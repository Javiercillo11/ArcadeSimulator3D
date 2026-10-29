/* Logros: se desbloquean una vez por jugador y avisan a la interfaz. */
import * as users from './users.js';

export const ACHIEVEMENTS = [
  { id: 'first', name: 'PRIMERA PARTIDA', desc: 'JUEGA A CUALQUIER MÁQUINA' },
  { id: 'allGames', name: 'TURISTA', desc: 'JUEGA A LAS 5 MÁQUINAS' },
  { id: 'chain4', name: 'COMILÓN', desc: 'COME LOS 4 ENEMIGOS CON UNA SUPERPÍLDORA' },
  { id: 'rescue', name: 'AL RESCATE', desc: 'RESCATA A LUNA' },
  { id: 'hammer', name: 'MARTILLAZO', desc: 'ROMPE UN BARRIL CON EL MARTILLO' },
  { id: 'brickLevel', name: 'ROMPEMUROS', desc: 'SUPERA UN NIVEL DE BRICK BLAST' },
  { id: 'skee100', name: 'PLENO', desc: 'METE UNA BOLA EN EL 100' },
  { id: 'hockeyWin', name: 'GOLEADOR', desc: 'GANA AL AIR HOCKEY' },
  { id: 'top10', name: 'FAMOSO', desc: 'ENTRA EN UN TOP 10' },
  { id: 'champion', name: 'CAMPEÓN', desc: 'CONSIGUE EL PRIMER PUESTO DE UN TOP 10' },
  { id: 'claw', name: 'GANCHO DE ORO', desc: 'GANA UN PELUCHE EN LA GRÚA' },
  { id: 'prize', name: 'COLECCIONISTA', desc: 'CANJEA UN PREMIO EN RECEPCIÓN' },
  { id: 'jukebox', name: 'MELÓMANO', desc: 'ELIGE UNA CANCIÓN EN LA GRAMOLA' },
  { id: 'soda', name: 'REFRESCANTE', desc: 'COMPRA UN REFRESCO' }
];

const listeners = [];
export function onUnlock(fn) { listeners.push(fn); }

// Desbloquea un logro del jugador activo. Devuelve true si es nuevo.
export function award(id) {
  const u = users.active();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!u || !a || !users.unlock(u.id, id)) return false;
  for (const fn of listeners) fn(a);
  return true;
}

export function has(id) {
  const u = users.active();
  return !!(u && u.achievements[id]);
}
