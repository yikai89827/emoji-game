'use strict';

const IS_MINIGAME = typeof wx !== 'undefined' && !!wx.createCanvas;

let canvas;
let ctx;
let W = 0;
let H = 0;
let DPR = 1;
let SCALE = 1;
/** top = 内容区顶边（已避开状态栏+胶囊）；capsuleLeft = 胶囊左缘，顶栏右侧要让开 */
let SAFE = { top: 48, left: 12, right: 12, bottom: 18, capsuleLeft: 0 };

if (IS_MINIGAME) {
  canvas = wx.createCanvas();
  ctx = canvas.getContext('2d');
} else {
  canvas = document.getElementById('game') || document.createElement('canvas');
  if (!canvas.parentNode) document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
}

let _syncCd = 0;
function syncCanvas() {
  if (!IS_MINIGAME) return false;
  // 限频：避免每帧 getSystemInfo / 改 canvas 尺寸导致整屏闪烁
  _syncCd--;
  if (_syncCd > 0 && W > 0 && H > 0) return false;
  _syncCd = 30;

  const info = wx.getSystemInfoSync();
  DPR = info.pixelRatio || 1;
  let ww = info.windowWidth || info.screenWidth || 390;
  let wh = info.windowHeight || info.screenHeight || 844;
  // 竖屏：短边为宽
  if (ww > wh) {
    const t = ww;
    ww = wh;
    wh = t;
  }
  // 始终按设备像素比渲染，表情/UI 才清晰（上限 3 控内存）
  const px = Math.min(Math.max(DPR, 1), 3);
  const wantW = Math.max(1, Math.round(ww * px));
  const wantH = Math.max(1, Math.round(wh * px));
  if (Math.abs(canvas.width - wantW) > 2 || Math.abs(canvas.height - wantH) > 2) {
    try {
      canvas.width = wantW;
      canvas.height = wantH;
    } catch (e) { /* ignore */ }
  }
  const changed = W !== ww || H !== wh;
  W = ww;
  H = wh;
  SCALE = (canvas.width || wantW) / ww;
  readSafe(info, ww, wh);
  return changed;
}

function readSafe(info, ww, wh) {
  if (IS_MINIGAME) {
    info = info || wx.getSystemInfoSync();
    const sa = info.safeArea || {};
    const status = info.statusBarHeight || 0;
    // safeArea.top / statusBarHeight：先避开刘海与系统状态栏
    let top = Math.max(status, sa.top || 0, 20);
    let left = Math.max(10, sa.left || 0);
    let right = Math.max(10, (info.windowWidth || ww) - (sa.right != null ? sa.right : ww));
    let bottom = Math.max(16, (info.windowHeight || wh) - (sa.bottom != null ? sa.bottom : wh));
    let capsuleLeft = ww;

    // 微信右上角胶囊：整块顶栏必须落到 capsule.bottom 之下
    let capsuleBottom = 0;
    if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
      try {
        const m = wx.getMenuButtonBoundingClientRect();
        if (m && m.bottom > 0) {
          capsuleBottom = m.bottom;
          if (m.left > 0) capsuleLeft = m.left;
        }
      } catch (e) { /* ignore */ }
    }
    if (capsuleBottom > 0) {
      top = Math.max(top, capsuleBottom + 10);
    } else {
      // API 未就绪时的经验兜底：状态栏 + 胶囊行高
      top = Math.max(top, status + 48);
    }
    // 再保底，避免个别机型算出过小
    top = Math.max(top, 64);

    SAFE = {
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      capsuleLeft: capsuleLeft,
    };
    return;
  }
  SAFE = { top: 48, left: 12, right: 12, bottom: 20, capsuleLeft: ww || 390 };
}

function applySize() {
  if (IS_MINIGAME) {
    syncCanvas();
    return;
  }
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  readSafe();
}

const held = Object.create(null);
const pressedFrame = Object.create(null);
const pointer = { x: 0, y: 0, down: false, justPressed: false, justReleased: false };
const taps = [];

function toLocal(clientX, clientY) {
  if (IS_MINIGAME) return { x: clientX, y: clientY };
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top) * (H / r.height),
  };
}

function initInput() {
  if (!IS_MINIGAME) {
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.down = true;
      pointer.justPressed = true;
      taps.push({ x: p.x, y: p.y });
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointer.down) return;
      const p = toLocal(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
    });
    window.addEventListener('pointerup', () => {
      pointer.down = false;
      pointer.justReleased = true;
    });
    window.addEventListener('resize', () => applySize());
    return;
  }
  wx.onTouchStart((e) => {
    const t = e.touches[0];
    if (!t) return;
    const p = toLocal(t.clientX, t.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.down = true;
    pointer.justPressed = true;
    taps.push({ x: p.x, y: p.y });
  });
  wx.onTouchMove((e) => {
    const t = e.touches[0];
    if (!t) return;
    const p = toLocal(t.clientX, t.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
  });
  wx.onTouchEnd(() => {
    pointer.down = false;
    pointer.justReleased = true;
  });
  if (wx.onWindowResize) wx.onWindowResize(() => applySize());
}

function endFrame() {
  pointer.justPressed = false;
  pointer.justReleased = false;
  taps.length = 0;
  for (const k in pressedFrame) pressedFrame[k] = false;
}

function raf(cb) {
  if (canvas.requestAnimationFrame) return canvas.requestAnimationFrame(cb);
  return requestAnimationFrame(cb);
}

function startLoop(cb) {
  const tick = (t) => {
    cb(t);
    raf(tick);
  };
  raf(tick);
}

applySize();

module.exports = {
  IS_MINIGAME,
  canvas,
  ctx,
  get width() { return W; },
  get height() { return H; },
  get renderScale() { return IS_MINIGAME ? SCALE : DPR; },
  get safe() { return SAFE; },
  pointer,
  taps,
  applySize,
  syncCanvas,
  initInput,
  endFrame,
  raf,
  startLoop,
};
