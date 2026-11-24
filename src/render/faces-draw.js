'use strict';

/**
 * 团子精致五官：立体 emoji 风弯眼 / 露齿 / 细眉。
 * 约定：已 translate 到团子中心，r 为半径，ink 为描边色。
 */

function lw(r, k) {
  return Math.max(1.4, r * (k == null ? 0.07 : k));
}

function setInk(ctx, ink, r, k) {
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw(r, k);
}

function dotEyes(ctx, r, y, s, dx) {
  y = y == null ? -r * 0.1 : y;
  s = s == null ? r * 0.075 : s;
  dx = dx == null ? r * 0.22 : dx;
  ctx.beginPath();
  ctx.arc(-dx, y, s, 0, Math.PI * 2);
  ctx.arc(dx, y, s, 0, Math.PI * 2);
  ctx.fill();
}

function ovalEyes(ctx, r, y, rx, ry, dx) {
  y = y == null ? -r * 0.1 : y;
  rx = rx == null ? r * 0.1 : rx;
  ry = ry == null ? r * 0.12 : ry;
  dx = dx == null ? r * 0.22 : dx;
  ctx.beginPath();
  ctx.ellipse(-dx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(dx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function lineEyes(ctx, r, y, w) {
  y = y == null ? -r * 0.08 : y;
  w = w == null ? r * 0.14 : w;
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, y);
  ctx.lineTo(-r * 0.28 + w, y);
  ctx.moveTo(r * 0.28 - w, y);
  ctx.lineTo(r * 0.28, y);
  ctx.stroke();
}

function arcMouth(ctx, r, y, rad, a0, a1) {
  y = y == null ? r * 0.12 : y;
  rad = rad == null ? r * 0.18 : rad;
  a0 = a0 == null ? 0.15 * Math.PI : a0;
  a1 = a1 == null ? 0.85 * Math.PI : a1;
  ctx.beginPath();
  ctx.arc(0, y, rad, a0, a1);
  ctx.stroke();
}

function frownMouth(ctx, r) {
  ctx.beginPath();
  ctx.arc(0, r * 0.28, r * 0.16, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
}

function oMouth(ctx, r, y, s) {
  y = y == null ? r * 0.16 : y;
  s = s == null ? r * 0.08 : s;
  ctx.beginPath();
  ctx.arc(0, y, s, 0, Math.PI * 2);
  ctx.fill();
}

function sweatDrop(ctx, r, x, y) {
  x = x == null ? r * 0.42 : x;
  y = y == null ? -r * 0.35 : y;
  ctx.fillStyle = '#6ec8ff';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.07, r * 0.13, 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function tear(ctx, r, x, y, h) {
  ctx.fillStyle = '#7ec8ff';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.05, h || r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokeX(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s, y - s);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s);
  ctx.lineTo(x - s, y + s);
  ctx.stroke();
}

function brow(ctx, r, angry) {
  ctx.beginPath();
  if (angry) {
    ctx.moveTo(-r * 0.34, -r * 0.28);
    ctx.lineTo(-r * 0.12, -r * 0.18);
    ctx.moveTo(r * 0.34, -r * 0.28);
    ctx.lineTo(r * 0.12, -r * 0.18);
  } else {
    ctx.moveTo(-r * 0.34, -r * 0.22);
    ctx.lineTo(-r * 0.12, -r * 0.26);
    ctx.moveTo(r * 0.34, -r * 0.22);
    ctx.lineTo(r * 0.12, -r * 0.26);
  }
  ctx.stroke();
}

function handBlob(ctx, r, x, y, s) {
  ctx.fillStyle = '#ffe0c8';
  ctx.beginPath();
  ctx.ellipse(x, y, s || r * 0.14, (s || r * 0.14) * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,40,0.25)';
  ctx.lineWidth = lw(r, 0.04);
  ctx.stroke();
}

function starEye(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    const r1 = s;
    const r2 = s * 0.4;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    else ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
  }
  ctx.closePath();
  ctx.fill();
}

function heartShape(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.9, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.9, y - s, x + s, y - s * 0.2, x, y + s * 0.35);
  ctx.fill();
}

/** 精致弯月笑眼（参考「憨笑」表情） */
function crescentEyes(ctx, ink, r, y) {
  y = y == null ? -r * 0.08 : y;
  setInk(ctx, ink, r, 0.085);
  ctx.beginPath();
  ctx.arc(-r * 0.22, y, r * 0.11, 1.12 * Math.PI, 1.88 * Math.PI);
  ctx.arc(r * 0.22, y, r * 0.11, 1.12 * Math.PI, 1.88 * Math.PI);
  ctx.stroke();
}

/** 精致露齿大笑嘴 */
function grinMouth(ctx, ink, r) {
  const y = r * 0.05;
  const rw = r * 0.3;
  const rh = r * 0.22;
  // 嘴型外轮廓
  ctx.beginPath();
  ctx.moveTo(-rw, y);
  ctx.quadraticCurveTo(-rw * 1.05, y + rh * 0.9, 0, y + rh * 1.15);
  ctx.quadraticCurveTo(rw * 1.05, y + rh * 0.9, rw, y);
  ctx.quadraticCurveTo(0, y + rh * 0.15, -rw, y);
  ctx.closePath();
  ctx.fillStyle = '#4a281f';
  ctx.fill();
  // 上排牙齿
  ctx.fillStyle = '#fffdf8';
  ctx.beginPath();
  ctx.moveTo(-rw * 0.86, y + rh * 0.02);
  ctx.quadraticCurveTo(0, y - rh * 0.02, rw * 0.86, y + rh * 0.02);
  ctx.lineTo(rw * 0.86, y + rh * 0.38);
  ctx.quadraticCurveTo(0, y + rh * 0.48, -rw * 0.86, y + rh * 0.38);
  ctx.closePath();
  ctx.fill();
  // 齿缝
  ctx.strokeStyle = 'rgba(90,50,40,0.28)';
  ctx.lineWidth = Math.max(0.8, r * 0.025);
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    const tx = (i / 2.6) * rw * 0.7;
    ctx.moveTo(tx, y + rh * 0.05);
    ctx.lineTo(tx, y + rh * 0.36);
  }
  ctx.stroke();
  // 舌尖
  ctx.fillStyle = '#ff6b8a';
  ctx.beginPath();
  ctx.ellipse(0, y + rh * 0.82, rw * 0.32, rh * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  // 嘴线描边
  setInk(ctx, ink, r, 0.055);
  ctx.beginPath();
  ctx.moveTo(-rw, y);
  ctx.quadraticCurveTo(-rw * 1.05, y + rh * 0.9, 0, y + rh * 1.15);
  ctx.quadraticCurveTo(rw * 1.05, y + rh * 0.9, rw, y);
  ctx.stroke();
}

/** 细弯眉 */
function softBrows(ctx, ink, r) {
  setInk(ctx, ink, r, 0.05);
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.28, r * 0.1, 1.2 * Math.PI, 1.75 * Math.PI);
  ctx.arc(r * 0.22, -r * 0.28, r * 0.1, 1.25 * Math.PI, 1.8 * Math.PI);
  ctx.stroke();
}

/** 各表情绘制表 */
const DRAW = {
  smile(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    grinMouth(ctx, ink, r);
  },

  anxious(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.08, r * 0.09, r * 0.11);
    oMouth(ctx, r, r * 0.18, r * 0.06);
    sweatDrop(ctx, r);
  },

  love(ctx, ink, r) {
    setInk(ctx, '#ff5a7a', r);
    heartShape(ctx, -r * 0.22, -r * 0.08, r * 0.14);
    heartShape(ctx, r * 0.22, -r * 0.08, r * 0.14);
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.18);
    ctx.quadraticCurveTo(0, r * 0.32, r * 0.12, r * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#7ec8ff';
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.28, r * 0.05, r * 0.1, 0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  determined(ctx, ink, r) {
    setInk(ctx, ink, r);
    brow(ctx, r, true);
    dotEyes(ctx, r, -r * 0.06, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, r * 0.18);
    ctx.lineTo(r * 0.16, r * 0.18);
    ctx.stroke();
  },

  cool(ctx, ink, r) {
    setInk(ctx, ink, r);
    // 墨镜
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.06, r * 0.16, r * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.22, -r * 0.06, r * 0.16, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw(r, 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.06, -r * 0.06);
    ctx.lineTo(r * 0.06, -r * 0.06);
    ctx.stroke();
    setInk(ctx, ink, r);
    arcMouth(ctx, r, r * 0.2, r * 0.14, 0.2 * Math.PI, 0.8 * Math.PI);
  },

  sob(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.12, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.12, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    oMouth(ctx, r, r * 0.2, r * 0.1);
    tear(ctx, r, -r * 0.32, r * 0.05, r * 0.22);
    tear(ctx, r, r * 0.32, r * 0.05, r * 0.22);
  },

  peace(ctx, ink, r) {
    crescentEyes(ctx, ink, r, -r * 0.06);
    setInk(ctx, ink, r);
    arcMouth(ctx, r, r * 0.14, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
  },

  muted(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r);
    ctx.fillStyle = '#f0e8ff';
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw(r, 0.05);
    const mx = -r * 0.22;
    const my = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + r * 0.44, my - r * 0.06);
    ctx.lineTo(mx + r * 0.44, my + r * 0.14);
    ctx.lineTo(mx, my + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },

  sleep(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r);
    ctx.font = 'bold ' + Math.round(r * 0.38) + 'px sans-serif';
    ctx.globalAlpha = 0.7;
    ctx.fillText('z', r * 0.32, -r * 0.42);
    ctx.globalAlpha = 1;
  },

  tired(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.1, r * 0.16);
    frownMouth(ctx, r);
    tear(ctx, r, r * 0.3, r * 0.02, r * 0.14);
  },

  hot(ctx, ink, r) {
    setInk(ctx, ink, r);
    // 红晕脸：X 眼 + 张嘴
    strokeX(ctx, -r * 0.2, -r * 0.08, r * 0.09);
    strokeX(ctx, r * 0.2, -r * 0.08, r * 0.09);
    oMouth(ctx, r, r * 0.18, r * 0.09);
    sweatDrop(ctx, r, r * 0.4, -r * 0.4);
    ctx.fillStyle = 'rgba(255,100,80,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, r * 0.1, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.38, r * 0.1, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  rage(ctx, ink, r) {
    setInk(ctx, ink, r, 0.08);
    brow(ctx, r, true);
    ovalEyes(ctx, r, -r * 0.05, r * 0.1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, r * 0.2);
    ctx.lineTo(r * 0.14, r * 0.14);
    ctx.lineTo(-r * 0.06, r * 0.28);
    ctx.closePath();
    ctx.fill();
  },

  wink(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.22, -r * 0.08, r * 0.1, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    // 吐舌
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#ff8fb5';
    ctx.beginPath();
    ctx.ellipse(r * 0.06, r * 0.28, r * 0.08, r * 0.1, 0.2, 0, Math.PI * 2);
    ctx.fill();
  },

  grin(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    grinMouth(ctx, ink, r);
  },

  gasp(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.12, r * 0.12, r * 0.14);
    oMouth(ctx, r, r * 0.2, r * 0.11);
  },

  sad(ctx, ink, r) {
    setInk(ctx, ink, r);
    brow(ctx, r, false);
    dotEyes(ctx, r, -r * 0.06);
    frownMouth(ctx, r);
  },

  worried(ctx, ink, r) {
    setInk(ctx, ink, r);
    brow(ctx, r, false);
    ovalEyes(ctx, r, -r * 0.08, r * 0.1, r * 0.12);
    oMouth(ctx, r, r * 0.2, r * 0.07);
    sweatDrop(ctx, r);
  },

  joy(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r, -r * 0.06);
    grinMouth(ctx, ink, r);
    tear(ctx, r, -r * 0.4, -r * 0.02, r * 0.12);
    tear(ctx, r, r * 0.4, -r * 0.02, r * 0.12);
  },

  sick(ctx, ink, r) {
    setInk(ctx, ink, r);
    strokeX(ctx, -r * 0.2, -r * 0.08, r * 0.09);
    strokeX(ctx, r * 0.2, -r * 0.08, r * 0.09);
    oMouth(ctx, r, r * 0.18, r * 0.07);
    ctx.fillStyle = '#7fd4ff';
    ctx.fillRect(-r * 0.28, -r * 0.55, r * 0.56, r * 0.16);
    ctx.fillStyle = 'rgba(120,200,120,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.2, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  shy(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.1, r * 0.08, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.1, r * 0.08, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
    handBlob(ctx, r, 0, r * 0.22, r * 0.2);
  },

  blush(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    setInk(ctx, ink, r);
    arcMouth(ctx, r, r * 0.14, r * 0.16);
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, r * 0.08, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.36, r * 0.08, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  uplook(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.2, r * 0.07, r * 0.18);
    // 高光瞳孔偏上
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.24, r * 0.025, 0, Math.PI * 2);
    ctx.arc(r * 0.18, -r * 0.24, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
    setInk(ctx, ink, r);
    oMouth(ctx, r, r * 0.14, r * 0.05);
  },

  sideeye(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.ellipse(-r * 0.18, -r * 0.08, r * 0.1, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.26, -r * 0.08, r * 0.1, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.14, -r * 0.08, r * 0.03, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.08, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.18);
    ctx.quadraticCurveTo(r * 0.05, r * 0.22, r * 0.18, r * 0.14);
    ctx.stroke();
  },

  flat(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.06, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.18);
    ctx.lineTo(r * 0.12, r * 0.18);
    ctx.stroke();
  },

  mad(ctx, ink, r) {
    setInk(ctx, ink, r);
    brow(ctx, r, true);
    strokeX(ctx, -r * 0.2, -r * 0.02, r * 0.08);
    strokeX(ctx, r * 0.2, -r * 0.02, r * 0.08);
    oMouth(ctx, r, r * 0.22, r * 0.1);
  },

  haha(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    grinMouth(ctx, ink, r);
  },

  soldier(ctx, ink, r) {
    // 小钢盔
    ctx.fillStyle = '#5a8f4a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.55, r * 0.28, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 0.18);
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.02);
    arcMouth(ctx, r, r * 0.18, r * 0.14);
  },

  curse(ctx, ink, r) {
    setInk(ctx, ink, r);
    brow(ctx, r, true);
    ovalEyes(ctx, r, -r * 0.05, r * 0.09, r * 0.08);
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold ' + Math.round(r * 0.28) + 'px sans-serif';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('#', r * 0.32, -r * 0.4);
  },

  confuse(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r);
    oMouth(ctx, r, r * 0.18, r * 0.05);
    ctx.font = 'bold ' + Math.round(r * 0.42) + 'px sans-serif';
    ctx.fillText('?', r * 0.28, -r * 0.38);
  },

  shush(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.12);
    handBlob(ctx, r, 0, r * 0.18, r * 0.12);
    ctx.font = 'bold ' + Math.round(r * 0.22) + 'px sans-serif';
    setInk(ctx, ink, r);
    ctx.fillText('嘘', r * 0.28, -r * 0.4);
  },

  dizzy(ctx, ink, r) {
    setInk(ctx, ink, r);
    // 螺旋眼
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const a = i * 0.55;
        const rad = r * 0.02 + i * r * 0.008;
        const x = side * r * 0.22 + Math.cos(a) * rad;
        const y = -r * 0.08 + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    oMouth(ctx, r, r * 0.2, r * 0.07);
  },

  soot(ctx, ink, r) {
    // 煤球：大眼睛
    ctx.fillStyle = '#1a1a22';
    setInk(ctx, '#f5f5ff', r);
    ovalEyes(ctx, r, -r * 0.05, r * 0.16, r * 0.18);
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.02, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.02, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.08, r * 0.03, 0, Math.PI * 2);
    ctx.arc(r * 0.26, -r * 0.08, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  },

  skull(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.08, r * 0.12, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.08);
    ctx.lineTo(r * 0.1, r * 0.08);
    ctx.moveTo(-r * 0.16, r * 0.2);
    ctx.lineTo(-r * 0.16, r * 0.32);
    ctx.moveTo(0, r * 0.2);
    ctx.lineTo(0, r * 0.32);
    ctx.moveTo(r * 0.16, r * 0.2);
    ctx.lineTo(r * 0.16, r * 0.32);
    ctx.stroke();
  },

  search(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.08, r * 0.06);
    // 放大镜
    ctx.strokeStyle = '#8ab4ff';
    ctx.lineWidth = lw(r, 0.06);
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.4, -r * 0.02);
    ctx.lineTo(r * 0.55, r * 0.18);
    ctx.stroke();
    setInk(ctx, ink, r);
    oMouth(ctx, r, r * 0.2, r * 0.05);
  },

  ponder(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.1);
    oMouth(ctx, r, r * 0.12, r * 0.04);
    handBlob(ctx, r, r * 0.28, r * 0.28, r * 0.12);
    ctx.font = 'bold ' + Math.round(r * 0.28) + 'px sans-serif';
    setInk(ctx, ink, r);
    ctx.fillText('…', r * 0.3, -r * 0.42);
  },

  smirk(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.22, -r * 0.1, r * 0.09, 1.2 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.16);
    ctx.quadraticCurveTo(r * 0.1, r * 0.28, r * 0.22, r * 0.1);
    ctx.stroke();
    sweatDrop(ctx, r, -r * 0.42, -r * 0.3);
  },

  bored(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.12, r * 0.14);
    ctx.beginPath();
    ctx.arc(0, r * 0.22, r * 0.1, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  },

  plead(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.08, r * 0.13, r * 0.15);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.14, r * 0.04, 0, Math.PI * 2);
    ctx.arc(r * 0.26, -r * 0.14, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    setInk(ctx, ink, r);
    frownMouth(ctx, r);
  },

  teeth(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.1, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(r * 0.22, -r * 0.1, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#fff8f0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, r * 0.08);
    ctx.lineTo(-r * 0.08, r * 0.28);
    ctx.lineTo(r * 0.08, r * 0.28);
    ctx.lineTo(r * 0.22, r * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.stroke();
  },

  cheeky(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.12, -r * 0.12);
    ctx.lineTo(r * 0.32, -r * 0.04);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, r * 0.16);
    ctx.quadraticCurveTo(r * 0.15, r * 0.26, r * 0.25, r * 0.08);
    ctx.stroke();
  },

  sneer(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.06, r * 0.1, 1.2 * Math.PI, 1.85 * Math.PI);
    ctx.arc(r * 0.22, -r * 0.06, r * 0.1, 1.2 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, r * 0.16);
    ctx.lineTo(r * 0.18, r * 0.2);
    ctx.stroke();
  },

  cry(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.1);
    frownMouth(ctx, r);
    tear(ctx, r, -r * 0.3, r * 0.05, r * 0.18);
    tear(ctx, r, r * 0.3, r * 0.05, r * 0.18);
  },

  downcast(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.02, r * 0.14);
    ctx.beginPath();
    ctx.arc(0, r * 0.28, r * 0.12, 1.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
  },

  smug(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.arc(r * 0.22, -r * 0.08, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.16);
    ctx.quadraticCurveTo(0, r * 0.26, r * 0.18, r * 0.12);
    ctx.stroke();
  },

  kiss(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.1, r * 0.08, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.22, -r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b9a';
    heartShape(ctx, r * 0.42, -r * 0.05, r * 0.12);
  },

  sparkle(ctx, ink, r) {
    setInk(ctx, '#ffb84d', r);
    starEye(ctx, -r * 0.22, -r * 0.08, r * 0.14);
    starEye(ctx, r * 0.22, -r * 0.08, r * 0.14);
    setInk(ctx, ink, r);
    oMouth(ctx, r, r * 0.2, r * 0.07);
  },

  happy(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    grinMouth(ctx, ink, r);
  },

  mask(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.16);
    ctx.fillStyle = '#dfefff';
    ctx.strokeStyle = '#8ab4d8';
    ctx.lineWidth = lw(r, 0.05);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.02);
    ctx.quadraticCurveTo(0, r * 0.45, r * 0.42, r * 0.02);
    ctx.quadraticCurveTo(0, r * 0.12, -r * 0.42, r * 0.02);
    ctx.fill();
    ctx.stroke();
  },

  wow(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.14, r * 0.13, r * 0.15);
    oMouth(ctx, r, r * 0.22, r * 0.12);
  },

  rofl(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.05, r * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.05, r * 0.12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.28, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    tear(ctx, r, -r * 0.4, r * 0.05, r * 0.14);
    // 轻微倾斜感：旁边小弧
    ctx.beginPath();
    ctx.arc(r * 0.45, r * 0.35, r * 0.08, Math.PI, 1.6 * Math.PI);
    ctx.stroke();
  },

  scream(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.16, r * 0.12, r * 0.14);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.22, r * 0.12, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  sigh(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.arc(r * 0.22, -r * 0.08, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    arcMouth(ctx, r, r * 0.16, r * 0.14);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(r * 0.35, -r * 0.35, r * 0.12, r * 0.06, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  eyeroll(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.14, r * 0.1, r * 0.11);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.2, r * 0.035, 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.2, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.18);
    ctx.lineTo(r * 0.1, r * 0.18);
    ctx.stroke();
  },

  wave(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r);
    arcMouth(ctx, r);
    handBlob(ctx, r, r * 0.55, -r * 0.15, r * 0.13);
  },

  lol(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    grinMouth(ctx, ink, r);
    tear(ctx, r, r * 0.4, -r * 0.02, r * 0.14);
  },

  scheme(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.18);
    ctx.lineTo(-r * 0.1, -r * 0.08);
    ctx.moveTo(r * 0.34, -r * 0.22);
    ctx.lineTo(r * 0.1, -r * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.02, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.2, -r * 0.04, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, r * 0.16);
    ctx.quadraticCurveTo(r * 0.12, r * 0.3, r * 0.24, r * 0.1);
    ctx.stroke();
  },

  doubt(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.22, -r * 0.1, r * 0.1, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    oMouth(ctx, r, r * 0.18, r * 0.05);
    ctx.font = 'bold ' + Math.round(r * 0.36) + 'px sans-serif';
    ctx.fillText('?', r * 0.3, -r * 0.4);
  },

  sweet(ctx, ink, r) {
    softBrows(ctx, ink, r);
    crescentEyes(ctx, ink, r);
    setInk(ctx, ink, r);
    arcMouth(ctx, r, r * 0.14, r * 0.16);
    ctx.fillStyle = 'rgba(255,130,160,0.4)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, r * 0.06, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.36, r * 0.06, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  hug(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.1, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.1, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    arcMouth(ctx, r);
    handBlob(ctx, r, -r * 0.5, r * 0.15, r * 0.12);
    handBlob(ctx, r, r * 0.5, r * 0.15, r * 0.12);
  },

  munch(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.1, r * 0.14);
    // 嘴里叼一根
    ctx.fillStyle = '#e8a04a';
    ctx.fillRect(-r * 0.02, r * 0.1, r * 0.45, r * 0.06);
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  },

  fight(ctx, ink, r) {
    // 头带
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-r * 0.55, -r * 0.42, r * 1.1, r * 0.14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(r * 0.18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('必', 0, -r * 0.3);
    setInk(ctx, ink, r);
    brow(ctx, r, true);
    dotEyes(ctx, r, -r * 0.02);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.18);
    ctx.lineTo(r * 0.12, r * 0.18);
    ctx.stroke();
  },

  blank(ctx, ink, r) {
    setInk(ctx, ink, r);
    lineEyes(ctx, r, -r * 0.08, r * 0.12);
    oMouth(ctx, r, r * 0.18, r * 0.035);
  },

  shock(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.12, r * 0.14, r * 0.16);
    oMouth(ctx, r, r * 0.22, r * 0.045);
  },

  whistle(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  arrogant(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, -r * 0.22);
    ctx.lineTo(-r * 0.1, -r * 0.14);
    ctx.moveTo(r * 0.32, -r * 0.26);
    ctx.lineTo(r * 0.1, -r * 0.16);
    ctx.stroke();
    dotEyes(ctx, r, -r * 0.04, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, r * 0.16);
    ctx.quadraticCurveTo(r * 0.1, r * 0.08, r * 0.22, r * 0.18);
    ctx.stroke();
  },

  doggo(ctx, ink, r) {
    // 柴犬耳
    ctx.fillStyle = '#e8a86a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.2);
    ctx.lineTo(-r * 0.35, -r * 0.7);
    ctx.lineTo(-r * 0.15, -r * 0.35);
    ctx.closePath();
    ctx.moveTo(r * 0.55, -r * 0.2);
    ctx.lineTo(r * 0.35, -r * 0.7);
    ctx.lineTo(r * 0.15, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.05, r * 0.08, r * 0.1);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.08, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  pose(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.22, -r * 0.1, r * 0.09, 1.2 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
    arcMouth(ctx, r, r * 0.16, r * 0.12, 0.2 * Math.PI, 0.7 * Math.PI);
    handBlob(ctx, r, r * 0.5, r * 0.05, r * 0.11);
  },

  slap(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.12, r * 0.06);
    handBlob(ctx, r, -r * 0.15, r * 0.05, r * 0.22);
    handBlob(ctx, r, r * 0.15, r * 0.05, r * 0.22);
  },

  star(ctx, ink, r) {
    setInk(ctx, '#ffb84d', r);
    starEye(ctx, -r * 0.22, -r * 0.08, r * 0.15);
    starEye(ctx, r * 0.22, -r * 0.08, r * 0.15);
    setInk(ctx, ink, r);
    arcMouth(ctx, r, r * 0.18, r * 0.16);
  },

  lookdown(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r, r * 0.02, r * 0.065, r * 0.2);
    frownMouth(ctx, r);
  },

  liu(ctx, ink, r) {
    setInk(ctx, ink, r);
    dotEyes(ctx, r);
    oMouth(ctx, r, r * 0.16, r * 0.05);
    handBlob(ctx, r, r * 0.45, r * 0.1, r * 0.12);
    ctx.font = 'bold ' + Math.round(r * 0.32) + 'px sans-serif';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('666', -r * 0.2, -r * 0.42);
  },

  peek(ctx, ink, r) {
    setInk(ctx, ink, r);
    handBlob(ctx, r, -r * 0.12, -r * 0.05, r * 0.2);
    handBlob(ctx, r, r * 0.12, -r * 0.05, r * 0.2);
    // 指缝露眼
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.08, r * 0.04, 0, Math.PI * 2);
    ctx.arc(r * 0.12, -r * 0.08, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  },

  freeze(ctx, ink, r) {
    setInk(ctx, ink, r);
    ovalEyes(ctx, r, -r * 0.1, r * 0.09, r * 0.1);
    oMouth(ctx, r, r * 0.16, r * 0.06);
    ctx.strokeStyle = '#9ad8ff';
    ctx.lineWidth = lw(r, 0.05);
    ctx.beginPath();
    ctx.moveTo(r * 0.2, r * 0.22);
    ctx.quadraticCurveTo(r * 0.45, r * 0.1, r * 0.5, -r * 0.05);
    ctx.stroke();
  },

  bawling(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.12, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.12, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    oMouth(ctx, r, r * 0.2, r * 0.1);
    tear(ctx, r, -r * 0.34, r * 0.08, r * 0.24);
    tear(ctx, r, r * 0.34, r * 0.08, r * 0.24);
  },

  cracked(ctx, ink, r) {
    setInk(ctx, ink, r);
    // 左右不同眼
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    strokeX(ctx, r * 0.22, -r * 0.08, r * 0.09);
    oMouth(ctx, r, r * 0.18, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7);
    ctx.lineTo(-r * 0.05, -r * 0.1);
    ctx.lineTo(r * 0.04, r * 0.2);
    ctx.lineTo(0, r * 0.7);
    ctx.stroke();
  },

  lips(ctx, ink, r) {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.32, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.28, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c03050';
    ctx.lineWidth = lw(r, 0.04);
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, r * 0.02);
    ctx.quadraticCurveTo(0, r * 0.08, r * 0.28, r * 0.02);
    ctx.stroke();
  },

  heart(ctx, ink, r) {
    ctx.fillStyle = '#ff6b9a';
    heartShape(ctx, 0, 0, r * 0.55);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, -r * 0.15, r * 0.1, r * 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  broke(ctx, ink, r) {
    ctx.fillStyle = '#b8b0c0';
    heartShape(ctx, -r * 0.12, 0, r * 0.4);
    heartShape(ctx, r * 0.18, r * 0.05, r * 0.35);
    setInk(ctx, ink, r, 0.06);
    ctx.beginPath();
    ctx.moveTo(-r * 0.05, -r * 0.35);
    ctx.lineTo(r * 0.08, r * 0.1);
    ctx.lineTo(-r * 0.02, r * 0.4);
    ctx.stroke();
  },

  sprout(ctx, ink, r) {
    // 小豆芽：两点眼 + 一撮叶子
    setInk(ctx, ink, r);
    dotEyes(ctx, r, -r * 0.05, r * 0.06, r * 0.16);
    arcMouth(ctx, r, r * 0.16, r * 0.12);
    ctx.fillStyle = '#6ecf7a';
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, -r * 0.7, r * 0.14, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 0.12, -r * 0.72, r * 0.14, r * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  },

  thumbsup(ctx, ink, r) {
    setInk(ctx, ink, r);
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.1, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.arc(r * 0.2, -r * 0.1, r * 0.09, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    arcMouth(ctx, r);
    // 大拇指
    ctx.fillStyle = '#ffe0c8';
    ctx.beginPath();
    ctx.ellipse(r * 0.48, -r * 0.05, r * 0.1, r * 0.22, 0.15, 0, Math.PI * 2);
    ctx.ellipse(r * 0.42, r * 0.2, r * 0.16, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

function drawFace(ctx, face, ink, r) {
  const fn = DRAW[face] || DRAW.smile;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  fn(ctx, ink, r);
}

module.exports = { drawFace, DRAW };
