/* IA de los 4 enemigos: objetivos diferenciados, ciclos de modos, salida de casa y tablas por nivel. */
import M from './mazeMap.js';
var ORDER = ['up', 'left', 'down', 'right'];   // orden de desempate
var DX = { up: 0, down: 0, left: -1, right: 1 };
var DY = { up: -1, down: 1, left: 0, right: 0 };
var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

var ai = { ORDER: ORDER, DX: DX, DY: DY, OPP: OPP };

// Alternancia dispersión/persecución en segundos (empieza en dispersión).
ai.modeSchedule = function (level) {
  if (level === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
  if (level <= 4) return [7, 20, 7, 20, 5, Infinity];
  return [5, 20, 5, 20, 5, Infinity];
};

var FRIGHT = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1];
ai.frightSeconds = function (level) {
  return level <= FRIGHT.length ? FRIGHT[level - 1] : 1;
};

// Velocidades en píxeles por paso (60 Hz). Base: 1.25 px/paso = 75 px/s.
var BASE = 1.25;
ai.speeds = function (level) {
  var t;
  if (level === 1) t = [0.80, 0.90, 0.75, 0.50, 0.40];
  else if (level <= 4) t = [0.90, 0.95, 0.85, 0.55, 0.45];
  else t = [1.00, 1.00, 0.95, 0.60, 0.50];
  return {
    player: t[0] * BASE, playerFright: t[1] * BASE,
    ghost: t[2] * BASE, ghostFright: t[3] * BASE, ghostTunnel: t[4] * BASE,
    eyes: 2.0, house: 0.6
  };
};

// Puntos comidos necesarios para que salga cada enemigo de la casa.
ai.dotLimits = function (level) {
  if (level === 1) return [0, 0, 30, 60];
  if (level === 2) return [0, 0, 0, 50];
  return [0, 0, 0, 0];
};
ai.AFTER_DEATH_LIMITS = [0, 7, 17, 32];
ai.noDotFrames = function (level) { return level < 5 ? 240 : 180; };

// Calcula el objetivo (en casillas) y lo guarda en ghost.tgtX / ghost.tgtY.
ai.target = function (ghost, game) {
  var p = game.player;
  var ptx = Math.floor(p.x / 8);
  var pty = Math.floor(p.y / 8);
  if (ghost.state === 'eyes') {
    ghost.tgtX = 13; ghost.tgtY = 11;
    return;
  }
  var corner = M.SCATTER[ghost.id];
  if (game.mode === 'scatter') {
    ghost.tgtX = corner.x; ghost.tgtY = corner.y;
    return;
  }
  switch (ghost.id) {
    case 0: // RUSTY: la casilla del jugador
      ghost.tgtX = ptx; ghost.tgtY = pty;
      break;
    case 1: // PETAL: 4 casillas por delante del jugador
      ghost.tgtX = ptx + DX[p.dir] * 4;
      ghost.tgtY = pty + DY[p.dir] * 4;
      break;
    case 2: { // FROST: vector desde RUSTY hasta 2 casillas por delante del jugador, duplicado
      var r = game.ghosts[0];
      var ax = ptx + DX[p.dir] * 2;
      var ay = pty + DY[p.dir] * 2;
      ghost.tgtX = ax * 2 - Math.floor(r.x / 8);
      ghost.tgtY = ay * 2 - Math.floor(r.y / 8);
      break;
    }
    default: { // AMBER: persigue de lejos y se retira cuando está cerca
      var gx = Math.floor(ghost.x / 8) - ptx;
      var gy = Math.floor(ghost.y / 8) - pty;
      if (gx * gx + gy * gy > 64) { ghost.tgtX = ptx; ghost.tgtY = pty; }
      else { ghost.tgtX = corner.x; ghost.tgtY = corner.y; }
    }
  }
};

// Decisión en una casilla: sin media vuelta, mínima distancia al objetivo (o azar si vulnerable).
ai.choose = function (ghost, game, tx, ty) {
  var back = OPP[ghost.dir];
  var options = 0;
  var best = null;
  var bestD = Infinity;
  if (ghost.frightened && ghost.state === 'active') {
    // Aleatorio: elige una de las salidas válidas.
    var pick = Math.floor(game.rand() * 4);
    for (var k = 0; k < 4; k++) {
      var dir = ORDER[(pick + k) % 4];
      if (dir !== back && !M.isWall(tx + DX[dir], ty + DY[dir])) return dir;
    }
    return back;
  }
  ai.target(ghost, game);
  for (var i = 0; i < 4; i++) {
    var d = ORDER[i];
    if (d === back) continue;
    var nx = tx + DX[d];
    var ny = ty + DY[d];
    if (M.isWall(nx, ny)) continue;
    options++;
    var ex = nx - ghost.tgtX;
    var ey = ny - ghost.tgtY;
    var dist = ex * ex + ey * ey;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return options ? best : back;
};

export default ai;
