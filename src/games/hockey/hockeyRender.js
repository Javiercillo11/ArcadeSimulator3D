/* AIR HOCKEY: dibujo de la mesa (224×400) vista desde arriba: líneas, porterías, mazos, disco y marcador. */
import { TABLE, PUCK_R, MALLET_R, WIN_GOALS } from './HockeyGame.js';
import { text } from '../../gfx/text.js';

function surface(g) {
  const grad = g.createLinearGradient(0, 0, 0, TABLE.h);
  grad.addColorStop(0, '#d8f2ff');
  grad.addColorStop(0.5, '#f4fbff');
  grad.addColorStop(1, '#d8f2ff');
  g.fillStyle = '#1b1b2e';
  g.fillRect(0, 0, TABLE.w, TABLE.h);
  g.fillStyle = grad;
  g.fillRect(TABLE.rail, TABLE.rail, TABLE.w - TABLE.rail * 2, TABLE.h - TABLE.rail * 2);
  // Agujeros del aire.
  g.fillStyle = 'rgba(40,80,120,0.18)';
  for (let y = 16; y < TABLE.h - 10; y += 12) for (let x = 16; x < TABLE.w - 10; x += 12) g.fillRect(x, y, 1, 1);
  // Línea central y círculos.
  g.strokeStyle = '#ff3d6e';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(TABLE.rail, TABLE.h / 2); g.lineTo(TABLE.w - TABLE.rail, TABLE.h / 2);
  g.stroke();
  g.beginPath();
  g.arc(112, TABLE.h / 2, 34, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#3d8bff';
  g.lineWidth = 2;
  for (const y of [TABLE.rail, TABLE.h - TABLE.rail]) {
    g.beginPath();
    g.arc(112, y, 48, 0, Math.PI * 2);
    g.stroke();
  }
  // Porterías: hueco oscuro en la banda.
  g.fillStyle = '#05050a';
  g.fillRect(TABLE.goalL, 0, TABLE.goalR - TABLE.goalL, TABLE.rail);
  g.fillRect(TABLE.goalL, TABLE.h - TABLE.rail, TABLE.goalR - TABLE.goalL, TABLE.rail);
}

function mallet(g, m, color, dark) {
  const x = Math.round(m.x), y = Math.round(m.y);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.arc(x + 2, y + 3, MALLET_R, 0, Math.PI * 2); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.arc(x, y, MALLET_R, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, MALLET_R - 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath(); g.arc(x - 3, y - 3, 2, 0, Math.PI * 2); g.fill();
}

function scoreboard(g, game, view) {
  // Marcador pintado en las bandas: máquina arriba, jugador abajo.
  g.fillStyle = 'rgba(5,5,10,0.85)';
  g.fillRect(8, TABLE.h / 2 - 34, 44, 68);
  text.draw(g, 'CPU', 30, TABLE.h / 2 - 30, '#33e6ff', 'center');
  text.draw(g, String(game.goals.cpu), 30, TABLE.h / 2 - 18, '#33e6ff', 'center', 2);
  text.draw(g, String(game.goals.player), 30, TABLE.h / 2 + 2, '#ff3d8b', 'center', 2);
  text.draw(g, (view.userName || 'TÚ').slice(0, 4), 30, TABLE.h / 2 + 22, '#ff3d8b', 'center');
  g.fillStyle = 'rgba(5,5,10,0.85)';
  g.fillRect(172, TABLE.h / 2 - 18, 44, 36);
  text.draw(g, 'A ' + WIN_GOALS, 194, TABLE.h / 2 - 12, '#ffd23f', 'center');
  text.draw(g, 'GOLES', 194, TABLE.h / 2 + 2, '#ffd23f', 'center');
}

export function renderHockey(g, game, view) {
  surface(g);
  scoreboard(g, game, view);
  mallet(g, game.cpu, '#33e6ff', '#0b5a78');
  mallet(g, game.player, '#ff3d8b', '#8a0d3e');
  const p = game.puck;
  if (game.phase !== 'GOAL') {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(p.x + 2, p.y + 2, PUCK_R, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1a1a';
    g.beginPath(); g.arc(p.x, p.y, PUCK_R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 2;
    g.beginPath(); g.arc(p.x, p.y, PUCK_R - 3, 0, Math.PI * 2); g.stroke();
  }
  const mid = TABLE.h / 2;
  if (game.phase === 'READY') text.draw(g, '¡YA!', 112, game.puck.y > mid ? mid + 60 : mid - 70, '#ff3d6e', 'center', 2);
  if (game.phase === 'GOAL') {
    const mine = game.lastGoal === 'player';
    g.fillStyle = 'rgba(5,5,10,0.8)';
    g.fillRect(40, mid - 40, 144, 80);
    text.draw(g, mine ? '¡GOL!' : 'GOL CPU', 112, mid - 26, mine ? '#ffd23f' : '#33e6ff', 'center', 2);
    text.draw(g, game.goals.player + ' - ' + game.goals.cpu, 112, mid + 6, '#ffffff', 'center', 2);
  }
  if (game.phase === 'GAME_OVER') {
    g.fillStyle = 'rgba(5,5,10,0.85)';
    g.fillRect(24, mid - 40, 176, 80);
    text.draw(g, game.won ? '¡GANAS!' : 'GANA LA CPU', 112, mid - 26, game.won ? '#ffd23f' : '#ff3b3b', 'center', 2);
    text.draw(g, game.goals.player + ' - ' + game.goals.cpu, 112, mid + 6, '#ffffff', 'center', 2);
  }
}

export function renderHockeyTitle(g, view) {
  const frame = view.frame || 0;
  surface(g);
  g.fillStyle = 'rgba(5,5,10,0.85)';
  g.fillRect(16, 70, 192, 260);
  text.draw(g, 'AIR', 112, 86, '#33e6ff', 'center', 3);
  text.draw(g, 'HOCKEY', 112, 114, '#ff3d8b', 'center', 3);
  text.draw(g, 'GANA QUIEN LLEGUE', 112, 160, '#ffffff', 'center');
  text.draw(g, 'A ' + WIN_GOALS + ' GOLES', 112, 174, '#ffffff', 'center');
  text.draw(g, 'GOL: 500 PTS', 112, 200, '#ffd23f', 'center');
  text.draw(g, 'VICTORIA: +3000', 112, 214, '#ffd23f', 'center');
  text.draw(g, 'RÉCORD ' + (view.best || 0), 112, 240, '#c8ccd6', 'center');
  if (Math.floor(frame / 30) % 2 === 0) text.draw(g, 'PULSA ENTER', 112, 270, '#33e6ff', 'center');
  text.draw(g, 'FLECHAS: MOVER MAZO', 112, 300, '#7a86c8', 'center');
}
