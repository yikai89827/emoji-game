'use strict';

/**
 * 从图集提炼的全部表情（8×10）。
 * 团子萌系绘制见 render/faces-draw.js
 */
const FACES = [
  // —— 第 1 行 ——
  { id: 'smile', name: '憨笑' },
  { id: 'anxious', name: '紧张' },
  { id: 'love', name: '花痴' },
  { id: 'determined', name: '倔强' },
  { id: 'cool', name: '墨镜' },
  { id: 'sob', name: '大哭' },
  { id: 'peace', name: '安心' },
  { id: 'muted', name: '禁言' },
  { id: 'sleep', name: '睡着' },
  { id: 'tired', name: '疲惫' },
  // —— 第 2 行 ——
  { id: 'hot', name: '发烧' },
  { id: 'rage', name: '暴怒' },
  { id: 'wink', name: '吐舌' },
  { id: 'grin', name: '露齿' },
  { id: 'gasp', name: '吃惊' },
  { id: 'sad', name: '难过' },
  { id: 'worried', name: '担心' },
  { id: 'joy', name: '大笑' },
  { id: 'sick', name: '恶心' },
  { id: 'shy', name: '害羞' },
  // —— 第 3 行 ——
  { id: 'blush', name: '脸红' },
  { id: 'uplook', name: '仰望' },
  { id: 'sideeye', name: '斜视' },
  { id: 'flat', name: '无眼' },
  { id: 'mad', name: '恼火' },
  { id: 'haha', name: '哈哈' },
  { id: 'soldier', name: '士兵' },
  { id: 'curse', name: '骂骂' },
  { id: 'confuse', name: '困惑' },
  { id: 'shush', name: '嘘' },
  // —— 第 4 行 ——
  { id: 'dizzy', name: '晕眩' },
  { id: 'soot', name: '煤球', tint: '#3a3a4a' },
  { id: 'skull', name: '骷髅', tint: '#d5d0c8' },
  { id: 'search', name: '窥探' },
  { id: 'ponder', name: '沉思' },
  { id: 'smirk', name: '奸笑' },
  { id: 'bored', name: '无聊' },
  { id: 'plead', name: '可怜' },
  { id: 'teeth', name: '龇牙' },
  { id: 'cheeky', name: '得意' },
  // —— 第 5 行 ——
  { id: 'sneer', name: '冷笑' },
  { id: 'cry', name: '哭哭' },
  { id: 'downcast', name: '失落' },
  { id: 'smug', name: '满足' },
  { id: 'kiss', name: '飞吻' },
  { id: 'sparkle', name: '星星眼' },
  { id: 'happy', name: '开心' },
  { id: 'mask', name: '口罩' },
  { id: 'wow', name: '哇' },
  { id: 'rofl', name: '笑翻' },
  // —— 第 6 行 ——
  { id: 'scream', name: '惊恐' },
  { id: 'sigh', name: '释然' },
  { id: 'eyeroll', name: '翻白眼' },
  { id: 'wave', name: '挥手' },
  { id: 'lol', name: '笑哭' },
  { id: 'scheme', name: '坏笑' },
  { id: 'doubt', name: '怀疑' },
  { id: 'sweet', name: '甜笑' },
  { id: 'hug', name: '抱抱' },
  { id: 'munch', name: '啃啃' },
  // —— 第 7 行 ——
  { id: 'fight', name: '奋斗' },
  { id: 'blank', name: '面瘫' },
  { id: 'shock', name: '震惊' },
  { id: 'whistle', name: '吹口哨' },
  { id: 'arrogant', name: '傲娇' },
  { id: 'doggo', name: '柴犬' },
  { id: 'pose', name: '摆酷' },
  { id: 'slap', name: '捂脸' },
  { id: 'star', name: '星星' },
  { id: 'lookdown', name: '低头' },
  // —— 第 8 行 ——
  { id: 'liu', name: '666' },
  { id: 'peek', name: '偷看' },
  { id: 'freeze', name: '冻住' },
  { id: 'bawling', name: '泪崩' },
  { id: 'cracked', name: '裂开' },
  { id: 'lips', name: '嘴唇' },
  { id: 'heart', name: '爱心' },
  { id: 'broke', name: '碎心' },
  { id: 'sprout', name: '豆芽' },
  { id: 'thumbsup', name: '点赞' },
];

const FACE_MAP = Object.create(null);
for (let i = 0; i < FACES.length; i++) FACE_MAP[FACES[i].id] = FACES[i];

/**
 * 团子配色：浅色 + 深色搭配，方便辨认。
 * 第 1 关用强冲突三色（浅奶油 / 深红 / 青粉）。
 */
const COLORS = [
  // 浅色
  { id: 'cream', fill: '#fff1d6', blush: '#ffb4c4', accent: '#5b4636' },
  { id: 'pink', fill: '#ffd0e0', blush: '#ff8fb5', accent: '#6b2f45' },
  { id: 'mint', fill: '#c8f5e4', blush: '#7ad9b8', accent: '#1f5a48' },
  { id: 'sky', fill: '#c9e7ff', blush: '#7eb8f0', accent: '#1e4a6d' },
  // 冲突 / 深色
  { id: 'crimson', fill: '#c4183a', blush: '#ff6b8a', accent: '#2a0610' },
  { id: 'cyanpink', fill: '#3de0d0', blush: '#ff9ad0', accent: '#0a3d3a' },
  { id: 'navy', fill: '#243a6b', blush: '#7eb8f0', accent: '#dce6ff' },
  { id: 'grape', fill: '#5b2a8a', blush: '#e4b4ff', accent: '#f3e8ff' },
  { id: 'ink', fill: '#2a2438', blush: '#ff8fb5', accent: '#f0e8ff' },
  { id: 'amber', fill: '#f0a010', blush: '#ffd080', accent: '#4a2800' },
  // 首页侧栏同款绿（声音/玩法按钮色）
  { id: 'leaf', fill: '#3cc878', blush: '#7ad9b8', accent: '#0a3d28' },
];

/** 每关预置的高对比色组（浅+深冲突） */
const LEVEL_PALETTES = [
  ['cream', 'crimson', 'cyanpink'], // 1：奶油 / 深红 / 青粉
  ['pink', 'navy', 'amber'], // 2：浅粉 / 深蓝 / 琥珀
  ['mint', 'grape', 'cream'], // 3
  ['sky', 'ink', 'crimson'], // 4
  ['cream', 'navy', 'amber', 'cyanpink'], // 5
  ['pink', 'ink', 'mint', 'crimson'], // 6+
];

/** 全玩法统一视觉半径：不再出特别小的球，避免「裁切后显得残缺」 */
const SIZES = {
  S: { key: 'S', r: 30, mass: 1.0, label: '标准' },
  M: { key: 'M', r: 30, mass: 1.0, label: '标准' },
  L: { key: 'L', r: 30, mass: 1.0, label: '标准' },
};

const SIZE_KEYS = ['M'];
const CLEAR_SCORE = 100;
/** 单关最多同时出现的表情种数 */
const MAX_FACES_PER_LEVEL = 16;

/** 从 80 表情里均匀抽一批，避免连号长得太像 */
function pickFaces(levelIndex, count) {
  const n = FACES.length;
  const step = Math.max(1, Math.floor(n / count));
  const start = (levelIndex * 7) % n;
  const ids = [];
  const used = Object.create(null);
  for (let i = 0; i < count; i++) {
    let idx = (start + i * step) % n;
    let guard = 0;
    while (used[FACES[idx].id] && guard++ < n) idx = (idx + 1) % n;
    used[FACES[idx].id] = true;
    ids.push(FACES[idx].id);
  }
  return ids;
}

function levelConfig(levelIndex) {
  const lv = levelIndex + 1;
  // 第 1 关就 8 种，之后加到 16
  const faceCount = Math.min(MAX_FACES_PER_LEVEL, 8 + Math.floor(levelIndex * 1.2));
  const faceIds = pickFaces(levelIndex, faceCount);
  const palette = LEVEL_PALETTES[Math.min(levelIndex, LEVEL_PALETTES.length - 1)];
  const colorIds = palette.slice();
  // 有清一色后目标抬高，避免一道具过关
  const targetScore = 1200 + levelIndex * 500;
  // 每关约 3～5 分钟，越往后略加长（最低 2.5 分钟）
  const timeLimit = Math.min(300, Math.max(150, 180 + levelIndex * 12));
  return {
    level: lv,
    faces: faceIds,
    colors: colorIds,
    targetScore: targetScore,
    timeLimit: timeLimit,
    title: '第 ' + lv + ' 关',
  };
}

function colorOf(id) {
  for (let i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
  return COLORS[0];
}

function faceOf(id) {
  return FACE_MAP[id] || FACES[0];
}

module.exports = {
  FACES,
  FACE_MAP,
  COLORS,
  SIZES,
  SIZE_KEYS,
  CLEAR_SCORE,
  MAX_FACES_PER_LEVEL,
  levelConfig,
  colorOf,
  faceOf,
};
