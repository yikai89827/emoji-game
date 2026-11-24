'use strict';

/**
 * 简易每日任务（按自然日）
 */
const KEY = 'tkc_daily_tasks';

function todayKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function load() {
  let raw = null;
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) raw = wx.getStorageSync(KEY);
  } catch (e) { /* ignore */ }
  try {
    if (!raw && typeof localStorage !== 'undefined') {
      const s = localStorage.getItem(KEY);
      raw = s ? JSON.parse(s) : null;
    }
  } catch (e) { /* ignore */ }

  if (!raw || typeof raw !== 'object' || raw.day !== todayKey()) {
    return {
      day: todayKey(),
      wins: 0,
      props: 0,
      claimed: { win1: false, win3: false, prop1: false, prop3: false },
    };
  }
  if (!raw.claimed) raw.claimed = {};
  if (raw.claimed.prop3 == null) raw.claimed.prop3 = false;
  return raw;
}

function save(data) {
  data.day = todayKey();
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

function getState() {
  return load();
}

function addWin() {
  const d = load();
  d.wins = (d.wins | 0) + 1;
  save(d);
  return d;
}

function addPropUse() {
  const d = load();
  d.props = (d.props | 0) + 1;
  save(d);
  return d;
}

function claim(id) {
  const d = load();
  if (!d.claimed) d.claimed = {};
  d.claimed[id] = true;
  save(d);
  return d;
}

const TASKS = [
  { id: 'win1', title: '今日通关 1 局', need: (d) => (d.wins | 0) >= 1, tip: '+15 秒下次开局' },
  { id: 'win3', title: '今日通关 3 局', need: (d) => (d.wins | 0) >= 3, tip: '复活次数 +1' },
  { id: 'prop1', title: '使用 1 次道具', need: (d) => (d.props | 0) >= 1, tip: '开局提示就绪' },
  { id: 'prop3', title: '使用 3 次道具', need: (d) => (d.props | 0) >= 3, tip: '开局炸弹就绪' },
];

module.exports = {
  getState,
  addWin,
  addPropUse,
  claim,
  TASKS,
};
