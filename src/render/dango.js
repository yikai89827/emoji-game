'use strict';

const { colorOf, faceOf } = require('../data/faces.js');
const { drawFace } = require('./faces-draw.js');
const { drawFaceSprite, getFaceImage, startLoad } = require('./face-sprites.js');

startLoad();

function shade(hex, amount) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function mixHex(a, b, t) {
  const parse = (hex) => {
    const n = hex.replace('#', '');
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };
  const A = parse(a);
  const B = parse(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

function strokeSelect(ctx, r, selected) {
  if (selected) {
    ctx.lineWidth = Math.max(3, r * 0.12);
    ctx.strokeStyle = '#ff6b9a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.02, r * 0.98, r * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.02, r + 5, r * 0.94 + 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,107,154,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.02, r * 0.98, r * 0.94, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.2, r * 0.04);
    ctx.strokeStyle = 'rgba(60,40,80,0.1)';
    ctx.stroke();
  }
}

/** 画一只团子：优先 AI 精致贴图，否则软萌身体 + 线稿五官 */
function drawDango(ctx, piece) {
  const faceMeta = faceOf(piece.face);
  const c = colorOf(piece.color);
  const r = piece.r;
  const x = piece.x;
  const y = piece.y;

  let fill = c.fill;
  if (faceMeta.tint) fill = mixHex(c.fill, faceMeta.tint, 0.72);

  ctx.save();
  ctx.translate(x, y);

  // 软阴影
  ctx.beginPath();
  ctx.ellipse(0, r * 0.78, r * 0.68, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,12,40,0.2)';
  ctx.fill();

  // 有精致贴图：完整圆形贴图 + 配色描边（全玩法共用，避免裁切残缺）
  if (getFaceImage(piece.face)) {
    ctx.beginPath();
    ctx.arc(0, r * 0.02, r * 0.98, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    drawFaceSprite(ctx, piece.face, r);
    ctx.lineWidth = Math.max(2.2, r * 0.09);
    ctx.strokeStyle = shade(fill, -18);
    ctx.beginPath();
    ctx.arc(0, r * 0.02, r * 0.97, 0, Math.PI * 2);
    ctx.stroke();
    strokeSelect(ctx, r, piece.selected);
    ctx.restore();
    return;
  }

  // 回退：立体球身 + 线稿五官
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.05, 0, r * 0.08, r * 1.05);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, mixHex('#ffffff', fill, 0.35));
  g.addColorStop(0.55, fill);
  g.addColorStop(1, shade(fill, -28));
  ctx.beginPath();
  ctx.ellipse(0, r * 0.02, r * 0.98, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  const gloss = ctx.createRadialGradient(-r * 0.28, -r * 0.42, 0, -r * 0.18, -r * 0.32, r * 0.42);
  gloss.addColorStop(0, 'rgba(255,255,255,0.72)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, -r * 0.34, r * 0.38, r * 0.26, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();

  strokeSelect(ctx, r, piece.selected);

  const skipBlush = faceMeta.id === 'heart' || faceMeta.id === 'broke' || faceMeta.id === 'lips';
  if (!skipBlush) {
    ctx.fillStyle = c.blush;
    ctx.globalAlpha = faceMeta.tint ? 0.22 : 0.42;
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, r * 0.14, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.4, r * 0.14, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawFace(ctx, piece.face, c.accent, r);
  ctx.restore();
}

module.exports = { drawDango };
