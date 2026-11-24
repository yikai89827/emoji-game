'use strict';

/**
 * 音频：欢乐 BGM + 消除 / 点选 / 过关音效
 */
const KEY = 'tkc_audio_on';

const PATHS = {
  bgm: 'assets/audio/bgm.wav',
  clear: 'assets/audio/clear.wav',
  tap: 'assets/audio/tap.wav',
  win: 'assets/audio/win.wav',
  merge: 'assets/audio/merge.wav',
  chime: 'assets/audio/chime.wav',
  unlock: 'assets/audio/unlock.wav',
};

let _on = true;
let _inited = false;
let _bgm = null;
const _sfx = Object.create(null);

function storageGet() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      const v = wx.getStorageSync(KEY);
      if (v === '' || v == null) return null;
      return !!v;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(KEY);
      if (v == null) return null;
      return v === '1' || v === 'true';
    }
  } catch (e) { /* ignore */ }
  return null;
}

function storageSet(on) {
  try {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(KEY, on ? 1 : 0);
      return;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, on ? '1' : '0');
    }
  } catch (e) { /* ignore */ }
}

function createPlayer(src, loop) {
  if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
    const a = wx.createInnerAudioContext();
    a.src = src;
    a.loop = !!loop;
    a.obeyMuteSwitch = true;
    return {
      play() {
        try {
          a.stop();
          a.seek(0);
        } catch (e) { /* ignore */ }
        a.play();
      },
      stop() {
        try {
          a.stop();
        } catch (e) { /* ignore */ }
      },
      set volume(v) {
        a.volume = v;
      },
      destroy() {
        try {
          a.destroy();
        } catch (e) { /* ignore */ }
      },
    };
  }
  if (typeof Audio !== 'undefined') {
    const a = new Audio(src);
    a.loop = !!loop;
    a.preload = 'auto';
    return {
      play() {
        try {
          a.currentTime = 0;
          const p = a.play();
          if (p && p.catch) p.catch(() => {});
        } catch (e) { /* ignore */ }
      },
      stop() {
        try {
          a.pause();
          a.currentTime = 0;
        } catch (e) { /* ignore */ }
      },
      set volume(v) {
        a.volume = v;
      },
      destroy() {
        try {
          a.pause();
          a.src = '';
        } catch (e) { /* ignore */ }
      },
    };
  }
  return null;
}

function ensureSfx(name) {
  if (_sfx[name]) return _sfx[name];
  const src = PATHS[name];
  if (!src) return null;
  _sfx[name] = createPlayer(src, false);
  if (_sfx[name]) _sfx[name].volume = 0.85;
  return _sfx[name];
}

function init() {
  if (_inited) return;
  _inited = true;
  const saved = storageGet();
  if (saved != null) _on = saved;
  _bgm = createPlayer(PATHS.bgm, true);
  if (_bgm) _bgm.volume = 0.38;
  ensureSfx('clear');
  ensureSfx('tap');
  ensureSfx('win');
  ensureSfx('merge');
  ensureSfx('chime');
  ensureSfx('unlock');
}

function isOn() {
  init();
  return _on;
}

function setOn(on) {
  init();
  _on = !!on;
  storageSet(_on);
  if (!_on) {
    stopBgm();
  } else {
    playBgm();
  }
  return _on;
}

function toggle() {
  return setOn(!isOn());
}

function playBgm() {
  init();
  if (!_on || !_bgm) return;
  try {
    _bgm.play();
  } catch (e) { /* ignore */ }
}

function stopBgm() {
  if (_bgm) _bgm.stop();
}

function play(name) {
  init();
  if (!_on) return;
  const a = ensureSfx(name);
  if (!a) return;
  try {
    a.play();
  } catch (e) { /* ignore */ }
}

function playClear() {
  play('clear');
}

function playTap() {
  play('tap');
}

function playWin() {
  play('win');
}

function playMerge() {
  play('merge');
}

function playChime() {
  play('chime');
}

function playUnlock() {
  play('unlock');
}

module.exports = {
  init,
  isOn,
  setOn,
  toggle,
  playBgm,
  stopBgm,
  playClear,
  playTap,
  playWin,
  playMerge,
  playChime,
  playUnlock,
};
