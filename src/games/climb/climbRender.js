/* BARREL CLIMB: dibujo en el canvas de 224×288 (vigas, actores, marcador, intermedio y pantalla de título). */
import L from './climbLevel.js';
import SP from './climbSprites.js';
import { sprites as S } from '../../gfx/sprites.js';
import { text } from '../../gfx/text.js';

var BARREL_FRAMES = ['barrel0', 'barrel1', 'barrel2', 'barrel3'];
var FIRE_FRAMES = ['fireBarrel0', 'fireBarrel1', 'fireBarrel2', 'fireBarrel3'];

var board = null;

// Sprites y escenario se generan una sola vez, la primera vez que se dibuja.
function build() {
  if (board) return;
  SP.build();
  board = SP.paintBoard(L);
}

// view: { best, userName, frame } — datos de la máquina que no son de la partida.
export function renderClimb(g, game, view) {
  build();
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  var phase = game.phase;
  if (phase === 'LEVEL_CLEAR' && game.timer <= 150) { renderHud(g, game, view); renderIntermission(g, game); return; }

  g.drawImage(board, 0, 0);
  renderHud(g, game, view);
  var i;

  // Bidón de aceite (con fuego si ya ha nacido una llama).
  var oilY = Math.round(L.surface(0, L.OIL_X)) - 16;
  g.drawImage(S.get('oil'), L.OIL_X - 8, oilY);
  if (game.oilLit || game.oilFlare > 0) {
    g.drawImage(S.get(Math.floor(game.frame / 6) % 2 ? 'flameA' : 'flameB'), L.OIL_X - 5, oilY - 10);
  }

  for (i = 0; i < L.hammers.length; i++) {
    if (game.hammersTaken[i]) continue;
    var h = L.hammers[i];
    g.drawImage(S.get('hammer'), h.x - 4, Math.round(L.surface(h.platform, h.x)) - 22);
  }

  // GROG y su reserva de barriles.
  var bossY = Math.round(L.surface(L.BOSS.platform, L.BOSS.x));
  g.drawImage(S.get('barrelSide'), 0, bossY - 10);
  g.drawImage(S.get('barrelSide'), 0, bossY - 20);
  S.drawFeet(g, game.throwAnim > 0 ? 'grogThrow' : 'grogIdle', L.BOSS.x, bossY, false);
  if (game.throwAnim > 8) g.drawImage(S.get(game.barrelCount % game.tune.fireEvery === 0 ? 'fireBarrel0' : 'barrel0'), L.BOSS.x - 5, bossY - 34);

  // LUNA en la cima.
  var topY = L.surface(L.TOP, L.RESCUE_X);
  S.drawFeet(g, Math.floor(game.frame / 20) % 2 ? 'lunaA' : 'lunaB', L.RESCUE_X, topY, false);
  if (phase === 'PLAYING' && Math.floor(game.frame / 45) % 2 === 0) text.draw(g, '¡AYUDA!', L.RESCUE_X, topY - 34, '#ff8ad8', 'center');

  for (i = 0; i < game.barrels.length; i++) {
    var b = game.barrels[i];
    if (!b.active) continue;
    if (b.state === 'ladder') { g.drawImage(S.get('barrelSide'), Math.round(b.x) - 6, Math.round(b.y) - 10); continue; }
    var frames = b.fire ? FIRE_FRAMES : BARREL_FRAMES;
    var f = Math.floor(b.spin / 6) % 4;
    if (b.dir < 0) f = 3 - f;
    g.drawImage(S.get(frames[f]), Math.round(b.x) - 5, Math.round(b.y) - 10);
  }
  for (i = 0; i < game.flames.length; i++) {
    var fl = game.flames[i];
    if (!fl.active) continue;
    S.drawFeet(g, Math.floor(fl.anim / 8) % 2 ? 'flameA' : 'flameB', fl.x, fl.y, fl.dir < 0);
  }

  renderPlayer(g, game);

  var sp = game.sparks;
  if (sp.timer > 0) {
    g.fillStyle = sp.timer % 4 < 2 ? '#ffffff' : '#ffe14d';
    var r = 18 - sp.timer;
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      g.fillRect(Math.round(sp.x + Math.cos(a) * r), Math.round(sp.y + Math.sin(a) * r), 2, 2);
    }
  }
  for (i = 0; i < game.popups.length; i++) {
    var pp = game.popups[i];
    if (pp.timer > 0) text.draw(g, pp.text, pp.x, pp.y, pp.color, 'center');
  }

  if (phase === 'READY') text.draw(g, '¡PREPARADO!', 112, 152, '#ffe14d', 'center');
  if (phase === 'GAME_OVER') {
    g.fillStyle = '#000';
    g.fillRect(56, 144, 112, 16);
    text.draw(g, 'GAME  OVER', 112, 148, '#ff3355', 'center');
  }
  if (phase === 'LEVEL_CLEAR') {
    g.drawImage(S.get('heart'), L.RESCUE_X + 6, Math.round(topY) - 30);
    text.draw(g, '¡RESCATE!', 112, 152, '#ff8ad8', 'center');
  }
}

function renderPlayer(g, game) {
  var p = game.player;
  var x = Math.round(p.x);
  var y = Math.round(p.y);
  if (game.phase === 'LIFE_LOST') {
    var t = 150 - game.timer;
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
    if (Math.floor(t / 10) % 2 === 0) text.draw(g, '×', x, y - 24, '#ffffff', 'center');
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

  if (game.hammerTimer > 0) {
    var blink = game.hammerTimer < 120 && Math.floor(game.hammerTimer / 6) % 2 === 0;
    if (!blink) {
      var hammer = S.get('hammer');
      if (Math.floor(game.frame / 8) % 2 === 0) {
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
}

function renderTop(g, frame, phase, score, scoreText, view) {
  var best = view.best || 0;
  if (Math.floor(frame / 20) % 2 === 0 || phase !== 'PLAYING') text.draw(g, '1UP', 8, 0, '#ffffff');
  text.draw(g, scoreText, 64, 9, '#ffffff', 'right');
  text.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
  text.draw(g, String(score > best ? score : best), 136, 9, '#ffffff', 'right');
  text.draw(g, view.userName || '', 216, 0, '#33e6ff', 'right');
}

function renderHud(g, game, view) {
  renderTop(g, game.frame, game.phase, game.score, game.scoreText, view);
  var spare = Math.max(0, game.lives - 1);
  var mini = S.get('pipMini');
  for (var i = 0; i < spare && i < 6; i++) g.drawImage(mini, 8 + i * 10, 22);
  text.draw(g, game.levelText, 8, 34, '#33e6ff');
  // Caja de bonificación.
  g.fillStyle = '#33e6ff';
  g.fillRect(164, 18, 56, 1);
  g.fillRect(164, 41, 56, 1);
  g.fillRect(164, 18, 1, 24);
  g.fillRect(219, 18, 1, 24);
  text.draw(g, 'BONO', 192, 21, '#ff8ad8', 'center');
  text.draw(g, game.bonusText, 192, 31, game.bonus <= 1000 && Math.floor(game.frame / 15) % 2 ? '#ff3355' : '#ffffff', 'center');
}

function renderIntermission(g, game) {
  var stack = Math.min(game.level + 1, 6);
  text.draw(g, game.nextLevelText, 112, 90, '#ffe14d', 'center', 2);
  for (var i = 0; i < stack; i++) {
    S.drawFeet(g, 'grogIdle', 112, 230 - i * 22, false);
  }
  text.draw(g, game.nextHeightText, 140, 230 - stack * 22 + 8, '#ffffff', 'left');
  text.draw(g, '¿HASTA DÓNDE SUBIRÁS?', 112, 250, '#33e6ff', 'center');
}

// Pantalla de título (la dibuja la máquina antes de empezar). frame: contador de la máquina.
export function renderClimbTitle(g, view) {
  build();
  var frame = view.frame || 0;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  renderTop(g, frame, 'TITLE', 0, '0', view);
  text.draw(g, 'BARREL', 112, 34, '#ff3366', 'center', 3);
  text.draw(g, 'CLIMB', 112, 62, '#33e6ff', 'center', 3);
  S.drawFeet(g, frame % 60 < 30 ? 'grogIdle' : 'grogThrow', 112, 122, false);
  S.drawFeet(g, 'pipStand', 60, 122, false);
  S.drawFeet(g, Math.floor(frame / 20) % 2 ? 'lunaA' : 'lunaB', 164, 122, false);
  text.draw(g, 'PIP', 60, 128, '#ff8c1a', 'center');
  text.draw(g, 'GROG', 112, 128, '#9b4dff', 'center');
  text.draw(g, 'LUNA', 164, 128, '#ff8ad8', 'center');
  g.drawImage(S.get('barrel1'), 24, 150);
  text.draw(g, 'SALTAR BARRIL   100', 40, 151, '#ffffff');
  g.drawImage(S.get('hammer'), 26, 166);
  text.draw(g, 'MARTILLO 300-800', 40, 168, '#ffffff');
  g.drawImage(S.get('heart'), 25, 185);
  text.draw(g, 'RESCATE + BONO', 40, 185, '#ffffff');
  text.draw(g, 'VIDA EXTRA: 7000', 112, 208, '#ffe14d', 'center');
  if (Math.floor(frame / 30) % 2 === 0) text.draw(g, 'PULSA ENTER', 112, 234, '#33e6ff', 'center');
  text.draw(g, 'ESPACIO: SALTAR', 112, 256, '#7a86c8', 'center');
  text.draw(g, 'FLECHAS: MOVER/SUBIR', 112, 266, '#7a86c8', 'center');
}
