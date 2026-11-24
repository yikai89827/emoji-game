'use strict';

const { FACES } = require('./faces.js');

const KEY = 'tkc_album_v1';
const DAILY_AD_MAX = 3;

function todayKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function defaultUnlocked() {
  // 开局先送一批，避免图鉴全锁
  const set = Object.create(null);
  const starter = Math.min(12, FACES.length);
  for (let i = 0; i < starter; i++) set[FACES[i].id] = true;
  return set;
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

  if (!raw || typeof raw !== 'object') {
    return { unlocked: defaultUnlocked(), day: todayKey(), adUnlocks: 0 };
  }
  if (!raw.unlocked || typeof raw.unlocked !== 'object') raw.unlocked = defaultUnlocked();
  if (raw.day !== todayKey()) {
    raw.day = todayKey();
    raw.adUnlocks = 0;
  }
  if (raw.adUnlocks == null) raw.adUnlocks = 0;
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

function isUnlocked(faceId) {
  const d = load();
  return !!(d.unlocked && d.unlocked[faceId]);
}

function unlock(faceId) {
  if (!faceId) return false;
  const d = load();
  if (d.unlocked[faceId]) return false;
  d.unlocked[faceId] = true;
  save(d);
  return true;
}

/** 过关解锁本关出现过的表情 */
function unlockMany(faceIds) {
  if (!faceIds || !faceIds.length) return 0;
  const d = load();
  let n = 0;
  for (let i = 0; i < faceIds.length; i++) {
    const id = faceIds[i];
    if (!id || d.unlocked[id]) continue;
    d.unlocked[id] = true;
    n++;
  }
  if (n) save(d);
  return n;
}

function adUnlockLeft() {
  const d = load();
  return Math.max(0, DAILY_AD_MAX - (d.adUnlocks | 0));
}

/** 图鉴广告解锁（计入每日次数） */
function unlockByAd(faceId) {
  const d = load();
  if (d.unlocked[faceId]) return { ok: false, reason: 'already' };
  if ((d.adUnlocks | 0) >= DAILY_AD_MAX) return { ok: false, reason: 'limit' };
  d.unlocked[faceId] = true;
  d.adUnlocks = (d.adUnlocks | 0) + 1;
  save(d);
  return { ok: true, left: DAILY_AD_MAX - d.adUnlocks };
}

function unlockedCount() {
  const d = load();
  let n = 0;
  for (const k in d.unlocked) if (d.unlocked[k]) n++;
  return n;
}

module.exports = {
  FACES,
  DAILY_AD_MAX,
  isUnlocked,
  unlock,
  unlockMany,
  unlockByAd,
  adUnlockLeft,
  unlockedCount,
};
