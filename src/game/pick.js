'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const rank = require('../data/rank.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');

const GAMES = [
  {
    id: 'match',
    title: '表情大冲关',
    tip: '堆里点选 · 三消闯关',
    face: 'joy',
    color: 'crimson',
  },
  {
    id: 'fuse',
    title: '表情合成',
    tip: '2048 滑动合并',
    face: 'heart',
    color: 'pink',
  },
  {
    id: 'sudoku',
    title: '表情数独',
    tip: '九表情代数字',
    face: 'cool',
    color: 'mint',
  },
  {
    id: 'spot',
    title: '表情找不同',
    tip: '左右对照找茬',
    face: 'search',
    color: 'sky',
  },
  {
    id: 'match3',
    title: '表情消消乐',
    tip: '三消送边槽',
    face: 'sparkle',
    color: 'amber',
  },
];

const HELP = {
  match: [
    '· 点选场地团子，飞入底部槽位',
    '· 槽内 3 个同色同表情会碎裂消除',
    '· 槽位满了就失败',
    '· 达到目标分且未超时即过关',
    '· 道具 / 复活需观看激励视频',
  ],
  fuse: [
    '· 上下左右滑动，合并相同表情',
    '· 两只同款相撞 → 升成下一阶，终点是大笑',
    '· 道具需看激励：撤销 / 消除 / 续命',
    '· 棋盘满且无法合并则结束，可广告续命',
    '· 点「重开」换新颜色和新表情',
  ],
  sudoku: [
    '· 9 种表情代替数独 1～9',
    '· 同一行 / 列 / 九宫不能重复',
    '· 先点格子，再点底部表情填入',
    '· 凑齐一行/列/宫会发光闪烁',
    '· 道具需看激励：提示 / 填三格 / 清错 / 擦除',
  ],
  spot: [
    '· 左侧是参考图，右侧藏着不同表情',
    '· 点右侧不一样的格子即可找到',
    '· 点错会扣时间；提示需看激励视频',
    '· 找齐本关全部不同点即可过关',
    '· 共 6 关，格子越来越大、不同点更多',
  ],
  match3: [
    '· 交换相邻表情，三连及以上消除',
    '· 指定表情滚到「槽位对应列/行」的外围末格才能进槽，每槽只需 1 个',
    '· 第 1 关 1 个槽；每 5 关多 1 个槽，最多四边各 1 个',
    '· 前几关掉落方向固定；更后关卡才偶尔换向',
    '· 四连生成炸弹、L/T 生成十字斩，拖动后引爆',
  ],
};

/**
 * 玩法 / 排行：先选游戏，再看对应内容
 * opts.purpose = 'help' | 'rank'
 */
class PickScene {
  constructor(app, opts) {
    this.app = app;
    opts = opts || {};
    this.purpose = opts.purpose === 'rank' ? 'rank' : 'help';
    this.view = 'list'; // list | detail
    this.gameId = null;
    this.t = 0;
    this._layout();
    showBanner('list');
  }

  destroy() {
    hideBanner('list');
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    this._adReserve = reservedBottom();

    this.btnBack = new Button({
      x: Math.max(10, s.left),
      y: s.top + 4,
      w: 72,
      h: 36,
      label: '返回',
      style: 'ghost',
      onTap: () => {
        if (this.view === 'detail') {
          this.view = 'list';
          this.gameId = null;
          return;
        }
        this.app.goto('home');
      },
    });
    this.buttons = [this.btnBack];
    this._hits = [];
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
    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      if (this.btnBack.handleTouch(tap.x, tap.y)) continue;
      if (this.view !== 'list') continue;
      for (let j = 0; j < this._hits.length; j++) {
        const h = this._hits[j];
        if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) {
          this.gameId = GAMES[h.i].id;
          this.view = 'detail';
          break;
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 24px ' + FONT;
    ctx.fillStyle = Theme.ink;

    if (this.view === 'list') {
      ctx.fillText(this.purpose === 'rank' ? '选择游戏 · 排行' : '选择游戏 · 玩法', W * 0.5, s.top + 8);
      ctx.font = '500 13px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText('先选一个玩法，再查看对应内容', W * 0.5, s.top + 40);
      this._drawList(ctx, W, H, s);
    } else if (this.purpose === 'help') {
      this._drawHelp(ctx, W, H, s);
    } else {
      this._drawRank(ctx, W, H, s);
    }
  }

  _drawList(ctx, W, H, s) {
    this._hits = [];
    const pw = Math.min(340, W - 32);
    const px = (W - pw) / 2;
    const adReserve = this._adReserve || reservedBottom();
    const viewTop = s.top + 72;
    const viewBot = H - adReserve - 8;
    const n = GAMES.length;
    const gap = 10;
    const avail = Math.max(120, viewBot - viewTop);
    const h = Math.min(88, Math.floor((avail - gap * (n - 1)) / n));
    let y = viewTop;

    for (let i = 0; i < n; i++) {
      const m = GAMES[i];
      roundRect(ctx, px, y, pw, h, 18);
      ctx.fillStyle = '#fff8ee';
      ctx.fill();
      ctx.strokeStyle = 'rgba(91,70,54,0.12)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, px, y, pw, h, 18);
      ctx.stroke();

      drawDango(ctx, {
        x: px + 36,
        y: y + h / 2,
        r: Math.min(22, h * 0.28),
        face: m.face,
        color: m.color,
        selected: false,
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '800 18px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.fillText(m.title, px + 68, y + h / 2 - 12);
      ctx.font = '500 12px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText(m.tip, px + 68, y + h / 2 + 14);

      this._hits.push({ x: px, y: y, w: pw, h: h, i: i });
      y += h + gap;
    }
  }

  _drawHelp(ctx, W, H, s) {
    const title = rank.LABELS[this.gameId] || '玩法';
    ctx.fillText(title + ' · 怎么玩', W * 0.5, s.top + 8);

    const lines = HELP[this.gameId] || [];
    const pw = Math.min(340, W - 32);
    const ph = 56 + lines.length * 32 + 24;
    const px = (W - pw) / 2;
    const py = s.top + 56;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = Theme.cardWin1;
    ctx.fill();
    ctx.strokeStyle = Theme.cardStrokeFail;
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '500 14px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], px + 20, py + 24 + i * 32);
    }
  }

  _drawRank(ctx, W, H, s) {
    const title = rank.LABELS[this.gameId] || '排行';
    ctx.fillText(title + ' · 本机榜', W * 0.5, s.top + 8);

    const list = rank.getList(this.gameId);
    const pw = Math.min(340, W - 32);
    const adReserve = this._adReserve || reservedBottom();
    const ph = Math.min(H - s.top - adReserve - 80, 58 + Math.max(list.length, 1) * 28 + 40);
    const px = (W - pw) / 2;
    const py = s.top + 56;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = Theme.cardWin1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,200,120,0.45)';
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    if (!list.length) {
      ctx.font = '500 13px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.textAlign = 'center';
      ctx.fillText('还没有成绩 · 去玩一局吧', W * 0.5, py + ph / 2);
      return;
    }

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const rowY = py + 24 + i * 28;
      ctx.textAlign = 'left';
      ctx.font = '700 13px ' + FONT;
      ctx.fillStyle = i < 3 ? Theme.score : Theme.ink;
      ctx.fillText(i + 1 + '.', px + 20, rowY);
      ctx.fillText(row.score + ' 分', px + 48, rowY);
      ctx.textAlign = 'right';
      ctx.font = '500 12px ' + FONT;
      ctx.fillStyle = Theme.inkMute;
      const right =
        row.level && (this.gameId === 'match' || this.gameId === 'spot' || this.gameId === 'match3')
          ? '第 ' + row.level + ' 关'
          : row.tip || '';
      ctx.fillText(right, px + pw - 20, rowY);
    }
  }
}

module.exports = { PickScene };
