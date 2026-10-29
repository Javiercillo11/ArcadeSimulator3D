/* BARREL CLIMB: vigas inclinadas propias, escaleras completas y rotas, martillos y tablas de dificultad. */
// Superficie de cada viga: recta de (x1, y1) a (x2, y2). La y crece hacia abajo.
// Los barriles ruedan hacia el extremo más bajo y caen por el borde abierto.
var PLATFORMS = [
  { x1: 0, y1: 280, x2: 224, y2: 272 },   // 0 suelo: rueda a la izquierda, hacia el bidón
  { x1: 0, y1: 236, x2: 208, y2: 244 },   // 1 rueda a la derecha
  { x1: 16, y1: 208, x2: 224, y2: 200 },  // 2 rueda a la izquierda
  { x1: 0, y1: 164, x2: 208, y2: 172 },   // 3 rueda a la derecha
  { x1: 16, y1: 136, x2: 224, y2: 128 },  // 4 rueda a la izquierda
  { x1: 0, y1: 92, x2: 192, y2: 100 },    // 5 cima del antagonista: rueda a la derecha
  { x1: 88, y1: 64, x2: 136, y2: 64 }     // 6 plataforma de rescate
];
for (var i = 0; i < PLATFORMS.length; i++) {
  var p = PLATFORMS[i];
  p.index = i;
  p.slope = (p.y2 - p.y1) / (p.x2 - p.x1);
  p.rollDir = p.y2 > p.y1 ? 1 : (p.y2 < p.y1 ? -1 : 0);
}

// Escaleras: x central, viga inferior, viga superior y si está rota (no se puede subir).
var LADDERS = [
  { x: 176, bottom: 0, top: 1, broken: false },
  { x: 80, bottom: 0, top: 1, broken: true },
  { x: 32, bottom: 1, top: 2, broken: false },
  { x: 104, bottom: 1, top: 2, broken: false },
  { x: 160, bottom: 1, top: 2, broken: true },
  { x: 192, bottom: 2, top: 3, broken: false },
  { x: 120, bottom: 2, top: 3, broken: true },
  { x: 64, bottom: 2, top: 3, broken: false },
  { x: 32, bottom: 3, top: 4, broken: false },
  { x: 96, bottom: 3, top: 4, broken: true },
  { x: 160, bottom: 3, top: 4, broken: false },
  { x: 184, bottom: 4, top: 5, broken: false },
  { x: 72, bottom: 4, top: 5, broken: true },
  { x: 128, bottom: 5, top: 6, broken: false }
];

var HAMMERS = [
  { x: 24, platform: 1 },
  { x: 208, platform: 4 }
];

var level = {
  platforms: PLATFORMS,
  ladders: LADDERS,
  hammers: HAMMERS,
  TOP: 6,
  PLAYER_START: { x: 56, platform: 0 },
  BOSS: { x: 24, platform: 5 },
  BARREL_SPAWN_X: 46,
  OIL_X: 14,
  RESCUE_X: 104
};

level.surface = function (pi, x) {
  var p = PLATFORMS[pi];
  return p.y1 + (x - p.x1) * p.slope;
};

level.inRange = function (pi, x) {
  var p = PLATFORMS[pi];
  return x >= p.x1 && x <= p.x2;
};

// Viga sobre la que se aterriza al pasar de prevY a newY en la columna x (−1 si ninguna).
level.findLanding = function (x, prevY, newY) {
  var best = -1;
  var bestY = Infinity;
  for (var i = 0; i < PLATFORMS.length; i++) {
    if (!level.inRange(i, x)) continue;
    var fy = level.surface(i, x);
    if (prevY <= fy + 0.001 && newY >= fy && fy < bestY) { best = i; bestY = fy; }
  }
  return best;
};

// Escalera completa alineada (±tol px) que sale hacia arriba ('up') o baja ('down') desde la viga pi.
level.ladderAt = function (x, pi, way, tol) {
  for (var i = 0; i < LADDERS.length; i++) {
    var l = LADDERS[i];
    if (l.broken || Math.abs(x - l.x) > tol) continue;
    if (way === 'up' && l.bottom === pi) return l;
    if (way === 'down' && l.top === pi) return l;
  }
  return null;
};

level.ladderTop = function (l) { return level.surface(l.top, l.x); };
level.ladderBottom = function (l) { return level.surface(l.bottom, l.x); };

// Dificultad por nivel.
level.tuning = function (n) {
  return {
    throwInterval: Math.max(70, 170 - 20 * (n - 1)),
    barrelSpeed: Math.min(1.5, 0.9 + 0.1 * (n - 1)),
    ladderProb: Math.min(0.5, 0.2 + 0.08 * (n - 1)),
    maxFlames: Math.min(4, 1 + Math.floor(n / 2)),
    flameSpeed: Math.min(0.8, 0.45 + 0.05 * (n - 1)),
    bonusStart: Math.min(8000, 5000 + 1000 * (n - 1)),
    fireEvery: 7
  };
};

export default level;
