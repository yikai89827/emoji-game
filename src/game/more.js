'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const { FACES } = require('../data/faces.js');
const album = require('../data/album.js');
const { showRewarded } = require('../ads/rewarded.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');
const { spawnFirework, updateShards, drawShards } = require('../render/fx.js');
const sound = require('../audio/sound.js');

const MODES = [
  {
    id: 'fuse2048',
    title: '表情合成',
    tip: '2048 玩法 · 滑动合并同款表情',
    color: '#ffb4c4',
    face: 'joy',
  },
  {
    id: 'sudoku',
    title: '表情数独',
    tip: '9 表情代替数字 · 行列表宫不重复',
    color: '#7ad9b8',
    face: 'cool',
  },
  {
    id: 'spotdiff',
    title: '表情找不同',
    tip: '左右对照 · 找出不一样的表情',
    color: '#9ad0ff',
    face: 'search',
  },
  {
    id: 'match3',
    title: '表情消消乐',
    tip: '三消送槽 · 重力随机 · 炸弹十字斩',
    color: '#ffd28a',
    face: 'sparkle',
  },
  {
    id: 'album',
    title: '表情图鉴',
    tip: '收集解锁全部表情',
    color: '#ffe566',
    face: 'star',
  },
];

/**
 * 更多玩法入口 + 表情图鉴（全量 / 锁 / 广告解锁）
 */
class MoreScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.view = 'list'; // list | album
    this.zoomFace = null;
    this.zoomColor = 'cream';
    this.zoomLocked = false;
    this._toast = '';
    this._toastT = 0;
    this.albumScroll = 0;
    this.listScroll = 0;
    this._drag = null;
    this.shards = [];
    this.unlockFxT = 0;
    this._layout();
    showBanner('list');
  }

  destroy() {
    hideBanner('list');
  }

  _playUnlockFx() {
    const W = P.width;
    const H = P.height;
    spawnFirework(this.shards, W * 0.5, H * 0.42, W, H);
    sound.playUnlock();
    this.unlockFxT = 1.4;
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.6;
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const adReserve = reservedBottom();
    this._adReserve = adReserve;

    this.btnBack = new Button({
      x: Math.max(10, s.left),
      y: s.top + 4,
      w: 72,
      h: 36,
      label: '返回',
      style: 'ghost',
      onTap: () => {
        if (this.zoomFace) {
          this.zoomFace = null;
          this.zoomLocked = false;
          return;
        }
        if (this.view !== 'list') {
          this.view = 'list';
          return;
        }
        this.app.goto('home');
      },
    });

    this.buttons = [this.btnBack];
    this._modeHits = [];
    this._faceHits = [];

    const cols = 4;
    const pad = 14;
    const gridTop = s.top + 64;
    const cell = Math.min(72, Math.floor((W - pad * 2) / cols));
    this._album = {
      cols: cols,
      cell: cell,
      gridTop: gridTop,
      startX: (W - cols * cell) / 2,
      viewH: H - adReserve - gridTop - 12,
      contentH: Math.ceil(FACES.length / cols) * cell,
    };
    this._clampScroll();
  }

  _clampScroll() {
    const a = this._album;
    if (a) {
      const max = Math.max(0, a.contentH - a.viewH);
      this.albumScroll = Math.max(0, Math.min(max, this.albumScroll));
    }
    const L = this._list;
    if (L) {
      const maxL = Math.max(0, L.contentH - L.viewH);
      this.listScroll = Math.max(0, Math.min(maxL, this.listScroll));
    }
  }

  _tryUnlock(face) {
    if (!face) return;
    if (album.isUnlocked(face.id)) {
      this.zoomFace = face;
      this.zoomLocked = false;
      this.zoomColor = 'cream';
      return;
    }
    const left = album.adUnlockLeft();
    if (left <= 0) {
      this.flash('今日图鉴广告解锁已达上限（3 次）');
      return;
    }
    this.flash('看广告解锁「' + (face.name || face.id) + '」…');
    showRewarded('albumUnlock', (ok, info) => {
      if (!ok) {
        this.flash(info === 'load_fail' ? '广告加载失败' : '未看完广告');
        return;
      }
      const res = album.unlockByAd(face.id);
      if (!res.ok) {
        this.flash(res.reason === 'limit' ? '今日次数已用完' : '已解锁');
        return;
      }
      this.zoomFace = face;
      this.zoomLocked = false;
      this.zoomColor = 'amber';
      this._playUnlockFx();
      this.flash('解锁成功 · 今日还可解锁 ' + res.left + ' 次');
    });
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showBanner('list');
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    if (this.unlockFxT > 0) this.unlockFxT -= dt;
    updateShards(this.shards, dt);
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

    const ptr = P.pointer;
    if (!this.zoomFace && (this.view === 'album' || this.view === 'list')) {
      if (ptr.justPressed) {
        this._drag = {
          y: ptr.y,
          scroll: this.view === 'album' ? this.albumScroll : this.listScroll,
          moved: false,
        };
      }
      if (ptr.down && this._drag) {
        const dy = this._drag.y - ptr.y;
        if (Math.abs(dy) > 6) this._drag.moved = true;
        if (this.view === 'album') this.albumScroll = this._drag.scroll + dy;
        else this.listScroll = this._drag.scroll + dy;
        this._clampScroll();
      }
    }

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      if (this.zoomFace) {
        // 锁定态：点蒙层尝试解锁；已解锁：关闭
        if (this.zoomLocked) {
          this._tryUnlock(this.zoomFace);
        } else {
          this.zoomFace = null;
        }
        this._drag = null;
        continue;
      }
      if (this.btnBack.handleTouch(tap.x, tap.y)) {
        this._drag = null;
        continue;
      }

      if (this.view === 'list') {
        if (this._drag && this._drag.moved) {
          this._drag = null;
          continue;
        }
        for (let j = 0; j < this._modeHits.length; j++) {
          const h = this._modeHits[j];
          if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) {
            const m = MODES[h.i];
            if (m.id === 'fuse2048') this.app.goto('fuse2048');
            else if (m.id === 'sudoku') this.app.goto('sudoku');
            else if (m.id === 'spotdiff') this.app.goto('spotdiff');
            else if (m.id === 'match3') this.app.goto('match3');
            else if (m.id === 'album') {
              this.view = 'album';
              this.albumScroll = 0;
            }
            break;
          }
        }
      } else if (this.view === 'album') {
        if (this._drag && this._drag.moved) {
          this._drag = null;
          continue;
        }
        for (let j = 0; j < this._faceHits.length; j++) {
          const h = this._faceHits[j];
          if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) {
            const face = FACES[h.i];
            const unlocked = album.isUnlocked(face.id);
            if (unlocked) {
              this.zoomFace = face;
              this.zoomLocked = false;
              this.zoomColor = ['cream', 'pink', 'mint', 'sky'][h.i % 4];
            } else {
              this.zoomFace = face;
              this.zoomLocked = true;
              this.zoomColor = 'cream';
            }
            break;
          }
        }
      }
      this._drag = null;
    }
    if (ptr.justReleased) this._drag = null;
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 24px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText(this.view === 'album' ? '表情图鉴' : '更多玩法', W * 0.5, s.top + 8);

    if (this.view === 'list') this._drawList(ctx, W, H, s);
    else this._drawAlbum(ctx, W, H, s);

    if (this.zoomFace) this._drawZoom(ctx, W, H);

    // 解锁礼花盖在最上层
    if (this.shards.length) drawShards(ctx, this.shards);
    if (this.unlockFxT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.unlockFxT * 2);
      ctx.font = '900 36px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(91,70,54,0.35)';
      ctx.lineWidth = 6;
      ctx.strokeText('解锁！', W * 0.5, H * 0.22);
      ctx.fillStyle = '#ffe566';
      ctx.fillText('解锁！', W * 0.5, H * 0.22);
      ctx.restore();
    }

    if (this._toastT > 0 && this._toast) {
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '600 14px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.fillText(this._toast, W * 0.5, H - (this._adReserve || reservedBottom()) - 16);
      ctx.globalAlpha = 1;
    }
  }

  _drawList(ctx, W, H, s) {
    this._modeHits = [];
    const pw = Math.min(340, W - 32);
    const px = (W - pw) / 2;
    const headY = s.top + 48;
    const itemH = 76;
    const gap = 10;
    const viewTop = headY + 28;
    const adReserve = this._adReserve || reservedBottom();
    const viewH = H - adReserve - viewTop - 12;
    this._list = {
      viewTop: viewTop,
      viewH: viewH,
      contentH: MODES.length * (itemH + gap),
    };
    this._clampScroll();

    ctx.font = '500 13px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.textAlign = 'center';
    ctx.fillText('合成 · 数独 · 找不同 · 消消乐 · 图鉴', W * 0.5, headY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewTop - 4, W, viewH + 8);
    ctx.clip();

    const colors = ['pink', 'mint', 'sky', 'amber', 'cream'];
    for (let i = 0; i < MODES.length; i++) {
      const m = MODES[i];
      const y = viewTop + i * (itemH + gap) - this.listScroll;
      if (y + itemH < viewTop - 8 || y > viewTop + viewH + 8) continue;
      roundRect(ctx, px, y, pw, itemH, 16);
      ctx.fillStyle = '#fff8ee';
      ctx.fill();
      ctx.strokeStyle = 'rgba(91,70,54,0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, px, y, pw, itemH, 16);
      ctx.stroke();

      drawDango(ctx, {
        x: px + 34,
        y: y + itemH / 2,
        r: 20,
        face: m.face,
        color: colors[i % colors.length],
        selected: false,
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 17px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.fillText(m.title, px + 64, y + itemH / 2 - 10);
      ctx.font = '500 12px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText(m.tip, px + 64, y + itemH / 2 + 12);

      this._modeHits.push({ x: px, y: y, w: pw, h: itemH, i: i });
    }
    ctx.restore();
  }

  _drawAlbum(ctx, W, H, s) {
    this._faceHits = [];
    const a = this._album;
    const unlockedN = album.unlockedCount();
    const left = album.adUnlockLeft();

    ctx.font = '500 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.textAlign = 'center';
    ctx.fillText(
      '已解锁 ' + unlockedN + '/' + FACES.length + ' · 广告解锁剩 ' + left + ' 次/天 · 可上下滑',
      W * 0.5,
      a.gridTop - 22
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, a.gridTop, W, a.viewH);
    ctx.clip();

    for (let i = 0; i < FACES.length; i++) {
      const col = i % a.cols;
      const row = Math.floor(i / a.cols);
      const x = a.startX + col * a.cell + a.cell / 2;
      const y = a.gridTop + row * a.cell + a.cell / 2 - this.albumScroll;
      if (y < a.gridTop - a.cell || y > a.gridTop + a.viewH + a.cell) continue;

      const face = FACES[i];
      const unlocked = album.isUnlocked(face.id);
      const color = ['cream', 'pink', 'mint', 'sky'][i % 4];
      // 外圈放大，名称画在圆内底部
      const ringR = a.cell * 0.44;
      const faceY = y - a.cell * 0.06;
      const faceR = a.cell * 0.30;

      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,252,245,0.92)';
      ctx.fill();
      ctx.strokeStyle = unlocked ? 'rgba(122,184,220,0.85)' : 'rgba(91,70,54,0.22)';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      drawDango(ctx, {
        x: x,
        y: faceY,
        r: faceR,
        face: face.id,
        color: color,
        selected: false,
      });

      if (!unlocked) {
        ctx.beginPath();
        ctx.arc(x, faceY, faceR * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40,28,20,0.55)';
        ctx.fill();
        ctx.font = '700 16px ' + FONT;
        ctx.fillStyle = '#fff8ee';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', x, faceY);
      }

      ctx.font = '600 10px ' + FONT;
      ctx.fillStyle = unlocked ? Theme.inkSoft : 'rgba(91,70,54,0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unlocked ? face.name || face.id : '未解锁', x, y + ringR * 0.62);

      this._faceHits.push({
        x: x - a.cell / 2,
        y: y - a.cell / 2,
        w: a.cell,
        h: a.cell,
        i: i,
      });
    }
    ctx.restore();
  }

  _drawZoom(ctx, W, H) {
    const face = this.zoomFace;
    if (!face) return;
    ctx.fillStyle = 'rgba(91,70,54,0.55)';
    ctx.fillRect(0, 0, W, H);

    const r = Math.min(W, H) * 0.28;
    drawDango(ctx, {
      x: W * 0.5,
      y: H * 0.4,
      r: r,
      face: face.id,
      color: this.zoomColor || 'cream',
      selected: false,
    });

    if (this.zoomLocked) {
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.4, r * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,28,20,0.5)';
      ctx.fill();
      ctx.font = '800 42px ' + FONT;
      ctx.fillStyle = '#fff8ee';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', W * 0.5, H * 0.4);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 28px ' + FONT;
    ctx.fillStyle = '#fff8ee';
    ctx.fillText(face.name || face.id, W * 0.5, H * 0.4 + r + 20);
    ctx.font = '500 13px ' + FONT;
    ctx.fillStyle = 'rgba(255,248,236,0.9)';
    if (this.zoomLocked) {
      ctx.fillText('点击看广告解锁 · 今日剩 ' + album.adUnlockLeft() + ' 次', W * 0.5, H * 0.4 + r + 56);
      ctx.fillText('也可通关主玩法自然解锁', W * 0.5, H * 0.4 + r + 78);
    } else {
      ctx.fillText('点击任意处关闭', W * 0.5, H * 0.4 + r + 56);
    }
  }
}

module.exports = { MoreScene };
