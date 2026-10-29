/* BARREL CLIMB: barriles, llamas y martillo. Pools fijos: sin asignaciones durante la partida. */
import L from './climbLevel.js';
var MAX_BARRELS = 10;
var MAX_FLAMES = 4;
var HAMMER_FRAMES = 600;
var SMASH_POINTS = [300, 500, 800];
var BARREL_GRAVITY = 0.12;

var hazards = { MAX_BARRELS: MAX_BARRELS, MAX_FLAMES: MAX_FLAMES, HAMMER_FRAMES: HAMMER_FRAMES, SMASH_POINTS: SMASH_POINTS };

hazards.createPools = function () {
  var barrels = [];
  for (var i = 0; i < MAX_BARRELS; i++) {
    barrels.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, state: 'roll', platform: 0, dir: 1, fire: false, ladder: null, jumped: -1, spin: 0 });
  }
  var flames = [];
  for (var k = 0; k < MAX_FLAMES; k++) {
    flames.push({ active: false, x: 0, y: 0, platform: 0, dir: 1, state: 'walk', ladder: null, timer: 0, anim: 0, jumped: -1 });
  }
  return { barrels: barrels, flames: flames };
};

hazards.clear = function (game) {
  for (var i = 0; i < game.barrels.length; i++) game.barrels[i].active = false;
  for (var k = 0; k < game.flames.length; k++) game.flames[k].active = false;
};

hazards.spawnBarrel = function (game, x, platform, dir, fire) {
  for (var i = 0; i < game.barrels.length; i++) {
    var b = game.barrels[i];
    if (b.active) continue;
    b.active = true;
    b.x = x;
    b.platform = platform;
    b.y = L.surface(platform, x);
    b.dir = dir === undefined ? L.platforms[platform].rollDir : dir;
    b.vx = 0;
    b.vy = 0;
    b.state = 'roll';
    b.fire = !!fire;
    b.ladder = null;
    b.jumped = -1;
    b.spin = 0;
    return b;
  }
  return null;
};

hazards.spawnFlame = function (game, x, platform) {
  var count = 0;
  for (var c = 0; c < game.flames.length; c++) if (game.flames[c].active) count++;
  if (count >= game.tune.maxFlames) return null;
  for (var i = 0; i < game.flames.length; i++) {
    var f = game.flames[i];
    if (f.active) continue;
    f.active = true;
    f.x = x;
    f.platform = platform;
    f.y = L.surface(platform, x);
    f.dir = 1;
    f.state = 'walk';
    f.ladder = null;
    f.timer = 60 + Math.floor(game.rand() * 90);
    f.anim = 0;
    f.jumped = -1;
    return f;
  }
  return null;
};

function updateBarrel(game, b) {
  var speed = game.tune.barrelSpeed;
  b.spin++;
  if (b.state === 'roll') {
    var prevX = b.x;
    b.x += b.dir * speed;
    b.y = L.surface(b.platform, b.x);
    // Bidón de aceite: el barril desaparece y, si es especial, nace una llama.
    if (b.platform === 0 && b.x <= L.OIL_X + 6) {
      b.active = false;
      if (b.fire) { hazards.spawnFlame(game, L.OIL_X + 10, 0); game.oilFlare = 40; }
      return;
    }
    // Bajar por una escalera con cierta probabilidad (mayor si el jugador está debajo).
    var lads = L.ladders;
    for (var i = 0; i < lads.length; i++) {
      var l = lads[i];
      if (l.broken || l.top !== b.platform || l.top === L.TOP) continue;
      if ((prevX - l.x) * (b.x - l.x) > 0) continue;
      var prob = game.tune.ladderProb + (game.player.platform < b.platform ? 0.2 : 0);
      if (game.barrelLadders && game.rand() < prob) {
        b.state = 'ladder';
        b.ladder = l;
        b.x = l.x;
        return;
      }
    }
    if (!L.inRange(b.platform, b.x)) {
      b.state = 'fall';
      b.vx = b.dir * speed * 0.6;
      b.vy = 0;
    }
  } else if (b.state === 'fall') {
    var prevY = b.y;
    b.vy = Math.min(3, b.vy + BARREL_GRAVITY);
    b.x += b.vx;
    b.y += b.vy;
    var land = L.findLanding(b.x, prevY, b.y);
    if (land >= 0 && land < b.platform) {
      b.platform = land;
      b.y = L.surface(land, b.x);
      b.state = 'roll';
      b.dir = L.platforms[land].rollDir;
    } else if (b.y > 300 || b.x < -12 || b.x > 236) {
      b.active = false;
    }
  } else if (b.state === 'ladder') {
    b.y += 0.8;
    var bottom = L.ladderBottom(b.ladder);
    if (b.y >= bottom) {
      b.platform = b.ladder.bottom;
      b.y = bottom;
      b.state = 'roll';
      b.dir = L.platforms[b.platform].rollDir;
      b.ladder = null;
    }
  }
}

function updateFlame(game, f) {
  var speed = game.tune.flameSpeed;
  f.anim++;
  if (f.state === 'walk') {
    var prevX = f.x;
    f.x += f.dir * speed;
    var pl = L.platforms[f.platform];
    if (f.x < Math.max(pl.x1 + 4, 8) || f.x > Math.min(pl.x2 - 4, 216)) {
      f.dir = -f.dir;
      f.x = prevX;
    }
    f.y = L.surface(f.platform, f.x);
    if (--f.timer <= 0) {
      f.timer = 60 + Math.floor(game.rand() * 120);
      if (game.rand() < 0.3) f.dir = -f.dir;
    }
    // Subir o bajar escaleras completas (nunca la de rescate).
    for (var i = 0; i < L.ladders.length; i++) {
      var l = L.ladders[i];
      if (l.broken || l.top === L.TOP) continue;
      if ((prevX - l.x) * (f.x - l.x) > 0) continue;
      if ((l.bottom === f.platform || l.top === f.platform) && game.rand() < 0.35) {
        f.state = l.bottom === f.platform ? 'up' : 'down';
        f.ladder = l;
        f.x = l.x;
        break;
      }
    }
  } else {
    var l2 = f.ladder;
    if (f.state === 'up') {
      f.y -= speed * 0.7;
      if (f.y <= L.ladderTop(l2)) { f.y = L.ladderTop(l2); f.platform = l2.top; f.state = 'walk'; }
    } else {
      f.y += speed * 0.7;
      if (f.y >= L.ladderBottom(l2)) { f.y = L.ladderBottom(l2); f.platform = l2.bottom; f.state = 'walk'; }
    }
  }
}

function overlap(ax, ay, ahw, ah, bx, by, bhw, bh) {
  return Math.abs(ax - bx) < ahw + bhw && ay - ah < by && by - bh < ay;
}

// Avanza barriles, llamas y martillo. Devuelve true si el jugador muere.
hazards.update = function (game) {
  var p = game.player;
  var i;

  // El antagonista lanza barriles a un ritmo que depende del nivel.
  if (game.throwing) {
    if (game.throwAnim > 0) {
      if (--game.throwAnim === 0) {
        var fire = game.barrelCount % game.tune.fireEvery === 0;
        hazards.spawnBarrel(game, L.BARREL_SPAWN_X, L.BOSS.platform, 1, fire);
        game.barrelCount++;
        game.sfx('throwBarrel');
      }
    } else if (--game.throwTimer <= 0) {
      game.throwAnim = 24;
      game.throwTimer = game.tune.throwInterval + Math.floor(game.rand() * 40);
    }
  }
  if (game.oilFlare > 0) game.oilFlare--;

  for (i = 0; i < game.barrels.length; i++) if (game.barrels[i].active) updateBarrel(game, game.barrels[i]);
  for (i = 0; i < game.flames.length; i++) if (game.flames[i].active) updateFlame(game, game.flames[i]);

  // Recoger martillo.
  if (game.hammerTimer > 0) game.hammerTimer--;
  for (i = 0; i < L.hammers.length; i++) {
    var h = L.hammers[i];
    if (game.hammersTaken[i] || p.state === 'climb') continue;
    var hy = L.surface(h.platform, h.x) - 22;
    if (overlap(p.x, p.y, 4, 16, h.x, hy + 4, 4, 8)) {
      game.hammersTaken[i] = true;
      game.hammerTimer = HAMMER_FRAMES;
      game.sfx('hammer');
    }
  }

  var hasHammer = game.hammerTimer > 0;
  var jumping = p.state === 'jump' || p.state === 'fall';

  for (i = 0; i < game.barrels.length; i++) {
    var b = game.barrels[i];
    if (!b.active) continue;
    if (hasHammer && overlap(p.x + p.facing * 4, p.y, 10, 28, b.x, b.y, 5, 10)) {
      b.active = false;
      game.smash(b.x, b.y);
      continue;
    }
    if (overlap(p.x, p.y, 3, 14, b.x, b.y, 4, 8)) return true;
    // Saltar un barril: pasa por debajo durante el salto.
    if (jumping && b.jumped !== p.jumpId && Math.abs(b.x - p.x) < 6 && b.y > p.y && b.y - p.y < 26) {
      b.jumped = p.jumpId;
      game.jumpScore(b.x, b.y);
    }
  }
  for (i = 0; i < game.flames.length; i++) {
    var f = game.flames[i];
    if (!f.active) continue;
    if (hasHammer && overlap(p.x + p.facing * 4, p.y, 10, 28, f.x, f.y, 5, 10)) {
      f.active = false;
      game.smash(f.x, f.y);
      continue;
    }
    if (overlap(p.x, p.y, 3, 14, f.x, f.y, 4, 10)) return true;
    if (jumping && f.jumped !== p.jumpId && Math.abs(f.x - p.x) < 6 && f.y > p.y && f.y - p.y < 26) {
      f.jumped = p.jumpId;
      game.jumpScore(f.x, f.y);
    }
  }
  return false;
};

export default hazards;
