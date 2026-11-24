'use strict';

/**
 * 生成简易欢乐 BGM / 消除音效（WAV，无第三方依赖）
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'audio');
const SR = 22050;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = clamp((samples[i] * 32767) | 0, -32768, 32767);
    buf.writeInt16LE(s, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  console.log('wrote', path.basename(file), (n / SR).toFixed(2) + 's');
}

function tone(freq, t, type) {
  const ph = 2 * Math.PI * freq * t;
  if (type === 'square') return Math.sin(ph) > 0 ? 1 : -1;
  if (type === 'tri') {
    const x = (freq * t) % 1;
    return x < 0.5 ? x * 4 - 1 : 3 - x * 4;
  }
  return Math.sin(ph);
}

function envADSR(t, dur, a, d, s, r) {
  if (t < 0 || t > dur) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  return s * (1 - (t - (dur - r)) / r);
}

/** 欢乐短旋律循环 BGM（约 8 秒） */
function makeBgm() {
  // C major pentatonic-ish cheerful arpeggio
  const scale = [262, 294, 330, 392, 440, 523, 587, 659];
  const melody = [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, 2];
  const bass = [0, 0, 4, 4, 0, 0, 5, 5];
  const beat = 0.22;
  const bars = 8;
  const dur = beat * melody.length * (bars / 4);
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const step = Math.floor(t / beat) % melody.length;
    const local = t % beat;
    const mf = scale[melody[step]];
    const bf = scale[bass[Math.floor(step / 2) % bass.length]] / 2;
    let v = 0;
    v += tone(mf, t, 'tri') * envADSR(local, beat, 0.01, 0.05, 0.45, 0.08) * 0.22;
    v += tone(mf * 2, t, 'sine') * envADSR(local, beat, 0.01, 0.04, 0.25, 0.1) * 0.1;
    v += tone(bf, t, 'square') * envADSR(local, beat * 2, 0.01, 0.08, 0.35, 0.12) * 0.08;
    // 轻鼓点
    if (local < 0.04 && step % 2 === 0) {
      v += (Math.random() * 2 - 1) * (1 - local / 0.04) * 0.18;
    }
    out[i] = v;
  }
  // soft loop fade edges
  const fade = Math.floor(SR * 0.05);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[n - 1 - i] *= i / fade;
  }
  return out;
}

/** 消除：上扬叮咚（纯音色，无噪声） */
function makeClear() {
  const notes = [523, 659, 784, 1046]; // C5 E5 G5 C6
  const dur = 0.55;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < notes.length; k++) {
      const st = k * 0.055;
      const lt = t - st;
      if (lt < 0) continue;
      v += tone(notes[k], lt, 'tri') * envADSR(lt, 0.35, 0.005, 0.06, 0.35, 0.15) * 0.28;
      v += tone(notes[k] * 2.01, lt, 'sine') * envADSR(lt, 0.28, 0.005, 0.05, 0.2, 0.12) * 0.12;
    }
    out[i] = v;
  }
  return out;
}

/** 合成合并：轻快琶音 */
function makeMerge() {
  const notes = [392, 494, 587, 740]; // G4 B4 D5 F#5
  const dur = 0.42;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < notes.length; k++) {
      const st = k * 0.045;
      const lt = t - st;
      if (lt < 0) continue;
      v += tone(notes[k], lt, 'sine') * envADSR(lt, 0.28, 0.004, 0.05, 0.3, 0.12) * 0.3;
      v += tone(notes[k] * 2, lt, 'tri') * envADSR(lt, 0.22, 0.004, 0.04, 0.2, 0.1) * 0.1;
    }
    out[i] = v;
  }
  return out;
}

/** 数独成行/列/宫：清脆钟琴 */
function makeChime() {
  const notes = [659, 880, 1175]; // E5 A5 D6
  const dur = 0.5;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < notes.length; k++) {
      const st = k * 0.07;
      const lt = t - st;
      if (lt < 0) continue;
      const e = envADSR(lt, 0.36, 0.002, 0.04, 0.25, 0.18);
      v += tone(notes[k], lt, 'sine') * e * 0.32;
      v += tone(notes[k] * 2.002, lt, 'sine') * e * 0.12;
    }
    out[i] = v;
  }
  return out;
}

/** 图鉴解锁：欢快礼花和弦 */
function makeUnlock() {
  const notes = [523, 659, 784, 1046, 1319]; // C5 E5 G5 C6 E6
  const dur = 0.85;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < notes.length; k++) {
      const st = 0.04 + k * 0.06;
      const lt = t - st;
      if (lt < 0) continue;
      const e = envADSR(lt, 0.5, 0.005, 0.06, 0.35, 0.22);
      v += tone(notes[k], lt, 'tri') * e * 0.22;
      v += tone(notes[k] * 2.01, lt, 'sine') * e * 0.1;
    }
    // 第二波
    if (t > 0.35) {
      const lt = t - 0.35;
      v += tone(784, lt, 'sine') * envADSR(lt, 0.4, 0.01, 0.08, 0.3, 0.2) * 0.18;
      v += tone(1175, lt, 'sine') * envADSR(lt, 0.35, 0.01, 0.07, 0.25, 0.18) * 0.14;
    }
    out[i] = v;
  }
  return out;
}

/** 点选轻点 */
function makeTap() {
  const dur = 0.08;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = tone(880 + t * 400, t, 'sine') * envADSR(t, dur, 0.002, 0.02, 0.2, 0.04) * 0.25;
  }
  return out;
}

/** 过关小扇子 */
function makeWin() {
  const notes = [392, 523, 659, 784, 1046];
  const dur = 0.9;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < notes.length; k++) {
      const st = 0.05 + k * 0.08;
      const lt = t - st;
      if (lt < 0) continue;
      v += tone(notes[k], lt, 'tri') * envADSR(lt, 0.4, 0.01, 0.08, 0.4, 0.2) * 0.22;
    }
    out[i] = v;
  }
  return out;
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
writeWav(path.join(OUT, 'bgm.wav'), makeBgm());
writeWav(path.join(OUT, 'clear.wav'), makeClear());
writeWav(path.join(OUT, 'tap.wav'), makeTap());
writeWav(path.join(OUT, 'win.wav'), makeWin());
writeWav(path.join(OUT, 'merge.wav'), makeMerge());
writeWav(path.join(OUT, 'chime.wav'), makeChime());
writeWav(path.join(OUT, 'unlock.wav'), makeUnlock());
console.log('done ->', OUT);
