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
    this.rankTab = 'friend'; // friend | global
    this.rankScroll = 0;
    this._drag = null;
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
          this.rankScroll = 0;
          return;
        }
        this.app.goto('home');
      },
    });
    this.buttons = [this.btnBack];
    this._hits = [];
    this._tabHits = [];
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

    const ptr = P.pointer;
    if (this.view === 'detail' && this.purpose === 'rank' && this._rankView) {
      const rv = this._rankView;
      if (ptr.justPressed && ptr.y >= rv.top && ptr.y <= rv.top + rv.h) {
        this._drag = { y: ptr.y, scroll: this.rankScroll };
      }
      if (this._drag && ptr.down) {
        this.rankScroll = this._drag.scroll + (this._drag.y - ptr.y);
        const max = Math.max(0, rv.contentH - rv.h);
        this.rankScroll = Math.max(0, Math.min(max, this.rankScroll));
      }
      if (ptr.justReleased) this._drag = null;
    }

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) {
      const tap = taps[i];
      if (this.btnBack.handleTouch(tap.x, tap.y)) continue;

      if (this.view === 'detail' && this.purpose === 'rank') {
        let tabHit = false;
        for (let j = 0; j < this._tabHits.length; j++) {
          const h = this._tabHits[j];
          if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) {
            if (this.rankTab !== h.tab) {
              this.rankTab = h.tab;
              this.rankScroll = 0;
            }
            tabHit = true;
            break;
          }
        }
        if (tabHit) continue;
        continue;
      }

      if (this.view !== 'list') continue;
      for (let j = 0; j < this._hits.length; j++) {
        const h = this._hits[j];
        if (tap.x >= h.x && tap.x <= h.x + h.w && tap.y >= h.y && tap.y <= h.y + h.h) {
          this.gameId = GAMES[h.i].id;
          this.view = 'detail';
          this.rankTab = 'friend';
          this.rankScroll = 0;
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
    const adReserve = this._adReserve || reservedBottom();
    ctx.fillText(title + ' · 排行榜', W * 0.5, s.top + 8);

    const board =
      this.rankTab === 'global'
        ? rank.getGlobalBoard(this.gameId)
        : rank.getFriendBoard(this.gameId);
    const list = board.show || board.list || [];

    // 页签
    this._tabHits = [];
    const tabW = 118;
    const tabH = 34;
    const tabY = s.top + 44;
    const tabs = [
      { id: 'friend', label: '同玩好友' },
      { id: 'global', label: '全服总榜' },
    ];
    const tabGap = 12;
    const tabsW = tabW * 2 + tabGap;
    let tx = (W - tabsW) / 2;
    for (let i = 0; i < tabs.length; i++) {
      const active = this.rankTab === tabs[i].id;
      roundRect(ctx, tx, tabY, tabW, tabH, 12);
      ctx.fillStyle = active ? Theme.gold : 'rgba(255,248,236,0.95)';
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(240,160,16,0.7)' : 'rgba(91,70,54,0.14)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, tx, tabY, tabW, tabH, 12);
      ctx.stroke();
      ctx.font = '700 13px ' + FONT;
      ctx.fillStyle = active ? Theme.goldInk : Theme.inkSoft;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tabs[i].label, tx + tabW / 2, tabY + tabH / 2);
      this._tabHits.push({ x: tx, y: tabY, w: tabW, h: tabH, tab: tabs[i].id });
      tx += tabW + tabGap;
    }

    const footH = 52;
    const pw = Math.min(340, W - 32);
    const px = (W - pw) / 2;
    const py = tabY + tabH + 12;
    const ph = Math.max(160, H - adReserve - py - footH - 12);
    const rowH = 30;
    const headPad = 36;
    const contentH = headPad + Math.max(list.length, 1) * rowH + 12;

    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = Theme.cardWin1;
    ctx.fill();
    ctx.strokeStyle =
      this.rankTab === 'global' ? 'rgba(60,200,120,0.45)' : 'rgba(255,143,181,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    this._rankView = { top: py, h: ph, contentH: contentH };
    const maxScroll = Math.max(0, contentH - ph);
    this.rankScroll = Math.max(0, Math.min(maxScroll, this.rankScroll));

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.clip();

    ctx.font = '500 11px ' + FONT;
    ctx.fillStyle = Theme.inkMute;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const sub =
      this.rankTab === 'global'
        ? '每日 0 点刷新 · 共 ' + board.total + ' 人'
        : '同玩好友榜';
    ctx.fillText(sub, W * 0.5, py + 10 - this.rankScroll);

    if (!list.length) {
      ctx.font = '500 13px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.rankTab === 'friend' ? '暂无同玩好友 · 先去玩一局吧' : '暂无数据',
        W * 0.5,
        py + ph / 2
      );
    } else {
      for (let i = 0; i < list.length; i++) {
        const row = list[i];
        const rowY = py + headPad + i * rowH - this.rankScroll;
        if (rowY < py - rowH || rowY > py + ph + 4) continue;

        if (row.isMe) {
          roundRect(ctx, px + 8, rowY - 4, pw - 16, rowH - 2, 8);
          ctx.fillStyle = 'rgba(240,160,16,0.18)';
          ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = i < 3 ? Theme.score : Theme.ink;
        ctx.fillText(i + 1 + '.', px + 16, rowY + 10);

        ctx.font = row.isMe ? '800 13px ' + FONT : '600 13px ' + FONT;
        ctx.fillStyle = row.isMe ? Theme.score : Theme.ink;
        const name = row.isMe ? (row.name || '我') + '（我）' : row.name || '玩家';
        ctx.fillText(name, px + 44, rowY + 10);

        ctx.textAlign = 'right';
        ctx.font = '700 13px ' + FONT;
        ctx.fillStyle = Theme.ink;
        ctx.fillText(row.score + ' 分', px + pw - 16, rowY + 10);
      }
    }
    ctx.restore();

    // 底部：我的全服/好友名次
    const footY = py + ph + 8;
    roundRect(ctx, px, footY, pw, footH - 4, 14);
    ctx.fillStyle = 'rgba(255,248,236,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(91,70,54,0.12)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, px, footY, pw, footH - 4, 14);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 14px ' + FONT;
    ctx.fillStyle = Theme.ink;
    if (board.myRank > 0) {
      const label = this.rankTab === 'global' ? '全服排名' : '好友排名';
      ctx.fillText(
        label + ' 第 ' + board.myRank + ' 名 · ' + board.myScore + ' 分',
        W * 0.5,
        footY + (footH - 4) / 2
      );
    } else {
      ctx.font = '600 13px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText('玩一局后即可查看你的名次', W * 0.5, footY + (footH - 4) / 2);
    }
  }
}

module.exports = { PickScene };
