'use strict';

/**
 * 激励视频广告位（道具 / 复活各用独立 adunit）
 */
const AD_UNITS = {
  bomb: 'adunit-673e201c94ca804d', // 炸弹
  heart: 'adunit-a36998c12ec9d1db', // 清色
  time: 'adunit-e9e30a35a2081d48', // 加时
  hint: 'adunit-fdcb6c5c787a4ccf', // 提示
  revive: 'adunit-d8ecdffd194f0df0', // 复活
  // 表情合成
  fuseUndo: 'adunit-df179d75e63048a0', // 撤销
  fuseHammer: 'adunit-cf9ee3d5c850962b', // 消除
  fuseRevive: 'adunit-615407b2c455073a', // 续命
  // 表情数独
  sudokuHint: 'adunit-26d0afdfbf626145', // 提示
  sudokuReveal: 'adunit-f1588c6221d6a5e2', // 填 3 格
  sudokuWipe: 'adunit-93f82f2ea9954e05', // 清错
  sudokuErase: 'adunit-71ad0a3233bc41b1', // 擦除
  // 图鉴
  albumUnlock: 'adunit-338e6b0fbc79238c', // 解锁图鉴
  // 找不同
  spotHint: 'adunit-687e2e84ffb96b4f', // 不同提示
  spotTime: 'adunit-636fce73d158757c', // 不同延时
  // 消消乐
  match3Hint: 'adunit-74d6d37c41f6c5cc', // 消消乐提示
  match3Shuffle: 'adunit-08c4a2e25a08ccca', // 消消乐大乱
  match3Time: 'adunit-4a3aa19e9fffec17', // 消消乐加时
  match3Revive: 'adunit-9e52a722a3f40f2e', // 消消乐续命
};

const _ads = Object.create(null);
/** @type {Record<string, Function>} */
const _errorHandlers = Object.create(null);
let _busy = false;
let _preloaded = false;

function unitOf(reason) {
  return AD_UNITS[reason] || '';
}

function bindErrorOnce(ad, unitId) {
  if (!ad || _errorHandlers[unitId]) return;
  const onError = (err) => {
    console.warn('[rewarded]', unitId, err);
  };
  // 激励广告按 adUnitId 单例；先卸旧监听，避免重复 onError 警告
  try {
    if (typeof ad.offError === 'function') ad.offError();
  } catch (e) { /* ignore */ }
  try {
    ad.onError(onError);
    _errorHandlers[unitId] = onError;
  } catch (e) { /* ignore */ }
}

function ensureAd(unitId) {
  if (!unitId) return null;
  if (_ads[unitId]) return _ads[unitId];
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) return null;
  try {
    const ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    bindErrorOnce(ad, unitId);
    // 预加载
    try {
      ad.load().catch(() => {});
    } catch (e) { /* ignore */ }
    _ads[unitId] = ad;
    return ad;
  } catch (e) {
    console.warn('[rewarded] create fail', unitId, e);
    return null;
  }
}

/** 预创建各广告实例（进游戏时可调；全局只跑一次） */
function preloadAll() {
  if (_preloaded) return;
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) return;
  _preloaded = true;
  const keys = Object.keys(AD_UNITS);
  const seen = Object.create(null);
  for (let i = 0; i < keys.length; i++) {
    const id = AD_UNITS[keys[i]];
    if (!id || seen[id]) continue;
    seen[id] = 1;
    ensureAd(id);
  }
}

/**
 * @param {string} reason hint|time|bomb|heart|revive
 * @param {(ok:boolean, info?:string) => void} done
 */
function showRewarded(reason, done) {
  if (_busy) {
    done(false, 'busy');
    return;
  }
  _busy = true;
  const finish = (ok, info) => {
    _busy = false;
    try {
      done(!!ok, info);
    } catch (e) { /* ignore */ }
  };

  const unitId = unitOf(reason);
  const hasWxAd = typeof wx !== 'undefined' && !!wx.createRewardedVideoAd;

  // 浏览器预览 / 无微信广告 API：模拟成功，方便本地调试
  if (!hasWxAd) {
    setTimeout(() => finish(true, 'mock'), 80);
    return;
  }

  if (!unitId) {
    finish(false, 'no_unit');
    return;
  }

  const ad = ensureAd(unitId);
  if (!ad) {
    finish(false, 'unavailable');
    return;
  }

  let closed = false;
  const onClose = (res) => {
    if (closed) return;
    closed = true;
    try {
      ad.offClose(onClose);
    } catch (e) { /* ignore */ }
    // 仅完整看完才发奖
    const ended = !!(res && res.isEnded === true);
    finish(ended, ended ? 'ended' : 'skipped');
  };

  try {
    // 避免上次异常残留导致重复 onClose
    if (typeof ad.offClose === 'function') ad.offClose();
    ad.onClose(onClose);
  } catch (e) {
    finish(false, 'onclose_fail');
    return;
  }

  const show = () =>
    ad.show().catch(() =>
      ad
        .load()
        .then(() => ad.show())
        .catch((err) => {
          try {
            ad.offClose(onClose);
          } catch (e) { /* ignore */ }
          closed = true;
          console.warn('[rewarded] show fail', reason, err);
          finish(false, 'load_fail');
        })
    );

  show();
}

function isAdConfigured(reason) {
  if (reason) return !!unitOf(reason);
  const keys = Object.keys(AD_UNITS);
  for (let i = 0; i < keys.length; i++) {
    if (AD_UNITS[keys[i]]) return true;
  }
  return false;
}

module.exports = {
  showRewarded,
  preloadAll,
  isAdConfigured,
  AD_UNITS,
};
