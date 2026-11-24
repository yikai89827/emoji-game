'use strict';

const seen = { frames: 0 };

const ctxStub = new Proxy({
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  measureText() { return { width: 40 }; },
}, {
  get(t, p) { return p in t ? t[p] : function () {}; },
  set() { return true; },
});

const canvasStub = {
  width: 390, height: 844,
  getContext() { return ctxStub; },
  requestAnimationFrame() { return 0; },
  addEventListener() {},
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 844 }; },
};

global.wx = {
  createCanvas: () => canvasStub,
  getSystemInfoSync: () => ({
    windowWidth: 390, windowHeight: 844, pixelRatio: 2,
    statusBarHeight: 44,
    safeArea: { top: 44, left: 0, right: 390, bottom: 810 },
  }),
  getMenuButtonBoundingClientRect: () => ({ top: 48, bottom: 80, left: 281, right: 368, width: 87, height: 32 }),
  onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
  onWindowResize() {},
};

const P = require('../src/platform.js');
const { Scene } = require('../src/game/scene.js');

P.initInput();
const app = { goto() {} };
const scene = new Scene(app, { level: 0 });

if (scene.introDone || scene.pieces.length !== 0) {
  console.error('开局应为空场落雨', scene.pieces.length, scene.introDone);
  process.exitCode = 1;
} else {
  let tapped = false;
  for (let f = 0; f < 480; f++) {
    scene.update(1 / 60);
    scene.draw();
    P.endFrame();
    seen.frames++;

    if (!tapped && scene.introDone && scene.pieces.length >= 20) {
      const byKey = Object.create(null);
      for (const p of scene.pieces) {
        const k = p.matchKey;
        if (!byKey[k]) byKey[k] = [];
        byKey[k].push(p);
      }
      let trio = null;
      for (const k in byKey) if (byKey[k].length >= 3) { trio = byKey[k].slice(0, 3); break; }
      if (trio) {
        for (const p of trio) P.taps.push({ x: p.x, y: p.y });
        tapped = true;
      }
    }

    for (const p of scene.pieces) {
      if (!isFinite(p.x) || !isFinite(p.y)) {
        console.error('NaN at frame', f);
        process.exitCode = 1;
        process.exit();
      }
    }
  }

  if (!scene.introDone) {
    console.error('开局落雨未完成');
    process.exitCode = 1;
  } else {
    console.log(
      '冒烟通过：帧', seen.frames,
      '堆', scene.pieces.length,
      '分', scene.score,
      '目标', scene.cfg.targetScore,
      '时限', scene.cfg.timeLimit,
      '点选', tapped ? 'ok' : 'skip'
    );
  }
}

// 新玩法冒烟：找不同 + 消消乐
{
  const { SpotDiffScene } = require('../src/game/spotdiff.js');
  const { Match3Scene } = require('../src/game/match3.js');
  const spot = new SpotDiffScene(app);
  for (let i = 0; i < 30; i++) {
    spot.update(1 / 60);
    spot.draw();
    P.endFrame();
  }
  if (!spot.left || !spot.left.length || !spot.right || !spot.right.length) {
    console.error('找不同棋盘未生成');
    process.exitCode = 1;
  } else {
    console.log('找不同冒烟 ok · 关', spot.levelIndex + 1, '时限', Math.ceil(spot.timeLeft));
  }
  if (spot.destroy) spot.destroy();

  const m3 = new Match3Scene(app);
  for (let i = 0; i < 30; i++) {
    m3.update(1 / 60);
    m3.draw();
    P.endFrame();
  }
  if (!m3.grid || !m3.grid.length || !m3.slots || !m3.slots.length) {
    console.error('消消乐棋盘/槽位未生成');
    process.exitCode = 1;
  } else {
    console.log(
      '消消乐冒烟 ok · 关', m3.spec.level,
      '尺寸', m3.size,
      '槽', m3.slots.length,
      '重力', m3.gravity
    );
  }
  if (m3.destroy) m3.destroy();
}
