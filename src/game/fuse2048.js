'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const sound = require('../audio/sound.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');
const { showRewarded } = require('../ads/rewarded.js');
const { rollFuseLadder, LADDER_LEN } = require('../data/mode-skin.js');
const { spawnShatter, updateShards, drawShards } = require('../render/fx.js');
const { colorOf } = require('../data/faces.js');
const rank = require('../data/rank.js');
const daily = require('../data/daily.js');

const SIZE = 4;
const BEST_KEY = 'tkc_fuse_best';

function loadBest() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const v = wx.getStorageSync(BEST_KEY);
      if (v != null && v !== '') return Math.max(0, parseInt(v, 10) || 0);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      return Math.max(0, parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0);
    }
  } catch (e) { /* ignore */ }
  return 0;
}

function saveBest(n) {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(BEST_KEY, n);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(n));
  } catch (e) { /* ignore */ }
}

/**
 * 表情合成 · 2048 滑结合并
 * 每局随机外围色 + 表情阶梯（越高阶越愉悦）
 */
class Fuse2048Scene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.score = 0;
    this.best = loadBest();
    this.over = false;
    this.won = false;
    this._toast = '';
    this._toastT = 0;
    this._swipe = null;
    this.ringColor = 'cream';
    this.ladder = [];
    this._prev = null;
    this._prevScore = 0;
    this.shards = [];
    this._rollSkin();
    this.grid = emptyGrid();
    this._spawn();
    this._spawn();
    this._layout();
    showBanner('fuse');
  }

  _rollSkin() {
    const skin = rollFuseLadder(this.ringColor);
    this.ringColor = skin.ringColor;
    this.ladder = skin.ladder;
  }

  destroy() {
    hideBanner('fuse');
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.5;
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const adReserve = reservedBottom();
    this.btnBack = new Button({
      x: Math.max(10, s.left),
      y: s.top + 4,
      w: 72,
      h: 36,
      label: '返回',
      style: 'ghost',
      onTap: () => this.app.goto('more'),
    });
    this.btnRetry = new Button({
      x: W - Math.max(10, s.right) - 72,
      y: s.top + 4,
      w: 72,
      h: 36,
      label: '重开',
      style: 'gold',
      onTap: () => this._reset(),
    });

    const propY = s.top + 96;
    const bw = 88;
    const gapB = 10;
    const totalW = bw * 3 + gapB * 2;
    let bx = (W - totalW) / 2;
    this.btnUndo = new Button({
      x: bx,
      y: propY,
      w: bw,
      h: 36,
      label: '撤销',
      style: 'dock',
      onTap: () => this._useProp('fuseUndo'),
    });
    bx += bw + gapB;
    this.btnHammer = new Button({
      x: bx,
      y: propY,
      w: bw,
      h: 36,
      label: '消除',
      style: 'dock',
      onTap: () => this._useProp('fuseHammer'),
    });
    bx += bw + gapB;
    this.btnFuseRevive = new Button({
      x: bx,
      y: propY,
      w: bw,
      h: 36,
      label: '续命',
      style: 'revive',
      onTap: () => this._useProp('fuseRevive'),
    });
    this._propLayout = {
      undo: { x: this.btnUndo.x, y: propY, w: bw, h: 36 },
      hammer: { x: this.btnHammer.x, y: propY, w: bw, h: 36 },
      revive: { x: this.btnFuseRevive.x, y: propY, w: bw, h: 36 },
    };

    this.buttons = [this.btnBack, this.btnRetry, this.btnUndo, this.btnHammer, this.btnFuseRevive];

    // 自上而下：标题 → 道具 → 棋盘 → 合成链 → 广告
    const chainH = 58;
    const gap = 10;
    const top = s.top + 140;
    const side = 14;
    const bottomPad = Math.max(adReserve, 108 + (s.bottom || 0) + 8);
    const boardMax = H - bottomPad - chainH - gap - top;
    const board = Math.min(W - side * 2, Math.max(160, boardMax));
    this.boardX = (W - board) / 2;
    this.boardY = top;
    this.boardS = board;
    this.cell = board / SIZE;
    this.previewY = this.boardY + board + gap;
  }

  _reset() {
    this.score = 0;
    this.over = false;
    this.won = false;
    this._prev = null;
    this._prevScore = 0;
    this._rollSkin();
    this.grid = emptyGrid();
    this._spawn();
    this._spawn();
    this.flash('新开一局 · 换了表情和颜色');
  }

  _snapshot() {
    this._prev = cloneGrid(this.grid);
    this._prevScore = this.score;
  }

  _useProp(id) {
    if (id === 'fuseRevive') {
      if (!this.over) {
        this.flash('满盘后才能续命');
        return;
      }
    } else if (this.over) {
      this.flash('满盘了 · 可点续命或重开');
      return;
    }
    this.flash('看广告使用…');
    showRewarded(id, (ok, info) => {
      if (!ok) {
        this.flash(info === 'load_fail' ? '广告加载失败' : '未看完广告');
        return;
      }
      this._applyProp(id);
    });
  }

  _applyProp(id) {
    if (id === 'fuseUndo') {
      if (!this._prev) {
        this.flash('没有可撤销的步');
        return;
      }
      this.grid = cloneGrid(this._prev);
      this.score = this._prevScore;
      this._prev = null;
      this.over = false;
      this.flash('已撤销上一步');
    } else if (id === 'fuseHammer') {
      if (!removeLowest(this.grid)) {
        this.flash('没有可消除的');
        return;
      }
      this._prev = null;
      this.over = false;
      sound.playClear();
      this.flash('已消除一只最低阶');
    } else if (id === 'fuseRevive') {
      // 清掉 3 只最低阶，继续玩
      let n = 0;
      for (let i = 0; i < 3; i++) if (removeLowest(this.grid)) n++;
      if (n <= 0) {
        this.flash('续命失败');
        return;
      }
      this.over = false;
      this._prev = null;
      sound.playClear();
      this.flash('续命成功 · 清掉 ' + n + ' 只');
    }
    daily.addPropUse();
  }

  _spawn() {
    const empties = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.grid[r][c] == null) empties.push({ r: r, c: c });
      }
    }
    if (!empties.length) return false;
    const pick = empties[Math.floor(Math.random() * empties.length)];
    // 90% 出 0 阶，10% 出 1 阶
    const lv = Math.random() < 0.9 ? 0 : 1;
    this.grid[pick.r][pick.c] = lv;
    return true;
  }

  _slide(dir) {
    if (this.over) return false;
    const g = this.grid;
    const next = emptyGrid();
    let moved = false;
    let gained = 0;

    const lines = [];
    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const row = [];
        for (let c = 0; c < SIZE; c++) row.push(g[r][c]);
        if (dir === 'right') row.reverse();
        lines.push({ kind: 'row', i: r, vals: row, rev: dir === 'right' });
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = 0; r < SIZE; r++) col.push(g[r][c]);
        if (dir === 'down') col.reverse();
        lines.push({ kind: 'col', i: c, vals: col, rev: dir === 'down' });
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const merged = mergeLine(line.vals, this.ladder.length - 1);
      gained += merged.gain;
      if (merged.changed) moved = true;
      const out = line.rev ? merged.line.reverse() : merged.line;
      for (let j = 0; j < SIZE; j++) {
        if (line.kind === 'row') next[line.i][j] = out[j];
        else next[j][line.i] = out[j];
      }
    }

    if (!moved) return false;
    this._snapshot();
    // 合成特效：等级升高的格子
    const merges = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const before = g[r][c];
        const after = next[r][c];
        if (after != null && before != null && after > before) {
          merges.push({ r: r, c: c, lv: after });
        }
      }
    }
    this.grid = next;
    this.score += gained;
    if (this.score > this.best) {
      this.best = this.score;
      saveBest(this.best);
    }
    if (gained > 0) {
      sound.playMerge();
      const fill = colorOf(this.ringColor).fill;
      for (let i = 0; i < merges.length; i++) {
        const m = merges[i];
        const x = this.boardX + m.c * this.cell + this.cell / 2;
        const y = this.boardY + m.r * this.cell + this.cell / 2;
        spawnShatter(this.shards, x, y, fill, this.cell * 0.28);
      }
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (this.grid[r][c] === this.ladder.length - 1 && !this.won) {
            this.won = true;
            const top = this.ladder[this.ladder.length - 1];
            this.flash('合成出「' + (top && top.label) + '」！');
            sound.playWin();
          }
        }
      }
    }
    this._spawn();
    if (!canMove(this.grid)) {
      this.over = true;
      if (this.score > 0) rank.submit('fuse', this.score);
      this.flash('没有空位了 · 点重开再战');
    }
    return true;
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showBanner('fuse');
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    updateShards(this.shards, dt);
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

    const ptr = P.pointer;
    if (ptr.justPressed) {
      this._swipe = { x: ptr.x, y: ptr.y };
    }
    if (ptr.justReleased && this._swipe) {
      const dx = ptr.x - this._swipe.x;
      const dy = ptr.y - this._swipe.y;
      this._swipe = null;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) >= 28) {
        if (absX > absY) this._slide(dx > 0 ? 'right' : 'left');
        else this._slide(dy > 0 ? 'down' : 'up');
      }
    }

    // 非满盘时续命回到道具栏；满盘时按钮位置由结算卡决定
    if (this.btnFuseRevive && this._propLayout && !this.over) {
      const L = this._propLayout;
      this.btnUndo.x = L.undo.x;
      this.btnUndo.y = L.undo.y;
      this.btnUndo.w = L.undo.w;
      this.btnHammer.x = L.hammer.x;
      this.btnHammer.y = L.hammer.y;
      this.btnHammer.w = L.hammer.w;
      this.btnFuseRevive.x = L.revive.x;
      this.btnFuseRevive.y = L.revive.y;
      this.btnFuseRevive.w = L.revive.w;
      this.btnFuseRevive.h = L.revive.h;
      this.btnFuseRevive.label = '续命';
    }

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      let hit = false;
      for (let j = 0; j < this.buttons.length; j++) {
        if (this.buttons[j].handleTouch(tap.x, tap.y)) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }
  }

  draw() {
    const ctx = P.ctx;
    const W = P.width;
    const H = P.height;
    const scale = P.renderScale;
    const s = P.safe;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = Theme.clear;
    ctx.fillRect(0, 0, P.canvas.width || W, P.canvas.height || H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, Theme.bgTop);
    g.addColorStop(0.5, Theme.bgMid);
    g.addColorStop(1, Theme.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this.btnBack.draw(ctx);
    this.btnRetry.draw(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 22px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText('表情合成', W * 0.5, s.top + 8);
    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('滑动合并同款 · 合成更高阶表情', W * 0.5, s.top + 36);

    // 左：本局得分 · 右：历史最高
    const scoreY = s.top + 56;
    ctx.font = '700 13px ' + FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('得分', Math.max(14, s.left), scoreY);
    ctx.font = '800 18px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText(String(this.score), Math.max(14, s.left), scoreY + 18);

    ctx.textAlign = 'right';
    ctx.font = '700 13px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('最高', W - Math.max(14, s.right), scoreY);
    ctx.font = '800 18px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText(String(this.best), W - Math.max(14, s.right), scoreY + 18);

    // 棋盘底
    roundRect(ctx, this.boardX, this.boardY, this.boardS, this.boardS, 16);
    ctx.fillStyle = 'rgba(91,70,54,0.12)';
    ctx.fill();

    const pad = 6;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = this.boardX + c * this.cell + pad;
        const y = this.boardY + r * this.cell + pad;
        const cs = this.cell - pad * 2;
        roundRect(ctx, x, y, cs, cs, 12);
        ctx.fillStyle = 'rgba(255,248,236,0.85)';
        ctx.fill();

        const lv = this.grid[r][c];
        if (lv == null) continue;
        const meta = this.ladder[Math.min(lv, this.ladder.length - 1)];
        const cx = x + cs / 2;
        const cy = y + cs / 2;
        drawDango(ctx, {
          x: cx,
          y: cy,
          r: cs * 0.42,
          face: meta.face,
          color: this.ringColor,
          selected: false,
        });
        ctx.font = '700 10px ' + FONT;
        ctx.fillStyle = Theme.inkMute;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(meta.label, cx, y + cs - 14);
      }
    }

    // 预览：前 3 阶 + … + 后 2 阶（终点必是大笑类）
    const previewY = this.previewY || H - reservedBottom() - 52;
    const n = this.ladder.length;
    const idxs =
      n <= 5
        ? Array.from({ length: n }, (_, i) => i)
        : [0, 1, 2, n - 2, n - 1];
    const slots = idxs.length + (n > 5 ? 1 : 0); // 中间省略号占位
    const step = 50;
    const chainW = slots * step - 8;
    let px = (W - chainW) / 2;
    for (let k = 0; k < idxs.length; k++) {
      if (n > 5 && k === 3) {
        ctx.fillStyle = Theme.inkMute;
        ctx.font = '700 14px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('…', px + 18, previewY + 22);
        px += step;
      }
      const meta = this.ladder[idxs[k]];
      drawDango(ctx, {
        x: px + 18,
        y: previewY + 22,
        r: 14,
        face: meta.face,
        color: this.ringColor,
        selected: false,
      });
      if (k < idxs.length - 1) {
        ctx.fillStyle = Theme.inkMute;
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('→', px + 40, previewY + 22);
      }
      px += step;
    }

    if (this._toastT > 0 && this._toast) {
      // 画在棋盘上方内侧，避开道具栏
      const ty = this.boardY + 22;
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '700 14px ' + FONT;
      const tw = Math.min(this.boardS - 24, ctx.measureText(this._toast).width + 28);
      roundRect(ctx, (W - tw) / 2, ty - 12, tw, 28, 10);
      ctx.fillStyle = 'rgba(255,248,236,0.92)';
      ctx.fill();
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._toast, W * 0.5, ty + 2);
      ctx.globalAlpha = 1;
    }

    if (this.over) {
      this._drawSettle(ctx, W, H);
    }

    drawShards(ctx, this.shards);

    // 道具栏（非满盘时画在顶区；满盘时续命在结算卡）
    if (!this.over) {
      this.btnUndo.draw(ctx);
      this.btnHammer.draw(ctx);
      this.btnFuseRevive.draw(ctx);
    }
  }

  _drawSettle(ctx, W, H) {
    ctx.fillStyle = 'rgba(91,70,54,0.45)';
    ctx.fillRect(0, 0, W, H);

    const cardW = Math.min(300, W - 40);
    const cardH = 210;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2 - 20;

    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    const cg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cg.addColorStop(0, Theme.cardFail0);
    cg.addColorStop(0.5, Theme.cardFail1);
    cg.addColorStop(1, Theme.cardFail2);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = Theme.cardStrokeFail;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 26px ' + FONT;
    ctx.fillStyle = Theme.titleFail;
    ctx.fillText('满格了', W * 0.5, cardY + 36);

    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = Theme.subText;
    ctx.fillText('看广告续命或点右上重开', W * 0.5, cardY + 64);

    roundRect(ctx, cardX + 24, cardY + 82, cardW - 48, 44, 12);
    ctx.fillStyle = Theme.scoreBox;
    ctx.fill();
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('本局得分', W * 0.5, cardY + 96);
    ctx.font = '800 20px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText(String(this.score), W * 0.5, cardY + 116);

    this.btnFuseRevive.x = (W - 140) / 2;
    this.btnFuseRevive.y = cardY + cardH + 14;
    this.btnFuseRevive.w = 140;
    this.btnFuseRevive.h = 42;
    this.btnFuseRevive.label = '看广告续命';
    this.btnFuseRevive.draw(ctx);
  }
}

function emptyGrid() {
  const g = [];
  for (let r = 0; r < SIZE; r++) {
    g[r] = [];
    for (let c = 0; c < SIZE; c++) g[r][c] = null;
  }
  return g;
}

function cloneGrid(src) {
  const g = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) g[r][c] = src[r][c];
  }
  return g;
}

function removeLowest(grid) {
  let best = null;
  let bestLv = Infinity;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v == null) continue;
      if (v < bestLv) {
        bestLv = v;
        best = { r: r, c: c };
      }
    }
  }
  if (!best) return false;
  grid[best.r][best.c] = null;
  return true;
}

function mergeLine(vals, maxLv) {
  if (maxLv == null) maxLv = LADDER_LEN - 1;
  const filtered = vals.filter((v) => v != null);
  const out = [];
  let gain = 0;
  let changed = filtered.length !== vals.length;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const nextLv = Math.min(filtered[i] + 1, maxLv);
      out.push(nextLv);
      gain += Math.pow(2, nextLv + 1) * 10;
      if (nextLv !== filtered[i]) changed = true;
      i++;
      changed = true;
    } else {
      out.push(filtered[i]);
    }
  }
  while (out.length < SIZE) out.push(null);
  if (!changed) {
    for (let i = 0; i < SIZE; i++) {
      if (out[i] !== vals[i]) {
        changed = true;
        break;
      }
    }
  }
  return { line: out, gain: gain, changed: changed };
}

function canMove(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] == null) return true;
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

module.exports = { Fuse2048Scene };
