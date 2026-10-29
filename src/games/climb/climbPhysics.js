/* BARREL CLIMB: movimiento del jugador. Caminar, escaleras alineadas, salto de arco fijo y caídas. */
import L from './climbLevel.js';
var physics = {
  WALK: 0.75,          // px por paso
  CLIMB: 0.6,
  JUMP_VY: -1.8,       // salto: altura máx. ≈ 16 px, ≈ 36 pasos en el aire
  GRAVITY: 0.1,
  MAX_FALL_VY: 3,
  FALL_DEATH: 20,      // caer más de esto (desde el punto más alto) es mortal
  LADDER_TOL: 4,
  MIN_X: 6,
  MAX_X: 218
};

physics.resetPlayer = function (p) {
  p.x = L.PLAYER_START.x;
  p.platform = L.PLAYER_START.platform;
  p.y = L.surface(p.platform, p.x);
  p.state = 'walk';
  p.facing = 1;
  p.vx = 0;
  p.vy = 0;
  p.ladder = null;
  p.peakY = p.y;
  p.anim = 0;
  p.jumpId = 0;
};

function clampX(p) {
  if (p.x < physics.MIN_X) { p.x = physics.MIN_X; p.vx = 0; }
  else if (p.x > physics.MAX_X) { p.x = physics.MAX_X; p.vx = 0; }
}

function startFall(p) {
  p.state = 'fall';
  p.vx = 0;
  p.vy = 0;
  p.peakY = p.y;
}

// Devuelve: null | 'jump' | 'land' | 'fall-death'
physics.update = function (p, input, hasHammer) {
  switch (p.state) {
    case 'walk': {
      if (!hasHammer && input.pressed.jump) {
        p.state = 'jump';
        p.vy = physics.JUMP_VY;
        p.vx = input.down.left ? -physics.WALK : (input.down.right ? physics.WALK : 0);
        if (p.vx) p.facing = p.vx > 0 ? 1 : -1;
        p.peakY = p.y;
        p.jumpId++;
        return 'jump';
      }
      if (!hasHammer && (input.down.up || input.down.down)) {
        var way = input.down.up ? 'up' : 'down';
        var lad = L.ladderAt(p.x, p.platform, way, physics.LADDER_TOL);
        if (lad) {
          p.state = 'climb';
          p.ladder = lad;
          p.x = lad.x;
          if (way === 'down') p.y += 0.01;
          return null;
        }
      }
      var dir = input.down.left ? -1 : (input.down.right ? 1 : 0);
      if (dir) {
        p.facing = dir;
        p.x += dir * physics.WALK;
        p.anim++;
        clampX(p);
      }
      if (!L.inRange(p.platform, p.x)) { startFall(p); return null; }
      p.y = L.surface(p.platform, p.x);
      return null;
    }
    case 'climb': {
      var l = p.ladder;
      var top = L.ladderTop(l);
      var bottom = L.ladderBottom(l);
      if (input.down.up) {
        p.y -= physics.CLIMB;
        p.anim++;
        if (p.y <= top) { p.y = top; p.state = 'walk'; p.platform = l.top; p.ladder = null; }
      } else if (input.down.down) {
        p.y += physics.CLIMB;
        p.anim++;
        if (p.y >= bottom) { p.y = bottom; p.state = 'walk'; p.platform = l.bottom; p.ladder = null; }
      }
      return null;
    }
    case 'jump':
    case 'fall': {
      var prevY = p.y;
      p.vy = Math.min(physics.MAX_FALL_VY, p.vy + physics.GRAVITY);
      p.x += p.vx;
      clampX(p);
      p.y += p.vy;
      if (p.y < p.peakY) p.peakY = p.y;
      if (p.vy > 0) {
        var land = L.findLanding(p.x, prevY, p.y);
        if (land >= 0) {
          var fy = L.surface(land, p.x);
          var drop = fy - p.peakY;
          p.y = fy;
          p.platform = land;
          p.state = 'walk';
          p.vx = p.vy = 0;
          return drop > physics.FALL_DEATH ? 'fall-death' : 'land';
        }
      }
      if (p.y > 300) return 'fall-death';
      return null;
    }
  }
  return null;
};

export default physics;
