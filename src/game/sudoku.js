'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const sound = require('../audio/sound.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');
const { showRewarded } = require('../ads/rewarded.js');
const { rollSudokuSkin } = require('../data/mode-skin.js');
const { colorOf } = require('../data/faces.js');
const rank = require('../data/rank.js');
const daily = require('../data/daily.js');

function hexAlpha(hex, a) {
  let h = String(hex || '#f0a010').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!isFinite(n)) return 'rgba(240,160,16,' + a + ')';
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/**
 * 表情数独：9 表情代替 9 数字
 * 每局 / 换题：随机外围色 + 随机 9 表情
 */
class SudokuScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this._toast = '';
    this._toastT = 0;
    this.selected = null; // {r,c}
    this.palette = 0;
    this.won = false;
    this.ringColor = 'cream';
    this.symbols = [];
    this.glows = []; // { type, index, t }
    this._rollSkin();
    this._buildPuzzle(36); // 挖空约 36 格，偏简单
    this._layout();
    showBanner('sudoku');
  }

  _rollSkin() {
    const skin = rollSudokuSkin(this.ringColor);
    this.ringColor = skin.ringColor;
    this.symbols = skin.symbols;
  }

  destroy() {
    hideBanner('sudoku');
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.5;
  }

  _buildPuzzle(holes) {
    const full = generateSolved();
    this.solution = full;
    this.given = emptyBoard();
    this.board = emptyBoard();
    // 复制后随机挖空
    const cells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.board[r][c] = full[r][c];
        this.given[r][c] = true;
        cells.push({ r: r, c: c });
      }
    }
    shuffle(cells);
    const n = Math.min(holes, cells.length);
    for (let i = 0; i < n; i++) {
      const cell = cells[i];
      this.board[cell.r][cell.c] = null;
      this.given[cell.r][cell.c] = false;
    }
    this.won = false;
    this.selected = null;
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;

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
      label: '换题',
      style: 'gold',
      onTap: () => {
        this._rollSkin();
        this._buildPuzzle(36);
        this.flash('换题 · 新表情新颜色');
      },
    });
    // 自下而上：安全区 → 广告 → 表情盘 → 擦除 → 棋盘
    const adReserve = reservedBottom();
    const paletteH = 76;
    const eraseH = 36;
    const gap = 8;
    const dockBottom = H - adReserve;
    this.paletteY = dockBottom - paletteH;
    const eraseY = this.paletteY - gap - eraseH;
    const boardBottom = eraseY - gap;
    const top = s.top + 64;
    const board = Math.min(W - 20, Math.max(160, boardBottom - top));
    this.boardX = (W - board) / 2;
    // 贴着下方操作区，吃掉棋盘下空白
    this.boardY = boardBottom - board;
    this.boardS = board;
    this.cell = board / 9;

    const pw = 72;
    const gapP = 8;
    const rowW = pw * 4 + gapP * 3;
    let px = (W - rowW) / 2;
    this.btnHint = new Button({
      x: px,
      y: eraseY,
      w: pw,
      h: eraseH,
      label: '提示',
      style: 'dock',
      onTap: () => this._useProp('sudokuHint'),
    });
    px += pw + gapP;
    this.btnReveal = new Button({
      x: px,
      y: eraseY,
      w: pw,
      h: eraseH,
      label: '填三格',
      style: 'dock',
      onTap: () => this._useProp('sudokuReveal'),
    });
    px += pw + gapP;
    this.btnWipe = new Button({
      x: px,
      y: eraseY,
      w: pw,
      h: eraseH,
      label: '清错',
      style: 'dock',
      onTap: () => this._useProp('sudokuWipe'),
    });
    px += pw + gapP;
    this.btnClear = new Button({
      x: px,
      y: eraseY,
      w: pw,
      h: eraseH,
      label: '擦除',
      style: 'ghost',
      onTap: () => this._useProp('sudokuErase'),
    });
    this.buttons = [
      this.btnBack,
      this.btnRetry,
      this.btnHint,
      this.btnReveal,
      this.btnWipe,
      this.btnClear,
    ];
  }

  _cellGlowing(r, c) {
    for (let i = 0; i < this.glows.length; i++) {
      if (unitContains(this.glows[i], r, c)) return true;
    }
    return false;
  }

  _useProp(id) {
    if (this.won) {
      this.flash('已经完成啦');
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
    if (id === 'sudokuErase') {
      if (!this._eraseFree()) return;
      this.flash('已擦除');
    } else if (id === 'sudokuHint') {
      if (!fillOneHint(this.board, this.solution, this.given)) {
        this.flash('没有空格了');
        return;
      }
      this.flash('已填入一格提示');
      sound.playTap();
    } else if (id === 'sudokuReveal') {
      let n = 0;
      for (let i = 0; i < 3; i++) {
        if (fillOneHint(this.board, this.solution, this.given)) n++;
      }
      if (n <= 0) {
        this.flash('没有空格了');
        return;
      }
      this.flash('已填入 ' + n + ' 格');
      sound.playClear();
    } else if (id === 'sudokuWipe') {
      const n = wipeWrong(this.board, this.solution, this.given);
      this.flash(n > 0 ? '清掉 ' + n + ' 处错误' : '没有错误填写');
    }
    daily.addPropUse();
    if (isComplete(this.board)) {
      this.won = true;
      const score = Math.max(50, Math.floor(3000 - this.t * 8));
      rank.submit('sudoku', score);
      this.flash('数独完成！+' + score);
      sound.playWin();
    }
  }

  _eraseFree() {
    if (!this.selected || this.won) return false;
    const { r, c } = this.selected;
    if (this.given[r][c]) {
      this.flash('题目格不能改');
      return false;
    }
    if (this.board[r][c] == null) {
      this.flash('这里是空的');
      return false;
    }
    this.board[r][c] = null;
    return true;
  }

  _place(sym) {
    if (!this.selected || this.won) return;
    const { r, c } = this.selected;
    if (this.given[r][c]) {
      this.flash('题目格不能改');
      return;
    }
    if (!isValidPlace(this.board, r, c, sym)) {
      this.flash('这里放不下 · 行/列/宫冲突');
      sound.playTap();
      return;
    }
    this.board[r][c] = sym;
    sound.playTap();
    const units = findCompletedUnits(this.board);
    // 只闪本次新凑齐的：简单做法——当前行/列/宫若完整就闪
    const fresh = units.filter((u) => unitContains(u, r, c));
    if (fresh.length) {
      for (let i = 0; i < fresh.length; i++) {
        this.glows.push({ type: fresh[i].type, index: fresh[i].index, t: 0.7 });
      }
      sound.playChime();
    }
    if (isComplete(this.board)) {
      this.won = true;
      const score = Math.max(50, Math.floor(3000 - this.t * 8));
      rank.submit('sudoku', score);
      this.flash('数独完成！+' + score);
      sound.playWin();
    }
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showBanner('sudoku');
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    for (let i = this.glows.length - 1; i >= 0; i--) {
      this.glows[i].t -= dt;
      if (this.glows[i].t <= 0) this.glows.splice(i, 1);
    }
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      let hitBtn = false;
      for (let j = 0; j < this.buttons.length; j++) {
        if (this.buttons[j].handleTouch(tap.x, tap.y)) {
          hitBtn = true;
          break;
        }
      }
      if (hitBtn) continue;

      // 点棋盘
      if (
        tap.x >= this.boardX &&
        tap.x < this.boardX + this.boardS &&
        tap.y >= this.boardY &&
        tap.y < this.boardY + this.boardS
      ) {
        const c = Math.floor((tap.x - this.boardX) / this.cell);
        const r = Math.floor((tap.y - this.boardY) / this.cell);
        if (r >= 0 && r < 9 && c >= 0 && c < 9) {
          this.selected = { r: r, c: c };
        }
        continue;
      }

      // 点底部表情盘
      const pw = this.boardS;
      const px = this.boardX;
      const slot = pw / 9;
      if (
        tap.y >= this.paletteY &&
        tap.y <= this.paletteY + 70 &&
        tap.x >= px &&
        tap.x <= px + pw
      ) {
        const idx = Math.floor((tap.x - px) / slot);
        if (idx >= 0 && idx < 9) {
          this.palette = idx;
          this._place(idx);
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

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, Theme.bgTop);
    bg.addColorStop(0.5, Theme.bgMid);
    bg.addColorStop(1, Theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.btnBack.draw(ctx);
    this.btnRetry.draw(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 22px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText('表情数独', W * 0.5, s.top + 8);
    ctx.font = '600 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('9 表情代数字 · 行/列/宫不重复', W * 0.5, s.top + 36);

    // 棋盘底 + 线色跟表情外圈同色，减少色系打架
    const ringFill = colorOf(this.ringColor).fill;
    roundRect(ctx, this.boardX - 2, this.boardY - 2, this.boardS + 4, this.boardS + 4, 10);
    ctx.fillStyle = 'rgba(255,248,236,0.96)';
    ctx.fill();
    ctx.strokeStyle = hexAlpha(ringFill, 0.45);
    ctx.lineWidth = 2;
    roundRect(ctx, this.boardX - 2, this.boardY - 2, this.boardS + 4, this.boardS + 4, 10);
    ctx.stroke();

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = this.boardX + c * this.cell;
        const y = this.boardY + r * this.cell;
        const sel =
          this.selected && this.selected.r === r && this.selected.c === c;
        // 宫底色：同色浅染，去掉粉块
        const br = Math.floor(r / 3);
        const bc = Math.floor(c / 3);
        if ((br + bc) % 2 === 1) {
          ctx.fillStyle = hexAlpha(ringFill, 0.1);
          ctx.fillRect(x, y, this.cell, this.cell);
        }
        if (sel) {
          ctx.fillStyle = hexAlpha(ringFill, 0.28);
          ctx.fillRect(x, y, this.cell, this.cell);
        }
        if (this._cellGlowing(r, c)) {
          const pulse = 0.3 + 0.3 * Math.sin(this.t * 14);
          ctx.fillStyle = hexAlpha(ringFill, pulse);
          ctx.fillRect(x, y, this.cell, this.cell);
          ctx.strokeStyle = hexAlpha(ringFill, 0.9);
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
        }

        const v = this.board[r][c];
        if (v != null) {
          const meta = this.symbols[v];
          drawDango(ctx, {
            x: x + this.cell / 2,
            y: y + this.cell / 2,
            r: this.cell * 0.42,
            face: meta.face,
            color: this.ringColor,
            selected: false,
          });
        }
      }
    }

    // 网格线：与表情外圈同色（宫线更实、格线更淡）
    for (let i = 0; i <= 9; i++) {
      const thick = i % 3 === 0;
      ctx.strokeStyle = thick ? hexAlpha(ringFill, 0.72) : hexAlpha(ringFill, 0.28);
      ctx.lineWidth = thick ? 2.4 : 1;
      const x = this.boardX + i * this.cell;
      const y = this.boardY + i * this.cell;
      ctx.beginPath();
      ctx.moveTo(this.boardX, y);
      ctx.lineTo(this.boardX + this.boardS, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, this.boardY);
      ctx.lineTo(x, this.boardY + this.boardS);
      ctx.stroke();
    }

    // 底部选盘
    roundRect(ctx, this.boardX, this.paletteY, this.boardS, 70, 14);
    ctx.fillStyle = Theme.dock;
    ctx.fill();
    const slot = this.boardS / 9;
    for (let i = 0; i < 9; i++) {
      const meta = this.symbols[i];
      const cx = this.boardX + slot * i + slot / 2;
      const cy = this.paletteY + 28;
      if (this.palette === i) {
        ctx.beginPath();
        ctx.arc(cx, cy, slot * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(ringFill, 0.95);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      drawDango(ctx, {
        x: cx,
        y: cy,
        r: slot * 0.36,
        face: meta.face,
        color: this.ringColor,
        selected: false,
      });
      ctx.font = '600 9px ' + FONT;
      ctx.fillStyle = Theme.inkMute;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.name, cx, this.paletteY + 48);
    }

    this.btnHint.draw(ctx);
    this.btnReveal.draw(ctx);
    this.btnWipe.draw(ctx);
    this.btnClear.draw(ctx);

    if (this._toastT > 0 && this._toast) {
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '700 14px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText(this._toast, W * 0.5, this.boardY - 16);
      ctx.globalAlpha = 1;
    }

    if (this.won) {
      this._drawSettle(ctx, W, H);
    }
  }

  _drawSettle(ctx, W, H) {
    ctx.fillStyle = 'rgba(91,70,54,0.45)';
    ctx.fillRect(0, 0, W, H);

    const cardW = Math.min(300, W - 40);
    const cardH = 170;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2 - 20;

    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    const cg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cg.addColorStop(0, Theme.cardWin0);
    cg.addColorStop(0.5, Theme.cardWin1);
    cg.addColorStop(1, Theme.cardWin2);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = Theme.cardStrokeWin;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 26px ' + FONT;
    ctx.fillStyle = Theme.titleWin;
    ctx.fillText('完成！', W * 0.5, cardY + 48);

    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = Theme.subText;
    ctx.fillText('点右上「换题」再来一局', W * 0.5, cardY + 92);
  }
}

function emptyBoard() {
  const b = [];
  for (let r = 0; r < 9; r++) {
    b[r] = [];
    for (let c = 0; c < 9; c++) b[r][c] = null;
  }
  return b;
}

function generateSolved() {
  // 标准种子盘
  const base = [];
  for (let r = 0; r < 9; r++) {
    base[r] = [];
    for (let c = 0; c < 9; c++) {
      base[r][c] = (r * 3 + Math.floor(r / 3) + c) % 9;
    }
  }
  // 打乱数字映射
  const map = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  shuffle(map);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) base[r][c] = map[base[r][c]];
  }
  // 交换同行带 / 同列带
  shuffleBands(base, true);
  shuffleBands(base, false);
  return base;
}

function shuffleBands(board, rows) {
  const order = [0, 1, 2];
  shuffle(order);
  const copy = board.map((row) => row.slice());
  for (let band = 0; band < 3; band++) {
    for (let i = 0; i < 3; i++) {
      const from = order[band] * 3 + i;
      const to = band * 3 + i;
      if (rows) {
        board[to] = copy[from].slice();
      } else {
        for (let r = 0; r < 9; r++) board[r][to] = copy[r][from];
      }
    }
  }
  // 带内再洗
  for (let band = 0; band < 3; band++) {
    const inner = [0, 1, 2];
    shuffle(inner);
    const snap = board.map((row) => row.slice());
    for (let i = 0; i < 3; i++) {
      const from = band * 3 + inner[i];
      const to = band * 3 + i;
      if (rows) board[to] = snap[from].slice();
      else {
        for (let r = 0; r < 9; r++) board[r][to] = snap[r][from];
      }
    }
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function isValidPlace(board, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (i !== c && board[r][i] === v) return false;
    if (i !== r && board[i][c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if ((rr !== r || cc !== c) && board[rr][cc] === v) return false;
    }
  }
  return true;
}

function isComplete(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] == null) return false;
      if (!isValidPlace(board, r, c, board[r][c])) return false;
    }
  }
  return true;
}

function fillOneHint(board, solution, given) {
  const empties = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] == null) empties.push({ r: r, c: c });
    }
  }
  if (!empties.length) return false;
  const pick = empties[Math.floor(Math.random() * empties.length)];
  board[pick.r][pick.c] = solution[pick.r][pick.c];
  // 提示格视为锁定，避免擦掉
  if (given) given[pick.r][pick.c] = true;
  return true;
}

function wipeWrong(board, solution, given) {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (given[r][c]) continue;
      if (board[r][c] == null) continue;
      if (board[r][c] !== solution[r][c]) {
        board[r][c] = null;
        n++;
      }
    }
  }
  return n;
}

function unitFull(board, cells) {
  for (let i = 0; i < cells.length; i++) {
    if (board[cells[i].r][cells[i].c] == null) return false;
  }
  const seen = Object.create(null);
  for (let i = 0; i < cells.length; i++) {
    const v = board[cells[i].r][cells[i].c];
    if (seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

function findCompletedUnits(board) {
  const out = [];
  for (let r = 0; r < 9; r++) {
    const cells = [];
    for (let c = 0; c < 9; c++) cells.push({ r: r, c: c });
    if (unitFull(board, cells)) out.push({ type: 'row', index: r });
  }
  for (let c = 0; c < 9; c++) {
    const cells = [];
    for (let r = 0; r < 9; r++) cells.push({ r: r, c: c });
    if (unitFull(board, cells)) out.push({ type: 'col', index: c });
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells = [];
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) cells.push({ r: r, c: c });
      }
      if (unitFull(board, cells)) out.push({ type: 'box', index: br * 3 + bc });
    }
  }
  return out;
}

function unitContains(u, r, c) {
  if (u.type === 'row') return u.index === r;
  if (u.type === 'col') return u.index === c;
  const br = Math.floor(r / 3);
  const bc = Math.floor(c / 3);
  return u.index === br * 3 + bc;
}

module.exports = { SudokuScene };
