/* BARREL CLIMB: reglas, puntuación, niveles y estados. */
(function (A) {
  'use strict';

  var L = A.games.climbLevel;
  var PH = A.games.climbPhysics;
  var HZ = A.games.climbHazards;
  var SP = A.games.climbSprites;

  var EXTRA_LIFE_AT = 7000;
  var BONUS_STEP_FRAMES = 120;
  var CLEAR_FRAMES = 300;          // 150 de rescate + 150 de transición de fase
  var BARREL_FRAMES = ['barrel0', 'barrel1', 'barrel2', 'barrel3'];
  var FIRE_FRAMES = ['fireBarrel0', 'fireBarrel1', 'fireBarrel2', 'fireBarrel3'];

  function ClimbGame() {}
  var P = ClimbGame.prototype;

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
    this.bestText = String(this.best);
    this.rand = A.core.makeRng(env.seed || Date.now());
    SP.build();
    this.board = SP.paintBoard(L);

    var pools = HZ.createPools();
    this.barrels = pools.barrels;
    this.flames = pools.flames;
    this.player = {};
    this.hammersTaken = [false, false];
    this.popups = [];
    for (var i = 0; i < 4; i++) this.popups.push({ timer: 0, x: 0, y: 0, text: '', color: '#fff' });
    this.sparks = { timer: 0, x: 0, y: 0 };

    this.score = 0;
    this.scoreText = '0';
    this.lives = 3;
    this.level = 1;
    this.paused = false;
    this.finished = false;
    this.throwing = true;
    this.barrelLadders = true;
    this.frame = 0;
    this.startLevel();
    this.setPhase('TITLE', 0);
    this.audio.music('title');
    this.test = this.makeTestApi();
  };

  P.update = function () {
    if (this.paused || this.finished) return;
    this.frame++;
    for (var i = 0; i < this.popups.length; i++) if (this.popups[i].timer > 0) this.popups[i].timer--;
    if (this.sparks.timer > 0) this.sparks.timer--;

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
            this.resetRound();
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
    this.barrels = this.flames = this.popups = null;
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
    this.input.clear();
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
    this.audio.play('score');
  };

  P.smash = function (x, y) {
    var pts = HZ.SMASH_POINTS[Math.floor(this.rand() * HZ.SMASH_POINTS.length)];
    this.addScore(pts);
    this.popup(String(pts), x, y - 14, '#33e6ff');
    this.sparks.timer = 18;
    this.sparks.x = x;
    this.sparks.y = y - 5;
    this.audio.play('smash');
  };

  P.die = function (cause) {
    if (this.invulnerable) return;
    this.lives--;
    this.deathCause = cause;
    this.hammerTimer = 0;
    this.setPhase('LIFE_LOST', 150);
    this.audio.play('death');
  };

  P.tickPlaying = function () {
    var p = this.player;
    var res = PH.update(p, this.input, this.hammerTimer > 0);
    if (res === 'jump') this.audio.play('jump');
    else if (res === 'fall-death') { this.die('fall'); return; }

    if (p.platform === L.TOP && p.state === 'walk') {
      this.addScore(this.bonus);
      this.popup(this.bonusText, p.x, p.y - 24, '#ffe14d');
      HZ.clear(this);
      this.hammerTimer = 0;
      this.setPhase('LEVEL_CLEAR', CLEAR_FRAMES);
      this.audio.play('levelClear');
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

  // ---------------------------------------------------------------- dibujo

  P.render = function () {
    var g = this.g;
    if (!g) return;
    var tx = this.text;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 224, 288);
    if (this.phase === 'TITLE') { this.renderHud(); this.renderTitle(); return; }
    if (this.phase === 'LEVEL_CLEAR' && this.timer <= 150) { this.renderHud(); this.renderIntermission(); return; }

    g.drawImage(this.board, 0, 0);
    this.renderHud();
    var S = this.sprites;
    var i;

    // Bidón de aceite (con fuego si ya ha nacido una llama).
    var oilY = Math.round(L.surface(0, L.OIL_X)) - 16;
    g.drawImage(S.get('oil'), L.OIL_X - 8, oilY);
    if (this.oilLit || this.oilFlare > 0) {
      g.drawImage(S.get(Math.floor(this.frame / 6) % 2 ? 'flameA' : 'flameB'), L.OIL_X - 5, oilY - 10);
    }

    for (i = 0; i < L.hammers.length; i++) {
      if (this.hammersTaken[i]) continue;
      var h = L.hammers[i];
      g.drawImage(S.get('hammer'), h.x - 4, Math.round(L.surface(h.platform, h.x)) - 22);
    }

    // GROG y su reserva de barriles.
    var bossY = Math.round(L.surface(L.BOSS.platform, L.BOSS.x));
    g.drawImage(S.get('barrelSide'), 0, bossY - 10);
    g.drawImage(S.get('barrelSide'), 0, bossY - 20);
    S.drawFeet(g, this.throwAnim > 0 ? 'grogThrow' : 'grogIdle', L.BOSS.x, bossY, false);
    if (this.throwAnim > 8) g.drawImage(S.get(this.barrelCount % this.tune.fireEvery === 0 ? 'fireBarrel0' : 'barrel0'), L.BOSS.x - 5, bossY - 34);

    // LUNA en la cima.
    var topY = L.surface(L.TOP, L.RESCUE_X);
    S.drawFeet(g, Math.floor(this.frame / 20) % 2 ? 'lunaA' : 'lunaB', L.RESCUE_X, topY, false);
    if (this.phase === 'PLAYING' && Math.floor(this.frame / 45) % 2 === 0) tx.draw(g, '¡AYUDA!', L.RESCUE_X, topY - 34, '#ff8ad8', 'center');

    for (i = 0; i < this.barrels.length; i++) {
      var b = this.barrels[i];
      if (!b.active) continue;
      if (b.state === 'ladder') { g.drawImage(S.get('barrelSide'), Math.round(b.x) - 6, Math.round(b.y) - 10); continue; }
      var frames = b.fire ? FIRE_FRAMES : BARREL_FRAMES;
      var f = Math.floor(b.spin / 6) % 4;
      if (b.dir < 0) f = 3 - f;
      g.drawImage(S.get(frames[f]), Math.round(b.x) - 5, Math.round(b.y) - 10);
    }
    for (i = 0; i < this.flames.length; i++) {
      var fl = this.flames[i];
      if (!fl.active) continue;
      S.drawFeet(g, Math.floor(fl.anim / 8) % 2 ? 'flameA' : 'flameB', fl.x, fl.y, fl.dir < 0);
    }

    this.renderPlayer();

    if (this.sparks.timer > 0) {
      g.fillStyle = this.sparks.timer % 4 < 2 ? '#ffffff' : '#ffe14d';
      var r = 18 - this.sparks.timer;
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
        g.fillRect(Math.round(this.sparks.x + Math.cos(a) * r), Math.round(this.sparks.y + Math.sin(a) * r), 2, 2);
      }
    }
    for (i = 0; i < this.popups.length; i++) {
      var pp = this.popups[i];
      if (pp.timer > 0) tx.draw(g, pp.text, pp.x, pp.y, pp.color, 'center');
    }

    if (this.phase === 'READY') tx.draw(g, '¡PREPARADO!', 112, 152, '#ffe14d', 'center');
    if (this.phase === 'GAME_OVER') {
      g.fillStyle = '#000';
      g.fillRect(56, 144, 112, 16);
      tx.draw(g, 'GAME  OVER', 112, 148, '#ff3355', 'center');
    }
    if (this.phase === 'LEVEL_CLEAR') {
      g.drawImage(S.get('heart'), L.RESCUE_X + 6, Math.round(topY) - 30);
      tx.draw(g, '¡RESCATE!', 112, 152, '#ff8ad8', 'center');
    }
  };

  P.renderPlayer = function () {
    var g = this.g;
    var S = this.sprites;
    var p = this.player;
    var x = Math.round(p.x);
    var y = Math.round(p.y);
    if (this.phase === 'LIFE_LOST') {
      var t = 150 - this.timer;
      if (t < 30) { S.drawFeet(g, 'pipStand', x, y, p.facing < 0); return; }
      if (t < 100) {
        g.save();
        g.translate(x, y - 8);
        g.rotate(Math.floor((t - 30) / 6) * Math.PI / 2);
        g.drawImage(S.get('pipStand'), -6, -8);
        g.restore();
        return;
      }
      g.save();
      g.translate(x, y - 6);
      g.rotate(Math.PI / 2);
      g.drawImage(S.get('pipStand'), -8, -6);
      g.restore();
      if (Math.floor(t / 10) % 2 === 0) this.text.draw(g, '×', x, y - 24, '#ffffff', 'center');
      return;
    }
    var name;
    if (p.state === 'climb') {
      S.drawFeet(g, 'pipClimb', x, y, Math.floor(p.anim / 8) % 2 === 1);
      return;
    }
    if (p.state === 'jump' || p.state === 'fall') name = 'pipJump';
    else if (Math.floor(p.anim / 5) % 4 === 1) name = 'pipWalk1';
    else if (Math.floor(p.anim / 5) % 4 === 3) name = 'pipWalk2';
    else name = 'pipStand';
    S.drawFeet(g, name, x, y, p.facing < 0);

    if (this.hammerTimer > 0) {
      var blink = this.hammerTimer < 120 && Math.floor(this.hammerTimer / 6) % 2 === 0;
      if (!blink) {
        var hammer = S.get('hammer');
        if (Math.floor(this.frame / 8) % 2 === 0) {
          g.drawImage(hammer, x - 4 + p.facing * 2, y - 28);
        } else {
          g.save();
          g.translate(x + p.facing * 10, y - 9);
          g.rotate(p.facing * Math.PI / 2);
          g.drawImage(hammer, -4, -5);
          g.restore();
        }
      }
    }
  };

  P.renderHud = function () {
    var g = this.g;
    var tx = this.text;
    if (Math.floor(this.frame / 20) % 2 === 0 || this.phase !== 'PLAYING') tx.draw(g, '1UP', 8, 0, '#ffffff');
    tx.draw(g, this.scoreText, 64, 9, '#ffffff', 'right');
    tx.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
    tx.draw(g, this.score > this.best ? this.scoreText : this.bestText, 136, 9, '#ffffff', 'right');
    tx.draw(g, this.user ? this.user.name : '', 216, 0, '#33e6ff', 'right');
    if (this.phase === 'TITLE') return;
    var spare = Math.max(0, this.lives - 1);
    var mini = this.sprites.get('pipMini');
    for (var i = 0; i < spare && i < 6; i++) g.drawImage(mini, 8 + i * 10, 22);
    tx.draw(g, this.levelText, 8, 34, '#33e6ff');
    // Caja de bonificación.
    g.fillStyle = '#33e6ff';
    g.fillRect(164, 18, 56, 1);
    g.fillRect(164, 41, 56, 1);
    g.fillRect(164, 18, 1, 24);
    g.fillRect(219, 18, 1, 24);
    tx.draw(g, 'BONO', 192, 21, '#ff8ad8', 'center');
    tx.draw(g, this.bonusText, 192, 31, this.bonus <= 1000 && Math.floor(this.frame / 15) % 2 ? '#ff3355' : '#ffffff', 'center');
  };

  P.renderTitle = function () {
    var g = this.g;
    var tx = this.text;
    var S = this.sprites;
    tx.draw(g, 'BARREL', 112, 34, '#ff3366', 'center', 3);
    tx.draw(g, 'CLIMB', 112, 62, '#33e6ff', 'center', 3);
    S.drawFeet(g, this.frame % 60 < 30 ? 'grogIdle' : 'grogThrow', 112, 122, false);
    S.drawFeet(g, 'pipStand', 60, 122, false);
    S.drawFeet(g, Math.floor(this.frame / 20) % 2 ? 'lunaA' : 'lunaB', 164, 122, false);
    tx.draw(g, 'PIP', 60, 128, '#ff8c1a', 'center');
    tx.draw(g, 'GROG', 112, 128, '#9b4dff', 'center');
    tx.draw(g, 'LUNA', 164, 128, '#ff8ad8', 'center');
    g.drawImage(S.get('barrel1'), 24, 150);
    tx.draw(g, 'SALTAR BARRIL   100', 40, 151, '#ffffff');
    g.drawImage(S.get('hammer'), 26, 166);
    tx.draw(g, 'MARTILLO 300-800', 40, 168, '#ffffff');
    g.drawImage(S.get('heart'), 25, 185);
    tx.draw(g, 'RESCATE + BONO', 40, 185, '#ffffff');
    tx.draw(g, 'VIDA EXTRA: 7000', 112, 208, '#ffe14d', 'center');
    if (Math.floor(this.frame / 30) % 2 === 0) tx.draw(g, 'PULSA ENTER', 112, 234, '#33e6ff', 'center');
    tx.draw(g, 'ESPACIO: SALTAR', 112, 256, '#7a86c8', 'center');
    tx.draw(g, 'FLECHAS: MOVER/SUBIR', 112, 266, '#7a86c8', 'center');
  };

  P.renderIntermission = function () {
    var g = this.g;
    var tx = this.text;
    var stack = Math.min(this.level + 1, 6);
    tx.draw(g, this.nextLevelText, 112, 90, '#ffe14d', 'center', 2);
    for (var i = 0; i < stack; i++) {
      this.sprites.drawFeet(g, 'grogIdle', 112, 230 - i * 22, false);
    }
    tx.draw(g, this.nextHeightText, 140, 230 - stack * 22 + 8, '#ffffff', 'left');
    tx.draw(g, '¿HASTA DÓNDE SUBIRÁS?', 112, 250, '#33e6ff', 'center');
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
      startPlaying: function () {
        if (self.phase === 'TITLE') { self.audio.stopMusic(); self.startGame(); }
        self.setPhase('PLAYING', 0);
      },
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
      setSeed: function (s) { self.rand = A.core.makeRng(s); },
      surface: function (pi, x) { return L.surface(pi, x); },
      ladders: function () { return L.ladders.map(function (l) { return { x: l.x, bottom: l.bottom, top: l.top, broken: l.broken }; }); },
      platforms: function () { return L.platforms.map(function (p) { return { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 }; }); },
      physics: function () { return { WALK: PH.WALK, JUMP_VY: PH.JUMP_VY, GRAVITY: PH.GRAVITY, FALL_DEATH: PH.FALL_DEATH }; },
      tuning: function () { return self.tune; }
    };
  };

  A.games.climb = {
    id: 'climb',
    name: 'BARREL CLIMB',
    create: function () { return new ClimbGame(); }
  };
})(window.Arcade = window.Arcade || {});
