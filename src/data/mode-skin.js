'use strict';

const { FACES, FACE_MAP } = require('./faces.js');

/** 外围可用色（明亮好认） */
const RING_COLORS = [
  'cream',
  'pink',
  'mint',
  'sky',
  'amber',
  'leaf',
  'cyanpink',
  'crimson',
  'grape',
  'navy',
];

/**
 * 合成链：前段日常 → 中段过渡 → 末尾固定愉悦压轴（大笑 / 红心等）
 */
const FUSE_EARLY = [
  'flat', 'bored', 'tired', 'sleep', 'blank', 'sideeye', 'anxious', 'ponder',
  'gasp', 'confuse', 'doubt', 'eyeroll', 'sigh', 'smirk', 'muted', 'worried',
];
const FUSE_MID = [
  'smile', 'wink', 'shy', 'blush', 'peace', 'cool', 'grin', 'wave', 'pose',
  'smug', 'cheeky', 'doggo', 'sprout', 'whistle', 'determined', 'fight',
];
/** 倒数第二档：甜一点 */
const FUSE_NEAR = ['love', 'kiss', 'sweet', 'hug', 'happy', 'sparkle', 'star', 'thumbsup'];
/** 最终档：必须是大笑类愉悦脸（每局终点必出其中之一） */
const FUSE_FINALE = ['joy', 'haha', 'rofl'];

const LADDER_LEN = 11;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function pickRingColor(prev) {
  const pool = RING_COLORS.filter((c) => c !== prev);
  const list = pool.length ? pool : RING_COLORS;
  return list[Math.floor(Math.random() * list.length)];
}

function faceLabel(id) {
  const f = FACE_MAP[id];
  return (f && f.name) || id;
}

function takeFrom(pool, n, used) {
  const out = [];
  const list = shuffle(pool.slice().filter((id) => !used[id] && FACE_MAP[id]));
  for (let i = 0; i < list.length && out.length < n; i++) {
    used[list[i]] = true;
    out.push({ face: list[i], label: faceLabel(list[i]) });
  }
  return out;
}

/** 生成一局合成阶梯：终点必为大笑类 */
function rollFuseLadder(prevColor) {
  const used = Object.create(null);
  const ladder = [];

  // 0～5 日常，6～8 过渡，9 甜美，10 大笑压轴
  ladder.push.apply(ladder, takeFrom(FUSE_EARLY, 6, used));
  ladder.push.apply(ladder, takeFrom(FUSE_MID, 3, used));
  ladder.push.apply(ladder, takeFrom(FUSE_NEAR, 1, used));

  // 最终一格：joy / haha / rofl 随机，保证是大笑
  const finale = shuffle(FUSE_FINALE.slice().filter((id) => FACE_MAP[id]));
  let endId = finale[0] || 'joy';
  for (let i = 0; i < finale.length; i++) {
    if (!used[finale[i]]) {
      endId = finale[i];
      break;
    }
  }
  used[endId] = true;
  ladder.push({ face: endId, label: faceLabel(endId) });

  while (ladder.length < LADDER_LEN) {
    const fill = takeFrom(FUSE_MID.concat(FUSE_EARLY), 1, used);
    if (!fill.length) break;
    // 插到倒数第二，保住终点
    ladder.splice(ladder.length - 1, 0, fill[0]);
  }

  return {
    ringColor: pickRingColor(prevColor),
    ladder: ladder.slice(0, LADDER_LEN),
  };
}

/** 数独：随机 9 表情 + 一色外围 */
function rollSudokuSkin(prevColor) {
  const ids = shuffle(
    FACES.filter((f) => !f.tint).map((f) => f.id)
  ).slice(0, 9);
  if (ids.length < 9) {
    const more = shuffle(FACES.map((f) => f.id));
    for (let i = 0; i < more.length && ids.length < 9; i++) {
      if (ids.indexOf(more[i]) < 0) ids.push(more[i]);
    }
  }
  return {
    ringColor: pickRingColor(prevColor),
    symbols: ids.map((id) => ({ face: id, name: faceLabel(id) })),
  };
}

module.exports = {
  RING_COLORS,
  LADDER_LEN,
  pickRingColor,
  rollFuseLadder,
  rollSudokuSkin,
};
