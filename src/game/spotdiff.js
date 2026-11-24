'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const sound = require('../audio/sound.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');
const { showRewarded } = require('../ads/rewarded.js');
const rank = require('../data/rank.js');
const album = require('../data/album.js');
const daily = require('../data/daily.js');
const { FACES, colorOf } = require('../data/faces.js');
const { pickRingColor } = require('../data/mode-skin.js');
const { spawnShatter, updateShards, drawShards } = require('../render/fx.js');

const LEVELS = [
  { size: 3, diffCount: 2, pool: 4, time: 70 },
  { size: 3, diffCount: 3, pool: 5, time: 75 },
  { size: 4, diffCount: 3, pool: 5, time: 80 },
  { size: 4, diffCount: 4, pool: 6, time: 85 },
  { size: 5, diffCount: 4, pool: 7, time: 95 },
  { size: 5, diffCount: 5, pool: 8, time: 100 },
];

const SCORE_PER_DIFF = 80;
const LEVEL_BONUS = 150;
const WRONG_TIME = 2;
const WRONG_SCORE = 3;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function pickPool(n) {
  const ids = shuffle(FACES.map((f) => f.id));
  return ids.slice(0, Math.min(n, ids.length));
}

function otherFace(pool, avoid) {
  const list = pool.filter((id) => id !== avoid);
  if (!list.length) return pool[Math.floor(Math.random() * pool.length)];
  return list[Math.floor(Math.random() * list.length)];
}

function makeGrid(size, fill) {
  const g = [];
  for (let r = 0; r < size; r++) {
    g[r] = [];
    for (let c = 0; c < size; c++) g[r][c] = fill;
  }
  return g;
}

function countFound(isDiff, found) {
  let n = 0;
  let total = 0;
  for (let r = 0; r < isDiff.length; r++) {
    for (let c = 0; c < isDiff[r].length; c++) {
      if (isDiff[r][c]) {
        total++;
        if (found[r][c]) n++;
      }
    }
  }
  return { n: n, total: total };
}

/**
 * 表情找不同：左右对照 · 点出右侧不同格
 */
class SpotDiffScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this._toast = '';
    this._toastT = 0;
    this.shards = [];
    this.ringColor = 'cream';
    this.levelIndex = 0;
    this.score = 0;
    this.timeLeft = 0;
    this.over = false;
    this.allWon = false;
    this.missStreak = 0;
    this.hintPulse = null; // { r, c, t }
    this.facePool = [];
    this.left = [];
    this.right = [];
    this.isDiff = [];
    this.found = [];
    this._levelFaces = [];
    this._newGame();
    this._layout();
    showBanner('spot');
  }

  destroy() {
    hideBanner('spot');
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.5;
  }

  _newGame() {
    this.levelIndex = 0;
    this.score = 0;
    this.over = false;
    this.allWon = false;
    this.missStreak = 0;
    this.hintPulse = null;
    this.shards = [];
    this._startLevel(0);
  }

  _startLevel(idx) {
    const cfg = LEVELS[Math.min(idx, LEVELS.length - 1)];
    this.levelIndex = idx;
    this.over = false;
    this.allWon = false;
    this.missStreak = 0;
    this.hintPulse = null;
    this.timeLeft = cfg.time;
    this.ringColor = pickRingColor(this.ringColor);
    this.facePool = pickPool(cfg.pool);
    this._levelFaces = this.facePool.slice();

    const size = cfg.size;
    const left = makeGrid(size, null);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        left[r][c] = this.facePool[Math.floor(Math.random() * this.facePool.length)];
      }
    }

    const right = makeGrid(size, null);
    const isDiff = makeGrid(size, false);
    const found = makeGrid(size, false);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) right[r][c] = left[r][c];
    }

    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) cells.push({ r: r, c: c });
    }
    shuffle(cells);
    let placed = 0;
    for (let i = 0; i < cells.length && placed < cfg.diffCount; i++) {
      const { r, c } = cells[i];
      const alt = otherFace(this.facePool, left[r][c]);
      if (alt === left[r][c]) continue;
      right[r][c] = alt;
      isDiff[r][c] = true;
      if (this._levelFaces.indexOf(alt) < 0) this._levelFaces.push(alt);
      placed++;
    }

    this.left = left;
    this.right = right;
    this.isDiff = isDiff;
    this.found = found;
    this._size = size;
    this._diffTarget = placed;
    this._layout();
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const adReserve = reservedBottom();
    this.stacked = W < 360;

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
      onTap: () => {
        this._newGame();
        this.flash('新开一局');
      },
    });

    // 道具栏紧贴广告区上方，避免与广告重叠
    const dockH = 48;
    const dockY = H - adReserve - dockH - 10;
    const bw = 108;
    const gapB = 16;
    const rowW = bw * 2 + gapB;
    let bx = (W - rowW) / 2;
    this.btnHint = new Button({
      x: bx,
      y: dockY,
      w: bw,
      h: dockH,
      label: '提示',
      sub: '看广告',
      badge: 'AD',
      style: 'dock',
      onTap: () => this._useHint(),
    });
    bx += bw + gapB;
    this.btnDelay = new Button({
      x: bx,
      y: dockY,
      w: bw,
      h: dockH,
      label: '延时',
      sub: '看广告',
      badge: 'AD',
      style: 'dock',
      onTap: () => this._useDelay(),
    });

    this.btnFailRetry = new Button({
      x: 0,
      y: 0,
      w: 112,
      h: 40,
      label: '重开本关',
      style: 'ghost',
      onTap: () => {
        this._newGame();
        this.flash('重开本局');
      },
    });
    this.btnFailTime = new Button({
      x: 0,
      y: 0,
      w: 140,
      h: 42,
      label: '看广告加时',
      style: 'revive',
      onTap: () => this._useDelay(true),
    });

    this.buttons = [this.btnBack, this.btnRetry, this.btnHint, this.btnDelay];
    this._dockY = dockY;

    // 标题/关卡 HUD 下方 ~ s.top+100，道具栏上方：游戏区垂直居中
    const top = s.top + 100;
    const bottom = dockY - 16;
    const availH = Math.max(120, bottom - top);
    const side = 10;
    const gap = this.stacked ? 10 : 14;
    const labelH = 18;

    if (this.stacked) {
      const boardW = W - side * 2;
      const eachH = Math.max(72, (availH - gap - labelH * 2) / 2);
      const boardS = Math.min(boardW, eachH);
      const blockH = labelH * 2 + boardS * 2 + gap;
      const blockTop = top + Math.max(0, (availH - blockH) / 2);
      this.leftX = (W - boardS) / 2;
      this.leftY = blockTop + labelH;
      this.rightX = this.leftX;
      this.rightY = this.leftY + boardS + gap + labelH;
      this.boardS = boardS;
      this._labelY = blockTop;
      this._labelY2 = this.rightY - labelH;
    } else {
      const maxW = (W - side * 2 - gap) / 2;
      const boardS = Math.min(maxW, Math.max(88, availH - labelH));
      const total = boardS * 2 + gap;
      const blockH = labelH + boardS;
      const blockTop = top + Math.max(0, (availH - blockH) / 2);
      this.leftX = (W - total) / 2;
      this.rightX = this.leftX + boardS + gap;
      this.leftY = blockTop + labelH;
      this.rightY = this.leftY;
      this.boardS = boardS;
      this._labelY = blockTop;
      this._labelY2 = blockTop;
    }
    this.cell = this.boardS / (this._size || 3);
  }

  _useHint() {
    if (this.over || this.allWon) {
      this.flash('本关已结束');
      return;
    }
    const unfound = [];
    for (let r = 0; r < this.isDiff.length; r++) {
      for (let c = 0; c < this.isDiff[r].length; c++) {
        if (this.isDiff[r][c] && !this.found[r][c]) unfound.push({ r: r, c: c });
      }
    }
    if (!unfound.length) {
      this.flash('都已找到啦');
      return;
    }
    this.flash('看广告揭晓一处…');
    showRewarded('spotHint', (ok, info) => {
      if (!ok) {
        this.flash(info === 'load_fail' ? '广告加载失败' : '未看完广告');
        return;
      }
      const pick = unfound[Math.floor(Math.random() * unfound.length)];
      this.hintPulse = { r: pick.r, c: pick.c, t: 2.2 };
      this.flash('看右侧闪烁格');
      daily.addPropUse();
    });
  }

  _useDelay(fromFail) {
    if (this.allWon) {
      this.flash('已全部通关');
      return;
    }
    if (!fromFail && this.over) {
      this.flash('时间已到 · 可点加时复活');
      return;
    }
    this.flash('看广告延时…');
    showRewarded('spotTime', (ok, info) => {
      if (!ok) {
        this.flash(info === 'load_fail' ? '广告加载失败' : '未看完广告');
        return;
      }
      this.timeLeft += 30;
      if (this.over) this.over = false;
      this.flash('延时 +30 秒！');
      sound.playClear();
      daily.addPropUse();
    });
  }

  _winLevel() {
    this.score += LEVEL_BONUS;
    sound.playWin();
    rank.submit('spot', this.score, { level: this.levelIndex + 1 });
    album.unlockMany(this._levelFaces);

    if (this.levelIndex + 1 >= LEVELS.length) {
      this.allWon = true;
      this.flash('全部通关！得分 ' + this.score);
      return;
    }
    const next = this.levelIndex + 1;
    this.flash('第 ' + (next + 1) + ' 关 · 加油');
    this._startLevel(next);
  }

  _tapRight(r, c) {
    if (this.over || this.allWon) return;
    if (r < 0 || c < 0 || r >= this._size || c >= this._size) return;

    if (!this.isDiff[r][c]) {
      this.missStreak++;
      this.timeLeft = Math.max(0, this.timeLeft - WRONG_TIME);
      this.score = Math.max(0, this.score - WRONG_SCORE);
      this.flash('不是不同点');
      sound.playTap();
      return;
    }
    if (this.found[r][c]) {
      this.flash('这个已经找过啦');
      sound.playTap();
      return;
    }

    this.found[r][c] = true;
    this.missStreak = 0;
    this.score += SCORE_PER_DIFF;

    const x = this.rightX + c * this.cell + this.cell / 2;
    const y = this.rightY + r * this.cell + this.cell / 2;
    const fill = colorOf(this.ringColor).fill;
    spawnShatter(this.shards, x, y, fill, this.cell * 0.32);
    sound.playClear();

    const stat = countFound(this.isDiff, this.found);
    if (stat.n >= stat.total) this._winLevel();
    else this.flash('找对 +' + SCORE_PER_DIFF + '（' + stat.n + '/' + stat.total + '）');
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showBanner('spot');
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    updateShards(this.shards, dt);

    if (this.hintPulse) {
      this.hintPulse.t -= dt;
      if (this.hintPulse.t <= 0) this.hintPulse = null;
    }

    if (!this.over && !this.allWon) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.over = true;
        this.flash('时间到啦');
        if (this.score > 0) rank.submit('spot', this.score, { level: this.levelIndex + 1 });
      }
    }

    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

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

      if (this.over || this.allWon) {
        if (this.btnFailRetry.handleTouch(tap.x, tap.y)) continue;
        if (this.over && this.btnFailTime.handleTouch(tap.x, tap.y)) continue;
        continue;
      }

      if (
        tap.x >= this.rightX &&
        tap.x < this.rightX + this.boardS &&
        tap.y >= this.rightY &&
        tap.y < this.rightY + this.boardS
      ) {
        const c = Math.floor((tap.x - this.rightX) / this.cell);
        const r = Math.floor((tap.y - this.rightY) / this.cell);
        this._tapRight(r, c);
      }
    }
  }

  _drawGrid(ctx, grid, x0, y0, opts) {
    opts = opts || {};
    const found = opts.found;
    const isDiff = opts.isDiff;
    const hint = opts.hint;
    const pad = 3;

    roundRect(ctx, x0, y0, this.boardS, this.boardS, 14);
    ctx.fillStyle = 'rgba(91,70,54,0.1)';
    ctx.fill();

    for (let r = 0; r < this._size; r++) {
      for (let c = 0; c < this._size; c++) {
        const x = x0 + c * this.cell + pad;
        const y = y0 + r * this.cell + pad;
        const cs = this.cell - pad * 2;
        roundRect(ctx, x, y, cs, cs, 10);
        ctx.fillStyle = 'rgba(255,248,236,0.9)';
        ctx.fill();

        const faceId = grid[r][c];
        const cx = x + cs / 2;
        const cy = y + cs / 2;
        const sel = found && found[r][c];
        if (hint && hint.r === r && hint.c === c && hint.t > 0) {
          const a = 0.25 + 0.35 * Math.sin(this.t * 16);
          ctx.fillStyle = 'rgba(255,230,80,' + a + ')';
          roundRect(ctx, x - 1, y - 1, cs + 2, cs + 2, 11);
          ctx.fill();
          ctx.strokeStyle = 'rgba(240,160,16,0.85)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (sel) {
          ctx.fillStyle = 'rgba(94,230,168,0.35)';
          roundRect(ctx, x, y, cs, cs, 10);
          ctx.fill();
        }

        drawDango(ctx, {
          x: cx,
          y: cy,
          r: cs * 0.44,
          face: faceId,
          color: this.ringColor,
          selected: sel,
        });

        if (isDiff && isDiff[r][c] && found && found[r][c]) {
          ctx.font = '800 11px ' + FONT;
          ctx.fillStyle = Theme.titleWin;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('✓', cx, y + cs - 2);
        }
      }
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
    if (!this.over && !this.allWon) {
      this.btnHint.draw(ctx);
      this.btnDelay.draw(ctx);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 22px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText('表情找不同', W * 0.5, s.top + 8);
    ctx.font = '600 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('对照左侧 · 点右侧不同表情', W * 0.5, s.top + 34);

    const stat = countFound(this.isDiff, this.found);
    const hudY = s.top + 58;
    ctx.font = '700 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('第 ' + (this.levelIndex + 1) + ' / ' + LEVELS.length + ' 关', Math.max(12, s.left), hudY);

    ctx.textAlign = 'center';
    const tCol = this.timeLeft <= 10 ? Theme.titleFail : Theme.ink;
    ctx.fillStyle = tCol;
    ctx.fillText('⏱ ' + Math.ceil(this.timeLeft) + ' 秒', W * 0.5, hudY);

    ctx.textAlign = 'right';
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText(stat.n + ' / ' + stat.total + ' 处', W - Math.max(12, s.right), hudY);

    ctx.textAlign = 'center';
    ctx.font = '800 16px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText('得分 ' + this.score, W * 0.5, hudY + 20);

    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = Theme.inkMute;
    ctx.fillText('参照', this.leftX + this.boardS / 2, this._labelY);
    ctx.fillText(
      '找不同',
      this.rightX + this.boardS / 2,
      this.stacked ? this.rightY - 18 : this._labelY
    );

    const hintCell =
      this.hintPulse && this.hintPulse.t > 0
        ? { r: this.hintPulse.r, c: this.hintPulse.c, t: this.hintPulse.t }
        : null;

    this._drawGrid(ctx, this.left, this.leftX, this.leftY, {});
    this._drawGrid(ctx, this.right, this.rightX, this.rightY, {
      found: this.found,
      isDiff: this.isDiff,
      hint: hintCell,
    });

    if (this._toastT > 0 && this._toast) {
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '700 14px ' + FONT;
      const tw = Math.min(W - 40, ctx.measureText(this._toast).width + 28);
      const ty = this.leftY - 6;
      roundRect(ctx, (W - tw) / 2, ty - 14, tw, 28, 10);
      ctx.fillStyle = 'rgba(255,248,236,0.92)';
      ctx.fill();
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._toast, W * 0.5, ty);
      ctx.globalAlpha = 1;
    }

    if (this.over || this.allWon) {
      this._drawSettle(ctx, W, H);
    }

    drawShards(ctx, this.shards);
  }

  _drawSettle(ctx, W, H) {
    const win = !!this.allWon;
    const s = P.safe;
    ctx.fillStyle = 'rgba(91,70,54,0.45)';
    ctx.fillRect(0, 0, W, H);

    const adTop = H - reservedBottom();
    const cardW = Math.min(300, W - 40);
    const cardH = win ? 190 : 230;
    const cardX = (W - cardW) / 2;
    const belowExtra = win ? 0 : 56; // 加时按钮避开底部广告
    let cardY = (H - cardH) / 2 - 20;
    const maxBottom = adTop - 8 - belowExtra;
    if (cardY + cardH > maxBottom) cardY = Math.max(s.top + 48, maxBottom - cardH);

    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    const cg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    if (win) {
      cg.addColorStop(0, Theme.cardWin0);
      cg.addColorStop(0.5, Theme.cardWin1);
      cg.addColorStop(1, Theme.cardWin2);
    } else {
      cg.addColorStop(0, Theme.cardFail0);
      cg.addColorStop(0.5, Theme.cardFail1);
      cg.addColorStop(1, Theme.cardFail2);
    }
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = win ? Theme.cardStrokeWin : Theme.cardStrokeFail;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 26px ' + FONT;
    ctx.fillStyle = win ? Theme.titleWin : Theme.titleFail;
    ctx.fillText(win ? '全部通关！' : '时间到', W * 0.5, cardY + 36);

    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = Theme.subText;
    ctx.fillText(win ? '再点右上重开挑战' : '还可以看广告加时', W * 0.5, cardY + 64);

    roundRect(ctx, cardX + 24, cardY + 82, cardW - 48, 44, 12);
    ctx.fillStyle = Theme.scoreBox;
    ctx.fill();
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('本局得分', W * 0.5, cardY + 96);
    ctx.font = '800 20px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText(String(this.score), W * 0.5, cardY + 116);

    if (win) {
      this.btnFailRetry.x = (W - 112) / 2;
      this.btnFailRetry.y = cardY + cardH - 56;
      this.btnFailRetry.w = 112;
      this.btnFailRetry.h = 40;
      this.btnFailRetry.label = '再玩一局';
      this.btnFailRetry.draw(ctx);
      return;
    }

    this.btnFailRetry.x = (W - 112) / 2;
    this.btnFailRetry.y = cardY + cardH - 56;
    this.btnFailRetry.w = 112;
    this.btnFailRetry.h = 40;
    this.btnFailRetry.label = '重开本关';
    this.btnFailRetry.draw(ctx);

    this.btnFailTime.x = (W - 140) / 2;
    this.btnFailTime.y = Math.min(cardY + cardH + 14, adTop - 50);
    this.btnFailTime.w = 140;
    this.btnFailTime.h = 42;
    this.btnFailTime.label = '看广告加时';
    this.btnFailTime.draw(ctx);
  }
}

module.exports = { SpotDiffScene };