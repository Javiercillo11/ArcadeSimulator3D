/* SKEE-BALL: dibujo de la pista (224×560): diana con anillos, agujeros de 100, rampa, madera, bola y barra de fuerza. */
import { LANE, TARGET, RINGS, HUNDREDS, HUNDRED_R, BALLS } from './SkeeGame.js';
import { text } from '../../gfx/text.js';

const RING_COLORS = ['#ff3d6e', '#ffd23f', '#3dff8b', '#33e6ff', '#9b4dff'];

function board(g) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, LANE.w, LANE.h);
  // Diana: fondo azul con anillos concéntricos y su agujero oscuro.
  g.fillStyle = '#121a4a';
  g.fillRect(LANE.left - 10, 0, LANE.right - LANE.left + 20, LANE.rampY);
  const outer = RINGS[RINGS.length - 1][0] + 18;
  g.fillStyle = RING_COLORS[4];
  g.beginPath(); g.arc(TARGET.x, TARGET.y, outer, 0, Math.PI * 2); g.fill();
  text.draw(g, '10', TARGET.x, TARGET.y + outer - 14, '#ffffff', 'center');
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const [r, pts] = RINGS[i];
    g.fillStyle = RING_COLORS[i];
    g.beginPath(); g.arc(TARGET.x, TARGET.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0a0a14';
    g.beginPath(); g.arc(TARGET.x, TARGET.y, r - 7, 0, Math.PI * 2); g.fill();
    if (i > 0) text.draw(g, String(pts), TARGET.x, TARGET.y - r + 1, '#000000', 'center');
  }
  text.draw(g, '50', TARGET.x, TARGET.y - 4, '#ffd23f', 'center');
  for (const h of HUNDREDS) {
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(h.x, h.y, HUNDRED_R + 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0a0a14';
    g.beginPath(); g.arc(h.x, h.y, HUNDRED_R, 0, Math.PI * 2); g.fill();
    text.draw(g, '100', h.x, h.y + HUNDRED_R + 6, '#ffd23f', 'center');
  }
  // Rampa.
  const grad = g.createLinearGradient(0, LANE.rampY - 14, 0, LANE.rampY + 10);
  grad.addColorStop(0, '#3a2a18');
  grad.addColorStop(1, '#c89a5a');
  g.fillStyle = grad;
  g.fillRect(LANE.left, LANE.rampY - 14, LANE.right - LANE.left, 24);
  // Pista de madera con flechas guía.
  g.fillStyle = '#b8864a';
  g.fillRect(LANE.left, LANE.rampY + 10, LANE.right - LANE.left, LANE.h - LANE.rampY - 30);
  g.fillStyle = 'rgba(80,40,10,0.35)';
  for (let x = LANE.left + 14; x < LANE.right; x += 14) g.fillRect(x, LANE.rampY + 10, 1, LANE.h - LANE.rampY - 30);
  g.fillStyle = '#ff3d6e';
  for (let i = 0; i < 5; i++) {
    const x = LANE.left + 22 + i * 30, y = 420;
    g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 7, y + 4); g.lineTo(x - 7, y + 4); g.fill();
  }
  // Bandas laterales.
  g.fillStyle = '#ff3d8b';
  g.fillRect(LANE.left - 10, LANE.rampY, 10, LANE.h - LANE.rampY);
  g.fillRect(LANE.right, LANE.rampY, 10, LANE.h - LANE.rampY);
}

function ball(g, b) {
  const r = 7 * b.scale;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.arc(b.x + 2, b.y + 3, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c4122e';
  g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.3, 0, Math.PI * 2); g.fill();
}

function hud(g, game, view) {
  g.fillStyle = 'rgba(5,5,10,0.9)';
  g.fillRect(0, LANE.h - 20, LANE.w, 20);
  text.draw(g, 'PUNTOS ' + game.scoreText, 8, LANE.h - 14, '#ffd23f');
  text.draw(g, 'BOLAS ' + game.ballsLeft, 216, LANE.h - 14, '#ffffff', 'right');
  if (view && view.best) text.draw(g, 'RÉCORD ' + Math.max(view.best, game.score), 112, LANE.rampY + 18, '#5a3a18', 'center');
}

export function renderSkee(g, game, view) {
  board(g);
  // Bolas restantes en la canaleta.
  for (let i = 0; i < game.ballsLeft - (game.phase === 'AIM' ? 1 : 0); i++) ball(g, { x: 14, y: LANE.h - 30 - i * 16, scale: 0.8 });
  const b = game.ball;
  if (game.phase !== 'GAME_OVER' && game.phase !== 'SCORED') ball(g, b);
  if (game.phase === 'AIM') {
    // Línea de puntería y barra de fuerza.
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.setLineDash([4, 6]);
    g.beginPath(); g.moveTo(game.aim, LANE.startY - 10); g.lineTo(game.aim, LANE.rampY + 20); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(5,5,10,0.8)';
    g.fillRect(204, 300, 14, 200);
    const h = 196 * game.power;
    g.fillStyle = game.power > 0.75 ? '#ff3b3b' : game.power > 0.4 ? '#ffd23f' : '#3dff8b';
    g.fillRect(206, 498 - h, 10, h);
    if (!game.charging && Math.floor(game.frame / 30) % 2 === 0) text.draw(g, 'MANTÉN ESPACIO', 112, 470, '#ffffff', 'center');
  }
  if (game.phase === 'SCORED') {
    const L = game.landing;
    ball(g, { x: L.x, y: L.y, scale: 0.7 });
    g.fillStyle = 'rgba(5,5,10,0.85)';
    g.fillRect(52, 300, 120, 44);
    text.draw(g, '+' + game.lastPts, 112, 308, game.lastPts === 100 ? '#ffd23f' : '#ffffff', 'center', 3);
  }
  if (game.phase === 'GAME_OVER') {
    g.fillStyle = 'rgba(5,5,10,0.85)';
    g.fillRect(28, 300, 168, 60);
    text.draw(g, 'FIN', 112, 308, '#ff3b3b', 'center', 2);
    text.draw(g, game.score + ' PUNTOS', 112, 336, '#ffd23f', 'center');
  }
  hud(g, game, view);
}

export function renderSkeeTitle(g, view) {
  const frame = view.frame || 0;
  board(g);
  g.fillStyle = 'rgba(5,5,10,0.88)';
  g.fillRect(16, 260, 192, 260);
  text.draw(g, 'SKEE', 112, 276, '#ffd23f', 'center', 3);
  text.draw(g, 'BALL', 112, 304, '#ff3d6e', 'center', 3);
  text.draw(g, BALLS + ' BOLAS POR PARTIDA', 112, 344, '#ffffff', 'center');
  text.draw(g, 'ANILLOS 10-50', 112, 360, '#ffffff', 'center');
  text.draw(g, 'ESQUINAS: 100', 112, 374, '#ffd23f', 'center');
  text.draw(g, 'TICKET POR 10 PTS', 112, 396, '#3dff8b', 'center');
  text.draw(g, 'RÉCORD ' + (view.best || 0), 112, 418, '#c8ccd6', 'center');
  if (Math.floor(frame / 30) % 2 === 0) text.draw(g, 'PULSA ENTER', 112, 446, '#33e6ff', 'center');
  text.draw(g, 'FLECHAS: APUNTAR', 112, 472, '#7a86c8', 'center');
  text.draw(g, 'ESPACIO: FUERZA', 112, 486, '#7a86c8', 'center');
}
