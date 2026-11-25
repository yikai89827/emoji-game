'use strict';

const P = require('./platform.js');
const { HomeScene } = require('./game/home.js');
const { Scene } = require('./game/scene.js');
const { MoreScene } = require('./game/more.js');
const { Fuse2048Scene } = require('./game/fuse2048.js');
const { SudokuScene } = require('./game/sudoku.js');
const { SpotDiffScene } = require('./game/spotdiff.js');
const { Match3Scene } = require('./game/match3.js');
const { PickScene } = require('./game/pick.js');
const { bindLifecycle, preloadAll: preloadInterstitial } = require('./ads/interstitial.js');
const { hideAll } = require('./ads/custom-ad.js');
const { bindUpdateCheck } = require('./system/update.js');
const { loadFacesPackage } = require('./ads/faces-pkg.js');
const { startLoad: startFaceSprites } = require('./render/face-sprites.js');

/** 场景注册表：新增玩法只需在此加一行 */
const SCENES = {
  home: HomeScene,
  game: Scene,
  more: MoreScene,
  fuse2048: Fuse2048Scene,
  sudoku: SudokuScene,
  spotdiff: SpotDiffScene,
  match3: Match3Scene,
  pick: PickScene,
};

const app = {
  scene: null,

  /** 注册/覆盖场景（便于分包或热插拔） */
  register(name, Ctor) {
    if (!name || typeof Ctor !== 'function') return;
    SCENES[name] = Ctor;
  },

  goto(name, opts) {
    opts = opts || {};
    const Ctor = SCENES[name];
    if (!Ctor) {
      console.warn('[app] unknown scene:', name);
      return;
    }
    if (this.scene && this.scene.destroy) {
      try {
        this.scene.destroy();
      } catch (e) { /* ignore */ }
    }
    hideAll();
    this.scene = new Ctor(this, opts);
  },
};

function start() {
  P.initInput();
  bindUpdateCheck();
  preloadInterstitial();
  bindLifecycle();
  app.goto('home');

  let last = 0;
  P.startLoop((now) => {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    if (app.scene) {
      app.scene.update(dt);
      app.scene.draw();
    }
    P.endFrame();
  });
}

// 先拉表情分包，再解码贴图，避免主包超限
loadFacesPackage().then(() => {
  startFaceSprites();
  start();
});
