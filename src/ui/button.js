'use strict';

const { Theme } = require('./theme.js');

const FONT = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

class Button {
  constructor(opts) {
    opts = opts || {};
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.w = opts.w || 80;
    this.h = opts.h || 40;
    this.label = opts.label || '';
    this.icon = opts.icon || '';
    this.style = opts.style || 'primary';
    this.visible = opts.visible !== false;
    this.enabled = opts.enabled !== false;
    this.onTap = opts.onTap || null;
    this.badge = opts.badge || '';
    this.sub = opts.sub || '';
    this._press = 0;
  }

  contains(px, py) {
    if (!this.visible || !this.enabled) return false;
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  handleTouch(px, py) {
    if (!this.contains(px, py)) return false;
    this._press = 0.12;
    if (this.onTap) this.onTap();
    return true;
  }

  update(dt) {
    if (this._press > 0) this._press = Math.max(0, this._press - dt);
  }

  draw(ctx) {
    if (!this.visible) return;
    const scale = this._press > 0 ? 0.96 : 1;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const w = this.w * scale;
    const h = this.h * scale;
    const x = cx - w / 2;
    const y = cy - h / 2;

    let fill = Theme.primary;
    let stroke = 'rgba(255,255,255,0.55)';
    let text = Theme.primaryInk;
    let glow = null;
    if (this.style === 'ghost') {
      fill = Theme.ghostFill;
      stroke = Theme.ghostStroke;
      text = Theme.ghostText;
    } else if (this.style === 'dock') {
      fill = 'rgba(255,248,236,0.75)';
      stroke = 'rgba(91,70,54,0.16)';
      text = Theme.ink;
    } else if (this.style === 'danger') {
      fill = '#c4183a';
      text = '#fff';
      glow = 'rgba(196,24,58,0.28)';
    } else if (this.style === 'gold') {
      fill = Theme.gold;
      stroke = 'rgba(255,255,255,0.55)';
      text = Theme.goldInk;
      glow = Theme.glowAmber;
    } else if (this.style === 'win') {
      fill = Theme.mint;
      stroke = 'rgba(255,255,255,0.55)';
      text = Theme.mintInk;
      glow = Theme.glowMint;
    } else if (this.style === 'revive') {
      fill = Theme.revive;
      stroke = 'rgba(255,255,255,0.6)';
      text = Theme.primaryInk;
      glow = Theme.glowPink;
    } else if (this.style === 'primary') {
      glow = Theme.glowPink;
    }

    if (!this.enabled) {
      fill = 'rgba(91,70,54,0.06)';
      text = 'rgba(91,70,54,0.28)';
      glow = null;
    }

    if (glow) {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
      roundRect(ctx, x, y, w, h, Math.min(16, h / 2));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    } else {
      roundRect(ctx, x, y, w, h, Math.min(14, h / 2));
      ctx.fillStyle = fill;
      ctx.fill();
    }
    roundRect(ctx, x, y, w, h, Math.min(16, h / 2));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.icon) {
      ctx.font = '700 16px ' + FONT;
      ctx.fillText(this.icon, cx, cy - (this.label ? 8 : 0));
      if (this.label) {
        ctx.font = '600 11px ' + FONT;
        ctx.fillText(this.label, cx, cy + 12);
      }
    } else {
      ctx.font = '700 15px ' + FONT;
      ctx.fillText(this.label, cx, cy + (this.sub ? -6 : 0));
      if (this.sub) {
        ctx.font = '500 11px ' + FONT;
        ctx.fillStyle = Theme.inkMute;
        ctx.fillText(this.sub, cx, cy + 12);
      }
    }

    if (this.badge) {
      const text = String(this.badge);
      const isAd = text.toUpperCase() === 'AD';
      const bx = x + w - (isAd ? 4 : 2);
      const by = y + 2;
      ctx.fillStyle = Theme.revive;
      if (isAd) {
        roundRect(ctx, bx - 16, by - 8, 22, 14, 7);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '800 9px ' + FONT;
        ctx.fillText('AD', bx - 5, by + 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 10px ' + FONT;
        ctx.fillText(text, bx, by + 0.5);
      }
    }
  }
}

module.exports = { Button, roundRect, FONT };
