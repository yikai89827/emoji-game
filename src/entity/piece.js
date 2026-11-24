'use strict';

const { SIZES } = require('../data/faces.js');

let _uid = 1;

class Piece {
  constructor(opts) {
    opts = opts || {};
    this.id = _uid++;
    this.face = opts.face;
    this.color = opts.color;
    this.sizeKey = opts.sizeKey || 'M';
    const sz = SIZES[this.sizeKey] || SIZES.M;
    this.r = sz.r;
    this.mass = sz.mass;
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.vx = opts.vx || 0;
    this.vy = opts.vy || 0;
    this.selected = false;
    this.alive = true;
    /** 近静止累计时间；达到阈值后 settled，不再一直滚 */
    this.settleT = 0;
    this.settled = false;
  }

  wake() {
    this.settled = false;
    this.settleT = 0;
  }

  get matchKey() {
    return this.face + '|' + this.color;
  }
}

module.exports = { Piece };
