/* Sintetizador chiptune con Web Audio: efectos, música de título y silencio global. */
(function (A) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var musicTimer = 0;
  var musicNodes = [];
  var currentMusic = null;
  var listeners = [];

  // Notas: nombre → frecuencia (temperamento igual, A4 = 440).
  var NOTE_INDEX = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  function freq(note) {
    if (typeof note === 'number') return note;
    var m = /^([A-G]#?)(\d)$/.exec(note);
    if (!m) return 0;
    var semis = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }

  function tone(opts, when) {
    if (!ctx) return null;
    var t0 = (when || ctx.currentTime) + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.wave || 'square';
    osc.frequency.setValueAtTime(freq(opts.f), t0);
    if (opts.to) osc.frequency.linearRampToValueAtTime(freq(opts.to), t0 + opts.d);
    var vol = opts.v === undefined ? 0.15 : opts.v;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.setValueAtTime(vol, t0 + opts.d * 0.7);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + opts.d);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + opts.d + 0.02);
    return osc;
  }

  function seq(notes, wave, step, vol, when) {
    var nodes = [];
    var t = when || (ctx ? ctx.currentTime : 0);
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n && n !== '-') {
        var len = 1;
        while (notes[i + len] === '-') len++;
        nodes.push(tone({ f: n, d: step * len * 0.95, wave: wave, v: vol }, t + i * step));
      }
    }
    return nodes;
  }

  // Efectos de sonido (todos propios).
  var chompFlip = false;
  var SFX = {
    chomp: function () { chompFlip = !chompFlip; tone({ f: chompFlip ? 330 : 247, to: chompFlip ? 247 : 330, d: 0.07, wave: 'triangle', v: 0.18 }); },
    power: function () { tone({ f: 200, to: 800, d: 0.25, wave: 'square', v: 0.08 }); },
    eatGhost: function () { tone({ f: 200, to: 1200, d: 0.18, wave: 'sawtooth', v: 0.08 }); },
    fruit: function () { seq(['E6', 'G6', 'C7'], 'square', 0.06, 0.08); },
    extra: function () { seq(['C6', 'E6', 'G6', 'C7', 'G6', 'C7'], 'square', 0.07, 0.08); },
    death: function () { tone({ f: 700, to: 90, d: 1.2, wave: 'square', v: 0.09 }); },
    jump: function () { tone({ f: 280, to: 560, d: 0.12, wave: 'square', v: 0.07 }); },
    land: function () { tone({ f: 120, d: 0.04, wave: 'triangle', v: 0.12 }); },
    score: function () { seq(['A5', 'E6'], 'square', 0.05, 0.07); },
    smash: function () { tone({ f: 900, to: 60, d: 0.2, wave: 'sawtooth', v: 0.1 }); },
    hammer: function () { seq(['C5', 'C6', 'C5', 'C6'], 'square', 0.05, 0.07); },
    throwBarrel: function () { tone({ f: 90, to: 60, d: 0.12, wave: 'triangle', v: 0.15 }); },
    levelClear: function () { seq(['C5', 'E5', 'G5', 'C6', '-', 'G5', 'C6', '-'], 'square', 0.1, 0.08); },
    gameOver: function () { seq(['G4', 'F#4', 'F4', 'E4', '-', '-'], 'triangle', 0.18, 0.18); },
    record: function () { seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7', '-'], 'square', 0.08, 0.08); },
    start: function () { seq(['G5', 'C6'], 'square', 0.07, 0.07); },
    menuMove: function () { tone({ f: 660, d: 0.03, wave: 'square', v: 0.05 }); },
    menuSelect: function () { seq(['E6', 'B6'], 'square', 0.05, 0.06); },
    error: function () { tone({ f: 140, d: 0.15, wave: 'square', v: 0.08 }); }
  };

  // Música de título: melodía + bajo, en bucle.
  var MUSIC = {
    title: {
      step: 0.14,
      lead: ['C5', 'E5', 'G5', 'E5', 'A5', '-', 'G5', '-', 'F5', 'A5', 'C6', 'A5', 'G5', '-', '-', '-',
             'E5', 'G5', 'C6', 'G5', 'D6', '-', 'C6', '-', 'B5', 'G5', 'A5', 'B5', 'C6', '-', '-', '-'],
      bass: ['C3', '-', 'G3', '-', 'A2', '-', 'E3', '-', 'F2', '-', 'C3', '-', 'G2', '-', 'D3', '-',
             'C3', '-', 'G3', '-', 'A2', '-', 'E3', '-', 'G2', '-', 'D3', '-', 'C3', '-', 'G2', '-']
    }
  };

  function scheduleMusic(name) {
    var m = MUSIC[name];
    if (!m || !ctx) return;
    var t = ctx.currentTime + 0.05;
    musicNodes = seq(m.lead, 'square', m.step, 0.05, t).concat(seq(m.bass, 'triangle', m.step, 0.12, t));
    musicTimer = setTimeout(function () { scheduleMusic(name); }, m.lead.length * m.step * 1000);
  }

  var audio = {};

  audio.unlocked = function () { return !!ctx && ctx.state === 'running'; };

  audio.unlock = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    var pending = currentMusic;
    if (pending && !musicTimer) scheduleMusic(pending);
    for (var i = 0; i < listeners.length; i++) listeners[i]();
  };

  audio.onUnlock = function (fn) { listeners.push(fn); };

  audio.play = function (name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    var fx = SFX[name];
    if (fx) fx();
  };

  audio.music = function (name) {
    audio.stopMusic();
    currentMusic = name;
    if (ctx && ctx.state === 'running') scheduleMusic(name);
  };

  audio.stopMusic = function () {
    currentMusic = null;
    clearTimeout(musicTimer);
    musicTimer = 0;
    for (var i = 0; i < musicNodes.length; i++) {
      if (musicNodes[i]) { try { musicNodes[i].stop(); } catch (e) { /* ya parado */ } }
    }
    musicNodes = [];
  };

  audio.setMuted = function (value) {
    muted = !!value;
    if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.8, ctx.currentTime);
  };

  audio.isMuted = function () { return muted; };

  // El navegador exige un gesto del usuario para arrancar el audio.
  function firstGesture() {
    audio.unlock();
    if (audio.unlocked()) {
      window.removeEventListener('keydown', firstGesture, true);
      window.removeEventListener('pointerdown', firstGesture, true);
    }
  }
  window.addEventListener('keydown', firstGesture, true);
  window.addEventListener('pointerdown', firstGesture, true);

  A.core = A.core || {};
  A.core.audio = audio;
})(window.Arcade = window.Arcade || {});
