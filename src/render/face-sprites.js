'use strict';

/**
 * 加载 AI 表情贴图，并缩到小画布缓存。
 * 按彩色脸本体取包围盒统一缩放，但留足边距，避免裁切后五官/外轮廓显示不全。
 */

const P = require('../platform.js');
const { FACES } = require('../data/faces.js');

// 与分包源图同档缓存，避免二次缩小再放大发糊
const SPRITE_HI = 320;
const FACE_DIR = 'pkg-faces/';
const cacheHi = Object.create(null);
let started = false;
let readyN = 0;

function makeOffscreen(w, h) {
  if (typeof wx !== 'undefined' && wx.createCanvas) {
    const c = wx.createCanvas();
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

function isMarginPixel(r, g, b, a) {
  if (a < 20) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (sat < 22 && max > 150) return true;
  if (max > 235 && sat < 40) return true;
  return false;
}

function isFacePixel(r, g, b, a) {
  if (a < 20) return false;
  if (isMarginPixel(r, g, b, a)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (sat >= 28) return true;
  if (max < 110) return true;
  return false;
}

function contentBounds(img) {
  const w = img.width || 0;
  const h = img.height || 0;
  if (!w || !h) return null;
  const tmp = makeOffscreen(Math.min(w, 512), Math.min(h, 512));
  if (!tmp) return null;
  const tw = tmp.width;
  const th = tmp.height;
  const tctx = tmp.getContext('2d');
  try {
    tctx.drawImage(img, 0, 0, tw, th);
    const data = tctx.getImageData(0, 0, tw, th).data;
    let minX = tw;
    let minY = th;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    const step = tw > 256 ? 2 : 1;
    for (let y = 0; y < th; y += step) {
      for (let x = 0; x < tw; x += step) {
        const i = (y * tw + x) * 4;
        if (!isFacePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!found) return null;

    const sx = w / tw;
    const sy = h / th;
    // 留足边距，避免泪滴、高光、外轮廓被裁掉
    const pad = Math.max(8, Math.floor(Math.min(w, h) * 0.04));
    const x0 = Math.max(0, Math.floor(minX * sx) - pad);
    const y0 = Math.max(0, Math.floor(minY * sy) - pad);
    const x1 = Math.min(w, Math.ceil((maxX + 1) * sx) + pad);
    const y1 = Math.min(h, Math.ceil((maxY + 1) * sy) + pad);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  } catch (e) {
    return null;
  }
}

function bakeSprite(img, size) {
  const S = size || SPRITE_HI;
  const c = makeOffscreen(S, S);
  if (!c) return img;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const box = contentBounds(img);
  if (!box || box.w < 8 || box.h < 8) {
    // 整图等比放入，不放大裁边
    const iw = img.width || S;
    const ih = img.height || S;
    const sc = Math.min(S / iw, S / ih) * 0.96;
    const dw = iw * sc;
    const dh = ih * sc;
    ctx.drawImage(img, 0, 0, iw, ih, (S - dw) / 2, (S - dh) / 2, dw, dh);
    return c;
  }

  // 正方形包围，再外扩一点，保证完整圆形脸
  const side0 = Math.max(box.w, box.h);
  const side = Math.min(
    Math.max(img.width || side0, img.height || side0),
    Math.ceil(side0 * 1.08)
  );
  let cx = box.x + box.w / 2;
  let cy = box.y + box.h / 2;
  let x = cx - side / 2;
  let y = cy - side / 2;
  const iw = img.width || side;
  const ih = img.height || side;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + side > iw) x = Math.max(0, iw - side);
  if (y + side > ih) y = Math.max(0, ih - side);
  const sw = Math.min(side, iw - x);
  const sh = Math.min(side, ih - y);

  const margin = S * 0.06;
  const fit = S - margin * 2;
  const zoom = fit / Math.max(sw, sh);
  const dw = sw * zoom;
  const dh = sh * zoom;
  ctx.drawImage(img, x, y, sw, sh, (S - dw) / 2, (S - dh) / 2, dw, dh);
  return c;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (P.IS_MINIGAME && typeof wx !== 'undefined' && wx.createImage) {
      const img = wx.createImage();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
      return;
    }
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function startLoad() {
  if (started) return;
  started = true;
  for (let i = 0; i < FACES.length; i++) {
    const id = FACES[i].id;
    const src = FACE_DIR + id + '.png';
    loadImage(src).then((img) => {
      if (!img) return;
      try {
        cacheHi[id] = bakeSprite(img, SPRITE_HI);
      } catch (e) {
        cacheHi[id] = img;
      }
      readyN++;
    });
  }
}

function getFaceImage(id) {
  return cacheHi[id] || null;
}

function readyCount() {
  return readyN;
}

function drawFaceSprite(ctx, faceId, r) {
  const img = cacheHi[faceId];
  if (!img) return false;
  ctx.save();
  if (ctx.imageSmoothingEnabled != null) ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  // 用略大的圆裁剪，避免外轮廓被硬切
  ctx.beginPath();
  ctx.arc(0, r * 0.02, r * 1.02, 0, Math.PI * 2);
  ctx.clip();
  const s = r * 2.02;
  ctx.drawImage(img, -s * 0.5, -s * 0.5 + r * 0.02, s, s);
  ctx.restore();
  return true;
}

module.exports = {
  startLoad,
  getFaceImage,
  drawFaceSprite,
  readyCount,
};
