'use strict';

/** 缓动：飞入槽位 */
function easeOutCubic(t) {
  const u = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - u, 3);
}

/**
 * 飞入动画：带一点抛物线弧度
 */
function flyerPose(f) {
  const u = Math.min(1, f.t / f.dur);
  const e = easeOutCubic(u);
  const arc = Math.sin(u * Math.PI) * (f.arc || 48);
  return {
    x: f.x0 + (f.x1 - f.x0) * e,
    y: f.y0 + (f.y1 - f.y0) * e - arc,
    s: 1 - e * 0.35,
    done: u >= 1,
  };
}

function mixHex(a, b, t) {
  const parse = (hex) => {
    const n = (hex || '#ffffff').replace('#', '');
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
    const num = parseInt(full, 16) || 0xffffff;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };
  const A = parse(a);
  const B = parse(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/**
 * 炫酷三消特效：冲击环 + 星屑 + 彩带 + 闪光
 */
function spawnShatter(shards, x, y, fill, r) {
  const base = fill || '#ff6b9a';
  const bright = mixHex(base, '#ffffff', 0.45);
  const gold = '#ffe566';
  const cyan = '#7dffd2';

  // 冲击环
  shards.push({
    kind: 'ring',
    x: x,
    y: y,
    life: 0.45,
    maxLife: 0.45,
    r0: Math.max(8, r * 0.4),
    r1: r * 2.8 + 36,
    color: bright,
    line: Math.max(3, r * 0.12),
  });
  shards.push({
    kind: 'ring',
    x: x,
    y: y,
    life: 0.55,
    maxLife: 0.55,
    r0: Math.max(6, r * 0.2),
    r1: r * 3.4 + 48,
    color: gold,
    line: Math.max(2, r * 0.08),
  });

  // 中心闪光
  shards.push({
    kind: 'flash',
    x: x,
    y: y,
    life: 0.28,
    maxLife: 0.28,
    r: r * 1.6 + 18,
    color: '#ffffff',
  });

  // 彩色碎片
  const n = 16 + ((Math.random() * 6) | 0);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.35;
    const sp = 160 + Math.random() * 280;
    const palette = [base, bright, gold, cyan, '#ff7ab8'];
    shards.push({
      kind: 'shard',
      x: x + (Math.random() - 0.5) * r * 0.35,
      y: y + (Math.random() - 0.5) * r * 0.35,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 90,
      life: 0.45 + Math.random() * 0.4,
      maxLife: 0.7,
      r: 2.5 + Math.random() * Math.max(3.5, r * 0.2),
      fill: palette[i % palette.length],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 14,
    });
  }

  // 星屑
  const stars = 10 + ((Math.random() * 5) | 0);
  for (let i = 0; i < stars; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 200;
    shards.push({
      kind: 'star',
      x: x,
      y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.5 + Math.random() * 0.45,
      maxLife: 0.8,
      r: 3 + Math.random() * 5,
      fill: i % 2 ? gold : '#fff8c8',
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 8,
    });
  }

  // 上飘彩点
  for (let i = 0; i < 8; i++) {
    shards.push({
      kind: 'spark',
      x: x + (Math.random() - 0.5) * r,
      y: y + (Math.random() - 0.5) * r * 0.5,
      vx: (Math.random() - 0.5) * 60,
      vy: -120 - Math.random() * 160,
      life: 0.55 + Math.random() * 0.35,
      maxLife: 0.75,
      r: 1.5 + Math.random() * 2.5,
      fill: [gold, cyan, '#ff9ad0', '#fff'][i % 4],
    });
  }
}

function updateShards(shards, dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.life -= dt;
    if (s.kind === 'ring' || s.kind === 'flash') {
      if (s.life <= 0) shards.splice(i, 1);
      continue;
    }
    const g = s.kind === 'spark' ? 180 : 560;
    s.vy += g * dt;
    s.x += (s.vx || 0) * dt;
    s.y += (s.vy || 0) * dt;
    if (s.vx != null) s.vx *= 0.985;
    if (s.vr) s.rot = (s.rot || 0) + s.vr * dt;
    if (s.life <= 0) shards.splice(i, 1);
  }
}

function drawStar(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    const x1 = Math.cos(a) * r;
    const y1 = Math.sin(a) * r;
    const x2 = Math.cos(b) * r * 0.42;
    const y2 = Math.sin(b) * r * 0.42;
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShards(ctx, shards) {
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    const a = Math.max(0, s.life / (s.maxLife || 0.5));
    ctx.save();
    ctx.globalAlpha = a;

    if (s.kind === 'ring') {
      const u = 1 - a;
      const rr = s.r0 + (s.r1 - s.r0) * (1 - a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = (s.line || 3) * (0.4 + 0.6 * a);
      ctx.globalAlpha = a * (1 - u * 0.3);
      ctx.stroke();
    } else if (s.kind === 'flash') {
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grd.addColorStop(0, 'rgba(255,255,255,' + (0.85 * a) + ')');
      grd.addColorStop(0.35, 'rgba(255,230,120,' + (0.35 * a) + ')');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'star') {
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot || 0);
      ctx.fillStyle = s.fill;
      drawStar(ctx, s.r);
    } else if (s.kind === 'spark') {
      ctx.fillStyle = s.fill;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot || 0);
      ctx.fillStyle = s.fill;
      ctx.beginPath();
      ctx.moveTo(0, -s.r);
      ctx.lineTo(s.r * 0.9, s.r * 0.6);
      ctx.lineTo(-s.r * 0.9, s.r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * 图鉴解锁礼花：多点爆开 + 上飘彩带
 */
function spawnFirework(shards, x, y, w, h) {
  const colors = ['#ff6b9a', '#ffe566', '#7dffd2', '#ff9ad0', '#7eb8f0', '#fff', '#ffc857'];
  const bursts = [
    { x: x, y: y },
    { x: x - w * 0.22, y: y - h * 0.08 },
    { x: x + w * 0.22, y: y - h * 0.06 },
    { x: x - w * 0.1, y: y + h * 0.12 },
    { x: x + w * 0.12, y: y + h * 0.1 },
  ];
  for (let b = 0; b < bursts.length; b++) {
    const cx = bursts[b].x;
    const cy = bursts[b].y;
    spawnShatter(shards, cx, cy, colors[b % colors.length], 28 + b * 4);
    // 额外礼花粒子
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.2;
      const sp = 120 + Math.random() * 260;
      shards.push({
        kind: i % 3 === 0 ? 'star' : 'spark',
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.1,
        r: 2.5 + Math.random() * 4,
        fill: colors[(i + b) % colors.length],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
      });
    }
  }
  // 顶部彩带雨
  for (let i = 0; i < 28; i++) {
    shards.push({
      kind: 'shard',
      x: x + (Math.random() - 0.5) * w * 0.9,
      y: y - h * 0.35 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 80,
      vy: 40 + Math.random() * 120,
      life: 0.9 + Math.random() * 0.6,
      maxLife: 1.4,
      r: 3 + Math.random() * 5,
      fill: colors[i % colors.length],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 16,
    });
  }
}

module.exports = {
  easeOutCubic,
  flyerPose,
  spawnShatter,
  spawnFirework,
  updateShards,
  drawShards,
};
