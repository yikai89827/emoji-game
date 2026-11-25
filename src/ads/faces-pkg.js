'use strict';

/**
 * 加载表情资源分包（pkg-faces）
 * 浏览器预览无 wx.loadSubpackage 时直接视为已就绪
 */
let _loading = null;
let _ready = false;

function loadFacesPackage() {
  if (_ready) return Promise.resolve(true);
  if (_loading) return _loading;

  _loading = new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.loadSubpackage !== 'function') {
      _ready = true;
      resolve(true);
      return;
    }
    try {
      const task = wx.loadSubpackage({
        name: 'faces',
        success() {
          _ready = true;
          resolve(true);
        },
        fail(err) {
          console.warn('[faces-pkg] load fail', err);
          // 兜底：仍继续，避免卡死在启动（可能本地已有资源）
          _ready = true;
          resolve(false);
        },
      });
      if (task && task.onProgressUpdate) {
        task.onProgressUpdate(() => {});
      }
    } catch (e) {
      console.warn('[faces-pkg] exception', e);
      _ready = true;
      resolve(false);
    }
  });

  return _loading;
}

function isFacesPackageReady() {
  return _ready;
}

module.exports = {
  loadFacesPackage,
  isFacesPackageReady,
};
