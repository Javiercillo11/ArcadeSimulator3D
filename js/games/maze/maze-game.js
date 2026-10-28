/* MAZE MUNCHER: reglas, movimiento por casillas, puntuación, niveles y estados. */
(function (A) {
  'use strict';

  var M = A.games.mazeMap;
  var AI = A.games.ghostAI;
  var SP = A.games.mazeSprites;
  var T = M.TILE;
  var DX = AI.DX;
  var DY = AI.DY;
  var OPP = AI.OPP;

  var TS = 8;
  var OY = 24;                  // el laberinto empieza bajo el marcador
  var EPS = 1e-4;
  var CORNER_TOLERANCE = 3;     // píxeles de giro anticipado
  var GHOST_POINTS = [200, 400, 800, 1600];
  var FRUIT_VALUES = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000];
  var FRUIT_SPRITE = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5];
  var FRUIT_FRAMES = 570;
  var EXTRA_LIFE_AT = 10000;

  var MUNCH = ['munch0', 'munch1', 'munch2', 'munch1'];
  var DIE = [];
  for (var di = 0; di < 11; di++) DIE.push('munchDie' + di);
  var SPOOK = [];
  for (var si = 0; si < 4; si++) SPOOK.push(['spook' + si + '_0', 'spook' + si + '_1']);
  var SCARED = ['scared_0', 'scared_1'];
  var SCARED_FLASH = ['scaredFlash_0', 'scaredFlash_1'];
  var FRUIT_NAMES = [];
  for (var fi = 0; fi < 6; fi++) FRUIT_NAMES.push('fruit' + fi);
  var ROTATION = { right: 0, down: Math.PI / 2, up: -Math.PI / 2, left: 0 };
  var TITLE_ROLES = ['-EL TERCO', '-LA ASTUTA', '-EL RARO', '-LA TÍMIDA'];
  var TITLE_NAMES = SP.GHOST_NAMES.map(function (n) { return '"' + n + '"'; });

  function mod(a, b) { return ((a % b) + b) % b; }
  function approach(v, target, step) {
    if (v < target) return Math.min(target, v + step);
    return Math.max(target, v - step);
  }

  function MazeGame() {}
  var P = MazeGame.prototype;

  // ---------------------------------------------------------------- contrato

  P.init = function (env, user) {
    this.env = env;
    this.g = env.g;
    this.input = env.input;
    this.audio = env.audio;
    this.text = env.text;
    this.sprites = env.sprites;
    this.user = user;
    this.best = env.best || 0;
    this.rand = A.core.makeRng(env.seed || Date.now());
    SP.build();

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

    this.score = 0;
    this.scoreText = '0';
    this.bestText = String(this.best);
    this.lives = 3;
    this.level = 1;
    this.paused = false;
    this.finished = false;
    this.ghostsEnabled = true;
    this.frame = 0;

    this.mazeCanvas = this.paintMaze('#3d5cff', '#0b1030');
    this.flashCanvas = this.paintMaze('#ffffff', '#0b1030');
    this.startLevel();
    this.setPhase('TITLE', 0);
    this.audio.music('title');
    this.test = this.makeTestApi();
  };

  P.update = function () {
    if (this.paused || this.finished) return;
    this.frame++;
    for (var i = 0; i < this.popups.length; i++) if (this.popups[i].timer > 0) this.popups[i].timer--;

    switch (this.phase) {
      case 'TITLE':
        if (this.input.pressed.start || this.input.pressed.jump) {
          this.audio.stopMusic();
          this.startGame();
        }
        break;
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
            this.audio.play('gameOver');
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

  P.pause = function () {
    this.paused = true;
    this.audio.stopMusic();
  };

  P.resume = function () {
    this.paused = false;
    if (this.phase === 'TITLE') this.audio.music('title');
  };

  P.getScore = function () { return this.score; };
  P.getLevel = function () { return this.level; };
  P.getPhase = function () { return this.phase; };
  P.isFinished = function () { return this.finished; };

  P.destroy = function () {
    this.audio.stopMusic();
    this.finished = true;
    this.env = this.g = this.input = null;
    this.ghosts = this.popups = null;
  };

  // ---------------------------------------------------------------- partida

  P.setPhase = function (name, frames) {
    this.phase = name;
    this.timer = frames;
  };

  P.startGame = function () {
    this.score = 0;
    this.scoreText = '0';
    this.lives = 3;
    this.level = 1;
    this.extraGiven = false;
    this.startLevel();
    this.setPhase('READY', 150);
    this.audio.play('start');
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
    this.input.clear();
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
      this.audio.play('extra');
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
        this.audio.play('fruit');
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
    var want = this.input.lastDir;
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
    var want = this.input.lastDir;
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
      this.audio.play('chomp');
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
      this.audio.play('levelClear');
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
    this.audio.play('power');
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
        this.audio.play('eatGhost');
      } else if (!this.invulnerable) {
        this.lives--;
        this.fruit.active = false;
        this.setPhase('LIFE_LOST', 150);
        this.audio.play('death');
        return true;
      }
    }
    return false;
  };

  // ---------------------------------------------------------------- dibujo

  P.paintMaze = function (line, fill) {
    var c = A.gfx.sprites.makeCanvas(M.COLS * TS, M.ROWS * TS);
    var g = c.getContext('2d');
    function solid(tx, ty) {
      var t = M.at(M.base, tx, ty);
      return t === T.WALL;
    }
    for (var ty = 0; ty < M.ROWS; ty++) {
      for (var tx = 0; tx < M.COLS; tx++) {
        var t = M.at(M.base, tx, ty);
        var x = tx * TS;
        var y = ty * TS;
        if (t === T.DOOR) {
          g.fillStyle = '#ff8ad8';
          g.fillRect(x, y + 3, TS, 2);
          continue;
        }
        if (t !== T.WALL) continue;
        g.fillStyle = fill;
        g.fillRect(x, y, TS, TS);
        g.fillStyle = line;
        var up = solid(tx, ty - 1);
        var dn = solid(tx, ty + 1);
        var lf = solid(tx - 1, ty);
        var rt = solid(tx + 1, ty);
        if (ty === 0) up = true;
        if (ty === M.ROWS - 1) dn = true;
        if (tx === 0) lf = lf || ty !== M.TUNNEL_ROW;
        if (tx === M.COLS - 1) rt = rt || ty !== M.TUNNEL_ROW;
        var x0 = lf ? x : x + 2;
        var x1 = rt ? x + TS : x + 6;
        var y0 = up ? y : y + 2;
        var y1 = dn ? y + TS : y + 6;
        if (!up) g.fillRect(x0, y + 2, x1 - x0, 1);
        if (!dn) g.fillRect(x0, y + 5, x1 - x0, 1);
        if (!lf) g.fillRect(x + 2, y0, 1, y1 - y0);
        if (!rt) g.fillRect(x + 5, y0, 1, y1 - y0);
        // Esquinas interiores: diagonal libre con ortogonales macizas.
        if (up && lf && !solid(tx - 1, ty - 1) && tx > 0 && ty > 0) { g.fillRect(x, y + 2, 3, 1); g.fillRect(x + 2, y, 1, 3); }
        if (up && rt && !solid(tx + 1, ty - 1) && tx < M.COLS - 1 && ty > 0) { g.fillRect(x + 5, y + 2, 3, 1); g.fillRect(x + 5, y, 1, 3); }
        if (dn && lf && !solid(tx - 1, ty + 1) && tx > 0 && ty < M.ROWS - 1) { g.fillRect(x, y + 5, 3, 1); g.fillRect(x + 2, y + 5, 1, 3); }
        if (dn && rt && !solid(tx + 1, ty + 1) && tx < M.COLS - 1 && ty < M.ROWS - 1) { g.fillRect(x + 5, y + 5, 3, 1); g.fillRect(x + 5, y + 5, 1, 3); }
      }
    }
    return c;
  };

  P.render = function () {
    var g = this.g;
    if (!g) return;
    var tx = this.text;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 224, 288);
    this.renderHud();
    if (this.phase === 'TITLE') { this.renderTitle(); return; }

    var flash = this.phase === 'LEVEL_CLEAR' && this.timer < 120 && Math.floor(this.timer / 12) % 2 === 0;
    g.drawImage(flash ? this.flashCanvas : this.mazeCanvas, 0, OY);

    // Puntos y superpíldoras.
    var blinkOn = this.phase !== 'PLAYING' || Math.floor(this.frame / 12) % 2 === 0;
    var tiles = this.tiles;
    g.fillStyle = '#ffd6a8';
    for (var ty = 0; ty < M.ROWS; ty++) {
      for (var x = 0; x < M.COLS; x++) {
        var t = tiles[ty * M.COLS + x];
        if (t === T.DOT) g.fillRect(x * TS + 3, OY + ty * TS + 3, 2, 2);
        else if (t === T.POWER && blinkOn) g.drawImage(this.sprites.get('power'), x * TS, OY + ty * TS);
      }
    }

    if (this.fruit.active) this.sprites.draw(g, FRUIT_NAMES[this.fruit.sprite], M.FRUIT_POS.x, M.FRUIT_POS.y + OY);

    var dying = this.phase === 'LIFE_LOST';
    var hideGhosts = (dying && this.timer < 120) || this.phase === 'LEVEL_CLEAR' || this.phase === 'GAME_OVER';
    if (!hideGhosts) {
      for (var i = 0; i < 4; i++) {
        var gh = this.ghosts[i];
        if (this.freeze > 0 && gh.state === 'eyes' && this.isPopupAt(gh)) continue;
        this.renderGhost(gh);
      }
    }

    if (dying) this.renderDeath();
    else if (this.phase !== 'GAME_OVER') this.renderPlayer();

    for (var k = 0; k < this.popups.length; k++) {
      var pp = this.popups[k];
      if (pp.timer > 0) tx.draw(g, pp.text, pp.x, pp.y + OY - 4, pp.color, 'center');
    }

    if (this.phase === 'READY') tx.draw(g, 'READY!', 112, OY + 17 * TS, '#ffc93c', 'center');
    if (this.phase === 'GAME_OVER') tx.draw(g, 'GAME  OVER', 112, OY + 17 * TS, '#ff3b3b', 'center');
    if (this.phase === 'LEVEL_CLEAR' && this.timer >= 120) tx.draw(g, '¡NIVEL SUPERADO!', 112, OY + 17 * TS, '#33e6ff', 'center');
  };

  P.isPopupAt = function (gh) {
    for (var i = 0; i < this.popups.length; i++) {
      var p = this.popups[i];
      if (p.timer > 0 && Math.abs(p.x - gh.x) < 1 && Math.abs(p.y - gh.y) < 1) return true;
    }
    return false;
  };

  P.renderHud = function () {
    var g = this.g;
    var tx = this.text;
    if (Math.floor(this.frame / 20) % 2 === 0 || this.phase !== 'PLAYING') tx.draw(g, '1UP', 8, 0, '#ffffff');
    tx.draw(g, this.scoreText, 64, 9, '#ffffff', 'right');
    tx.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
    tx.draw(g, this.score > this.best ? this.scoreText : this.bestText, 136, 9, '#ffffff', 'right');
    tx.draw(g, this.user ? this.user.name : '', 216, 0, '#33e6ff', 'right');
    tx.draw(g, this.levelText, 216, 9, '#ffc93c', 'right');
    if (this.phase === 'TITLE') return;
    // Vidas de reserva y frutas de los últimos niveles.
    var spare = Math.max(0, this.lives - 1);
    var icon = this.sprites.get('munch1', true);
    for (var i = 0; i < spare && i < 6; i++) g.drawImage(icon, 8 + i * 16, 274);
    var first = Math.max(1, this.level - 6);
    for (var l = first, n = 0; l <= this.level; l++, n++) {
      var li = Math.min(l, FRUIT_SPRITE.length) - 1;
      g.drawImage(this.sprites.get(FRUIT_NAMES[FRUIT_SPRITE[li]]), 204 - n * 14, 275);
    }
  };

  P.renderPlayer = function () {
    var g = this.g;
    var p = this.player;
    var name = p.moving ? MUNCH[Math.floor(p.anim / 3) % 4] : 'munch1';
    var img = this.sprites.get(name, p.dir === 'left');
    var x = Math.round(p.x);
    var y = Math.round(p.y) + OY;
    var rot = ROTATION[p.dir];
    if (rot === 0) {
      g.drawImage(img, x - 6, y - 6);
    } else {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.drawImage(img, -6, -6);
      g.restore();
    }
  };

  P.renderDeath = function () {
    var g = this.g;
    var p = this.player;
    var t = 150 - this.timer;
    var x = Math.round(p.x);
    var y = Math.round(p.y) + OY;
    if (t < 30) { this.renderPlayer(); return; }
    var f = Math.floor((t - 30) / 8);
    if (f < DIE.length) {
      g.save();
      g.translate(x, y);
      g.rotate(-Math.PI / 2);
      g.drawImage(this.sprites.get(DIE[f]), -6, -6);
      g.restore();
    } else if (f < DIE.length + 2) {
      // Chispa final.
      g.fillStyle = '#ffc93c';
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        g.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), 1, 1);
      }
    }
  };

  P.renderGhost = function (gh) {
    var g = this.g;
    var frame = Math.floor(gh.anim / 8) % 2;
    var x = Math.round(gh.x) - 7;
    var y = Math.round(gh.y) + OY - 7;
    var eyesOnly = gh.state === 'eyes' || gh.state === 'entering';
    if (gh.frightened && !eyesOnly) {
      var flash = this.frightTimer < 120 && Math.floor(this.frightTimer / 14) % 2 === 0;
      g.drawImage(this.sprites.get(flash ? SCARED_FLASH[frame] : SCARED[frame]), x, y);
      return;
    }
    if (!eyesOnly) g.drawImage(this.sprites.get(SPOOK[gh.id][frame]), x, y);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 2, y + 4, 4, 5);
    g.fillRect(x + 8, y + 4, 4, 5);
    g.fillStyle = '#1b2bff';
    var ox = DX[gh.dir];
    var oy = DY[gh.dir];
    g.fillRect(x + 3 + ox, y + 6 + oy * 2, 2, 2);
    g.fillRect(x + 9 + ox, y + 6 + oy * 2, 2, 2);
  };

  P.renderTitle = function () {
    var g = this.g;
    var tx = this.text;
    tx.draw(g, 'MAZE', 112, 36, '#ffc93c', 'center', 3);
    tx.draw(g, 'MUNCHER', 112, 64, '#ff8ad8', 'center', 2);
    tx.draw(g, 'PERSONAJE  /  APODO', 112, 96, '#ffffff', 'center');
    for (var i = 0; i < 4; i++) {
      var y = 116 + i * 20;
      g.drawImage(this.sprites.get(SPOOK[i][Math.floor(this.frame / 8) % 2]), 28, y - 3);
      tx.draw(g, TITLE_ROLES[i], 52, y, SP.GHOST_COLORS[i]);
      tx.draw(g, TITLE_NAMES[i], 204, y, SP.GHOST_COLORS[i], 'right');
    }
    g.fillStyle = '#ffd6a8';
    g.fillRect(83, 207, 2, 2);
    tx.draw(g, '10 PTS', 96, 204, '#ffffff');
    if (Math.floor(this.frame / 12) % 2 === 0) g.drawImage(this.sprites.get('power'), 80, 216);
    tx.draw(g, '50 PTS', 96, 216, '#ffffff');
    g.drawImage(this.sprites.get('munch2'), 40, 205);
    if (Math.floor(this.frame / 30) % 2 === 0) tx.draw(g, 'PULSA ENTER', 112, 244, '#33e6ff', 'center');
    tx.draw(g, 'FLECHAS: MOVER  ESC: PAUSA', 112, 266, '#7a86c8', 'center');
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
      startPlaying: function () {
        if (self.phase === 'TITLE') { self.audio.stopMusic(); self.startGame(); }
        self.setPhase('PLAYING', 0);
      },
      setPlayer: function (tx, ty, dir) {
        var p = self.player;
        p.x = tx * TS + 4;
        p.y = ty * TS + 4;
        p.dir = dir || 'left';
        p.moving = true;
        self.input.lastDir = null;
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

  A.games.maze = {
    id: 'maze',
    name: 'MAZE MUNCHER',
    create: function () { return new MazeGame(); }
  };
})(window.Arcade = window.Arcade || {});
