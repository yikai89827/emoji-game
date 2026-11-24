'use strict';

const P = require('../platform.js');
const { Button, roundRect, FONT } = require('../ui/button.js');
const { Theme } = require('../ui/theme.js');
const { drawDango } = require('../render/dango.js');
const sound = require('../audio/sound.js');
const { showBanner, hideBanner, reservedBottom } = require('../ads/custom-ad.js');
const { showRewarded } = require('../ads/rewarded.js');
const { pickRingColor } = require('../data/mode-skin.js');
const { spawnShatter, updateShards, drawShards } = require('../render/fx.js');
const { FACES, colorOf } = require('../data/faces.js');
const rank = require('../data/rank.js');
const album = require('../data/album.js');
const daily = require('../data/daily.js');

const PROGRESS_KEY = 'tkc_match3_prog';
const DIR_LABEL = { up: '上', down: '下', left: '左', right: '右' };
const DIRS = ['up', 'down', 'left', 'right'];
const MAX_LEVEL = 20;

/** @typedef {{ face: string, special: null|'bomb'|'cross' }} Cell */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function loadProgress() {
  let lv = 1;
  let score = 0;
  try {
    let raw = null;
    if (typeof wx !== 'undefined' && wx.getStorageSync) raw = wx.getStorageSync(PROGRESS_KEY);
    if (!raw && typeof localStorage !== 'undefined') {
      const s = localStorage.getItem(PROGRESS_KEY);
      if (s) raw = JSON.parse(s);
    }
    if (raw && typeof raw === 'object') {
      lv = Math.max(1, Math.min(MAX_LEVEL, parseInt(raw.level, 10) || 1));
      score = Math.max(0, parseInt(raw.score, 10) || 0);
    }
  } catch (e) { /* ignore */ }
  return { level: lv, score: score };
}

function saveProgress(level, score) {
  const data = { level: level, score: score };
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(PROGRESS_KEY, data);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    }
  } catch (e) { /* ignore */ }
}

/** 视觉差异大的表情池，避免相似脸挤在同一关 */
const DISTINCT_FACES = [
  'cool', 'rage', 'sob', 'skull', 'heart', 'doggo', 'sparkle', 'sleep',
  'thumbsup', 'sprout', 'mask', 'dizzy', 'kiss', 'rofl', 'soldier', 'soot',
  'wave', 'star', 'freeze', 'lips', 'joy', 'mad', 'shy', 'wink',
  'peek', 'cracked', 'arrogant', 'munch', 'broke', 'gasp',
];

function pickFacePool(levelIndex, count) {
  const pool = DISTINCT_FACES.filter((id) => FACE_MAP_OK(id));
  const list = shuffle(pool.slice());
  const start = (levelIndex * 3) % Math.max(1, list.length);
  const ids = [];
  for (let i = 0; i < list.length && ids.length < count; i++) {
    ids.push(list[(start + i) % list.length]);
  }
  // 不足时再从全表补差异位
  if (ids.length < count) {
    const more = shuffle(FACES.map((f) => f.id).filter((id) => ids.indexOf(id) < 0));
    for (let i = 0; i < more.length && ids.length < count; i++) ids.push(more[i]);
  }
  return ids;
}

function FACE_MAP_OK(id) {
  for (let i = 0; i < FACES.length; i++) if (FACES[i].id === id) return true;
  return false;
}

/**
 * 关卡：尺寸、时限、边槽数量与需求
 */
function levelSpec(levelIndex) {
  const lv = levelIndex + 1;
  const size = lv <= 5 ? 7 : 8;
  const faceCount = Math.min(7, 5 + Math.floor(levelIndex / 4));
  const faces = pickFacePool(levelIndex, faceCount);
  const timeLimit = Math.max(55, 110 - Math.floor(levelIndex * 2.2));
  const bonus = 200 + levelIndex * 100;
  // 过关积分门槛（与送槽并行）
  const targetScore = 350 + levelIndex * 120;

  /**
   * 槽位数：第 1 关 1 个，每 5 关 +1，最多 4 个方向各一个
   * 每个槽位只需送入 1 个对应表情（need = 1）
   * lane = 对齐的列(上下)或行(左右)
   */
  /** @type {Array<{dir:string, lane:number, face:string, need:number, got:number, flashT:number}>} */
  const slots = [];
  const slotCount = Math.min(4, 1 + Math.floor((lv - 1) / 5));
  // 第 1 关固定下方；之后按关卡轮换方位，保证多槽时方位不重复
  const dirOrder =
    lv === 1
      ? ['down']
      : shuffle(DIRS.slice());
  const usedLane = Object.create(null);

  function pickLane(dir) {
    const key = dir === 'up' || dir === 'down' ? 'col' : 'row';
    let lane = Math.floor(Math.random() * size);
    let guard = 0;
    while (usedLane[key + ':' + lane] && guard++ < size) {
      lane = (lane + 1) % size;
    }
    usedLane[key + ':' + lane] = true;
    return lane;
  }

  for (let i = 0; i < slotCount; i++) {
    const dir = dirOrder[i % dirOrder.length];
    slots.push({
      dir: dir,
      lane: pickLane(dir),
      face: faces[i % faces.length],
      need: 1,
      got: 0,
      flashT: 0,
    });
  }

  // 前几关固定掉落方向（跟主槽一致）；后期才偶尔换向
  const gravityEvery = lv <= 5 ? 0 : lv <= 10 ? 12 : lv <= 15 ? 8 : 6;
  const fixedGravity = gravityEvery === 0 ? slots[0].dir : null;

  return {
    level: lv,
    size: size,
    timeLimit: timeLimit,
    faces: faces,
    slots: slots,
    bonus: bonus,
    targetScore: targetScore,
    gravityEvery: gravityEvery,
    fixedGravity: fixedGravity,
  };
}

function emptyGrid(size) {
  const g = [];
  for (let r = 0; r < size; r++) {
    g[r] = [];
    for (let c = 0; c < size; c++) g[r][c] = null;
  }
  return g;
}

function cloneGrid(src) {
  const size = src.length;
  const g = emptyGrid(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = src[r][c];
      g[r][c] = v ? { face: v.face, special: v.special || null } : null;
    }
  }
  return g;
}

function randFace(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeCell(face, special) {
  return { face: face, special: special || null };
}

function hasAnyMatch(grid, size) {
  return findMatchCells(grid, size).length > 0;
}

function fillGridNoMatch(size, pool) {
  for (let t = 0; t < 48; t++) {
    const g = emptyGrid(size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        g[r][c] = makeCell(randFace(pool));
      }
    }
    if (!hasAnyMatch(g, size)) return g;
  }
  const g = emptyGrid(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) g[r][c] = makeCell(pool[r % pool.length]);
  }
  return g;
}

/** 所有 ≥3 连 matched 坐标 */
function findMatchCells(grid, size) {
  const key = (r, c) => r + ',' + c;
  const set = Object.create(null);

  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      const cell = grid[r][c];
      if (!cell) {
        c++;
        continue;
      }
      const face = cell.face;
      let c2 = c + 1;
      while (c2 < size && grid[r][c2] && grid[r][c2].face === face) c2++;
      const len = c2 - c;
      if (len >= 3) {
        for (let x = c; x < c2; x++) set[key(r, x)] = { r: r, c: x };
      }
      c = c2;
    }
  }

  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      const cell = grid[r][c];
      if (!cell) {
        r++;
        continue;
      }
      const face = cell.face;
      let r2 = r + 1;
      while (r2 < size && grid[r2][c] && grid[r2][c].face === face) r2++;
      const len = r2 - r;
      if (len >= 3) {
        for (let y = r; y < r2; y++) set[key(y, c)] = { r: y, c: c };
      }
      r = r2;
    }
  }

  return Object.keys(set).map((k) => set[k]);
}

/** ≥4 连 → 炸弹落在连消中段（棋盘上生成） */
function bombSites(grid, size, matched) {
  const inSet = Object.create(null);
  for (let i = 0; i < matched.length; i++) inSet[matched[i].r + ',' + matched[i].c] = true;
  const sites = [];
  const used = Object.create(null);

  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      const cell = grid[r][c];
      if (!cell) {
        c++;
        continue;
      }
      const face = cell.face;
      let c2 = c + 1;
      while (c2 < size && grid[r][c2] && grid[r][c2].face === face) c2++;
      const len = c2 - c;
      if (len >= 4) {
        const cc = c + Math.floor((len - 1) / 2);
        const k = r + ',' + cc;
        if (inSet[k] && !used[k]) {
          used[k] = true;
          sites.push({ r: r, c: cc, kind: 'bomb', face: face });
        }
      }
      c = c2;
    }
  }

  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      const cell = grid[r][c];
      if (!cell) {
        r++;
        continue;
      }
      const face = cell.face;
      let r2 = r + 1;
      while (r2 < size && grid[r2][c] && grid[r2][c].face === face) r2++;
      const len = r2 - r;
      if (len >= 4) {
        const rr = r + Math.floor((len - 1) / 2);
        const k = rr + ',' + c;
        if (inSet[k] && !used[k]) {
          used[k] = true;
          sites.push({ r: rr, c: c, kind: 'bomb', face: face });
        }
      }
      r = r2;
    }
  }
  return sites;
}

/** L/T 十字斩：横竖均 ≥3 的交点 */
function crossSites(grid, size, matched) {
  const inSet = Object.create(null);
  for (let i = 0; i < matched.length; i++) inSet[matched[i].r + ',' + matched[i].c] = true;
  const sites = [];
  const used = Object.create(null);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r][c];
      if (!cell || !inSet[r + ',' + c]) continue;
      const face = cell.face;
      let h = 1;
      let hc = c - 1;
      while (hc >= 0 && grid[r][hc] && grid[r][hc].face === face) {
        h++;
        hc--;
      }
      hc = c + 1;
      while (hc < size && grid[r][hc] && grid[r][hc].face === face) {
        h++;
        hc++;
      }
      let v = 1;
      let vr = r - 1;
      while (vr >= 0 && grid[vr][c] && grid[vr][c].face === face) {
        v++;
        vr--;
      }
      vr = r + 1;
      while (vr < size && grid[vr][c] && grid[vr][c].face === face) {
        v++;
        vr++;
      }
      if (h >= 3 && v >= 3) {
        const k = r + ',' + c;
        if (!used[k]) {
          used[k] = true;
          sites.push({ r: r, c: c, kind: 'cross', face: face });
        }
      }
    }
  }
  return sites;
}

function expandBomb(grid, size, r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size && grid[rr][cc]) {
        out.push({ r: rr, c: cc });
      }
    }
  }
  return out;
}

function expandCross(grid, size, r, c) {
  const out = [];
  for (let x = 0; x < size; x++) if (grid[r][x]) out.push({ r: r, c: x });
  for (let y = 0; y < size; y++) if (grid[y][c]) out.push({ r: y, c: c });
  const seen = Object.create(null);
  const uniq = [];
  for (let i = 0; i < out.length; i++) {
    const k = out[i].r + ',' + out[i].c;
    if (!seen[k]) {
      seen[k] = true;
      uniq.push(out[i]);
    }
  }
  return uniq;
}

/**
 * 按重力压实 + 从对侧「顶部」补新表情，并生成掉落动画起点
 * 规则：先原有表情往重力方向掉，空出来的顶部再从盘外落入
 * 返回 falls: [{ r,c, cell, fromR, fromC, t, dur }]
 */
function packAndRefillWithFalls(grid, size, dir, pool) {
  const falls = [];
  const FALL_DUR = 0.28;

  function pushFall(cell, toR, toC, fromR, fromC) {
    if (toR === fromR && toC === fromC) {
      grid[toR][toC] = cell;
      return;
    }
    grid[toR][toC] = cell;
    falls.push({
      r: toR,
      c: toC,
      cell: cell,
      fromR: fromR,
      fromC: fromC,
      t: 0,
      dur: FALL_DUR + Math.abs(toR - fromR + toC - fromC) * 0.04,
    });
  }

  if (dir === 'down') {
    for (let c = 0; c < size; c++) {
      const stack = [];
      for (let r = 0; r < size; r++) {
        if (grid[r][c]) stack.push({ cell: grid[r][c], oldR: r });
        grid[r][c] = null;
      }
      const start = size - stack.length;
      for (let i = 0; i < stack.length; i++) {
        pushFall(stack[i].cell, start + i, c, stack[i].oldR, c);
      }
      for (let r = 0; r < start; r++) {
        const cell = makeCell(randFace(pool));
        pushFall(cell, r, c, r - start - 1, c);
      }
    }
  } else if (dir === 'up') {
    for (let c = 0; c < size; c++) {
      const stack = [];
      for (let r = 0; r < size; r++) {
        if (grid[r][c]) stack.push({ cell: grid[r][c], oldR: r });
        grid[r][c] = null;
      }
      for (let i = 0; i < stack.length; i++) {
        pushFall(stack[i].cell, i, c, stack[i].oldR, c);
      }
      for (let r = stack.length; r < size; r++) {
        const cell = makeCell(randFace(pool));
        pushFall(cell, r, c, r + (size - stack.length), c);
      }
    }
  } else if (dir === 'left') {
    for (let r = 0; r < size; r++) {
      const stack = [];
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) stack.push({ cell: grid[r][c], oldC: c });
        grid[r][c] = null;
      }
      for (let i = 0; i < stack.length; i++) {
        pushFall(stack[i].cell, r, i, r, stack[i].oldC);
      }
      for (let c = stack.length; c < size; c++) {
        const cell = makeCell(randFace(pool));
        pushFall(cell, r, c, r, c + (size - stack.length));
      }
    }
  } else {
    // right
    for (let r = 0; r < size; r++) {
      const stack = [];
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) stack.push({ cell: grid[r][c], oldC: c });
        grid[r][c] = null;
      }
      const start = size - stack.length;
      for (let i = 0; i < stack.length; i++) {
        pushFall(stack[i].cell, r, start + i, r, stack[i].oldC);
      }
      for (let c = 0; c < start; c++) {
        const cell = makeCell(randFace(pool));
        pushFall(cell, r, c, r, c - start - 1);
      }
    }
  }
  return falls;
}

/**
 * 只有掉到「该槽位对齐的那一列/行」的外围末格，才能进入槽位
 */
function collectEdgeIntoSlots(grid, size, gravity, slots) {
  let fed = 0;
  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    if (slot.dir !== gravity) continue;
    if (slot.got >= slot.need) continue;
    const lane = Math.max(0, Math.min(size - 1, slot.lane | 0));
    let r;
    let c;
    if (gravity === 'down') {
      r = size - 1;
      c = lane;
    } else if (gravity === 'up') {
      r = 0;
      c = lane;
    } else if (gravity === 'left') {
      r = lane;
      c = 0;
    } else {
      r = lane;
      c = size - 1;
    }
    const cell = grid[r][c];
    if (!cell || cell.special) continue;
    if (cell.face !== slot.face) continue;
    slot.got++;
    slot.flashT = 0.7;
    grid[r][c] = null;
    fed++;
  }
  return fed;
}

function easeOutQuad(t) {
  const u = Math.max(0, Math.min(1, t));
  return 1 - (1 - u) * (1 - u);
}

function adj(r1, c1, r2, c2) {
  return (r1 === r2 && Math.abs(c1 - c2) === 1) || (c1 === c2 && Math.abs(r1 - r2) === 1);
}

function randomGravity(prev) {
  const pool = DIRS.filter((d) => d !== prev);
  const list = pool.length ? pool : DIRS;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 表情消消乐 · 重力边槽闯关
 */
class Match3Scene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this._toast = '';
    this._toastT = 0;
    this.shards = [];
    this.ringColor = 'cream';
    this.selected = null;
    this._drag = null;
    this.busy = false;
    this.over = false;
    this.won = false;
    this.hintCells = null;
    this.hintT = 0;
    this.falls = [];
    this._cascadePending = false;

    const prog = loadProgress();
    this.campaignScore = prog.score;
    this.levelIndex = Math.max(0, Math.min(MAX_LEVEL - 1, prog.level - 1));
    this._loadLevel();
    this._layout();
    showBanner('match3');
  }

  destroy() {
    hideBanner('match3');
  }

  flash(msg) {
    this._toast = msg;
    this._toastT = 1.8;
  }

  _loadLevel() {
    this.ringColor = pickRingColor(this.ringColor);
    const spec = levelSpec(this.levelIndex);
    this.spec = spec;
    this.size = spec.size;
    this.pool = spec.faces.slice();
    this.slots = spec.slots.map((s) => ({
      dir: s.dir,
      lane: s.lane != null ? s.lane : Math.floor(spec.size / 2),
      face: s.face,
      need: s.need,
      got: 0,
      flashT: 0,
    }));
    this.timeLeft = spec.timeLimit;
    this.gravity = spec.fixedGravity || 'down';
    this._wavesSinceGravity = 0;
    this.grid = fillGridNoMatch(this.size, this.pool);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.selected = null;
    this.busy = false;
    this.hintCells = null;
    this.hintT = 0;
    this.falls = [];
    this._cascadePending = false;
    this._scoreGateHinted = false;
    this._restoreReviveDock();
  }

  _restoreReviveDock() {
    if (!this.btnRevive || !this._reviveDock) return;
    const d = this._reviveDock;
    this.btnRevive.x = d.x;
    this.btnRevive.y = d.y;
    this.btnRevive.w = d.w;
    this.btnRevive.h = d.h;
    this.btnRevive.label = d.label;
    this.btnRevive.sub = d.sub;
    this.btnRevive.badge = d.badge;
  }

  _layout() {
    const W = P.width;
    const H = P.height;
    const s = P.safe;
    const adReserve = reservedBottom();

    this.btnBack = new Button({
      x: Math.max(10, s.left),
      y: s.top + 4,
      w: 64,
      h: 32,
      label: '返回',
      style: 'ghost',
      onTap: () => this.app.goto('more'),
    });
    this.btnRetry = new Button({
      x: W - Math.max(10, s.right) - 64,
      y: s.top + 4,
      w: 64,
      h: 32,
      label: '重开',
      style: 'gold',
      onTap: () => {
        this._loadLevel();
        this._layout();
        this.flash('重开本关');
      },
    });

    // 底栏：打乱 / 加时 / 续命（炸弹·十字在棋盘生成，拖动引爆）
    const propH = 52;
    const propY = H - adReserve - propH - 10;
    const bw = 72;
    const gapB = 8;
    const labels = ['提示', '打乱', '加时', '续命'];
    const ids = ['hint', 'shuffle', 'time', 'revive'];
    this._propBtns = [];
    const totalW = bw * labels.length + gapB * (labels.length - 1);
    let bx = (W - totalW) / 2;
    for (let i = 0; i < labels.length; i++) {
      const id = ids[i];
      const btn = new Button({
        x: bx,
        y: propY,
        w: bw,
        h: propH,
        label: labels[i],
        sub: '看广告',
        badge: 'AD',
        style: 'dock',
        onTap: () => this._onProp(id),
      });
      bx += bw + gapB;
      this._propBtns.push(btn);
    }
    this.btnHint = this._propBtns[0];
    this.btnShuffle = this._propBtns[1];
    this.btnTime = this._propBtns[2];
    this.btnRevive = this._propBtns[3];
    this._reviveDock = {
      x: this.btnRevive.x,
      y: this.btnRevive.y,
      w: this.btnRevive.w,
      h: this.btnRevive.h,
      label: '续命',
      sub: '看广告',
      badge: 'AD',
    };

    this.buttons = [
      this.btnBack,
      this.btnRetry,
      this.btnHint,
      this.btnShuffle,
      this.btnTime,
      this.btnRevive,
    ];

    // 顶栏标题 + 信息卡，中间棋盘最大化
    const titleH = 40;
    const infoH = 70;
    const infoTop = s.top + titleH;
    this._info = {
      x: 14,
      y: infoTop,
      w: W - 28,
      h: infoH,
    };

    const slotPad = 52;
    const boardTop = infoTop + infoH + 10;
    const boardBot = propY - 12;
    const side = 12 + slotPad * 0.55;
    const boardMaxH = Math.max(180, boardBot - boardTop - slotPad * 0.7);
    const boardMaxW = W - side * 2;
    const board = Math.min(boardMaxW, boardMaxH);
    this.boardS = board;
    this.boardX = (W - board) / 2;
    this.boardY = boardTop + Math.max(0, (boardBot - boardTop - board - slotPad * 0.35) / 2);
    this.cell = board / (this.size || 8);
    this.slotPad = slotPad;
    this._propY = propY;
  }

  _cellAt(x, y) {
    const pad = this.slotPad || 0;
    const bx = this.boardX - pad;
    const by = this.boardY - pad;
    const bs = this.boardS + pad * 2;
    if (x < bx || y < by || x > bx + bs || y > by + bs) return null;
    const lx = x - this.boardX;
    const ly = y - this.boardY;
    if (lx < 0 || ly < 0 || lx >= this.boardS || ly >= this.boardS) return null;
    const c = Math.floor(lx / this.cell);
    const r = Math.floor(ly / this.cell);
    if (r < 0 || r >= this.size || c < 0 || c >= this.size) return null;
    return { r: r, c: c };
  }

  _onProp(id) {
    if (id === 'hint') {
      if (this.over || this.won || this.busy) {
        this.flash('当前不能提示');
        return;
      }
      this.flash('看广告提示…');
      showRewarded('match3Hint', (ok) => {
        if (!ok) {
          this.flash('未看完广告');
          return;
        }
        this._showHint();
        daily.addPropUse();
      });
    } else if (id === 'shuffle') {
      this.flash('看广告打乱…');
      showRewarded('match3Shuffle', (ok) => {
        if (!ok) {
          this.flash('未看完广告');
          return;
        }
        this._shuffleBoard();
        daily.addPropUse();
      });
    } else if (id === 'time') {
      if (!this.over && !this.won) {
        this.flash('看广告加时…');
        showRewarded('match3Time', (ok) => {
          if (!ok) {
            this.flash('未看完广告');
            return;
          }
          this.timeLeft += 45;
          this.flash('+45 秒');
          sound.playChime();
          daily.addPropUse();
        });
      } else {
        this.flash('失败时可广告续命');
      }
    } else if (id === 'revive') {
      if (!this.over) {
        this.flash('超时后才能续命');
        return;
      }
      showRewarded('match3Revive', (ok) => {
        if (!ok) {
          this.flash('未看完广告');
          return;
        }
        this.over = false;
        this.timeLeft += 40;
        this.flash('续命 +40 秒');
        sound.playChime();
        daily.addPropUse();
      });
    }
  }

  _shuffleBoard() {
    const cells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c]) cells.push(this.grid[r][c]);
      }
    }
    shuffle(cells);
    let i = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) this.grid[r][c] = cells[i++];
    }
    if (hasAnyMatch(this.grid, this.size)) this._shuffleBoard();
    this.hintCells = null;
    this.flash('棋盘已打乱');
    sound.playClear();
  }

  /** 找一步可消交换并高亮 */
  _showHint() {
    const size = this.size;
    const g = this.grid;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const dirs = [
          [0, 1],
          [1, 0],
        ];
        for (let d = 0; d < dirs.length; d++) {
          const r2 = r + dirs[d][0];
          const c2 = c + dirs[d][1];
          if (r2 >= size || c2 >= size) continue;
          if (!g[r][c] || !g[r2][c2]) continue;
          const a = g[r][c];
          const b = g[r2][c2];
          // 拖动特殊道具也算提示
          if (a.special || b.special) {
            this.hintCells = [
              { r: r, c: c },
              { r: r2, c: c2 },
            ];
            this.hintT = 3.2;
            this.flash('拖动高亮格试试');
            sound.playChime();
            return;
          }
          g[r][c] = b;
          g[r2][c2] = a;
          const ok = findMatchCells(g, size).length > 0;
          g[r][c] = a;
          g[r2][c2] = b;
          if (ok) {
            this.hintCells = [
              { r: r, c: c },
              { r: r2, c: c2 },
            ];
            this.hintT = 3.2;
            this.flash('交换高亮两格可消');
            sound.playChime();
            return;
          }
        }
      }
    }
    this.flash('暂无步骤 · 可打乱棋盘');
  }

  _clearCells(coords) {
    const fill = colorOf(this.ringColor).fill;
    for (let i = 0; i < coords.length; i++) {
      const p = coords[i];
      const cell = this.grid[p.r][p.c];
      if (!cell) continue;
      const x = this.boardX + p.c * this.cell + this.cell / 2;
      const y = this.boardY + p.r * this.cell + this.cell / 2;
      spawnShatter(this.shards, x, y, fill, this.cell * 0.22);
      this.grid[p.r][p.c] = null;
      this.score += 12;
    }
    if (coords.length) sound.playClear();
  }

  /** 拖动炸弹 / 十字斩到新位置后引爆 */
  _detonateAt(r, c, kind) {
    const hits =
      kind === 'bomb'
        ? expandBomb(this.grid, this.size, r, c)
        : expandCross(this.grid, this.size, r, c);
    this._clearCells(hits);
    this.flash(kind === 'bomb' ? '炸弹 · 清 3×3' : '十字斩 · 横竖全消');
  }

  _maybeChangeGravity() {
    const every = this.spec.gravityEvery || 0;
    if (every <= 0) return; // 教学关固定
    this._wavesSinceGravity++;
    if (this._wavesSinceGravity < every) return;
    this._wavesSinceGravity = 0;
    const ng = randomGravity(this.gravity);
    if (ng !== this.gravity) {
      this.gravity = ng;
      this.flash('掉落改为「' + DIR_LABEL[ng] + '」');
    }
  }

  _slotsComplete() {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].got < this.slots[i].need) return false;
    }
    return true;
  }

  _scoreComplete() {
    return this.score >= (this.spec.targetScore || 0);
  }

  _canClearLevel() {
    return this._slotsComplete() && this._scoreComplete();
  }

  /** 启动连锁：先消再播掉落动画，动画结束后继续 */
  _startCascade() {
    this.busy = true;
    this._cascadePending = true;
    this._runCascadeRound();
  }

  _runCascadeRound() {
    const matched = findMatchCells(this.grid, this.size);
    if (!matched.length) {
      this._finishCascade();
      return;
    }

    const bombSp = bombSites(this.grid, this.size, matched);
    const crossSp = crossSites(this.grid, this.size, matched);
    const keep = Object.create(null);
    for (let i = 0; i < bombSp.length; i++) {
      keep[bombSp[i].r + ',' + bombSp[i].c] = bombSp[i];
    }
    for (let i = 0; i < crossSp.length; i++) {
      keep[crossSp[i].r + ',' + crossSp[i].c] = crossSp[i];
    }

    const survivors = Object.create(null);
    Object.keys(keep).forEach((k) => {
      const sp = keep[k];
      const cell = this.grid[sp.r][sp.c];
      const face = (cell && cell.face) || sp.face || this.pool[0];
      survivors[k] = makeCell(face, sp.kind);
    });

    for (let i = 0; i < matched.length; i++) {
      const p = matched[i];
      const k = p.r + ',' + p.c;
      if (survivors[k]) continue;
      const x = this.boardX + p.c * this.cell + this.cell / 2;
      const y = this.boardY + p.r * this.cell + this.cell / 2;
      spawnShatter(this.shards, x, y, colorOf(this.ringColor).fill, this.cell * 0.22);
      this.grid[p.r][p.c] = null;
      this.score += 12;
    }

    Object.keys(survivors).forEach((k) => {
      const parts = k.split(',');
      const rr = parseInt(parts[0], 10);
      const cc = parseInt(parts[1], 10);
      this.grid[rr][cc] = survivors[k];
    });

    if (Object.keys(survivors).length) {
      const kinds = Object.keys(survivors).map((k) => survivors[k].special);
      if (kinds.indexOf('cross') >= 0) this.flash('十字斩已生成 · 拖动触发');
      else this.flash('炸弹已生成 · 拖动引爆');
    }

    sound.playClear();
    this._beginFalls();
  }

  /** 压实 + 从对侧顶部补新，并播放掉落 */
  _beginFalls() {
    this.falls = packAndRefillWithFalls(this.grid, this.size, this.gravity, this.pool);
    if (!this.falls.length) {
      this._afterFalls();
    }
  }

  _afterFalls() {
    this.falls = [];
    const fed = collectEdgeIntoSlots(this.grid, this.size, this.gravity, this.slots);
    if (fed > 0) {
      sound.playChime();
      this.flash('送入槽位 ×' + fed);
      // 入槽后留下空位，再掉一轮
      this._beginFalls();
      return;
    }
    this._maybeChangeGravity();
    // 还有新三连则继续，否则结束
    if (findMatchCells(this.grid, this.size).length) {
      this._runCascadeRound();
    } else {
      this._finishCascade();
    }
  }

  _finishCascade() {
    this.busy = false;
    this._cascadePending = false;
    this.falls = [];
    this._checkEnd();
  }

  _cascadeAfterSwap() {
    this._startCascade();
  }

  _cascadeAfterSpecial() {
    this.busy = true;
    this._cascadePending = true;
    this._beginFalls();
  }

  _checkEnd() {
    if (this._canClearLevel()) {
      this.won = true;
      const extra = Math.floor(this.timeLeft) * 10;
      this.score += extra + this.spec.bonus;
      this.campaignScore += this.score;
      rank.submit('match3', this.campaignScore, { level: this.spec.level });
      album.unlockMany(this.pool);
      const cleared = Math.min(MAX_LEVEL, this.levelIndex + 1);
      saveProgress(Math.min(MAX_LEVEL, cleared + 1), this.campaignScore);
      sound.playWin();
      this.flash(
        this.levelIndex >= MAX_LEVEL - 1
          ? '全部通关！+' + (extra + this.spec.bonus)
          : '过关！+' + (extra + this.spec.bonus) + ' 分'
      );
      return;
    }
    if (this._slotsComplete() && !this._scoreComplete() && !this._scoreGateHinted) {
      this._scoreGateHinted = true;
      this.flash('槽位已激活 · 再攒 ' + (this.spec.targetScore - this.score) + ' 分过关');
    }
    if (this.timeLeft <= 0) {
      this.over = true;
      if (this.campaignScore > 0) rank.submit('match3', this.campaignScore, { level: this.spec.level });
    }
  }

  _trySwap(r1, c1, r2, c2) {
    if (this.busy || this.over || this.won) return;
    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];
    if (!a || !b) return;

    const aSp = a.special;
    const bSp = b.special;
    const movingSpecial = aSp === 'bomb' || aSp === 'cross' || bSp === 'bomb' || bSp === 'cross';

    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    this.selected = null;

    // 拖动炸弹 / 十字斩：在移动后的落点引爆（无需三连）
    if (movingSpecial) {
      this.busy = true;
      if (aSp === 'bomb' || aSp === 'cross') this._detonateAt(r2, c2, aSp);
      if (bSp === 'bomb' || bSp === 'cross') this._detonateAt(r1, c1, bSp);
      this._cascadeAfterSpecial();
      return;
    }

    const matched = findMatchCells(this.grid, this.size);
    if (!matched.length) {
      this.grid[r1][c1] = a;
      this.grid[r2][c2] = b;
      return;
    }
    this.busy = true;
    this._cascadeAfterSwap();
  }

  _tapCell(r, c) {
    if (this.busy || this.over || this.won) return;
    const cell = this.grid[r][c];
    if (!cell) return;

    if (this.selected) {
      const s = this.selected;
      if (s.r === r && s.c === c) {
        this.selected = null;
        return;
      }
      if (adj(s.r, s.c, r, c)) {
        this._trySwap(s.r, s.c, r, c);
        return;
      }
    }

    this.selected = { r: r, c: c };
    if (cell.special === 'bomb') this.flash('拖到相邻格 · 引爆 3×3');
    else if (cell.special === 'cross') this.flash('拖到相邻格 · 横竖全消');
  }

  _nextLevel() {
    if (this.levelIndex >= MAX_LEVEL - 1) {
      this.flash('已经是最后一关');
      this._loadLevel();
      this._layout();
      showBanner('match3');
      return;
    }
    this.levelIndex++;
    saveProgress(this.levelIndex + 1, this.campaignScore);
    this._loadLevel();
    this._layout();
    showBanner('match3');
    this.flash('第 ' + this.spec.level + ' 关');
  }

  update(dt) {
    if (P.syncCanvas) {
      const changed = P.syncCanvas();
      if (changed) {
        this._layout();
        showBanner('match3');
      }
    }
    this.t += dt;
    if (this._toastT > 0) this._toastT -= dt;
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hintCells = null;
    }
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].flashT > 0) this.slots[i].flashT -= dt;
    }
    updateShards(this.shards, dt);

    // 掉落动画
    if (this.falls && this.falls.length) {
      let allDone = true;
      for (let i = 0; i < this.falls.length; i++) {
        const f = this.falls[i];
        f.t += dt;
        if (f.t < f.dur) allDone = false;
      }
      if (allDone) this._afterFalls();
    }

    if (!this.over && !this.won && !this.busy) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.over = true;
        if (this.campaignScore > 0) rank.submit('match3', this.campaignScore, { level: this.spec.level });
      }
    }

    for (let i = 0; i < this.buttons.length; i++) this.buttons[i].update(dt);

    const ptr = P.pointer;
    if (ptr.justPressed && !this.over && !this.won && !this.busy) {
      this._drag = { r: null, c: null, x: ptr.x, y: ptr.y };
      const hit = this._cellAt(ptr.x, ptr.y);
      if (hit) {
        this._drag.r = hit.r;
        this._drag.c = hit.c;
      }
    }
    if (ptr.justReleased && this._drag) {
      const d = this._drag;
      this._drag = null;
      if (!this.busy && !this.over && !this.won) {
        const dx = ptr.x - d.x;
        const dy = ptr.y - d.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (d.r != null && dist >= 20) {
          let r2 = d.r;
          let c2 = d.c;
          if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1;
          else r2 += dy > 0 ? 1 : -1;
          if (r2 >= 0 && r2 < this.size && c2 >= 0 && c2 < this.size) {
            this._trySwap(d.r, d.c, r2, c2);
          }
        } else if (d.r != null && dist < 20) {
          this._tapCell(d.r, d.c);
        }
      }
    }

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
      if (this.won && this._overlayNext && this._hit(tap, this._overlayNext)) {
        this._nextLevel();
        continue;
      }
      if ((this.over || this.won) && this._overlayRetry && this._hit(tap, this._overlayRetry)) {
        this._loadLevel();
        this._layout();
        showBanner('match3');
        continue;
      }
      const cell = this._cellAt(tap.x, tap.y);
      if (cell) this._tapCell(cell.r, cell.c);
    }

  }

  _hit(tap, box) {
    return tap.x >= box.x && tap.x <= box.x + box.w && tap.y >= box.y && tap.y <= box.y + box.h;
  }

  _slotPos(slot) {
    const pad = this.slotPad;
    const lane = Math.max(0, Math.min(this.size - 1, slot.lane | 0));
    const mid = (lane + 0.5) / this.size;
    if (slot.dir === 'up') {
      return { x: this.boardX + this.boardS * mid, y: this.boardY - pad * 0.58 };
    }
    if (slot.dir === 'down') {
      return { x: this.boardX + this.boardS * mid, y: this.boardY + this.boardS + pad * 0.42 };
    }
    if (slot.dir === 'left') {
      return { x: this.boardX - pad * 0.5, y: this.boardY + this.boardS * mid };
    }
    return { x: this.boardX + this.boardS + pad * 0.5, y: this.boardY + this.boardS * mid };
  }

  _drawInfoCard(ctx, W, s) {
    const info = this._info;
    if (!info) return;
    roundRect(ctx, info.x, info.y, info.w, info.h, 16);
    ctx.fillStyle = 'rgba(255,248,236,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(91,70,54,0.1)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, info.x, info.y, info.w, info.h, 16);
    ctx.stroke();

    // 上行：关卡说明 | 得分（互不重叠）
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '700 12px ' + FONT;
    ctx.fillStyle = Theme.inkSoft;
    ctx.fillText('第 ' + this.spec.level + ' 关 · 送槽+积分', info.x + 12, info.y + 16);
    ctx.textAlign = 'right';
    ctx.font = '600 11px ' + FONT;
    ctx.fillStyle = Theme.inkMute;
    ctx.fillText('累计 ' + this.campaignScore, info.x + info.w - 12, info.y + 16);

    // 下行三列：积分门槛 / 掉落 / 时间（槽位进度看槽本身激活态）
    const colW = info.w / 3;
    const rowY = info.y + 46;
    const arrowMap = { up: '↑', down: '↓', left: '←', right: '→' };
    const tUrgent = this.timeLeft <= 12;
    const scoreOk = this._scoreComplete();

    const cols = [
      {
        label: '积分',
        value: this.score + '/' + this.spec.targetScore,
        color: scoreOk ? Theme.score : Theme.ink,
      },
      {
        label: '掉落',
        value: (arrowMap[this.gravity] || '↓') + DIR_LABEL[this.gravity],
        color: Theme.ink,
      },
      {
        label: '剩余',
        value: Math.ceil(this.timeLeft) + 's',
        color: tUrgent ? Theme.urgent : Theme.time,
      },
    ];
    for (let i = 0; i < cols.length; i++) {
      const cx = info.x + colW * (i + 0.5);
      ctx.textAlign = 'center';
      ctx.font = '600 10px ' + FONT;
      ctx.fillStyle = Theme.inkMute;
      ctx.fillText(cols[i].label, cx, rowY - 10);
      ctx.font = '800 16px ' + FONT;
      ctx.fillStyle = cols[i].color;
      ctx.fillText(cols[i].value, cx, rowY + 8);
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
    g.addColorStop(0.45, Theme.bgMid);
    g.addColorStop(1, Theme.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this.btnBack.draw(ctx);
    this.btnRetry.draw(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 20px ' + FONT;
    ctx.fillStyle = Theme.ink;
    ctx.fillText('表情消消乐', W * 0.5, s.top + 6);

    this._drawInfoCard(ctx, W, s);
    this._drawSlots(ctx);

    // 格间无缝；白底直角，腾出空间把表情略放大
    const faceScale = 0.48;
    roundRect(ctx, this.boardX - 4, this.boardY - 4, this.boardS + 8, this.boardS + 8, 10);
    ctx.fillStyle = 'rgba(255,248,236,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(91,70,54,0.12)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, this.boardX - 4, this.boardY - 4, this.boardS + 8, this.boardS + 8, 10);
    ctx.stroke();

    ctx.fillStyle = 'rgba(91,70,54,0.07)';
    ctx.fillRect(this.boardX, this.boardY, this.boardS, this.boardS);

    const fallMap = Object.create(null);
    if (this.falls) {
      for (let i = 0; i < this.falls.length; i++) {
        const f = this.falls[i];
        fallMap[f.r + ',' + f.c] = f;
      }
    }

    // 底格：铺满格子、无圆角
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const x = this.boardX + c * this.cell;
        const y = this.boardY + r * this.cell;
        const cs = this.cell;
        const sel = this.selected && this.selected.r === r && this.selected.c === c;
        let isHint = false;
        if (this.hintCells && this.hintT > 0) {
          for (let hi = 0; hi < this.hintCells.length; hi++) {
            if (this.hintCells[hi].r === r && this.hintCells[hi].c === c) {
              isHint = true;
              break;
            }
          }
        }
        ctx.fillStyle = sel
          ? 'rgba(255,180,196,0.5)'
          : isHint
            ? 'rgba(255,230,100,0.55)'
            : 'rgba(255,252,245,0.95)';
        ctx.fillRect(x, y, cs, cs);
        if (sel || isHint) {
          ctx.strokeStyle = sel ? 'rgba(255,107,154,0.95)' : 'rgba(240,160,16,0.95)';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
        }
      }
    }

    // 表情（带掉落插值），裁剪在棋盘内
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.boardX, this.boardY, this.boardS, this.boardS);
    ctx.clip();

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        const cs = this.cell;
        let drawR = r;
        let drawC = c;
        const f = fallMap[r + ',' + c];
        if (f) {
          const u = easeOutQuad(f.t / f.dur);
          drawR = f.fromR + (f.r - f.fromR) * u;
          drawC = f.fromC + (f.c - f.fromC) * u;
        }
        const cx = this.boardX + drawC * this.cell + this.cell / 2;
        const cy = this.boardY + drawR * this.cell + this.cell / 2;
        drawDango(ctx, {
          x: cx,
          y: cy,
          r: cs * faceScale,
          face: cell.face,
          color: this.ringColor,
          selected: false,
        });
        if (cell.special === 'bomb' || cell.special === 'cross') {
          const tag = cell.special === 'bomb' ? '炸' : '斩';
          ctx.beginPath();
          ctx.arc(cx + cs * 0.32, cy - cs * 0.32, 8, 0, Math.PI * 2);
          ctx.fillStyle = cell.special === 'bomb' ? '#ff6b9a' : '#5b8def';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '800 8px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tag, cx + cs * 0.32, cy - cs * 0.32 + 0.5);
        }
      }
    }
    ctx.restore();

    // 失败时续命挪到结算卡，底栏先复位再画（避免重开后残留）
    if (!this.over) this._restoreReviveDock();
    for (let i = 0; i < this._propBtns.length; i++) {
      if (this.over && this._propBtns[i] === this.btnRevive) continue;
      this._propBtns[i].draw(ctx);
    }

    if (this._toastT > 0 && this._toast) {
      const ty = this.boardY + 16;
      ctx.globalAlpha = Math.min(1, this._toastT * 2);
      ctx.font = '700 13px ' + FONT;
      const tw = Math.min(this.boardS, ctx.measureText(this._toast).width + 28);
      roundRect(ctx, (W - tw) / 2, ty - 8, tw, 28, 10);
      ctx.fillStyle = 'rgba(255,248,236,0.95)';
      ctx.fill();
      ctx.fillStyle = Theme.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._toast, W * 0.5, ty + 6);
      ctx.globalAlpha = 1;
    }

    drawShards(ctx, this.shards);

    if (this.won || this.over) {
      ctx.fillStyle = 'rgba(91,70,54,0.45)';
      ctx.fillRect(0, 0, W, H);

      const adTop = H - reservedBottom();
      const cardW = Math.min(300, W - 40);
      const cardH = this.won && this.levelIndex < MAX_LEVEL - 1 ? 210 : this.over ? 230 : 190;
      const cardX = (W - cardW) / 2;
      const belowExtra = this.over ? 56 : 0; // 续命按钮高度+间距，避开广告
      let cardY = (H - cardH) / 2 - 20;
      const maxBottom = adTop - 8 - belowExtra;
      if (cardY + cardH > maxBottom) cardY = Math.max(s.top + 48, maxBottom - cardH);
      roundRect(ctx, cardX, cardY, cardW, cardH, 22);
      const cg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      if (this.won) {
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
      ctx.strokeStyle = this.won ? Theme.cardStrokeWin : Theme.cardStrokeFail;
      ctx.lineWidth = 2;
      roundRect(ctx, cardX, cardY, cardW, cardH, 22);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 26px ' + FONT;
      ctx.fillStyle = this.won ? Theme.titleWin : Theme.titleFail;
      ctx.fillText(this.won ? '过关啦！' : '时间到', W * 0.5, cardY + 36);

      ctx.font = '600 13px ' + FONT;
      ctx.fillStyle = Theme.subText;
      ctx.fillText(
        this.won ? '槽位已激活 · 积分达标' : '还可以看广告续命',
        W * 0.5,
        cardY + 64
      );

      roundRect(ctx, cardX + 24, cardY + 82, cardW - 48, 44, 12);
      ctx.fillStyle = Theme.scoreBox;
      ctx.fill();
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = Theme.inkSoft;
      ctx.fillText('本关', W * 0.5 - 58, cardY + 96);
      ctx.fillText('累计', W * 0.5 + 58, cardY + 96);
      ctx.font = '800 18px ' + FONT;
      ctx.fillStyle = Theme.score;
      ctx.fillText(String(this.score), W * 0.5 - 58, cardY + 116);
      ctx.fillStyle = Theme.ink;
      ctx.fillText(String(this.campaignScore), W * 0.5 + 58, cardY + 116);

      const bw = 112;
      const bh = 40;
      const btnY = cardY + cardH - 56;
      const gap = 12;
      if (this.won && this.levelIndex < MAX_LEVEL - 1) {
        this._overlayRetry = { x: W * 0.5 - bw - gap / 2, y: btnY, w: bw, h: bh };
        this._overlayNext = { x: W * 0.5 + gap / 2, y: btnY, w: bw, h: bh };
      } else {
        this._overlayRetry = { x: (W - bw) / 2, y: btnY, w: bw, h: bh };
        this._overlayNext = null;
      }

      roundRect(ctx, this._overlayRetry.x, this._overlayRetry.y, bw, bh, 12);
      ctx.fillStyle = 'rgba(255,248,236,0.98)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(91,70,54,0.2)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, this._overlayRetry.x, this._overlayRetry.y, bw, bh, 12);
      ctx.stroke();
      ctx.font = '700 15px ' + FONT;
      ctx.fillStyle = Theme.ink;
      ctx.fillText('重开本关', this._overlayRetry.x + bw / 2, this._overlayRetry.y + bh / 2);

      if (this._overlayNext) {
        roundRect(ctx, this._overlayNext.x, this._overlayNext.y, bw, bh, 12);
        ctx.fillStyle = Theme.gold;
        ctx.fill();
        ctx.font = '700 15px ' + FONT;
        ctx.fillStyle = Theme.goldInk;
        ctx.fillText('下一关', this._overlayNext.x + bw / 2, this._overlayNext.y + bh / 2);
      }

      if (this.over) {
        this.btnRevive.x = (W - 140) / 2;
        this.btnRevive.y = Math.min(cardY + cardH + 14, adTop - 50);
        this.btnRevive.w = 140;
        this.btnRevive.h = 42;
        this.btnRevive.label = '看广告续命';
        this.btnRevive.draw(ctx);
      }
    }
  }

  _drawSlots(ctx) {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const pos = this._slotPos(slot);
      // 表情与棋盘同大；外框只留紧贴边距，整体槽位更小
      const faceR = Math.max(16, this.cell * 0.48);
      const pad = 3;
      const active = slot.dir === this.gravity;
      const done = slot.got >= slot.need;
      const boxW = (faceR + pad) * 2;
      const boxH = (faceR + pad) * 2;
      const boxX = pos.x - faceR - pad;
      const boxY = pos.y - faceR - pad;
      const faceY = pos.y;

      // 对齐目标列/行的末格外侧；激活态用高亮框，不显示数字
      roundRect(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.fillStyle = done
        ? 'rgba(60,200,120,0.28)'
        : active
          ? 'rgba(255,228,180,0.95)'
          : 'rgba(255,248,236,0.92)';
      ctx.fill();
      ctx.strokeStyle = done
        ? 'rgba(40,180,100,0.95)'
        : active
          ? 'rgba(240,160,16,0.75)'
          : 'rgba(91,70,54,0.16)';
      ctx.lineWidth = done ? 2.4 : active ? 2 : 1.2;
      roundRect(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.stroke();

      if (done) {
        ctx.beginPath();
        ctx.arc(pos.x, faceY, faceR + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(60,200,120,0.55)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 从棋盘末格连到槽位的引导线
      if (active && !done) {
        const lane = Math.max(0, Math.min(this.size - 1, slot.lane | 0));
        let ex;
        let ey;
        if (slot.dir === 'down') {
          ex = this.boardX + (lane + 0.5) * this.cell;
          ey = this.boardY + this.boardS;
        } else if (slot.dir === 'up') {
          ex = this.boardX + (lane + 0.5) * this.cell;
          ey = this.boardY;
        } else if (slot.dir === 'left') {
          ex = this.boardX;
          ey = this.boardY + (lane + 0.5) * this.cell;
        } else {
          ex = this.boardX + this.boardS;
          ey = this.boardY + (lane + 0.5) * this.cell;
        }
        ctx.strokeStyle = 'rgba(240,160,16,0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawDango(ctx, {
        x: pos.x,
        y: faceY,
        r: faceR,
        face: slot.face,
        color: done ? '#3cc878' : this.ringColor,
        selected: done,
      });

      if (slot.flashT > 0) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(slot.flashT * 14);
        ctx.beginPath();
        ctx.arc(pos.x, faceY, faceR + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#3cc878';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
}

module.exports = { Match3Scene };