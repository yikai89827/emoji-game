'use strict';

/**
 * 原生模板广告：全局只保留 1 个实例
 * - 切场景 destroy 再建（避免 hide 不支持 + LifeCycle:Show 监听泄漏）
 * - 无填充(1004)时进入冷却，不再狂建
 */
const AD_HEIGHT_EST = 108;
const FAIL_COOLDOWN_MS = 60000;

const UNITS = {
  home: 'adunit-d69241b164d60f8c',
  fuse: 'adunit-0d487f8ab2705710',
  sudoku: 'adunit-caed463a750d0b6a',
  spot: 'adunit-b0fd34af62236d8d', // 找不同底部
  match3: 'adunit-f516272b60b9b2bd', // 消消乐底部
  // 玩法 / 排行 / 更多 列表页共用
  list: 'adunit-bc7dd6aaea1d3e72',
};

/** @type {{ key: string, ad: any, visible: boolean } | null} */
let current = null;
/** @type {Record<string, number>} */
const failUntil = Object.create(null);
let creating = false;

function getWindowMetrics() {
  if (typeof wx === 'undefined' || !wx.getSystemInfoSync) {
    return { ww: 375, wh: 667, bottom: 0 };
  }
  const info = wx.getSystemInfoSync();
  const ww = info.windowWidth || info.screenWidth || 375;
  const wh = info.windowHeight || info.screenHeight || 667;
  const sa = info.safeArea || {};
  const bottomInset = Math.max(0, wh - (sa.bottom != null ? sa.bottom : wh));
  return { ww: ww, wh: wh, bottom: bottomInset, info: info };
}

function adBottomPad(m) {
  // 略贴底，减少广告下方空白
  return Math.max(0, (m.bottom || 0) - 2);
}

function reservedBottom() {
  const m = getWindowMetrics();
  return AD_HEIGHT_EST + adBottomPad(m) + 2;
}

function buildStyle() {
  const m = getWindowMetrics();
  const width = Math.min(m.ww - 16, 360);
  const left = Math.round((m.ww - width) / 2);
  const top = Math.round(m.wh - adBottomPad(m) - AD_HEIGHT_EST);
  return { left: left, top: top, width: width };
}

function safeDestroy(ad) {
  if (!ad) return;
  try {
    if (typeof ad.offError === 'function') ad.offError();
  } catch (e) { /* ignore */ }
  try {
    if (typeof ad.destroy === 'function') ad.destroy();
  } catch (e) { /* ignore */ }
}

function destroyCurrent() {
  if (!current) return;
  safeDestroy(current.ad);
  current = null;
  creating = false;
}

function applyStyle(ad) {
  if (!ad || !ad.style) return;
  try {
    const style = buildStyle();
    ad.style.left = style.left;
    ad.style.top = style.top;
    ad.style.width = style.width;
  } catch (e) { /* ignore */ }
}

function showBanner(key) {
  const unitId = UNITS[key];
  if (!unitId || typeof wx === 'undefined' || !wx.createCustomAd) return;

  // 已是当前位：只刷新位置 / 再 show，绝不重建
  if (current && current.key === key && current.ad) {
    applyStyle(current.ad);
    if (!current.visible) {
      current.ad
        .show()
        .then(() => {
          if (current && current.key === key) current.visible = true;
        })
        .catch(() => {
          if (current && current.key === key) current.visible = false;
        });
    }
    return;
  }

  // 冷却中（如 1004 无填充）
  if (failUntil[key] && Date.now() < failUntil[key]) return;

  if (creating) return;
  creating = true;

  // 换位：先彻底销毁旧实例，禁止 hide（部分状态不支持）
  destroyCurrent();

  let ad = null;
  try {
    ad = wx.createCustomAd({
      adUnitId: unitId,
      adIntervals: 30,
      style: buildStyle(),
    });
  } catch (e) {
    console.warn('[customAd:' + key + '] create fail', e);
    creating = false;
    failUntil[key] = Date.now() + FAIL_COOLDOWN_MS;
    return;
  }

  current = { key: key, ad: ad, visible: false };

  ad.onError((err) => {
    const code = err && err.errCode;
    console.warn('[customAd:' + key + ']', code, err && err.errMsg);
    // 1004 无广告等：冷却，销毁实例避免脏状态
    failUntil[key] = Date.now() + FAIL_COOLDOWN_MS;
    if (current && current.key === key) {
      safeDestroy(current.ad);
      current = null;
    }
    creating = false;
  });

  if (ad.onResize) {
    ad.onResize((res) => {
      if (!current || current.key !== key || !current.ad) return;
      try {
        const m = getWindowMetrics();
        const h = (res && res.height) || AD_HEIGHT_EST;
        current.ad.style.top = Math.round(m.wh - adBottomPad(m) - h);
      } catch (e) { /* ignore */ }
    });
  }

  ad
    .show()
    .then(() => {
      if (current && current.key === key) current.visible = true;
      creating = false;
    })
    .catch(() => {
      if (current && current.key === key) current.visible = false;
      creating = false;
    });
}

/** 兼容旧调用：不再 hide，切走时销毁 */
function hideBanner(key) {
  if (current && current.key === key) destroyCurrent();
}

function hideAll() {
  destroyCurrent();
}

function destroyBanner(key) {
  if (!key || (current && current.key === key)) destroyCurrent();
}

function showHomeBanner() {
  showBanner('home');
}
function hideHomeBanner() {
  hideBanner('home');
}
function destroyHomeBanner() {
  destroyBanner('home');
}

module.exports = {
  UNITS,
  AD_HEIGHT_EST,
  reservedBottom,
  showBanner,
  hideBanner,
  hideAll,
  destroyBanner,
  showHomeBanner,
  hideHomeBanner,
  destroyHomeBanner,
};
