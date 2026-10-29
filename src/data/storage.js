/* Persistencia en localStorage con versión de esquema, validación, copia de seguridad y modo memoria. */

export const KEY = 'arcade.v1';
export const BACKUP_KEY = 'arcade.backup';
export const SCHEMA_VERSION = 2;
export const GAMES = ['maze', 'climb'];
export const MAX_USERS = 5;
export const MAX_HISTORY = 20;
export const NAME_RE = /^[A-Z0-9ÑÁÉÍÓÚÜÇ _.\-]{1,10}$/;
const QUALITIES = ['high', 'low'];
const SENS_MIN = 0.2;
const SENS_MAX = 3;

export const storage = {
  mode: 'local',        // 'local' | 'memory'
  repaired: false,      // true si al cargar hubo que recuperar datos
  migrated: false,      // true si al cargar se subió de versión de esquema
  data: null,
  backend: null         // por defecto window.localStorage; las pruebas pueden inyectar otro
};

export function emptyRecord() { return { best: 0, date: null, level: 0 }; }

export function defaultSettings() {
  return { muted: false, crt: true, quality: 'high', mouseSens: 1 };
}

export function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeUserId: null,
    users: [],
    settings: defaultSettings()
  };
}

function isIsoDate(v) {
  return typeof v === 'string' && !isNaN(Date.parse(v));
}

function toInt(v) {
  const n = Math.floor(Number(v));
  return isFinite(n) && n >= 0 ? n : 0;
}

function backend() {
  if (storage.backend) return storage.backend;
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch (e) { return null; }
}

function lsAvailable() {
  const ls = backend();
  if (!ls) return false;
  try {
    const k = '__arcade_probe__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

function sanitizeRecord(r) {
  if (!r || typeof r !== 'object') return { value: emptyRecord(), ok: false };
  const out = {
    best: toInt(r.best),
    date: isIsoDate(r.date) ? r.date : null,
    level: toInt(r.level)
  };
  const ok = out.best === r.best && out.date === r.date && out.level === r.level;
  return { value: out, ok };
}

function sanitizeHistory(list) {
  if (!Array.isArray(list)) return { value: [], ok: false };
  const out = [];
  let ok = true;
  for (const h of list) {
    if (h && GAMES.includes(h.game) && isIsoDate(h.date)) {
      out.push({ game: h.game, score: toInt(h.score), level: toInt(h.level), date: h.date });
    } else {
      ok = false;
    }
  }
  // Máximo 20 por juego: conserva las más recientes (al final).
  for (const g of GAMES) {
    let count = 0;
    for (let j = out.length - 1; j >= 0; j--) {
      if (out[j].game !== g) continue;
      count++;
      if (count > MAX_HISTORY) { out.splice(j, 1); ok = false; }
    }
  }
  return { value: out, ok };
}

function sanitizeSettings(s) {
  const out = defaultSettings();
  let ok = true;
  if (!s || typeof s !== 'object') return { value: out, ok: false };
  if (typeof s.muted === 'boolean') out.muted = s.muted; else ok = false;
  if (typeof s.crt === 'boolean') out.crt = s.crt; else ok = false;
  if (QUALITIES.includes(s.quality)) out.quality = s.quality; else ok = false;
  if (typeof s.mouseSens === 'number' && s.mouseSens >= SENS_MIN && s.mouseSens <= SENS_MAX) out.mouseSens = s.mouseSens;
  else ok = false;
  return { value: out, ok };
}

// Migraciones entre versiones de esquema. v0 = datos sin schemaVersion.
// Devuelve una copia; nunca modifica el original.
export function migrate(raw) {
  const copy = JSON.parse(JSON.stringify(raw));
  let v = copy.schemaVersion === undefined ? 0 : copy.schemaVersion;
  if (v === 0) v = 1;
  if (v === 1) {
    // v2: ajustes de la sala 3D (calidad gráfica y sensibilidad del ratón).
    const s = copy.settings && typeof copy.settings === 'object' ? copy.settings : {};
    copy.settings = Object.assign({ muted: false, crt: true }, s, { quality: 'high', mouseSens: 1 });
    v = 2;
  }
  copy.schemaVersion = v;
  return copy;
}

// Valida y repara: nunca descarta todo, recupera lo que sea válido.
export function validate(raw) {
  const data = emptyData();
  let ok = true;
  if (!raw || typeof raw !== 'object') return { data, ok: false };

  const known = raw.schemaVersion === undefined || [0, 1, 2].includes(raw.schemaVersion);
  if (!known) ok = false;
  raw = known ? migrate(raw) : raw;

  const seen = {};
  const users = Array.isArray(raw.users) ? raw.users : [];
  if (!Array.isArray(raw.users)) ok = false;
  for (const u of users) {
    if (!u || typeof u !== 'object' || typeof u.id !== 'string' || typeof u.name !== 'string') { ok = false; continue; }
    const name = u.name.trim().toUpperCase();
    if (!NAME_RE.test(name) || seen[name] || data.users.length >= MAX_USERS) { ok = false; continue; }
    if (name !== u.name) ok = false;
    seen[name] = true;
    const user = {
      id: u.id,
      name,
      createdAt: isIsoDate(u.createdAt) ? u.createdAt : new Date().toISOString(),
      records: {},
      history: []
    };
    if (!isIsoDate(u.createdAt)) ok = false;
    const recs = u.records && typeof u.records === 'object' ? u.records : {};
    for (const g of GAMES) {
      const r = sanitizeRecord(recs[g]);
      user.records[g] = r.value;
      if (!r.ok) ok = false;
    }
    const h = sanitizeHistory(u.history);
    user.history = h.value;
    if (!h.ok) ok = false;
    data.users.push(user);
  }

  const active = raw.activeUserId;
  data.activeUserId = data.users.some((u) => u.id === active) ? active : null;
  if (active !== data.activeUserId) ok = false;

  const s = sanitizeSettings(raw.settings);
  data.settings = s.value;
  if (!s.ok) ok = false;

  return { data, ok };
}

export function load() {
  storage.repaired = false;
  storage.migrated = false;
  if (!lsAvailable()) {
    storage.mode = 'memory';
    storage.data = emptyData();
    return storage.data;
  }
  storage.mode = 'local';
  const ls = backend();
  let text = null;
  try { text = ls.getItem(KEY); } catch (e) { text = null; }
  if (text === null) {
    storage.data = emptyData();
    return storage.data;
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
  const result = validate(parsed);
  storage.data = result.data;
  if (!result.ok) {
    // Copia de seguridad del contenido original antes de reparar.
    try { ls.setItem(BACKUP_KEY, text); } catch (e) { /* sin espacio */ }
    storage.repaired = true;
    save();
  } else if (parsed.schemaVersion !== SCHEMA_VERSION) {
    storage.migrated = true;
    save();
  }
  return storage.data;
}

export function save() {
  if (storage.mode !== 'local') return false;
  try {
    backend().setItem(KEY, JSON.stringify(storage.data));
    return true;
  } catch (e) {
    storage.mode = 'memory';
    return false;
  }
}

export function exportJSON() {
  return JSON.stringify(storage.data, null, 2);
}

// Devuelve true si el JSON se pudo importar (con reparación si hacía falta).
export function importJSON(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return false; }
  if (!parsed || !Array.isArray(parsed.users)) return false;
  storage.data = validate(parsed).data;
  save();
  return true;
}
