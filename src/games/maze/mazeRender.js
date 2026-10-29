/* MAZE MUNCHER: dibujo en el canvas de 224×288 (laberinto, actores, marcador y pantalla de título). */
import M from './mazeMap.js';
import AI from './ghostAI.js';
import SP from './mazeSprites.js';
import { FRUIT_SPRITE } from './MazeGame.js';
import { sprites } from '../../gfx/sprites.js';
import { text } from '../../gfx/text.js';

var T = M.TILE;
var DX = AI.DX;
var DY = AI.DY;
var TS = 8;
var OY = 24;                  // el laberinto empieza bajo el marcador

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

var mazeCanvas = null;
var flashCanvas = null;

function paintMaze(line, fill) {
  var c = sprites.makeCanvas(M.COLS * TS, M.ROWS * TS);
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
}

// Sprites y laberinto se generan una sola vez, la primera vez que se dibuja.
function build() {
  if (mazeCanvas) return;
  SP.build();
  mazeCanvas = paintMaze('#3d5cff', '#0b1030');
  flashCanvas = paintMaze('#ffffff', '#0b1030');
}

// view: { best, userName, frame } — datos de la máquina que no son de la partida.
export function renderMaze(g, game, view) {
  build();
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  renderHud(g, game, view);

  var phase = game.phase;
  var flash = phase === 'LEVEL_CLEAR' && game.timer < 120 && Math.floor(game.timer / 12) % 2 === 0;
  g.drawImage(flash ? flashCanvas : mazeCanvas, 0, OY);

  // Puntos y superpíldoras.
  var blinkOn = phase !== 'PLAYING' || Math.floor(game.frame / 12) % 2 === 0;
  var tiles = game.tiles;
  g.fillStyle = '#ffd6a8';
  for (var ty = 0; ty < M.ROWS; ty++) {
    for (var x = 0; x < M.COLS; x++) {
      var t = tiles[ty * M.COLS + x];
      if (t === T.DOT) g.fillRect(x * TS + 3, OY + ty * TS + 3, 2, 2);
      else if (t === T.POWER && blinkOn) g.drawImage(sprites.get('power'), x * TS, OY + ty * TS);
    }
  }

  if (game.fruit.active) sprites.draw(g, FRUIT_NAMES[game.fruit.sprite], M.FRUIT_POS.x, M.FRUIT_POS.y + OY);

  var dying = phase === 'LIFE_LOST';
  var hideGhosts = (dying && game.timer < 120) || phase === 'LEVEL_CLEAR' || phase === 'GAME_OVER';
  if (!hideGhosts) {
    for (var i = 0; i < 4; i++) {
      var gh = game.ghosts[i];
      if (game.freeze > 0 && gh.state === 'eyes' && isPopupAt(game, gh)) continue;
      renderGhost(g, game, gh);
    }
  }

  if (dying) renderDeath(g, game);
  else if (phase !== 'GAME_OVER') renderPlayer(g, game);

  for (var k = 0; k < game.popups.length; k++) {
    var pp = game.popups[k];
    if (pp.timer > 0) text.draw(g, pp.text, pp.x, pp.y + OY - 4, pp.color, 'center');
  }

  if (phase === 'READY') text.draw(g, 'READY!', 112, OY + 17 * TS, '#ffc93c', 'center');
  if (phase === 'GAME_OVER') text.draw(g, 'GAME  OVER', 112, OY + 17 * TS, '#ff3b3b', 'center');
  if (phase === 'LEVEL_CLEAR' && game.timer >= 120) text.draw(g, '¡NIVEL SUPERADO!', 112, OY + 17 * TS, '#33e6ff', 'center');
}

function isPopupAt(game, gh) {
  for (var i = 0; i < game.popups.length; i++) {
    var p = game.popups[i];
    if (p.timer > 0 && Math.abs(p.x - gh.x) < 1 && Math.abs(p.y - gh.y) < 1) return true;
  }
  return false;
}

function renderHud(g, game, view) {
  var best = view.best || 0;
  if (Math.floor(game.frame / 20) % 2 === 0 || game.phase !== 'PLAYING') text.draw(g, '1UP', 8, 0, '#ffffff');
  text.draw(g, game.scoreText, 64, 9, '#ffffff', 'right');
  text.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
  text.draw(g, String(game.score > best ? game.score : best), 136, 9, '#ffffff', 'right');
  text.draw(g, view.userName || '', 216, 0, '#33e6ff', 'right');
  text.draw(g, game.levelText, 216, 9, '#ffc93c', 'right');
  // Vidas de reserva y frutas de los últimos niveles.
  var spare = Math.max(0, game.lives - 1);
  var icon = sprites.get('munch1', true);
  for (var i = 0; i < spare && i < 6; i++) g.drawImage(icon, 8 + i * 16, 274);
  var first = Math.max(1, game.level - 6);
  for (var l = first, n = 0; l <= game.level; l++, n++) {
    var li = Math.min(l, FRUIT_SPRITE.length) - 1;
    g.drawImage(sprites.get(FRUIT_NAMES[FRUIT_SPRITE[li]]), 204 - n * 14, 275);
  }
}

function renderPlayer(g, game) {
  var p = game.player;
  var name = p.moving ? MUNCH[Math.floor(p.anim / 3) % 4] : 'munch1';
  var img = sprites.get(name, p.dir === 'left');
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
}

function renderDeath(g, game) {
  var p = game.player;
  var t = 150 - game.timer;
  var x = Math.round(p.x);
  var y = Math.round(p.y) + OY;
  if (t < 30) { renderPlayer(g, game); return; }
  var f = Math.floor((t - 30) / 8);
  if (f < DIE.length) {
    g.save();
    g.translate(x, y);
    g.rotate(-Math.PI / 2);
    g.drawImage(sprites.get(DIE[f]), -6, -6);
    g.restore();
  } else if (f < DIE.length + 2) {
    // Chispa final.
    g.fillStyle = '#ffc93c';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      g.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), 1, 1);
    }
  }
}

function renderGhost(g, game, gh) {
  var frame = Math.floor(gh.anim / 8) % 2;
  var x = Math.round(gh.x) - 7;
  var y = Math.round(gh.y) + OY - 7;
  var eyesOnly = gh.state === 'eyes' || gh.state === 'entering';
  if (gh.frightened && !eyesOnly) {
    var flash = game.frightTimer < 120 && Math.floor(game.frightTimer / 14) % 2 === 0;
    g.drawImage(sprites.get(flash ? SCARED_FLASH[frame] : SCARED[frame]), x, y);
    return;
  }
  if (!eyesOnly) g.drawImage(sprites.get(SPOOK[gh.id][frame]), x, y);
  g.fillStyle = '#ffffff';
  g.fillRect(x + 2, y + 4, 4, 5);
  g.fillRect(x + 8, y + 4, 4, 5);
  g.fillStyle = '#1b2bff';
  var ox = DX[gh.dir];
  var oy = DY[gh.dir];
  g.fillRect(x + 3 + ox, y + 6 + oy * 2, 2, 2);
  g.fillRect(x + 9 + ox, y + 6 + oy * 2, 2, 2);
}

// Pantalla de título (la dibuja la máquina antes de empezar). frame: contador de la máquina.
export function renderMazeTitle(g, view) {
  build();
  var frame = view.frame || 0;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  text.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
  text.draw(g, String(view.best || 0), 136, 9, '#ffffff', 'right');
  text.draw(g, view.userName || '', 216, 0, '#33e6ff', 'right');
  text.draw(g, 'MAZE', 112, 36, '#ffc93c', 'center', 3);
  text.draw(g, 'MUNCHER', 112, 64, '#ff8ad8', 'center', 2);
  text.draw(g, 'PERSONAJE  /  APODO', 112, 96, '#ffffff', 'center');
  for (var i = 0; i < 4; i++) {
    var y = 116 + i * 20;
    g.drawImage(sprites.get(SPOOK[i][Math.floor(frame / 8) % 2]), 28, y - 3);
    text.draw(g, TITLE_ROLES[i], 52, y, SP.GHOST_COLORS[i]);
    text.draw(g, TITLE_NAMES[i], 204, y, SP.GHOST_COLORS[i], 'right');
  }
  g.fillStyle = '#ffd6a8';
  g.fillRect(83, 207, 2, 2);
  text.draw(g, '10 PTS', 96, 204, '#ffffff');
  if (Math.floor(frame / 12) % 2 === 0) g.drawImage(sprites.get('power'), 80, 216);
  text.draw(g, '50 PTS', 96, 216, '#ffffff');
  g.drawImage(sprites.get('munch2'), 40, 205);
  if (Math.floor(frame / 30) % 2 === 0) text.draw(g, 'PULSA ENTER', 112, 244, '#33e6ff', 'center');
  text.draw(g, 'FLECHAS: MOVER  ESC: PAUSA', 112, 266, '#7a86c8', 'center');
}
