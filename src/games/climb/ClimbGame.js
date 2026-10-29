/* BARREL CLIMB: reglas, puntuación, niveles y estados (sin dibujo). */
import L from './climbLevel.js';
import PH from './climbPhysics.js';
import HZ from './climbHazards.js';
import { makeRng } from '../../core/rng.js';
var EXTRA_LIFE_AT = 7000;
var BONUS_STEP_FRAMES = 120;
var CLEAR_FRAMES = 300;          // 150 de rescate + 150 de transición de fase
var KEYS = ['up', 'down', 'left', 'right', 'jump', 'start'];
var NO_SFX = function () {};

// Contrato v2: new ClimbGame({ level, rng, sfx }); update(input) a 60 Hz; estado en score, lives, level, state, gameOver.
// No toca el DOM ni el canvas: el dibujo está en climbRender.js.
export function ClimbGame(opts) {
  opts = opts || {};
  this.rand = opts.rng || makeRng(opts.seed || Date.now());
  this.sfx = opts.sfx || NO_SFX;
  // Entrada efectiva: las teclas que seguían pulsadas al reiniciar la ronda no cuentan hasta soltarlas.
  this.input = { down: {}, pressed: {}, lastDir: null };
  this.mask = {};
  this.seen = {};
  for (var k = 0; k < KEYS.length; k++) {
    this.input.down[KEYS[k]] = this.input.pressed[KEYS[k]] = this.mask[KEYS[k]] = this.seen[KEYS[k]] = false;
  }

  var pools = HZ.createPools();
  this.barrels = pools.barrels;
  this.flames = pools.flames;
  this.player = {};
  this.hammersTaken = [false, false];
  this.popups = [];
  for (var i = 0; i < 4; i++) this.popups.push({ timer: 0, x: 0, y: 0, text: '', color: '#fff' });
  this.sparks = { timer: 0, x: 0, y: 0 };

  this.finished = false;
  this.throwing = true;
  this.barrelLadders = true;
  this.frame = 0;
  this.startGame(opts.level || 1);
  this.test = this.makeTestApi();
}
var P = ClimbGame.prototype;

Object.defineProperty(P, 'state', { get: function () { return this.phase; } });
Object.defineProperty(P, 'gameOver', { get: function () { return this.finished; } });

// Copia la entrada del paso aplicando la máscara de teclas mantenidas.
P.readInput = function (src) {
  var dst = this.input;
  var down = src && src.down;
  var pressed = src && src.pressed;
  for (var i = 0; i < KEYS.length; i++) {
    var k = KEYS[i];
    var d = !!(down && down[k]);
    if (!d) this.mask[k] = false;
    this.seen[k] = d;
    dst.down[k] = d && !this.mask[k];
    dst.pressed[k] = !!(pressed && pressed[k]) && !this.mask[k];
  }
};

P.update = function (input) {
  if (this.finished) return;
  this.readInput(input);
  this.frame++;
  for (var i = 0; i < this.popups.length; i++) if (this.popups[i].timer > 0) this.popups[i].timer--;
  if (this.sparks.timer > 0) this.sparks.timer--;

  switch (this.phase) {
    case 'READY':
      if (--this.timer <= 0) this.setPhase('PLAYING', 0);
      break;
    case 'PLAYING':
      this.tickPlaying();
      break;
    case 'LIFE_LOST':
      if (--this.timer <= 0) {
        if (this.lives > 0) {
          this.resetRound();
          this.setPhase('READY', 120);
        } else {
          this.setPhase('GAME_OVER', 180);
          this.sfx('gameOver');
        }
      }
      break;
    case 'LEVEL_CLEAR':
      if (--this.timer <= 0) {
        this.level++;
        this.startLevel();
        this.setPhase('READY', 120);
      }
      break;
    case 'GAME_OVER':
      if (--this.timer <= 0) this.finished = true;
      break;
  }
};

// ---------------------------------------------------------------- partida

P.setPhase = function (name, frames) {
  this.phase = name;
  this.timer = frames;
};

P.startGame = function (level) {
  this.score = 0;
  this.scoreText = '0';
  this.lives = 3;
  this.level = level || 1;
  this.extraGiven = false;
  this.startLevel();
  this.setPhase('READY', 150);
};

P.startLevel = function () {
  this.tune = L.tuning(this.level);
  this.levelText = 'N=' + (this.level < 10 ? '0' : '') + this.level;
  this.nextLevelText = '¡NIVEL ' + (this.level + 1) + '!';
  this.nextHeightText = ((this.level + 1) * 25) + ' M';
  this.hammersTaken[0] = this.hammersTaken[1] = false;
  this.oilLit = false;
  this.resetRound();
};

// Tras perder una vida o al empezar nivel: posiciones, peligros y bonificación.
P.resetRound = function () {
  PH.resetPlayer(this.player);
  HZ.clear(this);
  this.bonus = this.tune.bonusStart;
  this.bonusText = String(this.bonus);
  this.bonusTimer = BONUS_STEP_FRAMES;
  this.barrelCount = 0;
  this.throwTimer = 60;
  this.throwAnim = 0;
  this.hammerTimer = 0;
  this.oilFlare = 0;
  for (var k = 0; k < KEYS.length; k++) this.mask[KEYS[k]] = this.seen[KEYS[k]];
};

P.addScore = function (n) {
  this.score += n;
  this.scoreText = String(this.score);
  if (!this.extraGiven && this.score >= EXTRA_LIFE_AT) {
    this.extraGiven = true;
    this.lives++;
    this.sfx('extra');
  }
};

P.popup = function (text, x, y, color) {
  for (var i = 0; i < this.popups.length; i++) {
    var p = this.popups[i];
    if (p.timer <= 0) {
      p.text = text; p.x = x; p.y = y; p.timer = 50; p.color = color || '#ffffff';
      return;
    }
  }
};

P.jumpScore = function (x, y) {
  this.addScore(100);
  this.popup('100', x, y - 14, '#ffe14d');
  this.sfx('score');
};

P.smash = function (x, y) {
  var pts = HZ.SMASH_POINTS[Math.floor(this.rand() * HZ.SMASH_POINTS.length)];
  this.addScore(pts);
  this.popup(String(pts), x, y - 14, '#33e6ff');
  this.sparks.timer = 18;
  this.sparks.x = x;
  this.sparks.y = y - 5;
  this.sfx('smash');
};

P.die = function (cause) {
  if (this.invulnerable) return;
  this.lives--;
  this.deathCause = cause;
  this.hammerTimer = 0;
  this.setPhase('LIFE_LOST', 150);
  this.sfx('death');
};

P.tickPlaying = function () {
  var p = this.player;
  var res = PH.update(p, this.input, this.hammerTimer > 0);
  if (res === 'jump') this.sfx('jump');
  else if (res === 'fall-death') { this.die('fall'); return; }

  if (p.platform === L.TOP && p.state === 'walk') {
    this.addScore(this.bonus);
    this.popup(this.bonusText, p.x, p.y - 24, '#ffe14d');
    HZ.clear(this);
    this.hammerTimer = 0;
    this.setPhase('LEVEL_CLEAR', CLEAR_FRAMES);
    this.sfx('levelClear');
    return;
  }

  if (HZ.update(this)) { this.die('hit'); return; }
  if (this.oilFlare > 0) this.oilLit = true;

  if (--this.bonusTimer <= 0) {
    this.bonusTimer = BONUS_STEP_FRAMES;
    this.bonus = Math.max(0, this.bonus - 100);
    this.bonusText = String(this.bonus);
    if (this.bonus === 0) this.die('time');
  }
};

// ---------------------------------------------------------------- ganchos de prueba

P.makeTestApi = function () {
  var self = this;
  function snap(o) {
    return { x: o.x, y: o.y, state: o.state, platform: o.platform, dir: o.dir, fire: o.fire };
  }
  return {
    state: function () {
      var p = self.player;
      return {
        phase: self.phase, level: self.level, score: self.score, lives: self.lives, bonus: self.bonus,
        hammer: self.hammerTimer, deathCause: self.deathCause || null,
        player: { x: p.x, y: p.y, state: p.state, platform: p.platform, facing: p.facing, vy: p.vy, peakY: p.peakY },
        barrels: self.barrels.filter(function (b) { return b.active; }).map(snap),
        flames: self.flames.filter(function (f) { return f.active; }).map(snap)
      };
    },
    startPlaying: function () { self.setPhase('PLAYING', 0); },
    setPlayer: function (x, platform) {
      var p = self.player;
      p.x = x;
      p.platform = platform;
      p.y = L.surface(platform, x);
      p.state = 'walk';
      p.vx = p.vy = 0;
      p.ladder = null;
    },
    setThrowing: function (v) { self.throwing = !!v; },
    setInvulnerable: function (v) { self.invulnerable = !!v; },
    setBarrelLadders: function (v) { self.barrelLadders = !!v; },
    spawnBarrel: function (x, platform, dir, fire) { return !!HZ.spawnBarrel(self, x, platform, dir, fire); },
    spawnFlame: function (x, platform) { return !!HZ.spawnFlame(self, x, platform); },
    clearHazards: function () { HZ.clear(self); },
    giveHammer: function () { self.hammerTimer = HZ.HAMMER_FRAMES; },
    setLives: function (n) { self.lives = n; },
    setScore: function (n) { self.score = n; self.scoreText = String(n); },
    setBonus: function (n) { self.bonus = n; self.bonusText = String(n); },
    setLevel: function (n) { self.level = n; self.startLevel(); self.setPhase('PLAYING', 0); },
    setSeed: function (s) { self.rand = makeRng(s); },
    surface: function (pi, x) { return L.surface(pi, x); },
    ladders: function () { return L.ladders.map(function (l) { return { x: l.x, bottom: l.bottom, top: l.top, broken: l.broken }; }); },
    platforms: function () { return L.platforms.map(function (p) { return { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 }; }); },
    physics: function () { return { WALK: PH.WALK, JUMP_VY: PH.JUMP_VY, GRAVITY: PH.GRAVITY, FALL_DEATH: PH.FALL_DEATH }; },
    tuning: function () { return self.tune; }
  };
};
