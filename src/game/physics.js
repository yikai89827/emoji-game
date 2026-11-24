'use strict';

const GRAVITY = 2000;
const REST = 0.08;
const FRICTION = 0.72;
const AIR = 0.99;
const ITER = 4;
const SETTLE_SPEED = 48;
const SETTLE_TIME = 0.18;
const FREEZE_PER_FRAME = 14;

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

/**
 * 脚下有支撑？
 * slack 越大越容易判「有支撑」（锁住更稳）；失支撑检测用大 slack，避免微缝就抖醒。
 */
function hasSupport(p, pieces, bounds, slack) {
  slack = slack == null ? 8 : slack;
  if (p.y + p.r >= bounds.bottom - 2.5) return true;
  for (let i = 0; i < pieces.length; i++) {
    const o = pieces[i];
    if (!o.alive || o === p) continue;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const dist = Math.hypot(dx, dy);
    const min = p.r + o.r;
    if (dist > min + slack) continue;
    // o 在 p 下方
    if (dy < -0.06 * min) return true;
  }
  return false;
}

function isSupported(p, pieces, bounds) {
  return hasSupport(p, pieces, bounds, 8);
}

/** 点走下面后：浮空锁定球解冻下落 */
function wakeUnsupported(pieces, bounds) {
  let woke = 0;
  for (let pass = 0; pass < 6; pass++) {
    let nThis = 0;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (!p.alive || !p.settled) continue;
      // 大 slack：只有明显悬空才醒，避免密堆微缝误醒
      if (hasSupport(p, pieces, bounds, 10)) continue;
      p.settled = false;
      p.settleT = 0;
      p.vx *= 0.3;
      p.vy = Math.max(p.vy, 80);
      nThis++;
      woke++;
    }
    if (nThis === 0) break;
  }
  return woke;
}

function step(pieces, bounds, dt) {
  const n = pieces.length;

  // 每帧检查浮空（点选/消除后上面要掉）
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

  if (awakeN === 0) return;

  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < n; i++) {
      const p = pieces[i];
      if (!p.alive) continue;
      if (p.settled) {
        if (p.x - p.r < bounds.left) p.x = bounds.left + p.r;
        else if (p.x + p.r > bounds.right) p.x = bounds.right - p.r;
        if (p.y + p.r > bounds.bottom) p.y = bounds.bottom - p.r;
        continue;
      }

      if (p.x - p.r < bounds.left) {
        p.x = bounds.left + p.r;
        p.vx *= -REST;
      } else if (p.x + p.r > bounds.right) {
        p.x = bounds.right - p.r;
        p.vx *= -REST;
      }

      if (p.y + p.r > bounds.bottom) {
        p.y = bounds.bottom - p.r;
        if (p.vy > 0) p.vy = -p.vy * REST;
        p.vx *= FRICTION;
        if (Math.abs(p.vx) < 14) p.vx = 0;
        if (Math.abs(p.vy) < 28) p.vy = 0;
      }

      if (p.y - p.r < bounds.top - 200) {
        p.y = bounds.top - 200 + p.r;
        p.vy = Math.max(0, p.vy);
      }
    }

    for (let i = 0; i < n; i++) {
      const a = pieces[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) {
        const b = pieces[j];
        if (!b.alive) continue;
        if (a.settled && b.settled) continue;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (dist < 1e-4) {
          dx = 0.01;
          dy = -0.01;
          dist = Math.hypot(dx, dy);
        }
        if (dist >= min) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = min - dist;
        const aStatic = a.settled;
        const bStatic = b.settled;

        if (aStatic) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        } else if (bStatic) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        } else {
          const total = a.mass + b.mass;
          a.x -= nx * overlap * (b.mass / total);
          a.y -= ny * overlap * (b.mass / total);
          b.x += nx * overlap * (a.mass / total);
          b.y += ny * overlap * (a.mass / total);
        }

        const invA = aStatic ? 0 : 1 / a.mass;
        const invB = bStatic ? 0 : 1 / b.mass;
        const invSum = invA + invB;
        if (invSum < 1e-8) continue;

        const sa = aStatic ? 0 : Math.hypot(a.vx, a.vy);
        const sb = bStatic ? 0 : Math.hypot(b.vx, b.vy);

        if ((!aStatic && sa < SETTLE_SPEED) && (!bStatic && sb < SETTLE_SPEED)) {
          a.vx = 0;
          a.vy = 0;
          b.vx = 0;
          b.vy = 0;
          continue;
        }
        if (aStatic && !bStatic && sb < SETTLE_SPEED) {
          b.vx = 0;
          b.vy = 0;
          continue;
        }
        if (bStatic && !aStatic && sa < SETTLE_SPEED) {
          a.vx = 0;
          a.vy = 0;
          continue;
        }

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
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

        const tx = -ny;
        const ty = nx;
        const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        const frictionJ = vt * 0.3 / invSum;
        if (!aStatic) {
          a.vx += frictionJ * tx * invA;
          a.vy += frictionJ * ty * invA;
        }
        if (!bStatic) {
          b.vx -= frictionJ * tx * invB;
          b.vy -= frictionJ * ty * invB;
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 100) {
      p.vx *= 0.85;
      p.vy *= 0.85;
    }
    if (speed < 20) {
      p.vx = 0;
      p.vy = 0;
    }

    if (speed < SETTLE_SPEED && hasSupport(p, pieces, bounds, 6)) {
      p.settleT += dt;
    } else {
      p.settleT = Math.max(0, p.settleT - dt);
    }
  }

  const ready = [];
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (!p.alive || p.settled) continue;
    if (p.settleT >= SETTLE_TIME && hasSupport(p, pieces, bounds, 6)) ready.push(p);
  }
  ready.sort((a, b) => b.y - a.y);
  const limit = Math.min(FREEZE_PER_FRAME, ready.length);
  for (let i = 0; i < limit; i++) freezePiece(ready[i]);

  // 全慢时只锁「有支撑」的，绝不把悬空球冻在半空
  if (awakeN > 0) {
    let maxSp = 0;
    let slowN = 0;
    for (let i = 0; i < n; i++) {
      const p = pieces[i];
      if (!p.alive || p.settled) continue;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxSp) maxSp = sp;
      if (sp < SETTLE_SPEED) slowN++;
    }
    if (maxSp < SETTLE_SPEED && slowN === awakeN) {
      for (let i = 0; i < n; i++) {
        const p = pieces[i];
        if (!p.alive || p.settled) continue;
        if (hasSupport(p, pieces, bounds, 8)) freezePiece(p);
      }
    }
  }
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
  resetCalm,
  GRAVITY,
  SETTLE_TIME,
};
