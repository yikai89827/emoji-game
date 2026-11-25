'use strict';

/**
 * 平面圆盘堆叠物理：
 * 重力下落 → 碰撞弹跳 → 切向摩擦滚动 → 多轮位置修正铺平 → 停稳锁定
 * 禁止三维叠压：任意两球圆心距 ≥ r1+r2+gap
 */

const GRAVITY = 2200;
const REST = 0.28; // 弹跳：落地/互撞有回弹，再衰减
const FRICTION = 0.78; // 地面切向摩擦（滚动减速）
const AIR = 0.995;
const ITER = 8;
const SETTLE_SPEED = 42;
const SETTLE_TIME = 0.16;
const FREEZE_PER_FRAME = 18;
/** 球间隙：尽量贴紧，堆满压迫感；仍留一点防描边互切 */
const PACK_GAP = 1.2;
const POS_CORRECT = 1; // 位置一次推满，平面硬分离

function freezePiece(p) {
  p.settled = true;
  p.vx = 0;
  p.vy = 0;
  p.settleT = SETTLE_TIME;
}

function freezeAll(pieces) {
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive) continue;
    freezePiece(p);
  }
}

function resetCalm() {}

function minSep(a, b) {
  return a.r + b.r + PACK_GAP;
}

/**
 * 脚下有支撑？（地面，或正下方近接触的球）
 * 侧向轻触不算支撑，避免「下面空了还挂着」
 */
function hasSupport(p, pieces, bounds, slack) {
  slack = slack == null ? 4 : slack;
  if (p.y + p.r >= bounds.bottom - 2.5) return true;
  for (let i = 0; i < pieces.length; i++) {
    const o = pieces[i];
    if (!o.alive || o === p) continue;
    const dx = p.x - o.x;
    const dy = p.y - o.y; // o 在下方 ⇒ dy < 0
    const dist = Math.hypot(dx, dy);
    const min = p.r + o.r;
    if (dist > min + slack) continue;
    if (dy > -Math.max(5, min * 0.25)) continue;
    if (dist > 1e-6 && dy / dist > -0.28) continue;
    return true;
  }
  return false;
}

function isSupported(p, pieces, bounds) {
  return hasSupport(p, pieces, bounds, 5);
}

/** 失支撑 → 解冻下落（多趟，打掉假支撑链） */
function wakeUnsupported(pieces, bounds) {
  let woke = 0;
  for (let pass = 0; pass < 8; pass++) {
    let nThis = 0;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (!p.alive || !p.settled) continue;
      if (hasSupport(p, pieces, bounds, 5)) continue;
      p.settled = false;
      p.settleT = 0;
      p.vx *= 0.2;
      p.vy = Math.max(p.vy, 120);
      nThis++;
      woke++;
    }
    if (nThis === 0) break;
  }
  return woke;
}

/** 只锁「有支撑且低速」的球，绝不把悬空球冻在半空 */
function settleSupported(pieces, bounds, speedLimit) {
  speedLimit = speedLimit == null ? 55 : speedLimit;
  let n = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    if (Math.hypot(p.vx, p.vy) >= speedLimit) continue;
    if (hasOverlap(p, pieces)) continue;
    if (!hasSupport(p, pieces, bounds, 5)) continue;
    freezePiece(p);
    n++;
  }
  return n;
}

function clampWalls(p, bounds, bounce) {
  if (p.x - p.r < bounds.left) {
    p.x = bounds.left + p.r;
    if (bounce && p.vx < 0) p.vx = -p.vx * REST;
  } else if (p.x + p.r > bounds.right) {
    p.x = bounds.right - p.r;
    if (bounce && p.vx > 0) p.vx = -p.vx * REST;
  }

  if (p.y + p.r > bounds.bottom) {
    p.y = bounds.bottom - p.r;
    if (bounce && p.vy > 0) {
      p.vy = -p.vy * REST;
      // 着地滚动：切向速度受摩擦
      p.vx *= FRICTION;
    }
    if (Math.abs(p.vx) < 12) p.vx = 0;
    if (Math.abs(p.vy) < 22) p.vy = 0;
  }

  if (p.y - p.r < bounds.top - 220) {
    p.y = bounds.top - 220 + p.r;
    if (p.vy < 0) p.vy = 0;
  }
}

/**
 * 两球位置硬分离（平面圆盘），按质量/是否锁定分配位移
 * 返回是否发生过推开
 */
function separatePair(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const min = minSep(a, b);
  if (dist < 1e-5) {
    // 完全重合：偏向上下错开，利于滚进凹槽
    dx = (a.id - b.id) * 0.01 || 0.02;
    dy = -0.04;
    dist = Math.hypot(dx, dy);
  }
  if (dist >= min) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (min - dist) * POS_CORRECT;
  const aStatic = a.settled;
  const bStatic = b.settled;

  // 偏置：更重/更靠下的球少动，上面的球滚开（平面滚动感）
  let wA = 0.5;
  let wB = 0.5;
  if (aStatic && !bStatic) {
    wA = 0;
    wB = 1;
  } else if (!aStatic && bStatic) {
    wA = 1;
    wB = 0;
  } else if (aStatic && bStatic) {
    // 两静球：偏向上层让位
    if (a.y < b.y) {
      wA = 0.35;
      wB = 0.65;
    } else if (b.y < a.y) {
      wA = 0.65;
      wB = 0.35;
    }
  } else {
    const ma = a.mass || 1;
    const mb = b.mass || 1;
    // 上方球多让位
    const biasA = a.y < b.y ? 0.4 : 0.6;
    const inv = 1 / (ma + mb);
    wA = biasA * (mb * inv) * 2;
    wB = (1 - biasA) * (ma * inv) * 2;
    const s = wA + wB || 1;
    wA /= s;
    wB /= s;
  }

  a.x -= nx * overlap * wA;
  a.y -= ny * overlap * wA;
  b.x += nx * overlap * wB;
  b.y += ny * overlap * wB;
  return true;
}

/** 碰撞冲量：法向弹跳 + 切向摩擦（滚动） */
function resolveImpulse(a, b) {
  const aStatic = a.settled;
  const bStatic = b.settled;
  if (aStatic && bStatic) return;

  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  if (dist < 1e-5) return;
  const nx = dx / dist;
  const ny = dy / dist;

  const invA = aStatic ? 0 : 1 / (a.mass || 1);
  const invB = bStatic ? 0 : 1 / (b.mass || 1);
  const invSum = invA + invB;
  if (invSum < 1e-8) return;

  const rvx = (bStatic ? 0 : b.vx) - (aStatic ? 0 : a.vx);
  const rvy = (bStatic ? 0 : b.vy) - (aStatic ? 0 : a.vy);
  const vn = rvx * nx + rvy * ny;

  // 正在靠近才弹
  if (vn < 0) {
    const jimp = -(1 + REST) * vn / invSum;
    if (!aStatic) {
      a.vx -= jimp * nx * invA;
      a.vy -= jimp * ny * invA;
    }
    if (!bStatic) {
      b.vx += jimp * nx * invB;
      b.vy += jimp * ny * invB;
    }
  }

  // 切向摩擦：模拟滚动，把相对切向速抹掉一部分
  const tx = -ny;
  const ty = nx;
  const vt =
    ((bStatic ? 0 : b.vx) - (aStatic ? 0 : a.vx)) * tx +
    ((bStatic ? 0 : b.vy) - (aStatic ? 0 : a.vy)) * ty;
  const mu = 0.35;
  const jt = (-vt * mu) / invSum;
  if (!aStatic) {
    a.vx -= jt * tx * invA;
    a.vy -= jt * ty * invA;
  }
  if (!bStatic) {
    b.vx += jt * tx * invB;
    b.vy += jt * ty * invB;
  }
}

function hasOverlap(p, pieces) {
  for (let i = 0; i < pieces.length; i++) {
    const o = pieces[i];
    if (!o.alive || o === p) continue;
    const need = p.r + o.r + PACK_GAP - 0.4;
    if (Math.hypot(p.x - o.x, p.y - o.y) < need) return true;
  }
  return false;
}

/**
 * 把单球投影出与其它球/墙的重叠（只动 p，Gauss-Seidel）
 * 底层先固定，上层球滚开 —— 更接近平面滚动入位
 */
function projectBall(p, pieces, bounds) {
  clampWalls(p, bounds, false);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < pieces.length; i++) {
      const o = pieces[i];
      if (!o.alive || o === p) continue;
      let dx = p.x - o.x;
      let dy = p.y - o.y;
      let dist = Math.hypot(dx, dy);
      const min = minSep(p, o);
      if (dist < 1e-5) {
        dx = 0.02;
        dy = -0.04;
        dist = Math.hypot(dx, dy);
      }
      if (dist >= min) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const push = min - dist;
      // 只动当前球；若对方是未锁定且更靠上，则各让一半
      if (!o.settled && o.y < p.y) {
        p.x += nx * push * 0.5;
        p.y += ny * push * 0.5;
        o.x -= nx * push * 0.5;
        o.y -= ny * push * 0.5;
      } else {
        p.x += nx * push;
        p.y += ny * push;
      }
    }
    clampWalls(p, bounds, false);
  }
}

/** 多趟硬分离：自下而上逐球投影，保证同平面不遮盖 */
function separateOverlaps(pieces, bounds, passes) {
  passes = passes || 6;
  const order = [];
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i].alive) order.push(pieces[i]);
  }
  for (let pass = 0; pass < passes; pass++) {
    order.sort((a, b) => b.y - a.y); // 底 → 顶
    for (let i = 0; i < order.length; i++) {
      projectBall(order[i], pieces, bounds);
    }
  }
}

/** 统计仍重叠的球对数 */
function overlapCount(pieces) {
  let c = 0;
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < pieces.length; j++) {
      const b = pieces[j];
      if (!b.alive) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < minSep(a, b) - 0.35) c++;
    }
  }
  return c;
}

/**
 * 收尾压实：反复硬分离；仍叠着的静球解冻，让重力再滚一次
 */
function packFlat(pieces, bounds, rounds) {
  rounds = rounds || 4;
  for (let r = 0; r < rounds; r++) {
    separateOverlaps(pieces, bounds, 8);
    if (overlapCount(pieces) === 0) break;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (!p.alive || !p.settled) continue;
      if (!hasOverlap(p, pieces)) continue;
      p.settled = false;
      p.settleT = 0;
      p.vy = Math.max(p.vy, 40);
    }
  }
  separateOverlaps(pieces, bounds, 6);
}

function step(pieces, bounds, dt) {
  const n = pieces.length;
  dt = Math.min(dt, 1 / 30);

  // 失支撑先醒，再积分
  wakeUnsupported(pieces, bounds);

  let awakeN = 0;
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    awakeN++;
    p.vy += GRAVITY * dt;
    p.vx *= AIR;
    p.vy *= AIR;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // 全静：仍做平面压实，清掉残留叠压
  if (awakeN === 0) {
    if (overlapCount(pieces) > 0) packFlat(pieces, bounds, 2);
    wakeUnsupported(pieces, bounds);
    return;
  }

  // 约束迭代：墙 + 球球位置修正 + 冲量
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < n; i++) {
      const p = pieces[i];
      if (!p.alive) continue;
      clampWalls(p, bounds, !p.settled);
    }

    for (let i = 0; i < n; i++) {
      const a = pieces[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) {
        const b = pieces[j];
        if (!b.alive) continue;
        const touched = separatePair(a, b);
        if (!touched) continue;
        // 两静球被推开后：若因此悬空，下帧 wake；动态球给弹跳/滚动冲量
        if (!a.settled || !b.settled) {
          resolveImpulse(a, b);
        }
      }
    }
  }

  // 低速阻尼，便于滚动进凹槽后停稳（不要过早清零，保留滚动）
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 90) {
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
    if (speed < 14) {
      p.vx = 0;
      p.vy = 0;
    }

    const sp = Math.hypot(p.vx, p.vy);
    if (sp < SETTLE_SPEED && hasSupport(p, pieces, bounds, 5) && !hasOverlap(p, pieces)) {
      p.settleT += dt;
    } else {
      p.settleT = Math.max(0, p.settleT - dt * 0.5);
    }
  }

  // 自下而上锁定，形成稳定平面堆
  const ready = [];
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    if (p.settleT >= SETTLE_TIME && hasSupport(p, pieces, bounds, 5) && !hasOverlap(p, pieces)) {
      ready.push(p);
    }
  }
  ready.sort((a, b) => b.y - a.y);
  const limit = Math.min(FREEZE_PER_FRAME, ready.length);
  for (let i = 0; i < limit; i++) freezePiece(ready[i]);

  // 全体已很慢：一次性锁住有支撑且无重叠的
  if (awakeN > 0) {
    let maxSp = 0;
    let slowN = 0;
    let live = 0;
    for (let i = 0; i < n; i++) {
      const p = pieces[i];
      if (!p.alive || p.settled) continue;
      live++;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxSp) maxSp = sp;
      if (sp < SETTLE_SPEED) slowN++;
    }
    if (live > 0 && maxSp < SETTLE_SPEED && slowN === live) {
      for (let i = 0; i < n; i++) {
        const p = pieces[i];
        if (!p.alive || p.settled) continue;
        if (hasOverlap(p, pieces)) continue;
        if (hasSupport(p, pieces, bounds, 7)) freezePiece(p);
      }
    }
  }

  separateOverlaps(pieces, bounds, 4);
  if (overlapCount(pieces) > 0) packFlat(pieces, bounds, 1);
  wakeUnsupported(pieces, bounds);
}

function hitTest(pieces, x, y) {
  let best = null;
  let bestY = -Infinity;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= p.r + 6 && p.y >= bestY) {
      best = p;
      bestY = p.y;
    }
  }
  return best;
}

function maxY(pieces) {
  let m = -Infinity;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive) continue;
    m = Math.max(m, p.y + p.r);
  }
  return m;
}

function minY(pieces) {
  let m = Infinity;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive) continue;
    m = Math.min(m, p.y - p.r);
  }
  return m;
}

function aliveCount(pieces) {
  let c = 0;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].alive) c++;
  return c;
}

function movingCount(pieces) {
  let c = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    if (Math.hypot(p.vx, p.vy) > 18) c++;
  }
  return c;
}

module.exports = {
  step,
  hitTest,
  maxY,
  minY,
  aliveCount,
  movingCount,
  freezeAll,
  wakeUnsupported,
  settleSupported,
  hasSupport,
  separateOverlaps,
  packFlat,
  overlapCount,
  resetCalm,
  GRAVITY,
  SETTLE_TIME,
  PACK_GAP,
};
