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

const app = {
  scene: null,
  goto(name, opts) {
    opts = opts || {};
    if (this.scene && this.scene.destroy) {
      try {
        this.scene.destroy();
      } catch (e) { /* ignore */ }
    }
    hideAll();
    if (name === 'home') {
      this.scene = new HomeScene(this);
    } else if (name === 'game') {
      this.scene = new Scene(this, opts);
    } else if (name === 'more') {
      this.scene = new MoreScene(this);
    } else if (name === 'fuse2048') {
      this.scene = new Fuse2048Scene(this);
    } else if (name === 'sudoku') {
      this.scene = new SudokuScene(this);
    } else if (name === 'spotdiff') {
      this.scene = new SpotDiffScene(this);
    } else if (name === 'match3') {
      this.scene = new Match3Scene(this);
    } else if (name === 'pick') {
      this.scene = new PickScene(this, opts);
    }
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

start();
