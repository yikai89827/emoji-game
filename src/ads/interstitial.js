'use strict';

/**
 * 插屏广告
 * - interval：当天每通关满 3 次结算时（按自然日计数，非累计关卡号）
 * - resume：从暂停 / 最小化等恢复显示时
 */
const AD_UNITS = {
  interval: 'adunit-92f2d1a095014ef4',
  resume: 'adunit-40a938fc6f6ca071',
};

const STORAGE_KEY = 'tkc_daily_wins';

const _ads = Object.create(null);
let _resumeReady = false;
let _lastShowAt = 0;
const RESUME_COOLDOWN_MS = 25000;
/** 内存兜底（无 storage 的环境） */
let _memDaily = null;

function todayKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function storageGet(key) {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(key);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (e) { /* ignore */ }
  return key === STORAGE_KEY ? _memDaily : null;
}

function storageSet(key, val) {
  if (key === STORAGE_KEY) _memDaily = val;
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(key, val);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
  } catch (e) { /* ignore */ }
}

/** 当天已通关次数 */
function getDailyWinCount() {
  const raw = storageGet(STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return 0;
  if (raw.day !== todayKey()) return 0;
  return raw.n | 0;
}

/** 记录一次通关，返回当天累计次数 */
function recordDailyWin() {
  const day = todayKey();
  const prev = storageGet(STORAGE_KEY);
  let n = 0;
  if (prev && typeof prev === 'object' && prev.day === day) n = prev.n | 0;
  n += 1;
  storageSet(STORAGE_KEY, { day: day, n: n });
  return n;
}

function ensureAd(kind) {
  const unitId = AD_UNITS[kind];
  if (!unitId) return null;
  if (_ads[kind]) return _ads[kind];
  if (typeof wx === 'undefined' || !wx.createInterstitialAd) return null;
  try {
    const ad = wx.createInterstitialAd({ adUnitId: unitId });
    ad.onError((err) => {
      console.warn('[interstitial]', kind, err && err.errCode, err && err.errMsg);
    });
    _ads[kind] = ad;
    return ad;
  } catch (e) {
    console.warn('[interstitial] create fail', kind, e);
    return null;
  }
}

function preloadAll() {
  ensureAd('interval');
  ensureAd('resume');
}

function showInterstitial(kind) {
  if (typeof wx === 'undefined' || !wx.createInterstitialAd) {
    return Promise.resolve(false);
  }
  const ad = ensureAd(kind);
  if (!ad) return Promise.resolve(false);

  return ad
    .show()
    .then(() => {
      _lastShowAt = Date.now();
      return true;
    })
    .catch(() =>
      ad
        .load()
        .then(() => ad.show())
        .then(() => {
          _lastShowAt = Date.now();
          return true;
        })
        .catch((err) => {
          console.warn('[interstitial] show fail', kind, err);
          return false;
        })
    );
}

/**
 * 通关结算：当天第 3、6、9… 次过关弹间歇插屏
 */
function showIntervalOnWin() {
  const n = recordDailyWin();
  if (n <= 0 || n % 3 !== 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    setTimeout(() => {
      showInterstitial('interval').then(resolve);
    }, 480);
  });
}

function showResumeIfNeeded() {
  if (!_resumeReady) {
    _resumeReady = true;
    return Promise.resolve(false);
  }
  const now = Date.now();
  if (now - _lastShowAt < RESUME_COOLDOWN_MS) {
    return Promise.resolve(false);
  }
  return showInterstitial('resume');
}

function bindLifecycle() {
  if (typeof wx === 'undefined') return;
  if (typeof wx.onShow === 'function') {
    wx.onShow(() => {
      showResumeIfNeeded();
    });
  }
  if (typeof wx.onHide === 'function') {
    wx.onHide(() => {});
  }
}

module.exports = {
  AD_UNITS,
  preloadAll,
  showInterstitial,
  showIntervalOnWin,
  getDailyWinCount,
  recordDailyWin,
  showResumeIfNeeded,
  bindLifecycle,
};
