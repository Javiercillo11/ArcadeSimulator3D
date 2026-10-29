/* Récords por jugador y juego, e historial de partidas. */
import { storage as S, save, GAMES, MAX_HISTORY, HOF_SIZE } from './storage.js';
import { get } from './users.js';

export const GAME_NAMES = { maze: 'MAZE MUNCHER', climb: 'BARREL CLIMB', brick: 'BRICK BLAST', skee: 'SKEE-BALL', hockey: 'AIR HOCKEY' };

const listeners = [];
export function onChange(fn) { listeners.push(fn); }

export function record(userId, game) {
  const u = get(userId);
  return u ? u.records[game] : null;
}

// Registra una partida. El récord solo cambia si se supera.
export function submit(userId, game, score, level) {
  const u = get(userId);
  if (!u || !GAMES.includes(game)) return { isRecord: false, best: 0, previous: 0 };
  score = Math.max(0, Math.floor(score));
  const now = new Date().toISOString();
  const rec = u.records[game];
  const previous = rec.best;
  const isRecord = score > previous;
  if (isRecord) {
    rec.best = score;
    rec.date = now;
    rec.level = level;
  }
  u.history.push({ game, score, level, date: now });
  let count = 0;
  for (let i = u.history.length - 1; i >= 0; i--) {
    if (u.history[i].game !== game) continue;
    count++;
    if (count > MAX_HISTORY) u.history.splice(i, 1);
  }
  save();
  for (const fn of listeners) fn(game);
  return { isRecord, best: rec.best, previous };
}

// Mejor puntuación de cualquier jugador en un juego (para el marcador HIGH).
export function globalBest(game) {
  let best = 0;
  for (const u of S.data.users) best = Math.max(best, u.records[game].best);
  return best;
}

// Tabla ordenada de un juego: [{ name, best, level, date }] de mayor a menor.
export function table(game) {
  return S.data.users
    .map((u) => ({ id: u.id, name: u.name, best: u.records[game].best, level: u.records[game].level, date: u.records[game].date }))
    .sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------ TOP 10 por máquina (con iniciales)

export function hallOfFame(game) {
  return S.data.hallOfFame[game];
}

// ¿Entra esta puntuación en el TOP 10? (con empate no desplaza a la que ya estaba)
export function qualifies(game, score) {
  const list = S.data.hallOfFame[game];
  if (!list || score <= 0) return false;
  return list.length < HOF_SIZE || score > list[list.length - 1].score;
}

// Añade una entrada { initials, score, level, userId } y devuelve su puesto (0 = primero), o -1 si no entra.
export function addHighScore(game, entry) {
  if (!qualifies(game, entry.score)) return -1;
  const list = S.data.hallOfFame[game];
  const item = { initials: entry.initials, score: entry.score, level: entry.level || 1, date: new Date().toISOString(), userId: entry.userId || null };
  let i = list.findIndex((e) => entry.score > e.score);
  if (i < 0) i = list.length;
  list.splice(i, 0, item);
  if (list.length > HOF_SIZE) list.length = HOF_SIZE;
  save();
  for (const fn of listeners) fn(game);
  return i;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const two = (n) => (n < 10 ? '0' + n : String(n));
  return two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
}
