'use strict';

/**
 * 分玩法本机排行
 * match = 表情大冲关，fuse = 表情合成，sudoku = 表情数独
 * spot = 表情找不同，match3 = 表情消消乐
 */
const KEY = 'tkc_rank_v2';
const MAX = 10;
const GAMES = ['match', 'fuse', 'sudoku', 'spot', 'match3'];

function _rawGet() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const v = wx.getStorageSync(KEY);
      if (v) return typeof v === 'string' ? JSON.parse(v) : v;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const s = localStorage.getItem(KEY);
      if (s) return JSON.parse(s);
    }
  } catch (e) { /* ignore */ }
  // 兼容旧版单一榜
  try {
    let legacy = null;
    if (typeof wx !== 'undefined' && wx.getStorageSync) legacy = wx.getStorageSync('tkc_rank_v1');
    if (!legacy && typeof localStorage !== 'undefined') {
      const s = localStorage.getItem('tkc_rank_v1');
      legacy = s ? JSON.parse(s) : null;
    }
    if (legacy && legacy.list) return { match: { list: legacy.list }, fuse: { list: [] }, sudoku: { list: [] } };
  } catch (e) { /* ignore */ }
  return { match: { list: [] }, fuse: { list: [] }, sudoku: { list: [] } };
}

function _rawSet(data) {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(KEY, data);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch (e) { /* ignore */ }
}

function _board(data, game) {
  const g = GAMES.indexOf(game) >= 0 ? game : 'match';
  if (!data[g] || !Array.isArray(data[g].list)) data[g] = { list: [] };
  return data[g];
}

function getList(game) {
  const data = _rawGet();
  const list = _board(data, game).list || [];
  return list.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, MAX);
}

function submit(game, score, meta) {
  meta = meta || {};
  const n = Math.max(0, Math.floor(score || 0));
  if (n <= 0) return getList(game);
  const data = _rawGet();
  const board = _board(data, game);
  board.list.push({
    score: n,
    level: meta.level || 0,
    at: Date.now(),
    tip: meta.tip || '',
  });
  board.list.sort((a, b) => b.score - a.score);
  board.list = board.list.slice(0, MAX);
  _rawSet(data);
  return board.list.slice();
}

const LABELS = {
  match: '表情大冲关',
  fuse: '表情合成',
  sudoku: '表情数独',
  spot: '表情找不同',
  match3: '表情消消乐',
};

module.exports = { getList, submit, MAX, GAMES, LABELS };
