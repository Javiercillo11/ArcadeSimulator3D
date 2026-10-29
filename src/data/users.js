/* Alta, selección y borrado de jugadores (máximo 5, sin duplicados). */
import { storage as S, save, emptyRecord, NAME_RE, MAX_USERS } from './storage.js';

function newId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function normalize(name) {
  return String(name == null ? '' : name).trim().toUpperCase();
}

// Devuelve null si es válido o un código de error.
export function validateName(name) {
  const n = normalize(name);
  if (n.length === 0) return 'EMPTY';
  if (n.length > 10) return 'TOO_LONG';
  if (!NAME_RE.test(n)) return 'INVALID';
  return null;
}

export function list() { return S.data.users; }

export function findByName(name) {
  const n = normalize(name);
  return S.data.users.find((u) => u.name === n) || null;
}

export function get(id) {
  return S.data.users.find((u) => u.id === id) || null;
}

export function isFull() { return S.data.users.length >= MAX_USERS; }

// { ok: true, user } | { ok: false, error, user? }
export function create(name) {
  const err = validateName(name);
  if (err) return { ok: false, error: err };
  const existing = findByName(name);
  if (existing) return { ok: false, error: 'DUPLICATE', user: existing };
  if (isFull()) return { ok: false, error: 'LIMIT' };
  const user = {
    id: newId(),
    name: normalize(name),
    createdAt: new Date().toISOString(),
    records: { maze: emptyRecord(), climb: emptyRecord() },
    history: []
  };
  S.data.users.push(user);
  S.data.activeUserId = user.id;
  save();
  return { ok: true, user };
}

export function select(id) {
  if (!get(id)) return false;
  S.data.activeUserId = id;
  save();
  return true;
}

export function active() {
  return S.data.activeUserId ? get(S.data.activeUserId) : null;
}

export function remove(id) {
  const i = S.data.users.findIndex((u) => u.id === id);
  if (i < 0) return false;
  S.data.users.splice(i, 1);
  if (S.data.activeUserId === id) S.data.activeUserId = null;
  save();
  return true;
}

export const ERROR_TEXT = {
  EMPTY: 'ESCRIBE UN NOMBRE',
  TOO_LONG: 'MÁXIMO 10 CARACTERES',
  INVALID: 'SOLO LETRAS, NÚMEROS, ESPACIO . - _',
  DUPLICATE: 'ESE NOMBRE YA EXISTE',
  LIMIT: 'LÍMITE DE 5 JUGADORES'
};
