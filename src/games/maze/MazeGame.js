/* MAZE MUNCHER: reglas, movimiento por casillas, puntuación, niveles y estados (sin dibujo). */
import M from './mazeMap.js';
import AI from './ghostAI.js';
import { makeRng } from '../../core/rng.js';
var T = M.TILE;
var DX = AI.DX;
var DY = AI.DY;
var OPP = AI.OPP;

var TS = 8;
var EPS = 1e-4;
var CORNER_TOLERANCE = 3;     // píxeles de giro anticipado
var GHOST_POINTS = [200, 400, 800, 1600];
var FRUIT_VALUES = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000];
export const FRUIT_SPRITE = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5];
var FRUIT_FRAMES = 570;
var EXTRA_LIFE_AT = 10000;

function mod(a, b) { return ((a % b) + b) % b; }
function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  return Math.max(target, v - step);
}

const NO_SFX = () => {};

// Contrato v2: new MazeGame({ level, rng, sfx }); update(input) a 60 Hz; estado en score, lives, level, state, gameOver.
// No toca el DOM ni el canvas: el dibujo está en mazeRender.js.
export function MazeGame(opts) {
  opts = opts || {};
  this.rand = opts.rng || makeRng(opts.seed || Date.now());
  this.sfx = opts.sfx || NO_SFX;
  this.want = null;             // giro pedido (buffer de dirección)

  this.tiles = new Uint8Array(M.base.length);
  this.player = { x: 0, y: 0, dir: 'left', moving: false, anim: 0 };
  this.ghosts = [];
  for (var i = 0; i < 4; i++) {
    this.ghosts.push({ id: i, x: 0, y: 0, dir: 'left', state: 'house', frightened: false, reverse: false,
      dotCounter: 0, tgtX: 0, tgtY: 0, decX: -99, decY: -99, anim: 0 });
  }
  this.popups = [];
  for (var k = 0; k < 4; k++) this.popups.push({ timer: 0, x: 0, y: 0, text: '', color: '#fff' });
  this.fruit = { active: false, timer: 0, value: 0, sprite: 0 };

  this.finished = false;
  this.ghostsEnabled = true;
  this.frame = 0;

  this.startGame(opts.level || 1);
  this.test = this.makeTestApi();
}
var P = MazeGame.prototype;

Object.defineProperty(P, 'state', { get: function () { return this.phase; } });
Object.defineProperty(P, 'gameOver', { get: function () { return this.finished; } });

// Lee la entrada del paso: una dirección recién pulsada pasa a ser el giro pedido.
P.readInput = function (input) {
  if (!input) return;
  var pr = input.pressed;
  if (!pr) return;
  if (input.lastDir && pr[input.lastDir]) { this.want = input.lastDir; return; }
  for (var i = 0; i < 4; i++) if (pr[AI.ORDER[i]]) this.want = AI.ORDER[i];
};

P.update = function (input) {
  if (this.finished) return;
  this.readInput(input);
  this.frame++;
  for (var i = 0; i < this.popups.length; i++) if (this.popups[i].timer > 0) this.popups[i].timer--;

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
          this.resetActors();
          this.afterDeath = true;
          this.deathCounter = 0;
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
  this.levelText = 'NIVEL ' + this.level;
  this.tiles.set(M.base);
  this.dotsLeft = M.countDots(this.tiles);
  this.dotsEaten = 0;
  this.speeds = AI.speeds(this.level);
  this.schedule = AI.modeSchedule(this.level);
  this.limits = AI.dotLimits(this.level);
  this.modeIndex = 0;
  this.mode = 'scatter';
  this.modeTimer = this.schedule[0] * 60;
  this.afterDeath = false;
  this.deathCounter = 0;
  this.fruit.active = false;
  for (var i = 0; i < 4; i++) this.ghosts[i].dotCounter = 0;
  this.resetActors();
};

P.resetActors = function () {
  var p = this.player;
  p.x = M.PLAYER_START.x;
  p.y = M.PLAYER_START.y;
  p.dir = 'left';
  p.moving = true;
  p.anim = 0;
  this.want = null;
  for (var i = 0; i < 4; i++) {
    var g = this.ghosts[i];
    g.frightened = false;
    g.reverse = false;
    g.decX = g.decY = -99;
    g.x = M.HOUSE_SLOTS[i];
    if (i === 0) {
      g.y = M.GHOST_EXIT.y;
      g.state = 'active';
      g.dir = 'left';
    } else {
      g.y = M.HOUSE_CENTER_Y;
      g.state = 'house';
      g.dir = i === 1 ? 'down' : 'up';
    }
  }
  this.frightTimer = 0;
  this.chain = 0;
  this.freeze = 0;
  this.noDotTimer = 0;
  this.fruit.active = false;
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

P.popup = function (text, x, y, frames, color) {
  for (var i = 0; i < this.popups.length; i++) {
    var p = this.popups[i];
    if (p.timer <= 0) {
      p.text = text; p.x = x; p.y = y; p.timer = frames; p.color = color || '#33e6ff';
      return;
    }
  }
};

P.tickPlaying = function () {
  if (this.freeze > 0) { this.freeze--; return; }

  // Modo vulnerable o ciclo dispersión/persecución.
  if (this.frightTimer > 0) {
    if (--this.frightTimer === 0) this.endFright();
  } else if (this.modeTimer !== Infinity) {
    if (--this.modeTimer <= 0) {
      this.modeIndex++;
      this.mode = this.modeIndex % 2 ? 'chase' : 'scatter';
      this.modeTimer = this.schedule[this.modeIndex] * 60;
      for (var r = 0; r < 4; r++) if (this.ghosts[r].state === 'active') this.ghosts[r].reverse = true;
    }
  }

  this.movePlayer();
  this.eat();
  if (this.phase !== 'PLAYING') return;
  if (this.collide()) return;

  if (this.ghostsEnabled) {
    for (var i = 0; i < 4; i++) this.updateGhost(this.ghosts[i]);
    if (this.collide()) return;
    this.houseRelease();
  }
  this.noDotTimer++;

  var f = this.fruit;
  if (f.active) {
    if (--f.timer <= 0) f.active = false;
    else if (Math.abs(this.player.x - M.FRUIT_POS.x) < 6 && Math.abs(this.player.y - M.FRUIT_POS.y) < 4) {
      f.active = false;
      this.addScore(f.value);
      this.popup(String(f.value), M.FRUIT_POS.x, M.FRUIT_POS.y, 90, '#ff8ad8');
      this.sfx('fruit');
    }
  }
};

// ---------------------------------------------------------------- movimiento

P.isWall = function (tx, ty) { return M.isWall(tx, ty); };

P.distToCenter = function (e) {
  var r;
  if (DX[e.dir] !== 0) {
    r = mod(e.x - 4, TS);
    if (r < EPS || r > TS - EPS) return 0;
    return DX[e.dir] > 0 ? TS - r : r;
  }
  r = mod(e.y - 4, TS);
  if (r < EPS || r > TS - EPS) return 0;
  return DY[e.dir] > 0 ? TS - r : r;
};

P.wrap = function (e) {
  if (e.x < -8) e.x += 240;
  else if (e.x >= 232) e.x -= 240;
};

// Avanza dist píxeles parando en cada centro de casilla para decidir.
P.move = function (e, dist, isGhost) {
  for (var guard = 0; guard < 4 && dist > EPS; guard++) {
    var toC = this.distToCenter(e);
    if (toC === 0) {
      e.x = Math.round(e.x);
      e.y = Math.round(e.y);
      if (isGhost) {
        this.ghostAtCenter(e);
        if (e.state !== 'active' && e.state !== 'eyes') return;
      } else {
        this.playerAtCenter(e);
        if (!e.moving) return;
      }
      toC = TS;
    }
    var step = dist < toC ? dist : toC;
    e.x += DX[e.dir] * step;
    e.y += DY[e.dir] * step;
    dist -= step;
    if (step === toC) { e.x = Math.round(e.x); e.y = Math.round(e.y); }
    this.wrap(e);
  }
};

P.movePlayer = function () {
  var p = this.player;
  var want = this.want;
  if (want && want !== p.dir) {
    if (want === OPP[p.dir]) {
      p.dir = want;
      p.moving = true;
    } else {
      this.tryCorner(p, want);
    }
  }
  this.move(p, this.frightTimer > 0 ? this.speeds.playerFright : this.speeds.player, false);
  if (p.moving) p.anim++;
};

// Giro anticipado: si está a ≤3 px del centro y la casilla destino está libre, se alinea y gira.
P.tryCorner = function (p, want) {
  var tx = Math.floor(p.x / TS);
  var ty = Math.floor(p.y / TS);
  var off = DX[p.dir] !== 0 ? p.x - (tx * TS + 4) : p.y - (ty * TS + 4);
  if (Math.abs(off) > CORNER_TOLERANCE + EPS) return;
  if (this.isWall(tx + DX[want], ty + DY[want])) return;
  if (DX[p.dir] !== 0) p.x = tx * TS + 4; else p.y = ty * TS + 4;
  p.dir = want;
  p.moving = true;
};

P.playerAtCenter = function (p) {
  var tx = Math.floor(p.x / TS);
  var ty = Math.floor(p.y / TS);
  var want = this.want;
  if (want && !this.isWall(tx + DX[want], ty + DY[want])) p.dir = want;
  p.moving = !this.isWall(tx + DX[p.dir], ty + DY[p.dir]);
};

P.ghostAtCenter = function (g) {
  var tx = Math.floor(g.x / TS);
  var ty = Math.floor(g.y / TS);
  if (g.decX === tx && g.decY === ty) return;
  g.decX = tx;
  g.decY = ty;
  if (g.state === 'eyes' && ty === 11 && (tx === 13 || tx === 14)) {
    g.state = 'entering';
    return;
  }
  if (g.reverse) {
    g.reverse = false;
    g.dir = OPP[g.dir];
    return;
  }
  g.dir = AI.choose(g, this, tx, ty);
};

P.updateGhost = function (g) {
  var sp = this.speeds;
  g.anim++;
  switch (g.state) {
    case 'house':
      g.y += (g.dir === 'up' ? -1 : 1) * sp.house;
      if (g.y <= M.HOUSE_CENTER_Y - 4) { g.y = M.HOUSE_CENTER_Y - 4; g.dir = 'down'; }
      else if (g.y >= M.HOUSE_CENTER_Y + 4) { g.y = M.HOUSE_CENTER_Y + 4; g.dir = 'up'; }
      break;
    case 'leaving':
      if (g.x !== M.GHOST_EXIT.x) {
        g.x = approach(g.x, M.GHOST_EXIT.x, sp.house);
        g.y = approach(g.y, M.HOUSE_CENTER_Y, sp.house);
        g.dir = g.x < M.GHOST_EXIT.x ? 'right' : 'left';
      } else if (g.y > M.GHOST_EXIT.y) {
        g.y = approach(g.y, M.GHOST_EXIT.y, sp.house);
        g.dir = 'up';
      } else {
        g.state = 'active';
        g.dir = 'left';
        g.decX = g.decY = -99;
      }
      break;
    case 'entering':
      if (g.x !== M.GHOST_EXIT.x) g.x = approach(g.x, M.GHOST_EXIT.x, 1.5);
      else if (g.y < M.HOUSE_CENTER_Y) { g.y = approach(g.y, M.HOUSE_CENTER_Y, 1.5); g.dir = 'down'; }
      else { g.frightened = false; g.state = 'leaving'; }
      break;
    default: {
      var speed;
      if (g.state === 'eyes') speed = sp.eyes;
      else if (M.isTunnel(Math.floor(g.x / TS), Math.floor(g.y / TS))) speed = sp.ghostTunnel;
      else if (g.frightened) speed = sp.ghostFright;
      else speed = sp.ghost;
      this.move(g, speed, true);
    }
  }
};

P.houseRelease = function () {
  var pref = null;
  for (var i = 1; i < 4; i++) if (this.ghosts[i].state === 'house') { pref = this.ghosts[i]; break; }
  if (!pref) return;
  var release = false;
  if (this.afterDeath) release = this.deathCounter >= AI.AFTER_DEATH_LIMITS[pref.id];
  else release = pref.dotCounter >= this.limits[pref.id];
  if (this.noDotTimer >= AI.noDotFrames(this.level)) { release = true; this.noDotTimer = 0; }
  if (release) pref.state = 'leaving';
};

// ---------------------------------------------------------------- reglas

P.eat = function () {
  var p = this.player;
  var tx = Math.floor(p.x / TS);
  var ty = Math.floor(p.y / TS);
  if (tx < 0 || tx >= M.COLS) return;
  var idx = ty * M.COLS + tx;
  var t = this.tiles[idx];
  if (t === T.DOT) {
    this.tiles[idx] = T.EMPTY;
    this.addScore(10);
    this.sfx('chomp');
    this.dotEaten();
  } else if (t === T.POWER) {
    this.tiles[idx] = T.EMPTY;
    this.addScore(50);
    this.frighten();
    this.dotEaten();
  }
};

P.dotEaten = function () {
  this.dotsLeft--;
  this.dotsEaten++;
  this.noDotTimer = 0;
  if (this.afterDeath) this.deathCounter++;
  else {
    for (var i = 1; i < 4; i++) if (this.ghosts[i].state === 'house') { this.ghosts[i].dotCounter++; break; }
  }
  if (this.dotsEaten === 70 || this.dotsEaten === 170) {
    var li = Math.min(this.level, FRUIT_VALUES.length) - 1;
    this.fruit.active = true;
    this.fruit.timer = FRUIT_FRAMES;
    this.fruit.value = FRUIT_VALUES[li];
    this.fruit.sprite = FRUIT_SPRITE[li];
  }
  if (this.dotsLeft === 0) {
    this.fruit.active = false;
    this.setPhase('LEVEL_CLEAR', 150);
    this.sfx('levelClear');
  }
};

P.frighten = function () {
  var secs = AI.frightSeconds(this.level);
  this.chain = 0;
  this.frightTimer = secs * 60;
  for (var i = 0; i < 4; i++) {
    var g = this.ghosts[i];
    if (g.state === 'eyes' || g.state === 'entering') continue;
    g.frightened = secs > 0;
    if (g.state === 'active') g.reverse = true;
  }
  this.sfx('power');
};

P.endFright = function () {
  for (var i = 0; i < 4; i++) this.ghosts[i].frightened = false;
  this.chain = 0;
};

P.collide = function () {
  var p = this.player;
  var ptx = Math.floor(p.x / TS);
  var pty = Math.floor(p.y / TS);
  for (var i = 0; i < 4; i++) {
    var g = this.ghosts[i];
    if (g.state !== 'active') continue;
    var same = Math.floor(g.x / TS) === ptx && Math.floor(g.y / TS) === pty;
    if (!same && (Math.abs(g.x - p.x) >= 5 || Math.abs(g.y - p.y) >= 5)) continue;
    if (g.frightened) {
      var pts = GHOST_POINTS[Math.min(this.chain, 3)];
      this.chain++;
      this.addScore(pts);
      g.state = 'eyes';
      g.frightened = false;
      g.decX = g.decY = -99;
      this.popup(String(pts), g.x, g.y, 45, '#33e6ff');
      this.freeze = 45;
      this.sfx('eatGhost');
    } else if (!this.invulnerable) {
      this.lives--;
      this.fruit.active = false;
      this.setPhase('LIFE_LOST', 150);
      this.sfx('death');
      return true;
    }
  }
  return false;
};

// ---------------------------------------------------------------- ganchos de prueba

P.makeTestApi = function () {
  var self = this;
  return {
    state: function () {
      var p = self.player;
      return {
        phase: self.phase, level: self.level, score: self.score, lives: self.lives,
        dotsLeft: self.dotsLeft, mode: self.mode, frightTimer: self.frightTimer, chain: self.chain,
        player: { x: p.x, y: p.y, tx: Math.floor(p.x / TS), ty: Math.floor(p.y / TS), dir: p.dir, moving: p.moving },
        ghosts: self.ghosts.map(function (g) {
          return { id: g.id, x: g.x, y: g.y, tx: Math.floor(g.x / TS), ty: Math.floor(g.y / TS), dir: g.dir, state: g.state, frightened: g.frightened };
        }),
        fruit: { active: self.fruit.active, value: self.fruit.value }
      };
    },
    startPlaying: function () { self.setPhase('PLAYING', 0); },
    setPlayer: function (tx, ty, dir) {
      var p = self.player;
      p.x = tx * TS + 4;
      p.y = ty * TS + 4;
      p.dir = dir || 'left';
      p.moving = true;
      self.want = null;
    },
    setGhost: function (i, tx, ty, opts) {
      var g = self.ghosts[i];
      g.x = tx * TS + 4;
      g.y = ty * TS + 4;
      g.state = (opts && opts.state) || 'active';
      g.dir = (opts && opts.dir) || 'left';
      g.decX = g.decY = -99;
    },
    setGhostsEnabled: function (v) { self.ghostsEnabled = !!v; },
    setInvulnerable: function (v) { self.invulnerable = !!v; },
    parkGhosts: function () {
      // Aparta a los enemigos en la casa sin que salgan (para probar movimiento o puntos aislados).
      self.ghostsEnabled = false;
      for (var i = 0; i < 4; i++) { self.ghosts[i].state = 'house'; self.ghosts[i].x = M.HOUSE_SLOTS[i]; self.ghosts[i].y = M.HOUSE_CENTER_Y; }
    },
    tileAt: function (tx, ty) { return M.at(self.tiles, tx, ty); },
    isWall: function (tx, ty) { return M.isWall(tx, ty); },
    walls: function () {
      var out = [];
      for (var y = 0; y < M.ROWS; y++) for (var x = 0; x < M.COLS; x++) if (M.isWall(x, y)) out.push([x, y]);
      return out;
    },
    clearDotsExcept: function (n) {
      var kept = 0;
      for (var i = 0; i < self.tiles.length; i++) {
        var t = self.tiles[i];
        if (t === T.DOT || t === T.POWER) {
          if (kept < n) kept++;
          else self.tiles[i] = T.EMPTY;
        }
      }
      self.dotsLeft = kept;
    },
    firstDot: function () {
      for (var i = 0; i < self.tiles.length; i++) {
        if (self.tiles[i] === T.DOT || self.tiles[i] === T.POWER) return { tx: i % M.COLS, ty: Math.floor(i / M.COLS), type: self.tiles[i] };
      }
      return null;
    },
    countDots: function () { return M.countDots(self.tiles); },
    frighten: function () { self.frighten(); },
    setLives: function (n) { self.lives = n; },
    setScore: function (n) { self.score = n; self.scoreText = String(n); },
    setLevel: function (n) { self.level = n; self.startLevel(); self.setPhase('PLAYING', 0); }
  };
};
