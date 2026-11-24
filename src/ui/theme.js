'use strict';

/**
 * 主题色对齐表情包本体：奶油肤色、腮红粉、薄荷绿、天空蓝、琥珀黄
 * （见 data/faces.js COLORS: cream / pink / mint / sky / amber）
 */
const Theme = {
  // 背景
  clear: '#fff1d6',
  bgTop: '#ffe9c8',
  bgMid: '#ffe4ec',
  bgBot: '#d8f0ea',

  // 文字
  ink: '#5b4636',
  inkSoft: 'rgba(91,70,54,0.72)',
  inkMute: 'rgba(91,70,54,0.45)',
  title: '#5b4636',
  score: '#c07810',
  time: '#1f8a72',
  urgent: '#c4183a',

  // 顶栏 / 底栏
  hudTop: 'rgba(255,248,236,0.94)',
  hudBot: 'rgba(255,232,236,0.92)',
  hudLine: 'rgba(255,180,196,0.65)',
  dock: 'rgba(255,248,236,0.92)',
  dockStroke: 'rgba(91,70,54,0.14)',
  slotHole: 'rgba(91,70,54,0.06)',
  slotRing: 'rgba(91,70,54,0.18)',
  hint: 'rgba(91,70,54,0.45)',

  // 氛围光
  glowPink: 'rgba(255,176,196,0.45)',
  glowMint: 'rgba(122,217,184,0.4)',
  glowAmber: 'rgba(240,160,16,0.35)',

  // 结算卡
  dim: 'rgba(91,70,54,0.28)',
  cardWin0: '#e8fff4',
  cardWin1: '#fff8ee',
  cardWin2: '#e8f6ff',
  cardFail0: '#fff0f4',
  cardFail1: '#fff8ee',
  cardFail2: '#ffe9d4',
  cardStrokeWin: 'rgba(60,200,120,0.55)',
  cardStrokeFail: 'rgba(255,143,181,0.55)',
  titleWin: '#1f5a48',
  titleFail: '#6b2f45',
  scoreBox: 'rgba(255,241,214,0.85)',
  subText: 'rgba(91,70,54,0.7)',

  // 按钮（与 button.js 呼应）
  primary: '#ffb4c4',
  primaryInk: '#6b2f45',
  gold: '#f0a010',
  goldInk: '#4a2800',
  mint: '#3cc878',
  mintInk: '#0a3d28',
  revive: '#ff8fb5',
  ghostFill: 'rgba(91,70,54,0.08)',
  ghostStroke: 'rgba(91,70,54,0.22)',
  ghostText: 'rgba(91,70,54,0.88)',
};

module.exports = { Theme };
