'use strict';

/**
 * 微信小游戏版本更新检测
 * - 冷启动由微信自动检查；有新包时下载完成后提示重启
 * - 开发者工具 / 非微信环境静默跳过
 */
const APP_VERSION = '1.0.0';

function bindUpdateCheck() {
  if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') return;

  let manager;
  try {
    manager = wx.getUpdateManager();
  } catch (e) {
    console.warn('[update] getUpdateManager fail', e);
    return;
  }
  if (!manager) return;

  if (typeof manager.onCheckForUpdate === 'function') {
    manager.onCheckForUpdate((res) => {
      if (res && res.hasUpdate) {
        console.log('[update] 发现新版本，下载中…');
      }
    });
  }

  if (typeof manager.onUpdateReady === 'function') {
    manager.onUpdateReady(() => {
      const ask = () => {
        if (typeof wx.showModal !== 'function') {
          try {
            manager.applyUpdate();
          } catch (e) { /* ignore */ }
          return;
        }
        wx.showModal({
          title: '发现新版本',
          content: '新内容已准备好，重启后即可体验最新玩法与修复。',
          confirmText: '立即重启',
          cancelText: '稍后',
          success(res) {
            if (res && res.confirm) {
              try {
                manager.applyUpdate();
              } catch (e) {
                console.warn('[update] applyUpdate fail', e);
              }
            }
          },
        });
      };
      ask();
    });
  }

  if (typeof manager.onUpdateFailed === 'function') {
    manager.onUpdateFailed(() => {
      console.warn('[update] 新版本下载失败');
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '更新失败，请稍后重试',
          icon: 'none',
          duration: 2500,
        });
      } else if (typeof wx.showModal === 'function') {
        wx.showModal({
          title: '更新失败',
          content: '新版本下载失败，可删除小游戏后重新进入再试。',
          showCancel: false,
          confirmText: '知道了',
        });
      }
    });
  }
}

module.exports = {
  APP_VERSION,
  bindUpdateCheck,
};
