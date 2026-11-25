'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const sound = require('../audio/sound.js');
const daily = require('../data/daily.js');
const { showHomeBanner, hideHomeBanner, reservedBottom } = require('../ads/custom-ad.js');
const { APP_VERSION } = require('../system/update.js');

/**
 * 经典♥判定：双圆叶瓣 + 尖底锥，顶部心窝挖空
 * nx∈[-1,1], ny∈[-1,1]，尖朝下
 */
function inHeartNorm(nx, ny) {
  const x = Math.abs(nx); // 判定用绝对 x，天然左右对称
  const y = ny;
  // 顶部心窝挖空（挖掉中间几颗）
  if (y < -0.22 && x < 0.34) return false;
  if (y < -0.40 && x < 0.52) return false;

  const lobeX = 0.44;
  const lobeY = -0.26;
  const lobeR = 0.54;
  const inLobe = Math.hypot(nx - lobeX, y - lobeY) <= lobeR ||
    Math.hypot(nx + lobeX, y - lobeY) <= lobeR;

  // 中段填实（堆实，不留底侧空洞）
  let inBody = false;
  if (y >= -0.12 && y < 0.38) {
    const half = 0.84 - Math.max(0, y) * 0.25;
    inBody = x <= half;
  }

  // 尖底对称收束到中心一点
  let inTip = false;
  if (y >= 0.32 && y <= 1.08) {
    const t = (y - 0.32) / (1.08 - 0.32);
    const half = (1 - t) * (1 - t) * 0.7;
    inTip = x <= Math.max(0.05, half);
  }

  return inLobe || inBody || inTip;
}

/**
 * 实心红心：按行生成中轴对称坐标（不先采半边再镜像，避免六边形偏移造成左右不齐）
 */
function buildHeartFill(r, halfW, halfH) {
  const minD = r * 2 + 1.2;
  const stepY = minD * 0.866;
  const stepX = minD;
  const sx = Math.max(halfW, 1);
  const sy = Math.max(halfH, 1);
  const picked = [];
  let row = 0;
  for (let y = -sy; y <= sy + 0.1; y += stepY, row++) {
    // 每行从中轴向外对称铺：0, ±1, ±2…（奇数行半步偏移也成对）
    const xOff = (row % 2) * (stepX * 0.5);
    const cols = [];
    if (xOff < 0.01) {
      cols.push(0);
      for (let k = 1; k * stepX <= sx + 0.1; k++) {
        cols.push(-k * stepX, k * stepX);
      }
    } else {
      for (let k = 0; xOff + k * stepX <= sx + 0.1; k++) {
        const x = xOff + k * stepX;
        cols.push(-x, x);
      }
    }
    for (let i = 0; i < cols.length; i++) {
      const x = cols[i];
      if (!inHeartNorm(x / sx, y / sy)) continue;
      let ok = true;
      for (let j = 0; j < picked.length; j++) {
        if (Math.hypot(x - picked[j].dx, y - picked[j].dy) < minD - 0.05) {
          ok = false;
          break;
        }
      }
      if (ok) picked.push({ dx: x, dy: y });
    }
  }
  // 保证尖底有中心点，底部左右对称收束
  const tip = { dx: 0, dy: sy * 0.92 };
  let tipOk = true;
  for (let j = 0; j < picked.length; j++) {
    if (Math.hypot(tip.dx - picked[j].dx, tip.dy - picked[j].dy) < minD - 0.05) {
      tipOk = false;
      break;
    }
  }
  if (tipOk && inHeartNorm(0, tip.dy / sy)) picked.push(tip);
  return picked;
}

/**
 * 首页：左栏音频/玩法/每日 · 右栏分享/排行/更多 + 开始 + 底部模板广告
 */
class HomeScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.showDaily = false;
    this._toast = '';
    this._toastT = 0;
    sound.init();
    sound.playBgm();
    this._layout();
    showHomeBanner();
  }

  destroy() {
    hideHomeBanner();
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.4;
  }

  _sideBtn(x, y, icon, label, onTap) {
    return new Button({
      x: x,
      y: y,
      w: 52,
      h: 52,
      icon: icon,
      label: label,
      style: 'dock',
      onTap: onTap,
    });
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const adReserve = reservedBottom();
    const colW = Math.min(260, W - 56);
    const cx = (W - colW) / 2;
    // 开始按钮抬到广告区之上
    const by = H - s.bottom - adReserve - 72;

    this.btnStart = new Button({
      x: cx,
      y: by,
      w: colW,
      h: 54,
      label: '开始游戏',
      style: 'gold',
      onTap: () => {
        hideHomeBanner();
        this.app.goto('game', { level: 0 });
      },
    });

    // 左侧：音频、玩法、每日
    const lx = Math.max(10, s.left);
    const ly = s.top + 8;
    this.btnAudio = this._sideBtn(lx, ly, sound.isOn() ? '🔊' : '🔇', '声音', () => {
      const on = sound.toggle();
      this.btnAudio.icon = on ? '🔊' : '🔇';
      this.flash(on ? '声音已开' : '声音已关');
    });
    this.btnHelp = this._sideBtn(lx, ly + 64, '❔', '玩法', () => {
      hideHomeBanner();
      this.app.goto('pick', { purpose: 'help' });
    });
    this.btnDaily = this._sideBtn(lx, ly + 128, '📅', '每日', () => {
      this.showDaily = true;
    });

    // 右侧贴边：分享 / 排行 / 更多
    const rx = W - 56;
    this.btnShare = this._sideBtn(rx, ly, 'share', '分享', () => this._share());
    this.btnRank = this._sideBtn(rx, ly + 64, 'rank', '排行', () => {
      hideHomeBanner();
      this.app.goto('pick', { purpose: 'rank' });
    });
    this.btnMore = this._sideBtn(rx, ly + 128, 'more', '更多', () => {
      hideHomeBanner();
      this.app.goto('more');
    });

    this.btnCloseModal = new Button({
      x: W / 2 - 60,
      y: H * 0.72,
      w: 120,
      h: 40,
      label: '知道了',
      style: 'ghost',
      visible: false,
      onTap: () => {
        this.showDaily = false;
      },
    });

    this.buttons = [
      this.btnStart,
      this.btnAudio,
      this.btnHelp,
      this.btnDaily,
      this.btnShare,
      this.btnRank,
      this.btnMore,
      this.btnCloseModal,
    ];

    // 装饰团子：实心小红心密铺，同平面不重叠、不抖动
    this.decos = [];
    const palette = ['crimson', 'amber', 'leaf'];
    const showcase = [
      'heart', 'wink', 'sprout', 'star', 'cool', 'doggo', 'love', 'sparkle',
      'smile', 'joy', 'dizzy', 'fight', 'mask', 'shy', 'sob', 'gasp',
      'sleep', 'rage', 'skull', 'thumbsup', 'kiss', 'soot', 'confuse', 'rofl',
    ];
    const pileX = W * 0.5;
    const pileY = Math.min(H * 0.45, by - 100);
    const faceR = Math.min(24, Math.max(18, W * 0.058));
    // 红心随表情加大，整体略放大
    const halfW = Math.min(W * 0.34, 138);
    const halfH = Math.min(W * 0.32, 128);
    const heart = buildHeartFill(faceR, halfW, halfH);
    for (let i = 0; i < heart.length; i++) {
      const p = heart[i];
      this.decos.push({
        x: pileX + p.dx,
        y: pileY + p.dy,
        r: faceR,
        face: showcase[i % showcase.length],
        color: palette[i % palette.length],
      });
    }
  }

  _share() {
    const title = '表情大冲关 · 表情玩法合集！';
    const imageUrl = '';
    if (typeof wx !== 'undefined' && wx.shareAppMessage) {
      try {
        wx.shareAppMessage({
          title: title,
          imageUrl: imageUrl || undefined,
        });
        this.flash('已调起分享');
        return;
      } catch (e) { /* fallthrough */ }
    }
    this.flash('请在微信小游戏内分享');
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showHomeBanner();
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);
    this.btnCloseModal.visible = this.showDaily;
    this.btnAudio.icon = sound.isOn() ? '🔊' : '🔇';

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      // 微信需用户手势后才能出声
      sound.playBgm();
      if (this.showDaily) {
        if (this.btnCloseModal.handleTouch(tap.x, tap.y)) continue;
        if (this._hitDailyClaim(tap.x, tap.y)) continue;
        this.showDaily = false;
        continue;
      }
      for (let j = 0; j < this.buttons.length; j++) {
        if (this.buttons[j].handleTouch(tap.x, tap.y)) break;
      }
    }
  }

  _hitDailyClaim(x, y) {
    if (!this._dailyHit) return false;
    for (let i = 0; i < this._dailyHit.length; i++) {
      const h = this._dailyHit[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
        const st = daily.getState();
        const task = daily.TASKS[i];
        if (!task) return true;
        if (st.claimed && st.claimed[task.id]) {
          this.flash('已领取');
          return true;
        }
        if (!task.need(st)) {
          this.flash('尚未完成');
          return true;
        }
        daily.claim(task.id);
        this.flash('领取成功 · ' + task.tip);
        return true;
      }
    }
    return false;
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

    // 软光点
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const sx = ((i * 97) % W);
      const sy = ((i * 53) % (H * 0.55));
      const tw = 0.5 + 0.5 * Math.sin(this.t * 1.5 + i);
      ctx.globalAlpha = 0.12 + 0.28 * tw;
      ctx.fillStyle = i % 3 === 0 ? '#ffb4c4' : i % 3 === 1 ? '#7ad9b8' : '#ffe566';
      ctx.beginPath();
      ctx.arc(sx, sy + s.top * 0.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.4;
    const blob = ctx.createRadialGradient(W * 0.5, H * 0.42, 20, W * 0.5, H * 0.48, 220);
    blob.addColorStop(0, 'rgba(255,208,224,0.9)');
    blob.addColorStop(0.55, 'rgba(200,245,228,0.35)');
    blob.addColorStop(1, 'rgba(255,241,214,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, W, H * 0.6);
    ctx.restore();

    for (let i = 0; i < this.decos.length; i++) {
      const d = this.decos[i];
      drawDango(ctx, {
        x: d.x,
        y: d.y,
        r: d.r,
        face: d.face,
        color: d.color,
        selected: false,
      });
    }

    const titleY = s.top + 28;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 38px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.shadowColor = Theme.glowPink;
    ctx.shadowBlur = 12;
    ctx.fillText('表情大冲关', W * 0.5, titleY);
    ctx.shadowBlur = 0;

    ctx.font = '500 13px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('表情玩法合集 · 点亮你的小宇宙', W * 0.5, titleY + 48);
    ctx.font = '500 11px ' + FONT;
    ctx.fillStyle = Theme.inkMute;
    ctx.fillText('v' + APP_VERSION, W * 0.5, titleY + 68);

    // 侧栏圆形按钮：单独画得更像参考图
    this._drawSideFab(ctx, this.btnAudio);
    this._drawSideFab(ctx, this.btnHelp);
    this._drawSideFab(ctx, this.btnDaily);
    this._drawSideFab(ctx, this.btnShare);
    this._drawSideFab(ctx, this.btnRank);
    this._drawSideFab(ctx, this.btnMore);

    this.btnStart.draw(ctx);

    if (this._toastT > 0 && this._toast) {
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '600 14px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText(this._toast, W * 0.5, this.btnStart.y - 28);
      ctx.globalAlpha = 1;
    }

    if (this.showDaily) this._drawDaily(ctx, W, H);
  }

  _drawSideFab(ctx, btn) {
    if (!btn || !btn.visible) return;
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    const r = 24;
    const iconY = btn.label ? cy - 6 : cy;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = Theme.mint;
    ctx.shadowColor = Theme.glowMint;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (btn.icon === 'share') {
      this._drawShareIcon(ctx, cx, iconY, 11);
    } else if (btn.icon === 'rank') {
      this._drawRankIcon(ctx, cx, iconY, 10);
    } else if (btn.icon === 'more') {
      this._drawMoreIcon(ctx, cx, iconY, 10);
    } else {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 18px ' + FONT;
      ctx.fillText(btn.icon || '', cx, iconY);
    }
    if (btn.label) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 10px ' + FONT;
      ctx.fillText(btn.label, cx, cy + 14);
    }
    ctx.restore();
  }

  /** 弯曲旋转分享箭头 */
  _drawShareIcon(ctx, cx, cy, s) {
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 弯曲主弧（自左下旋向右上）
    ctx.beginPath();
    ctx.arc(cx - 1, cy + 1, s * 0.72, Math.PI * 0.85, Math.PI * 1.95, false);
    ctx.stroke();
    // 箭头尖
    const tipX = cx + s * 0.55;
    const tipY = cy - s * 0.55;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - s * 0.55, tipY - s * 0.08);
    ctx.lineTo(tipX - s * 0.12, tipY + s * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  _drawRankIcon(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    const bars = [0.45, 0.85, 0.65];
    const gap = s * 0.55;
    const base = cy + s * 0.55;
    for (let i = 0; i < 3; i++) {
      const h = s * bars[i] * 1.4;
      const x = cx + (i - 1) * gap - s * 0.18;
      roundRect(ctx, x, base - h, s * 0.36, h, 2);
      ctx.fill();
    }
  }

  _drawMoreIcon(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * s * 0.7, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDaily(ctx, W, H) {
    ctx.fillStyle = Theme.dim;
    ctx.fillRect(0, 0, W, H);

    const pw = Math.min(320, W - 36);
    const ph = 58 + daily.TASKS.length * 68 + 64;
    const px = (W - pw) / 2;
    const py = Math.max(P.safe.top + 8, H * 0.5 - ph / 2);
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = Theme.cardWin1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,160,16,0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 20px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText('每日任务', W * 0.5, py + 18);

    const st = daily.getState();
    this._dailyHit = [];
    const tasks = daily.TASKS;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const rowY = py + 58 + i * 68;
      roundRect(ctx, px + 16, rowY, pw - 32, 58, 12);
      ctx.fillStyle = Theme.scoreBox;
      ctx.fill();

      const done = task.need(st);
      const claimed = !!(st.claimed && st.claimed[task.id]);

      ctx.textAlign = 'left';
      ctx.font = '700 14px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.fillText(task.title, px + 28, rowY + 10);
      ctx.font = '500 11px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText(task.tip, px + 28, rowY + 32);

      const bw = 64;
      const bx = px + pw - 32 - bw;
      const by = rowY + 14;
      roundRect(ctx, bx, by, bw, 30, 10);
      if (claimed) {
        ctx.fillStyle = 'rgba(91,70,54,0.1)';
      } else if (done) {
        ctx.fillStyle = Theme.gold;
      } else {
        ctx.fillStyle = 'rgba(91,70,54,0.08)';
      }
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = claimed ? Theme.inkMute : done ? Theme.goldInk : Theme.inkMute;
      ctx.fillText(claimed ? '已领' : done ? '领取' : '未完成', bx + bw / 2, by + 15);

      this._dailyHit.push({ x: bx, y: by, w: bw, h: 30, id: task.id });
    }

    this.btnCloseModal.y = py + ph - 52;
    this.btnCloseModal.x = px + (pw - this.btnCloseModal.w) / 2;
    this.btnCloseModal.label = '关闭';
    this.btnCloseModal.draw(ctx);
  }
}

module.exports = { HomeScene };
