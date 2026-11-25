'use strict';

/**
 * 分玩法排行：
 * - 同玩好友榜：每日虚拟同玩 + 本机玩家（无后端时的同玩展示）
 * - 全服总榜：每日固定种子生成 100 名虚拟玩家；有本机成绩则插入并计算全服名次
 */
const KEY = 'tkc_rank_v3';
const LEGACY_KEY = 'tkc_rank_v2';
const LOCAL_MAX = 10;
const GLOBAL_SIZE = 100;
const FRIEND_SIZE = 20;
const GLOBAL_SHOW = 50;

/** @type {any} */
let _mem = null;

const GAMES = ['match', 'fuse', 'sudoku', 'spot', 'match3'];

const LABELS = {
  match: '表情大冲关',
  fuse: '表情合成',
  sudoku: '表情数独',
  spot: '表情找不同',
  match3: '表情消消乐',
};

const NICK_POOL = [
  '团子选手', '表情猎人', '小太阳', '开心果', '开心蛙', '笑哭侠',
  '冷静猫', '火花兔', '奶茶怪', '星星眼', '摸鱼鸭', '冲分王',
  '逻辑熊', '观察狮', '合成达人', '数独迷', '找茬高手', '三消高手',
  '晚风', '阿乐', '小凯', '柚子', '糯米', '豆豆', '七七', '阿棠',
  '果冻', '可乐', '布丁', '芝麻', '花生', '栗子', '青柠', '蜜桃',
  '北极光', '南风', '云朵', '露珠', '竹马', '青禾', '晚星', '晨光',
  '糖醋', '椒盐', '海盐', '焦糖', '芝士', '抹茶', '可可', '香草',
  '闪电侠', '慢热君', '开挂星人', '佛系玩家', '肝帝本帝', '休闲派',
  '上岸了', '再来一把', '差一分', '差一点', '稳住', '别慌',
  '周末战士', '地铁玩家', '午休局', '睡前三消', '摸鱼局', '认真局',
];

const SCORE_RANGE = {
  match: [180, 9200],
  fuse: [120, 28000],
  sudoku: [80, 6400],
  spot: [80, 4200],
  match3: [200, 18000],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function _rawGet() {
  if (_mem) return _mem;
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const v = wx.getStorageSync(KEY);
      if (v) {
        _mem = typeof v === 'string' ? JSON.parse(v) : v;
        return _mem;
      }
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const s = localStorage.getItem(KEY);
      if (s) {
        _mem = JSON.parse(s);
        return _mem;
      }
    }
  } catch (e) { /* ignore */ }

  // 迁移旧本机榜
  try {
    let legacy = null;
    if (typeof wx !== 'undefined' && wx.getStorageSync) legacy = wx.getStorageSync(LEGACY_KEY);
    if (!legacy && typeof localStorage !== 'undefined') {
      const s = localStorage.getItem(LEGACY_KEY);
      legacy = s ? JSON.parse(s) : null;
    }
    if (legacy && typeof legacy === 'object') {
      const out = { day: '', games: {} };
      for (let i = 0; i < GAMES.length; i++) {
        const g = GAMES[i];
        const list = (legacy[g] && legacy[g].list) || [];
        const best = list.length
          ? {
              score: list[0].score || 0,
              level: list[0].level || 0,
              tip: list[0].tip || '',
              at: list[0].at || Date.now(),
            }
          : null;
        out.games[g] = { list: list.slice(0, LOCAL_MAX), best: best };
      }
      _mem = out;
      return _mem;
    }
  } catch (e) { /* ignore */ }

  _mem = { day: '', games: {} };
  return _mem;
}

function _rawSet(data) {
  _mem = data;
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(KEY, data);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch (e) { /* ignore */ }
}

function _ensureGame(data, game) {
  const g = GAMES.indexOf(game) >= 0 ? game : 'match';
  if (!data.games) data.games = {};
  if (!data.games[g]) data.games[g] = { list: [], best: null };
  if (!Array.isArray(data.games[g].list)) data.games[g].list = [];
  return data.games[g];
}

function _range(game) {
  return SCORE_RANGE[game] || SCORE_RANGE.match;
}

function _genVirtual(game, day, count, tag) {
  const rnd = mulberry32(hashStr(day + '|' + game + '|' + tag));
  const range = _range(game);
  const lo = range[0];
  const hi = range[1];
  const used = Object.create(null);
  const list = [];
  for (let i = 0; i < count; i++) {
    let name = NICK_POOL[Math.floor(rnd() * NICK_POOL.length)];
    let guard = 0;
    while (used[name] && guard < 40) {
      name = NICK_POOL[Math.floor(rnd() * NICK_POOL.length)] + (1 + Math.floor(rnd() * 9));
      guard++;
    }
    used[name] = 1;
    // 分数偏中高，带一点长尾
    const t = Math.pow(rnd(), 0.72);
    const score = Math.floor(lo + (hi - lo) * t);
    const level =
      game === 'match' || game === 'spot' || game === 'match3'
        ? 1 + Math.floor(rnd() * (game === 'match3' ? 20 : 12))
        : 0;
    list.push({
      name: name,
      score: score,
      level: level,
      tip: '',
      virtual: true,
      isMe: false,
    });
  }
  list.sort((a, b) => b.score - a.score);
  return list;
}

function _playerName() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const cached = wx.getStorageSync('tkc_nick');
      if (cached) return String(cached);
    }
  } catch (e) { /* ignore */ }
  return '我';
}

function _syncCloud(game, best) {
  if (!best || typeof wx === 'undefined' || !wx.setUserCloudStorage) return;
  try {
    wx.setUserCloudStorage({
      KVDataList: [
        {
          key: 'rank_' + game,
          value: JSON.stringify({
            score: best.score || 0,
            level: best.level || 0,
            at: best.at || Date.now(),
          }),
        },
      ],
    });
  } catch (e) { /* ignore */ }
}

function _refreshDay(data) {
  const day = todayKey();
  if (data.day === day) return data;
  data.day = day;
  // 虚拟榜按日种子即时生成，不必整表落盘；只记下日期
  _rawSet(data);
  return data;
}

function getBest(game) {
  const data = _refreshDay(_rawGet());
  const board = _ensureGame(data, game);
  return board.best ? Object.assign({}, board.best) : null;
}

function getList(game) {
  const data = _refreshDay(_rawGet());
  const list = _ensureGame(data, game).list || [];
  return list
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, LOCAL_MAX);
}

function _mergeMe(virtualList, best) {
  const list = virtualList.map((r) => Object.assign({}, r));
  if (!best || !(best.score > 0)) {
    return { list: list, myRank: 0, myScore: 0, total: list.length };
  }
  const me = {
    name: _playerName(),
    score: best.score | 0,
    level: best.level || 0,
    tip: best.tip || '',
    virtual: false,
    isMe: true,
  };
  list.push(me);
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 同分：玩家靠前一点更好看
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return 0;
  });
  let myRank = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].isMe) {
      myRank = i + 1;
      break;
    }
  }
  return { list: list, myRank: myRank, myScore: me.score, total: list.length };
}

function getGlobalBoard(game) {
  const data = _refreshDay(_rawGet());
  const day = data.day || todayKey();
  const board = _ensureGame(data, game);
  const hasMe = !!(board.best && board.best.score > 0);
  // 凑满 100：无玩家全虚拟；有玩家则 99 虚拟 + 我
  const virtual = _genVirtual(game, day, hasMe ? GLOBAL_SIZE - 1 : GLOBAL_SIZE, 'global');
  const merged = _mergeMe(virtual, board.best);
  return {
    day: day,
    kind: 'global',
    list: merged.list,
    show: merged.list.slice(0, GLOBAL_SHOW),
    myRank: merged.myRank,
    myScore: merged.myScore,
    total: merged.total,
  };
}

function getFriendBoard(game) {
  const data = _refreshDay(_rawGet());
  const day = data.day || todayKey();
  const board = _ensureGame(data, game);
  // 同玩好友：不填充虚拟玩家，仅本机「我」（后续可接微信同玩好友）
  const merged = _mergeMe([], board.best);
  return {
    day: day,
    kind: 'friend',
    list: merged.list,
    show: merged.list,
    myRank: merged.myRank,
    myScore: merged.myScore,
    total: merged.total,
  };
}

function getMyGlobalRank(game) {
  return getGlobalBoard(game).myRank || 0;
}

function submit(game, score, meta) {
  meta = meta || {};
  const n = Math.max(0, Math.floor(score || 0));
  if (n <= 0) return getList(game);

  const data = _refreshDay(_rawGet());
  const board = _ensureGame(data, game);
  const row = {
    score: n,
    level: meta.level || 0,
    at: Date.now(),
    tip: meta.tip || '',
  };
  board.list.push(row);
  board.list.sort((a, b) => b.score - a.score);
  board.list = board.list.slice(0, LOCAL_MAX);

  if (!board.best || n >= (board.best.score || 0)) {
    board.best = {
      score: n,
      level: row.level,
      tip: row.tip,
      at: row.at,
    };
    _syncCloud(game, board.best);
  }

  _rawSet(data);
  return board.list.slice();
}

module.exports = {
  getList,
  getBest,
  getGlobalBoard,
  getFriendBoard,
  getMyGlobalRank,
  submit,
  MAX: LOCAL_MAX,
  GLOBAL_SIZE,
  FRIEND_SIZE,
  GAMES,
  LABELS,
};
