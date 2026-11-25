'use strict';

const P = require('../platform.js');
const { Piece } = require('../entity/piece.js');
const { levelConfig, colorOf, CLEAR_SCORE, SIZES } = require('../data/faces.js');
const { drawDango } = require('../render/dango.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { flyerPose, spawnShatter, updateShards, drawShards } = require('../render/fx.js');
const phys = require('./physics.js');
const { showRewarded, preloadAll } = require('../ads/rewarded.js');
const { showIntervalOnWin, preloadAll: preloadInterstitial } = require('../ads/interstitial.js');
const daily = require('../data/daily.js');
const rank = require('../data/rank.js');
const album = require('../data/album.js');
const sound = require('../audio/sound.js');

const SLOT_MAX = 7;
const SLOT_R = 18;
/** 本局最多复活次数（每次仍需看激励） */
const REVIVE_MAX = 2;

const PROP_DEFS = [
  { id: 'hint', label: '提示' },
  { id: 'time', label: '加时' },
  { id: 'bomb', label: '炸弹' },
  { id: 'heart', label: '清色' },
];

class Scene {
  constructor(app, opts) {
    this.app = app || null;
    opts = opts || {};
    this.levelIndex = opts.level || 0;
    this.cfg = null;
    this.pieces = [];
    this.slots = [];
    this.flyers = [];
    this.shards = [];
    this.score = 0;
    this.timeLeft = 0;
    this.hearts = 1;
    this.maxHearts = 3;
    this.props = Object.create(null);
    this.bombArmed = false;
    this.colorArmed = false;
    this.hintIds = [];
    this.hintT = 0;
    this.msg = '';
    this.msgT = 0;
    this.fail = false;
    this.win = false;
    this.spawnQueue = 0;
    this.shake = 0;
    this.bootFreezeT = 0;
    this.introLeft = 0;
    this.introCd = 0;
    this.introDone = true;
    this.ended = false;
    this.failReason = '';
    this.reviveLeft = REVIVE_MAX;
    this.endAnimT = 0;
    this.hintLine = '点选入槽 · 3 个同款消除';
    this.buttons = [];
    this.slotLayout = [];
    this.resetLevel(this.levelIndex);
    preloadAll();
    preloadInterstitial();
    sound.init();
    sound.playBgm();
  }

  slotBarH() {
    return 56;
  }

  propBarH() {
    return 40;
  }

  dockHeight() {
    return this.slotBarH() + this.propBarH();
  }

  bounds() {
    const s = P.safe;
    const dockH = this.dockHeight();
    return {
      left: s.left + 4,
      right: P.width - s.right - 4,
      top: s.top + 52,
      bottom: P.height - s.bottom - dockH - 6,
    };
  }

  resetLevel(index) {
    this.levelIndex = index;
    this.cfg = levelConfig(index);
    this.pieces = [];
    this.slots = [];
    this.flyers = [];
    this.shards = [];
    this.score = 0;
    this.timeLeft = this.cfg.timeLimit;
    this.hearts = 1;
    this.bombArmed = false;
    this.colorArmed = false;
    this.hintIds = [];
    this.hintT = 0;
    this.fail = false;
    this.win = false;
    this.ended = false;
    this.failReason = '';
    this.reviveLeft = REVIVE_MAX;
    this.endAnimT = 0;
    this.spawnQueue = 0;
    this.bootFreezeT = 0;
    // 开局整堆砸下再散开铺平；数量按玩法区动态算满
    this.introLeft = this._calcIntroCount();
    this.introCd = 0;
    this.introDone = false;
    this._introWait = 0;
    this._introBurst = false;
    this._holdIntroFreeze = false;
    this.msg = this.cfg.title + ' · 目标 ' + this.cfg.targetScore;
    this.msgT = 1.6;
    this.hintLine = '点选入槽 · 3 个同色同表情消除';
    for (let i = 0; i < PROP_DEFS.length; i++) {
      this.props[PROP_DEFS[i].id] = 0;
    }
    phys.resetCalm();
    this._layoutButtons();
    // 不立刻铺满，由 intro 逐帧掉落
  }

  _layoutButtons() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const dockH = this.dockHeight();
    const dockTop = H - s.bottom - dockH;
    const slotH = this.slotBarH();
    const propY = dockTop + slotH + 4;
    const n = PROP_DEFS.length;
    const gap = 6;
    const bw = Math.min(78, Math.floor((W - s.left - s.right - gap * (n - 1)) / n));
    const total = n * bw + (n - 1) * gap;
    let x = (W - total) / 2;

    this.btnProps = PROP_DEFS.map((d) => {
      const btn = new Button({
        x: x,
        y: propY,
        w: bw,
        h: 32,
        label: d.label,
        style: 'dock',
        badge: String(this.props[d.id] || 0),
        onTap: () => this.useProp(d.id),
      });
      x += bw + gap;
      return btn;
    });

    // 槽位几何
    const slotGap = 6;
    const slotCell = SLOT_R * 2 + 4;
    const slotsW = SLOT_MAX * slotCell + (SLOT_MAX - 1) * slotGap;
    let sx = (W - slotsW) / 2 + slotCell / 2;
    const sy = dockTop + slotH * 0.55;
    this.slotLayout = [];
    for (let i = 0; i < SLOT_MAX; i++) {
      this.slotLayout.push({ x: sx, y: sy });
      sx += slotCell + slotGap;
    }

    this.btnHome = new Button({
      x: s.left,
      y: s.top + 2,
      w: 52,
      h: 28,
      label: '返回',
      style: 'ghost',
      onTap: () => {
        if (this.app) this.app.goto('home');
      },
    });

    this.btnRetry = new Button({
      x: W * 0.5 - 110,
      y: H * 0.55,
      w: 120,
      h: 48,
      label: '再来一局',
      style: 'primary',
      visible: false,
      onTap: () => this.resetLevel(this.levelIndex),
    });
    this.btnNext = new Button({
      x: W * 0.5 + 10,
      y: H * 0.55,
      w: 120,
      h: 48,
      label: '下一关',
      style: 'win',
      visible: false,
      onTap: () => this.resetLevel(this.levelIndex + 1),
    });
    this.btnRevive = new Button({
      x: W * 0.5 - 120,
      y: H * 0.55,
      w: 240,
      h: 52,
      label: '看广告复活',
      style: 'revive',
      visible: false,
      onTap: () => this.tryRevive(),
    });
    this.btnBackHome = new Button({
      x: W * 0.5 - 70,
      y: H * 0.55 + 56,
      w: 140,
      h: 42,
      label: '回首页',
      style: 'ghost',
      visible: false,
      onTap: () => {
        if (this.app) this.app.goto('home');
      },
    });

    this.buttons = [this.btnHome, this.btnRetry, this.btnNext, this.btnRevive, this.btnBackHome].concat(
      this.btnProps
    );
  }

  _syncPropBadges() {
    for (let i = 0; i < this.btnProps.length; i++) {
      const id = PROP_DEFS[i].id;
      // 无免费次数：角标标 AD，已就绪的炸弹/清色高亮
      this.btnProps[i].badge = 'AD';
      this.btnProps[i].enabled = !this.ended;
      if ((id === 'bomb' && this.bombArmed) || (id === 'heart' && this.colorArmed)) {
        this.btnProps[i].style = 'danger';
        this.btnProps[i].badge = '!';
      } else {
        this.btnProps[i].style = 'dock';
      }
    }
  }

  slotCountPending() {
    return this.slots.length + this.flyers.length;
  }

  nextSlotPos() {
    const i = Math.min(SLOT_MAX - 1, this.slotCountPending());
    return this.slotLayout[i] || this.slotLayout[this.slotLayout.length - 1];
  }

  randSize() {
    return 'M';
  }

  countMatchKeys() {
    const map = Object.create(null);
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive) continue;
      map[p.matchKey] = (map[p.matchKey] || 0) + 1;
    }
    return map;
  }

  pickBalancedStyle() {
    const faces = this.cfg.faces;
    const colors = this.cfg.colors;
    const counts = this.countMatchKeys();
    let bestFace = faces[0];
    let bestColor = colors[0];
    let bestScore = Infinity;
    const tries = Math.min(24, faces.length * colors.length);
    for (let t = 0; t < tries; t++) {
      const face = faces[(Math.random() * faces.length) | 0];
      const color = colors[(Math.random() * colors.length) | 0];
      const n = counts[face + '|' + color] || 0;
      const score = n + Math.random() * 0.3;
      if (score < bestScore) {
        bestScore = score;
        bestFace = face;
        bestColor = color;
      }
    }
    return { face: bestFace, color: bestColor };
  }

  makePiece(x, y, extra) {
    extra = extra || {};
    const bal = (!extra.face || !extra.color) ? this.pickBalancedStyle() : null;
    return new Piece({
      face: extra.face || bal.face,
      color: extra.color || bal.color,
      sizeKey: extra.sizeKey || this.randSize(),
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 40,
      vy: Math.random() * 40,
    });
  }

  spawnBatch(n) {
    const b = this.bounds();
    const W = b.right - b.left;
    for (let i = 0; i < n; i++) {
      // 中途补货：少量从上方掉入
      const x = b.left + 36 + Math.random() * (W - 72);
      const y = b.top - 28 - Math.random() * 40 - i * 14;
      const p = this.makePiece(x, y);
      p.vx = (Math.random() - 0.5) * 90;
      p.vy = 80 + Math.random() * 100;
      p.settled = false;
      p.settleT = 0;
      this.pieces.push(p);
    }
  }

  /** 按玩法区估算：大球密铺到顶 */
  _calcIntroCount() {
    const b = this.bounds();
    const r = (SIZES.M && SIZES.M.r) || 26;
    const sep = r * 2 + (phys.PACK_GAP || 1.2);
    const cols = Math.max(5, Math.floor((b.right - b.left) / sep));
    // ceil 略超量，散开后顶到上沿
    const rows = Math.max(6, Math.ceil((b.bottom - b.top) / (sep * 0.866)));
    return Math.max(48, Math.min(90, cols * rows));
  }

  /** 开局：先聚成一堆砸下来 */
  spawnIntroDump() {
    const n = this.introLeft;
    if (n <= 0) return;
    this.introLeft = 0;
    const b = this.bounds();
    const cx = (b.left + b.right) * 0.5;
    const cy = b.top - 70;
    for (let i = 0; i < n; i++) {
      // 紧密螺旋团，看起来是「一堆」
      const ang = i * 2.399;
      const rad = 6 + Math.sqrt(i) * 7.2;
      const x = cx + Math.cos(ang) * rad + (Math.random() - 0.5) * 4;
      const y = cy - Math.sqrt(i) * 5.5 - Math.random() * 6;
      const p = this.makePiece(x, y);
      p.vx = (Math.random() - 0.5) * 40;
      p.vy = 680 + Math.random() * 160;
      p.settled = false;
      p.settleT = 0;
      this.pieces.push(p);
    }
  }

  /** 落地后瞬间向外炸开，铺满平面 */
  _burstFlatten() {
    if (this._introBurst || this.pieces.length === 0) return;
    this._introBurst = true;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive) continue;
      sx += p.x;
      sy += p.y;
      n++;
    }
    if (n < 1) return;
    const cx = sx / n;
    const cy = sy / n;
    const b = this.bounds();
    const midX = (b.left + b.right) * 0.5;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive) continue;
      p.settled = false;
      p.settleT = 0;
      let dx = p.x - cx;
      let dy = p.y - cy;
      let d = Math.hypot(dx, dy);
      if (d < 4) {
        const a = (i / Math.max(1, n)) * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a) * 0.35;
        d = 1;
      }
      // 强力径向散开 + 一点上跳，随后重力压回铺平
      const push = 280 + Math.random() * 220 + d * 1.8;
      p.vx = (dx / d) * push + (p.x < midX ? -40 : 40) * Math.random();
      p.vy = (dy / d) * push * 0.45 - (180 + Math.random() * 120);
    }
    phys.separateOverlaps(this.pieces, b, 4);
  }

  /** 开局：一堆砸下 → 立刻散开铺平（约 1～2 秒）→ 开玩 */
  updateIntro(dt) {
    if (this.introDone) return;
    if (this.introLeft > 0) {
      this.spawnIntroDump();
      this._introWait = 0;
      this._introBurst = false;
    }
    if (this.pieces.length === 0) return;
    this._introWait += dt;

    // 砸到底附近或 0.22s 后：立刻炸开铺平
    if (!this._introBurst) {
      const floorHit = phys.maxY(this.pieces) > this.bounds().bottom - 60;
      if (this._introWait >= 0.22 || floorHit) this._burstFlatten();
    } else if (this._introWait < 0.85) {
      // 散开阶段持续硬分离，帮它们铺满平面
      phys.separateOverlaps(this.pieces, this.bounds(), 2);
    }

    const moving = phys.movingCount(this.pieces);
    if ((this._introWait >= 1.25 && moving <= 6) || this._introWait >= 2.2) {
      // 若堆顶距玩法区顶还有空档，再补一小波压满
      this._topUpIfSparse();
      this.introDone = true;
      phys.packFlat(this.pieces, this.bounds(), 8);
      phys.wakeUnsupported(this.pieces, this.bounds());
      phys.packFlat(this.pieces, this.bounds(), 4);
      phys.freezeAll(this.pieces);
      this.bootFreezeT = 0.35;
      this._holdIntroFreeze = true;
      this.flashMsg('开始！', 0.7);
    }
  }

  /** 堆不够高时再往上塞一批，压出压迫感 */
  _topUpIfSparse() {
    const b = this.bounds();
    const topGap = phys.minY(this.pieces) - b.top;
    if (!(topGap > 48)) return;
    const r = (SIZES.M && SIZES.M.r) || 26;
    const sep = r * 2 + (phys.PACK_GAP || 1.2);
    const cols = Math.max(4, Math.floor((b.right - b.left) / sep));
    const needRows = Math.min(3, Math.ceil(topGap / (sep * 0.866)));
    const n = cols * needRows;
    const y0 = b.top + r + 4;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const x = b.left + r + 2 + col * sep + (row % 2) * (sep * 0.5);
      const y = y0 + row * sep * 0.866;
      if (x + r > b.right - 2) continue;
      const p = this.makePiece(x, y);
      p.vx = (Math.random() - 0.5) * 80;
      p.vy = 200 + Math.random() * 120;
      p.settled = false;
      p.settleT = 0;
      this.pieces.push(p);
    }
  }

  useProp(id) {
    if (this.ended) return;

    // 炸弹 / 清色：已就绪可取消，不扣广告
    if (id === 'bomb' && this.bombArmed) {
      this.bombArmed = false;
      this.flashMsg('取消炸弹', 0.8);
      this._syncPropBadges();
      return;
    }
    if (id === 'heart' && this.colorArmed) {
      this.colorArmed = false;
      this.flashMsg('取消清色', 0.8);
      this._syncPropBadges();
      return;
    }

    // 全部道具：直接看激励后再生效
    this.flashMsg('看广告使用…', 0.8);
    showRewarded(id, (ok, info) => {
      if (!ok) {
        this.flashMsg(info === 'load_fail' ? '广告加载失败' : '未看完广告', 0.9);
        return;
      }
      this.applyPropAfterAd(id);
    });
  }

  applyPropAfterAd(id) {
    if (this.ended) return;
    if (id === 'hint') {
      if (!this.applyHint()) {
        this.flashMsg('暂时没有可消', 0.8);
        return;
      }
      this.flashMsg('看这里！', 0.7);
    } else if (id === 'time') {
      this.timeLeft += 30;
      this.flashMsg('+30 秒', 0.8);
    } else if (id === 'bomb') {
      this.bombArmed = true;
      this.colorArmed = false;
      this.flashMsg('点一个球炸掉', 0.8);
    } else if (id === 'heart') {
      this.colorArmed = true;
      this.bombArmed = false;
      this.flashMsg('点一个球清掉同色', 0.8);
    }
    daily.addPropUse();
    this._syncPropBadges();
  }

  applyHint() {
    const map = Object.create(null);
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive) continue;
      if (!map[p.matchKey]) map[p.matchKey] = [];
      map[p.matchKey].push(p);
    }
    // 优先提示槽里已有的同款，方便凑满
    for (let i = 0; i < this.slots.length; i++) {
      const key = this.slots[i].matchKey;
      if (map[key] && map[key].length > 0) {
        this.hintIds = map[key].slice(0, Math.min(3, map[key].length)).map((p) => p.id);
        this.hintT = 2.4;
        return true;
      }
    }
    let best = null;
    for (const k in map) {
      if (map[k].length >= 3) {
        best = map[k].slice(0, 3);
        break;
      }
    }
    if (!best) return false;
    this.hintIds = best.map((p) => p.id);
    this.hintT = 2.4;
    return true;
  }

  detonateAt(center) {
    if (!this.bombArmed) return;
    this.bombArmed = false;
    const R = center.r + 70;
    let n = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive) continue;
      const d = Math.hypot(p.x - center.x, p.y - center.y);
      if (d <= R) {
        const c = colorOf(p.color);
        spawnShatter(this.shards, p.x, p.y, c.fill, p.r);
        p.alive = false;
        this.nudgeNeighbors(p);
        n++;
      }
    }
    this.shake = 0.25;
    this.spawnQueue += Math.min(4, Math.max(2, (n / 2) | 0));
    this.score += Math.min(n, 8) * 30;
    phys.wakeUnsupported(this.pieces, this.bounds());
    this.bootFreezeT = Math.max(this.bootFreezeT, 0.25);
    this.flashMsg('轰！+' + Math.min(n, 8) * 30, 0.9);
    if (n > 0) sound.playClear();
    this.checkWin();
    this._syncPropBadges();
  }

  clearColorAt(center) {
    if (!this.colorArmed) return;
    this.colorArmed = false;
    const color = center.color;
    let n = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive || p.color !== color) continue;
      const c = colorOf(p.color);
      spawnShatter(this.shards, p.x, p.y, c.fill, p.r);
      p.alive = false;
      this.nudgeNeighbors(p);
      n++;
    }
    this.shake = 0.28;
    this.spawnQueue += Math.min(6, Math.max(3, (n / 3) | 0));
    const gain = Math.min(280, n * 15);
    this.score += gain;
    phys.wakeUnsupported(this.pieces, this.bounds());
    this.bootFreezeT = Math.max(this.bootFreezeT, 0.25);
    this.flashMsg('清一色！+' + gain, 1);
    if (n > 0) sound.playClear();
    this.checkWin();
    this._syncPropBadges();
  }

  /** 点选：飞入槽位 */
  sendToSlot(piece) {
    if (this.slotCountPending() >= SLOT_MAX) {
      this.flashMsg('槽位已满', 0.8);
      return;
    }
    this.nudgeNeighbors(piece);
    sound.playTap();
    const targetIndex = this.slotCountPending();
    const dest = this.slotLayout[targetIndex] || this.nextSlotPos();
    const fromX = piece.x;
    const fromY = piece.y;
    const fromR = piece.r;

    // 从场地移除，交给飞行动画
    const idx = this.pieces.indexOf(piece);
    if (idx >= 0) this.pieces.splice(idx, 1);
    piece.alive = true;
    piece.selected = false;
    piece.vx = 0;
    piece.vy = 0;

    // 立刻叫醒失去支撑的上层，让悬空球掉下来
    phys.wakeUnsupported(this.pieces, this.bounds());
    this.bootFreezeT = Math.max(this.bootFreezeT, 0.25);

    this.flyers.push({
      piece: piece,
      x0: fromX,
      y0: fromY,
      x1: dest.x,
      y1: dest.y,
      t: 0,
      dur: 0.18,
      arc: 36,
      fromR: fromR,
    });
  }

  onFlyerLand(flyer) {
    const p = flyer.piece;
    p.r = SLOT_R;
    this.slots.push(p);
    this.repositionSlots();
    this.tryClearSlots();
    if (!this.ended && this.slots.length >= SLOT_MAX) {
      this.onFail('槽位满了');
    }
  }

  /** 槽内凑齐 3 个同色同表情 → 碎裂消除 */
  tryClearSlots() {
    let cleared = false;
    for (;;) {
      const map = Object.create(null);
      for (let i = 0; i < this.slots.length; i++) {
        const key = this.slots[i].matchKey;
        if (!map[key]) map[key] = [];
        map[key].push(i);
      }
      let hitKey = null;
      for (const k in map) {
        if (map[k].length >= 3) {
          hitKey = k;
          break;
        }
      }
      if (!hitKey) break;

      const idxs = map[hitKey].slice(0, 3).sort((a, b) => b - a);
      for (let j = 0; j < idxs.length; j++) {
        const i = idxs[j];
        const p = this.slots[i];
        const c = colorOf(p.color);
        spawnShatter(this.shards, p.x, p.y, c.fill, SLOT_R);
        this.slots.splice(i, 1);
      }
      this.repositionSlots();
      this.score += CLEAR_SCORE;
      this.shake = 0.32;
      this.spawnQueue += 3;
      this.flashMsg('同款 +' + CLEAR_SCORE, 1.1);
      sound.playClear();
      cleared = true;
    }
    if (cleared) this.checkWin();
    return cleared;
  }

  repositionSlots() {
    for (let i = 0; i < this.slots.length; i++) {
      const pos = this.slotLayout[i];
      if (!pos) continue;
      this.slots[i].x = pos.x;
      this.slots[i].y = pos.y;
      this.slots[i].r = SLOT_R;
    }
  }

  onTap(x, y) {
    if (this.ended) {
      for (let i = 0; i < this.buttons.length; i++) {
        if (this.buttons[i].handleTouch(x, y)) return;
      }
      return;
    }

    // 开局掉落中：可点首页；堆已基本停稳也可点选（避免一直闪却点不了）
    if (!this.introDone) {
      if (this.btnHome && this.btnHome.handleTouch(x, y)) return;
      if (phys.movingCount(this.pieces) > 6) return;
    }

    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (b === this.btnRetry || b === this.btnNext || b === this.btnRevive || b === this.btnBackHome) {
        continue;
      }
      if (b.handleTouch(x, y)) return;
    }

    const bounds = this.bounds();
    if (y < bounds.top - 8 || y > bounds.bottom + 4) return;

    const hit = phys.hitTest(this.pieces, x, y);
    if (!hit) return;

    if (this.bombArmed) {
      this.detonateAt(hit);
      return;
    }
    if (this.colorArmed) {
      this.clearColorAt(hit);
      return;
    }

    this.sendToSlot(hit);
  }

  checkWin() {
    if (this.ended) return;
    if (this.score >= this.cfg.targetScore) {
      this.win = true;
      this.fail = false;
      this.ended = true;
      this.endAnimT = 0;
      this.bombArmed = false;
      this.colorArmed = false;
      this.failReason = '';
      this.flashMsg('过关！', 1.2);
      this._syncPropBadges();
      sound.playWin();
      daily.addWin();
      rank.submit('match', this.score, { level: this.levelIndex + 1 });
      // 过关解锁本关表情进图鉴
      if (this.cfg && this.cfg.faces) album.unlockMany(this.cfg.faces);
      // 当天每通关满 3 次：结算弹间歇插屏
      showIntervalOnWin();
    }
  }

  onFail(reason) {
    if (this.ended) return;
    this.fail = true;
    this.win = false;
    this.ended = true;
    this.endAnimT = 0;
    this.failReason = reason || '失败了';
    this.bombArmed = false;
    this.colorArmed = false;
    this.flashMsg(this.failReason, 1.2);
    this._syncPropBadges();
    if (this.score > 0) rank.submit('match', this.score, { level: this.levelIndex + 1 });
  }

  /** 激励复活：每次都看广告 */
  tryRevive() {
    if (!this.ended || this.win) return;
    if (this.reviveLeft <= 0) {
      this.flashMsg('本局复活次数用完', 1);
      return;
    }
    this.flashMsg('看广告复活…', 0.8);
    showRewarded('revive', (ok, info) => {
      if (!ok) {
        this.flashMsg(info === 'load_fail' ? '广告加载失败' : '未看完广告', 1);
        return;
      }
      this.applyRevive();
    });
  }

  applyRevive() {
    if (!this.ended || this.win) return;
    this.reviveLeft -= 1;
    const reason = this.failReason || '';

    if (reason.indexOf('槽位') >= 0) {
      // 清掉槽里 3 个，腾出空间
      const n = Math.min(3, this.slots.length);
      for (let i = 0; i < n; i++) {
        const p = this.slots.pop();
        if (!p) break;
        const c = colorOf(p.color);
        spawnShatter(this.shards, p.x, p.y, c.fill, SLOT_R);
      }
      this.repositionSlots();
      this.flashMsg('复活！清掉 ' + n + ' 个槽位', 1.1);
    } else {
      this.timeLeft = Math.max(this.timeLeft, 0) + 45;
      this.flashMsg('复活！+' + 45 + ' 秒', 1.1);
    }

    this.ended = false;
    this.fail = false;
    this.win = false;
    this.failReason = '';
    this.btnRetry.visible = false;
    this.btnNext.visible = false;
    this.btnRevive.visible = false;
    this.btnBackHome.visible = false;
    this._syncPropBadges();
  }

  nudgeNeighbors(center) {
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (!p.alive || p === center) continue;
      const d = Math.hypot(p.x - center.x, p.y - center.y);
      const near = d < center.r + p.r + 56 && d > 0.5;
      // 上方整片：支撑没了要掉
      const above =
        p.y < center.y - 4 &&
        Math.abs(p.x - center.x) < center.r + p.r + 36 &&
        d < 260;
      if (!near && !above) continue;
      p.wake();
      if (above) {
        p.vy = Math.max(p.vy, 0) + 140 + Math.random() * 60;
      } else if (d > 1) {
        const nx = (p.x - center.x) / d;
        const ny = (p.y - center.y) / d;
        p.vx += nx * (70 + Math.random() * 50);
        p.vy += ny * (30 + Math.random() * 30) + 40;
      } else {
        p.vy += 90;
      }
    }
  }

  flashMsg(text, life) {
    this.msg = text;
    this.msgT = life || 1;
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) this._layoutButtons();
    }

    const taps = P.taps;
    for (let i = 0; i < taps.length; i++) this.onTap(taps[i].x, taps[i].y);

    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);
    this._syncPropBadges();

    if (this.msgT > 0) this.msgT -= dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.ended) this.endAnimT += dt;
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hintIds = [];
    }
    // 飞入槽位
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      const pose = flyerPose(f);
      if (pose.done) {
        this.flyers.splice(i, 1);
        this.onFlyerLand(f);
      }
    }

    updateShards(this.shards, dt);

    const b = this.bounds();
    this.updateIntro(dt);

    // 开局「开始！」短冻结；对局中 bootFreeze 只平静抖动，绝不冻住悬空球
    if (this._holdIntroFreeze) {
      phys.freezeAll(this.pieces);
      this.bootFreezeT -= dt;
      if (this.bootFreezeT <= 0) {
        this._holdIntroFreeze = false;
        this.bootFreezeT = 0;
        phys.wakeUnsupported(this.pieces, b);
      }
    } else {
      phys.step(this.pieces, b, Math.min(dt, 1 / 30));
      if (this.bootFreezeT > 0) {
        this.bootFreezeT -= dt;
        if (this.bootFreezeT <= 0) {
          phys.settleSupported(this.pieces, b, 55);
          phys.wakeUnsupported(this.pieces, b);
        }
      }
    }

    if (this.pieces.some((p) => !p.alive)) {
      this.pieces = this.pieces.filter((p) => p.alive);
    }

    // 开局掉落期间不计时
    if (!this.ended && this.introDone) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.onFail('时间到');
      }
    }

    if (!this.ended && this.introDone) {
      const count = phys.aliveCount(this.pieces);
      const topMost = phys.minY(this.pieces);
      const moving = phys.movingCount(this.pieces);

      if (this.spawnQueue > 0 && moving === 0 && this.bootFreezeT <= 0) {
        const n = Math.min(2, this.spawnQueue);
        this.spawnBatch(n);
        this.spawnQueue -= n;
        this.bootFreezeT = 0.9;
      } else if (
        moving === 0 &&
        this.bootFreezeT <= 0 &&
        this.spawnQueue === 0 &&
        count < 30 &&
        topMost > b.top + 140
      ) {
        this.spawnBatch(2);
        this.bootFreezeT = 0.9;
      }
    }
  }

  draw() {
    const ctx = P.ctx;
    const W = P.width;
    const H = P.height;
    const scale = P.renderScale;
    const b = this.bounds();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = Theme.clear;
    ctx.fillRect(0, 0, P.canvas.width || W, P.canvas.height || H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, Theme.bgTop);
    g.addColorStop(0.45, Theme.bgMid);
    g.addColorStop(1, Theme.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sx = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    const list = this.pieces.slice().sort((a, c) => a.y - c.y);
    const hintSet = Object.create(null);
    for (let i = 0; i < this.hintIds.length; i++) hintSet[this.hintIds[i]] = true;

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      drawDango(ctx, p);
      if (hintSet[p.id] && this.hintT > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,220,90,' + (0.45 + 0.4 * Math.sin(this.hintT * 8)) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // 飞行中的团子
    for (let i = 0; i < this.flyers.length; i++) {
      const f = this.flyers[i];
      const pose = flyerPose(f);
      const p = f.piece;
      const drawR = (f.fromR || p.r) * pose.s;
      drawDango(ctx, {
        face: p.face,
        color: p.color,
        x: pose.x,
        y: pose.y,
        r: drawR,
        selected: false,
      });
    }

    drawShards(ctx, this.shards);

    ctx.restore();

    this.drawHud(ctx, W, H, b);
    this.drawDock(ctx, W, H);
    this.drawClearToast(ctx, W, H);

    if (this.ended) this.drawEndPanel(ctx, W, H);
  }

  drawHud(ctx, W, H, b) {
    const s = P.safe;
    const barBottom = b.top - 6;
    const hy = s.top + 6;
    // 顶栏已在胶囊下方，时间/心形贴右安全边即可
    const rightLimit = W - Math.max(s.right, 10) - 4;
    ctx.save();

    // 奶油顶栏，压在团子之上
    const grad = ctx.createLinearGradient(0, 0, 0, barBottom);
    grad.addColorStop(0, Theme.hudTop);
    grad.addColorStop(1, Theme.hudBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, barBottom);
    ctx.fillStyle = Theme.hudLine;
    ctx.fillRect(0, barBottom - 2, W, 2);

    this.btnHome.draw(ctx);

    const strokeText = (text, x, y, fill, size, align) => {
      ctx.font = '800 ' + size + 'px ' + FONT;
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,248,236,0.85)';
      ctx.lineWidth = Math.max(3, size * 0.22);
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    };

    const titleX = s.left + 60;
    strokeText(this.cfg.title, titleX, hy, Theme.ink, 16, 'left');
    strokeText(
      this.score + '/' + this.cfg.targetScore,
      titleX,
      hy + 24,
      Theme.score,
      15,
      'left'
    );

    // 色点跟在标题右侧，避开右侧时间区
    const cols = this.cfg.colors;
    ctx.font = '800 16px ' + FONT;
    const titleW = ctx.measureText(this.cfg.title).width;
    let lx = titleX + titleW + 14;
    for (let i = 0; i < cols.length; i++) {
      const c = colorOf(cols[i]);
      ctx.beginPath();
      ctx.arc(lx + i * 18, hy + 10, 7, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 时间 + 心：贴右
    const sec = Math.ceil(this.timeLeft);
    const urgent = sec <= 10;
    const timeX = rightLimit;
    strokeText(sec + 's', timeX, hy, urgent ? Theme.urgent : Theme.time, 20, 'right');

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '800 15px ' + FONT;
    for (let i = 0; i < this.maxHearts; i++) {
      ctx.strokeStyle = 'rgba(255,248,236,0.9)';
      ctx.lineWidth = 3;
      ctx.fillStyle = i < this.hearts ? '#ff8fb5' : 'rgba(91,70,54,0.22)';
      ctx.strokeText('♥', timeX - i * 18, hy + 26);
      ctx.fillText('♥', timeX - i * 18, hy + 26);
    }

    if (this.bombArmed || this.colorArmed) {
      ctx.font = '700 13px ' + FONT;
      ctx.fillStyle = Theme.primaryInk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(255,248,236,0.9)';
      ctx.lineWidth = 4;
      const tip = this.colorArmed ? '清色已就绪 · 点一个球清掉同色' : '炸弹已就绪 · 点一个球';
      ctx.strokeText(tip, W * 0.5, b.top - 18);
      ctx.fillText(tip, W * 0.5, b.top - 18);
    }

    ctx.restore();
  }

  /** 消除得分飘字：独立画在最上层，带实心底条 */
  drawClearToast(ctx, W, H) {
    if (!(this.msgT > 0) || !this.msg || this.ended) return;
    const mx = W * 0.5;
    const my = H * 0.36;
    const a = Math.min(1, this.msgT * 1.8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '900 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = Math.min(W - 48, ctx.measureText(this.msg).width + 48);
    const th = 52;
    roundRect(ctx, mx - tw / 2, my - th / 2, tw, th, 16);
    ctx.fillStyle = 'rgba(255,140,40,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,236,0.95)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, mx - tw / 2, my - th / 2, tw, th, 16);
    ctx.stroke();

    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(90,40,0,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeText(this.msg, mx, my + 1);
    ctx.fillStyle = '#fff8ee';
    ctx.fillText(this.msg, mx, my);
    ctx.restore();
  }

  drawDock(ctx, W, H) {
    const s = P.safe;
    const dockH = this.dockHeight();
    const dockTop = H - s.bottom - dockH;
    const slotH = this.slotBarH();

    // 槽位条
    roundRect(ctx, 8, dockTop, W - 16, slotH - 2, 14);
    ctx.fillStyle = Theme.dock;
    ctx.fill();
    ctx.strokeStyle = Theme.dockStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, 8, dockTop, W - 16, slotH - 2, 14);
    ctx.stroke();

    // 空槽位
    for (let i = 0; i < this.slotLayout.length; i++) {
      const pos = this.slotLayout[i];
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, SLOT_R + 2, 0, Math.PI * 2);
      ctx.fillStyle = Theme.slotHole;
      ctx.fill();
      ctx.strokeStyle = Theme.slotRing;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 槽内团子
    for (let i = 0; i < this.slots.length; i++) {
      const p = this.slots[i];
      const pos = this.slotLayout[i];
      if (pos) {
        p.x = pos.x;
        p.y = pos.y;
        p.r = SLOT_R;
      }
      drawDango(ctx, p);
    }

    // 道具条（矮）
    const propTop = dockTop + slotH;
    roundRect(ctx, 8, propTop, W - 16, this.propBarH() - 4, 12);
    ctx.fillStyle = 'rgba(255,232,236,0.9)';
    ctx.fill();
    ctx.strokeStyle = Theme.dockStroke;
    ctx.lineWidth = 1;
    roundRect(ctx, 8, propTop, W - 16, this.propBarH() - 4, 12);
    ctx.stroke();

    for (let i = 0; i < this.btnProps.length; i++) this.btnProps[i].draw(ctx);

    ctx.font = '500 10px ' + FONT;
    ctx.fillStyle = Theme.hint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.hintLine, W * 0.5, dockTop + 3);
  }

  drawEndPanel(ctx, W, H) {
    const t = Math.min(1, this.endAnimT * 3.2);
    const ease = 1 - Math.pow(1 - t, 3);

    ctx.fillStyle = 'rgba(91,70,54,' + (0.18 + 0.28 * ease) + ')';
    ctx.fillRect(0, 0, W, H);

    const canRevive = this.fail && this.reviveLeft > 0;
    const pw = Math.min(320, W - 36);
    const ph = this.win ? 280 : canRevive ? 340 : 300;
    const px = (W - pw) / 2;
    const py = H * 0.2 + (1 - ease) * 36;
    const cx = W * 0.5;

    // 奶油卡片
    ctx.save();
    ctx.shadowColor = this.win ? Theme.glowMint : Theme.glowPink;
    ctx.shadowBlur = 28;
    roundRect(ctx, px, py, pw, ph, 22);
    const card = ctx.createLinearGradient(px, py, px, py + ph);
    if (this.win) {
      card.addColorStop(0, Theme.cardWin0);
      card.addColorStop(0.45, Theme.cardWin1);
      card.addColorStop(1, Theme.cardWin2);
    } else {
      card.addColorStop(0, Theme.cardFail0);
      card.addColorStop(0.4, Theme.cardFail1);
      card.addColorStop(1, Theme.cardFail2);
    }
    ctx.fillStyle = card;
    ctx.fill();
    ctx.restore();

    roundRect(ctx, px, py, pw, ph, 22);
    ctx.strokeStyle = this.win ? Theme.cardStrokeWin : Theme.cardStrokeFail;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 顶部彩条：表情包色
    const ribbon = ctx.createLinearGradient(px, py, px + pw, py);
    ribbon.addColorStop(0, '#ffb4c4');
    ribbon.addColorStop(0.35, '#f0a010');
    ribbon.addColorStop(0.7, '#3cc878');
    ribbon.addColorStop(1, '#7eb8f0');
    roundRect(ctx, px + 14, py + 12, pw - 28, 5, 3);
    ctx.fillStyle = ribbon;
    ctx.fill();

    // 大标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '900 34px ' + FONT;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,248,236,0.95)';
    ctx.lineWidth = 6;
    const title = this.win ? '过关啦！' : '差一点！';
    ctx.strokeText(title, cx, py + 32);
    ctx.fillStyle = this.win ? Theme.titleWin : Theme.titleFail;
    ctx.fillText(title, cx, py + 32);

    // 分数块
    const scoreBoxY = py + 86;
    roundRect(ctx, px + 28, scoreBoxY, pw - 56, 54, 14);
    ctx.fillStyle = Theme.scoreBox;
    ctx.fill();
    ctx.font = '700 13px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('本局得分', cx, scoreBoxY + 8);
    ctx.font = '900 22px ' + FONT;
    ctx.fillStyle = Theme.score;
    ctx.fillText(this.score + ' / ' + this.cfg.targetScore, cx, scoreBoxY + 26);

    ctx.font = '600 13px ' + FONT;
    ctx.fillStyle = Theme.subText;
    const sub = this.win
      ? '目标达成 · 继续下一关吧'
      : this.failReason || '再试一次也能过';
    ctx.fillText(sub, cx, scoreBoxY + 66);

    let by = scoreBoxY + 96;
    this.btnRevive.visible = false;
    this.btnNext.visible = false;
    this.btnRetry.visible = true;
    this.btnBackHome.visible = true;

    if (this.win) {
      this.btnNext.visible = true;
      this.btnNext.x = cx - 126;
      this.btnNext.y = by;
      this.btnNext.w = 120;
      this.btnNext.h = 48;
      this.btnRetry.x = cx + 6;
      this.btnRetry.y = by;
      this.btnRetry.w = 120;
      this.btnRetry.h = 48;
      this.btnRetry.label = '再玩本关';
      this.btnRetry.style = 'ghost';
      this.btnNext.draw(ctx);
      this.btnRetry.draw(ctx);
      by += 60;
    } else {
      if (canRevive) {
        this.btnRevive.visible = true;
        this.btnRevive.x = cx - 118;
        this.btnRevive.y = by;
        this.btnRevive.w = 236;
        this.btnRevive.h = 48;
        this.btnRevive.label = '看广告复活';
        this.btnRevive.sub = '';
        this.btnRevive.draw(ctx);
        by += 58;
      }
      this.btnRetry.x = cx - 118;
      this.btnRetry.y = by;
      this.btnRetry.w = 236;
      this.btnRetry.h = 46;
      this.btnRetry.label = '重新开始';
      this.btnRetry.style = 'primary';
      this.btnRetry.draw(ctx);
      by += 56;
    }

    this.btnBackHome.x = cx - 70;
    this.btnBackHome.y = by;
    this.btnBackHome.w = 140;
    this.btnBackHome.h = 40;
    this.btnBackHome.draw(ctx);
  }
}

module.exports = { Scene };
