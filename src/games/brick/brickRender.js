/* BRICK BLAST: dibujo en el canvas de 224×288 (marco, ladrillos, pala, bola, cápsulas y título). */
import { FIELD, BRICK } from './BrickGame.js';
import { text } from '../../gfx/text.js';

const ROW_COLORS = ['#ff3b3b', '#ff8c1a', '#ffd23f', '#3dff8b', '#33e6ff', '#3d6bff', '#9b4dff', '#ff8ad8', '#ff8ad8', '#ff8ad8'];
const CAPSULE = { W: ['#33e6ff', 'W'], S: ['#3dff8b', 'S'], L: ['#ff8ad8', 'L'] };

function brick(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x + 1, y + 1, BRICK.w - 2, BRICK.h - 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(x + 1, y + 1, BRICK.w - 2, 1);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(x + 1, y + BRICK.h - 2, BRICK.w - 2, 1);
}

function hud(g, game, view) {
  text.draw(g, '1UP', 8, 0, '#ffffff');
  text.draw(g, game.scoreText, 64, 9, '#ffffff', 'right');
  text.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
  text.draw(g, String(Math.max(game.score, view.best || 0)), 136, 9, '#ffffff', 'right');
  text.draw(g, view.userName || '', 216, 0, '#33e6ff', 'right');
  text.draw(g, game.levelText, 216, 9, '#ffd23f', 'right');
}

export function renderBrick(g, game, view) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  // Fondo con rejilla tenue y marco metálico.
  g.fillStyle = '#0a0f2a';
  g.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
  g.fillStyle = '#141c44';
  for (let y = FIELD.top; y < FIELD.bottom; y += 16) for (let x = FIELD.left + ((y / 16) % 2) * 8; x < FIELD.right; x += 16) g.fillRect(x, y, 8, 8);
  g.fillStyle = '#8e94a4';
  g.fillRect(0, FIELD.top - 4, 224, 4);
  g.fillRect(0, FIELD.top, FIELD.left, 264);
  g.fillRect(FIELD.right, FIELD.top, 8, 264);
  g.fillStyle = '#c8ccd6';
  g.fillRect(2, FIELD.top, 2, 264);
  g.fillRect(220, FIELD.top, 2, 264);
  hud(g, game, view);

  for (let r = 0; r < BRICK.rows; r++) {
    for (let c = 0; c < BRICK.cols; c++) {
      const v = game.bricks[r * BRICK.cols + c];
      if (!v) continue;
      const color = v === 3 ? '#d8dce6' : v === 2 ? '#8e94a4' : ROW_COLORS[r];
      brick(g, FIELD.left + c * BRICK.w, BRICK.top + r * BRICK.h, color);
    }
  }

  const cap = game.capsule;
  if (cap.active) {
    const [color, letter] = CAPSULE[cap.type];
    g.fillStyle = color;
    g.fillRect(Math.round(cap.x) - 8, Math.round(cap.y) - 4, 16, 8);
    text.draw(g, letter, cap.x, cap.y - 4, '#000', 'center');
  }

  const p = game.paddle;
  const px = Math.round(p.x - p.w / 2);
  if (game.phase !== 'GAME_OVER') {
    g.fillStyle = '#ff3d8b';
    g.fillRect(px, 262, p.w, 6);
    g.fillStyle = '#c8ccd6';
    g.fillRect(px, 262, 4, 6);
    g.fillRect(px + p.w - 4, 262, 4, 6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(px + 4, 262, p.w - 8, 1);
  }
  const b = game.ball;
  if (game.phase !== 'LIFE_LOST' && game.phase !== 'GAME_OVER') {
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
  }
  // Vidas de reserva.
  for (let i = 0; i < Math.min(6, game.lives - 1); i++) {
    g.fillStyle = '#ff3d8b';
    g.fillRect(10 + i * 14, 278, 10, 3);
  }
  for (const pp of game.popups) if (pp.timer > 0) text.draw(g, pp.text, pp.x, pp.y - (40 - pp.timer) / 4, pp.color, 'center');

  if (game.phase === 'READY') text.draw(g, 'READY!', 112, 200, '#ffd23f', 'center');
  if (game.phase === 'PLAYING' && b.stuck && Math.floor(game.frame / 20) % 2 === 0) text.draw(g, 'ESPACIO: LANZAR', 112, 230, '#33e6ff', 'center');
  if (game.phase === 'GAME_OVER') text.draw(g, 'GAME  OVER', 112, 200, '#ff3b3b', 'center');
  if (game.phase === 'LEVEL_CLEAR') text.draw(g, '¡NIVEL SUPERADO!', 112, 200, '#33e6ff', 'center');
}

export function renderBrickTitle(g, view) {
  const frame = view.frame || 0;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 224, 288);
  text.draw(g, 'RÉCORD', 112, 0, '#ffffff', 'center');
  text.draw(g, String(view.best || 0), 136, 9, '#ffffff', 'right');
  text.draw(g, view.userName || '', 216, 0, '#33e6ff', 'right');
  // Logotipo hecho de ladrillos que se encienden por turnos.
  for (let c = 0; c < 13; c++) {
    for (let r = 0; r < 3; r++) brick(g, 8 + c * 16, 30 + r * 8, ROW_COLORS[(r + c + Math.floor(frame / 10)) % 7]);
  }
  text.draw(g, 'BRICK', 112, 66, '#ffd23f', 'center', 3);
  text.draw(g, 'BLAST', 112, 94, '#ff3d8b', 'center', 3);
  text.draw(g, 'PUNTOS POR FILA', 112, 132, '#ffffff', 'center');
  [70, 50, 30, 10].forEach((pts, i) => {
    brick(g, 60, 146 + i * 12, ROW_COLORS[i * 2]);
    text.draw(g, String(pts) + ' PTS', 90, 146 + i * 12, '#ffffff');
  });
  brick(g, 60, 194, '#d8dce6');
  text.draw(g, 'PLATA: 2 GOLPES', 90, 194, '#c8ccd6');
  text.draw(g, 'CÁPSULAS  W  S  L', 112, 214, '#33e6ff', 'center');
  if (Math.floor(frame / 30) % 2 === 0) text.draw(g, 'PULSA ENTER', 112, 238, '#33e6ff', 'center');
  text.draw(g, 'FLECHAS PALA · ESPACIO LANZA', 112, 258, '#7a86c8', 'center');
}
