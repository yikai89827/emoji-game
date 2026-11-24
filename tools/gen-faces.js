'use strict';

/**
 * 用阿里云百炼文生图生成精致表情贴图。
 *
 * 注意：qwen-mt-image-2.0 是「图片翻译」，不能文生表情。
 * 本脚本默认用 wan2.7-image（新人约 50 张免费额度）。
 *
 * 用法：
 *   set DASHSCOPE_API_KEY=sk-xxx
 *   node tools/gen-faces.js
 *   node tools/gen-faces.js --model qwen-image-2.1-turbo --limit 10
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'faces');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const FACES = require('../src/data/faces.js').FACES;

const API_KEY = process.env.DASHSCOPE_API_KEY || '';
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return def;
}
const MODEL = arg('--model', 'wan2.7-image');
const LIMIT = parseInt(arg('--limit', String(FACES.length)), 10);
const SIZE = arg('--size', '1024*1024');
const START = parseInt(arg('--start', '0'), 10);
const DELAY_MS = parseInt(arg('--delay', '1200'), 10);

/** 表情英文描述，保证风格统一 */
const PROMPTS = {
  smile: 'grinning face with smiling eyes, open mouth showing white teeth and tongue, soft curved eyebrows',
  anxious: 'anxious worried face, sweat drop, tense mouth',
  love: 'smiling face with heart-shaped eyes',
  determined: 'determined face, furrowed brows, firm straight mouth',
  cool: 'smiling face with sunglasses',
  sob: 'loudly crying face with streams of tears',
  peace: 'relieved smiling face, closed smiling eyes, calm',
  muted: 'face with zipper mouth',
  sleep: 'sleeping face with zzz',
  tired: 'tired yawning face',
  hot: 'hot face with tongue out, flushed red cheeks',
  rage: 'pouting angry red face',
  wink: 'winking face with tongue out',
  grin: 'beaming face with smiling eyes, big grin teeth',
  gasp: 'face with open mouth, surprised',
  sad: 'slightly frowning sad face',
  worried: 'worried face, raised eyebrows',
  joy: 'face with tears of joy, laughing',
  sick: 'nauseated green face',
  shy: 'shy smiling face covering mouth with hands',
  blush: 'smiling face with blushing cheeks',
  uplook: 'face looking up thoughtfully',
  sideeye: 'unamused face looking sideways',
  flat: 'expressionless face, flat eyes and mouth',
  mad: 'angry face, scowling',
  haha: 'grinning squinting face laughing hard',
  soldier: 'face with military helmet, serious',
  curse: 'face with symbols on mouth, swearing',
  confuse: 'confused face with question mark',
  shush: 'shushing face with finger on lips',
  dizzy: 'dizzy face with spiral eyes',
  soot: 'smiling face covered in soot, dark gray ash',
  skull: 'cute stylized skull emoji face',
  search: 'face with monocle looking closely',
  ponder: 'thinking face with hand on chin',
  smirk: 'smirking face',
  bored: 'bored face, half-closed eyes',
  plead: 'pleading face with big shiny eyes',
  teeth: 'grimacing face showing clenched teeth',
  cheeky: 'smirking cheeky face',
  sneer: 'sneering face',
  cry: 'crying face with single tear',
  downcast: 'disappointed downcast face',
  smug: 'smug satisfied smiling face',
  kiss: 'face blowing a kiss with heart',
  sparkle: 'star-struck face with star eyes',
  happy: 'happy grinning face with smiling eyes',
  mask: 'face with medical mask',
  wow: 'astonished wow face',
  rofl: 'rolling on the floor laughing face',
  scream: 'face screaming in fear',
  sigh: 'relieved sighing face',
  eyeroll: 'face with rolling eyes',
  wave: 'smiling face waving hand',
  lol: 'laughing face with tears of joy',
  scheme: 'scheming smirking face',
  doubt: 'face with raised eyebrow, skeptical',
  sweet: 'sweet gentle smiling face with blush',
  hug: 'smiling face with open hands hugging',
  munch: 'face savoring food, yum',
  fight: 'determined fighting face, flexed',
  blank: 'neutral blank face',
  shock: 'shocked face with wide eyes',
  whistle: 'whistling face',
  arrogant: 'arrogant smug face looking away',
  doggo: 'cute shiba inu dog face emoji style',
  pose: 'cool posing face',
  slap: 'facepalm face',
  star: 'glowing yellow star character face',
  lookdown: 'face looking down shyly',
  liu: 'excited face with 666 vibe, thumbs up energy',
  peek: 'face peeking with one eye',
  freeze: 'freezing cold face with blue tint',
  bawling: 'loudly bawling crying face',
  cracked: 'cracked broken face emoji',
  lips: 'kiss mark lips emoji',
  heart: 'red heart emoji glossy',
  broke: 'broken heart emoji',
  sprout: 'seedling sprout emoji cute',
  thumbsup: 'thumbs up hand emoji glossy',
};

function stylePrompt(face) {
  const detail = PROMPTS[face.id] || `${face.name} emoji expression`;
  return [
    'Premium glossy 3D emoji sticker, Apple-style high quality',
    detail,
    'smooth plastic-like yellow-orange gradient skin with soft specular highlight on top',
    'centered composition, single subject, clean soft light gray background',
    'no text, no watermark, no frame, no card, ultra refined, cute, sharp details',
  ].join(', ');
}

function requestJson(body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'dashscope.aliyuncs.com',
        path: '/api/v1/services/aigc/multimodal-generation/generation',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            return reject(new Error('非 JSON 响应: ' + data.slice(0, 200)));
          }
          if (res.statusCode >= 400 || json.code) {
            const err = new Error(json.message || json.code || ('HTTP ' + res.statusCode));
            err.payload = json;
            err.status = res.statusCode;
            return reject(err);
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error('下载失败 HTTP ' + res.statusCode));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          fs.writeFileSync(dest, Buffer.concat(chunks));
          resolve(dest);
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function genOne(face) {
  const prompt = stylePrompt(face);
    const isWan = MODEL.indexOf('wan') === 0;
  const isZ = MODEL.indexOf('z-image') === 0;
  let parameters;
  if (isWan) {
    parameters = { size: SIZE, n: 1, thinking_mode: true };
  } else if (isZ) {
    parameters = { size: SIZE, n: 1 };
  } else {
    parameters = { size: SIZE, n: 1, prompt_extend: true };
  }
  const body = {
    model: MODEL,
    input: {
      messages: [{ role: 'user', content: [{ text: prompt }] }],
    },
    parameters,
  };
  const result = await requestJson(body);
  const content = ((((result.output || {}).choices || [])[0] || {}).message || {}).content || [];
  const img = content.find((c) => c.image || c.type === 'image');
  const url = img && (img.image || img.url);
  if (!url) throw new Error('响应无图片 URL: ' + JSON.stringify(result).slice(0, 400));
  const file = path.join(OUT_DIR, face.id + '.png');
  await download(url, file);
  return { id: face.id, name: face.name, file: 'assets/faces/' + face.id + '.png', model: MODEL };
}

async function main() {
  if (!API_KEY) {
    console.error('请先设置环境变量 DASHSCOPE_API_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const list = FACES.slice(START, START + LIMIT);
  console.log('模型:', MODEL);
  console.log('输出:', OUT_DIR);
  console.log('数量:', list.length, '(from', START + ')');
  console.log('说明: qwen-mt-image-2.0 只能翻译图片文字，已改用文生图模型。');

  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { faces: {} };
  manifest.model = MODEL;
  manifest.updatedAt = new Date().toISOString();

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < list.length; i++) {
    const face = list[i];
    const out = path.join(OUT_DIR, face.id + '.png');
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) {
      console.log(`[跳过] ${face.id} 已存在`);
      manifest.faces[face.id] = {
        id: face.id,
        name: face.name,
        file: 'assets/faces/' + face.id + '.png',
        model: MODEL,
      };
      ok++;
      continue;
    }
    process.stdout.write(`[${i + 1}/${list.length}] ${face.id} ${face.name} ... `);
    try {
      const meta = await genOne(face);
      manifest.faces[face.id] = meta;
      ok++;
      console.log('OK');
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    } catch (e) {
      fail++;
      console.log('FAIL', e.message);
      if (/Arrearage|FreeQuota|quota|额度|Throttling|Insufficient/i.test(e.message + JSON.stringify(e.payload || {}))) {
        console.error('额度不足或限流，已停止。已成功:', ok);
        break;
      }
    }
    if (i < list.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('完成: 成功', ok, '失败', fail);
  console.log('清单:', MANIFEST);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
