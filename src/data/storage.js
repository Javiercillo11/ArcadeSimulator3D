/* Persistencia en localStorage con versión de esquema, validación, copia de seguridad y modo memoria. */

export const KEY = 'arcade.v1';
export const BACKUP_KEY = 'arcade.backup';
export const SCHEMA_VERSION = 4;
export const GAMES = ['maze', 'climb', 'brick', 'skee', 'hockey'];
export const MAX_USERS = 5;
export const MAX_HISTORY = 20;
export const NAME_RE = /^[A-Z0-9ÑÁÉÍÓÚÜÇ _.\-]{1,10}$/;
export const START_COINS = 3;
export const MAX_COINS = 30;
export const HOF_SIZE = 10;
export const INITIALS_RE = /^[A-Z0-9 .]{3}$/;
export const MAX_TICKETS = 99999;
export const MAX_PRIZES = 40;
const ID_RE = /^[a-z][a-zA-Z0-9]{1,30}$/;
const TRACKS = [null, 'neon', 'funk', 'road'];
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
  return { muted: false, crt: true, quality: 'high', mouseSens: 1, jukebox: null };
}

// Tabla inicial de cada máquina, como las que traían de fábrica las recreativas: puntuaciones del salón.
const HOUSE = {
  maze: [['SAL', 10000], ['PIX', 8000], ['ARC', 6000], ['NEO', 5000], ['CPU', 4000], ['JOY', 3000], ['BIT', 2000], ['MAX', 1500], ['ZAP', 1000], ['ACE', 500]],
  climb: [['SAL', 10000], ['GRG', 8000], ['LUN', 6000], ['PIP', 5000], ['RAY', 4000], ['KID', 3000], ['TOP', 2000], ['HIT', 1500], ['BAM', 1000], ['ACE', 500]],
  brick: [['SAL', 15000], ['BOX', 12000], ['WAL', 9000], ['PAD', 7000], ['BAL', 5000], ['ZIG', 4000], ['ROW', 3000], ['TNT', 2000], ['POP', 1500], ['ACE', 1000]],
  skee: [['SAL', 450], ['RNG', 400], ['ROL', 350], ['HOP', 300], ['BOW', 270], ['TIK', 240], ['LUK', 210], ['ZAP', 180], ['NEO', 150], ['ACE', 100]],
  hockey: [['SAL', 9000], ['ICE', 8000], ['GOL', 7000], ['PUK', 6000], ['ZAM', 5000], ['RAY', 4000], ['FLY', 3000], ['BIT', 2500], ['MAX', 2000], ['ACE', 1000]]
};

export function houseScores(game) {
  return HOUSE[game].map(([initials, score]) => ({ initials, score, level: 1, date: null, userId: null }));
}

export function emptyHallOfFame() {
  const out = {};
  for (const g of GAMES) out[g] = houseScores(g);
  return out;
}

// Iniciales por defecto a partir del nombre: tres caracteres válidos, sin acentos, rellenos con espacios.
export function defaultInitials(name) {
  const clean = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 .]/g, '');
  return (clean + '   ').slice(0, 3);
}

export function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeUserId: null,
    users: [],
    hallOfFame: emptyHallOfFame(),
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
  if (TRACKS.includes(s.jukebox)) out.jukebox = s.jukebox; else ok = false;
  return { value: out, ok };
}

function sanitizeHallOfFame(hof) {
  const out = {};
  let ok = true;
  if (!hof || typeof hof !== 'object') return { value: emptyHallOfFame(), ok: false };
  for (const g of GAMES) {
    const list = Array.isArray(hof[g]) ? hof[g] : null;
    if (!list) { out[g] = houseScores(g); ok = false; continue; }
    const clean = [];
    for (const e of list) {
      if (!e || typeof e !== 'object' || typeof e.initials !== 'string' || !INITIALS_RE.test(e.initials) || toInt(e.score) !== e.score) { ok = false; continue; }
      clean.push({
        initials: e.initials,
        score: e.score,
        level: toInt(e.level),
        date: isIsoDate(e.date) ? e.date : null,
        userId: typeof e.userId === 'string' ? e.userId : null
      });
    }
    clean.sort((a, b) => b.score - a.score);
    if (clean.length > HOF_SIZE) { clean.length = HOF_SIZE; ok = false; }
    out[g] = clean;
  }
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
  if (v === 2) {
    // v3: monedas e iniciales por jugador, y tabla TOP 10 por máquina con los récords que ya había.
    const users = Array.isArray(copy.users) ? copy.users : [];
    const hof = emptyHallOfFame();
    for (const u of users) {
      if (!u || typeof u !== 'object') continue;
      if (u.coins === undefined) u.coins = START_COINS;
      if (u.initials === undefined) u.initials = defaultInitials(u.name);
      for (const g of GAMES) {
        const r = u.records && u.records[g];
        if (r && r.best > 0) hof[g].push({ initials: u.initials, score: r.best, level: r.level || 1, date: r.date || null, userId: u.id });
      }
    }
    for (const g of GAMES) {
      hof[g].sort((a, b) => b.score - a.score);
      hof[g].length = Math.min(hof[g].length, HOF_SIZE);
    }
    copy.hallOfFame = hof;
    v = 3;
  }
  if (v === 3) {
    // v4: tres juegos nuevos (récords y TOP 10), tickets, premios, logros y la canción de la gramola.
    const users = Array.isArray(copy.users) ? copy.users : [];
    for (const u of users) {
      if (!u || typeof u !== 'object') continue;
      if (!u.records || typeof u.records !== 'object') u.records = {};
      for (const g of ['brick', 'skee', 'hockey']) if (!u.records[g]) u.records[g] = emptyRecord();
      if (u.tickets === undefined) u.tickets = 0;
      if (u.prizes === undefined) u.prizes = [];
      if (u.achievements === undefined) u.achievements = {};
    }
    if (!copy.hallOfFame || typeof copy.hallOfFame !== 'object') copy.hallOfFame = {};
    for (const g of ['brick', 'skee', 'hockey']) if (!copy.hallOfFame[g]) copy.hallOfFame[g] = houseScores(g);
    if (copy.settings && typeof copy.settings === 'object' && copy.settings.jukebox === undefined) copy.settings.jukebox = null;
    v = 4;
  }
  copy.schemaVersion = v;
  return copy;
}

// Valida y repara: nunca descarta todo, recupera lo que sea válido.
export function validate(raw) {
  const data = emptyData();
  let ok = true;
  if (!raw || typeof raw !== 'object') return { data, ok: false };

  const known = raw.schemaVersion === undefined || [0, 1, 2, 3, 4].includes(raw.schemaVersion);
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
      history: [],
      coins: START_COINS,
      initials: defaultInitials(name),
      tickets: 0,
      prizes: [],
      achievements: {}
    };
    if (!isIsoDate(u.createdAt)) ok = false;
    if (Number.isInteger(u.coins) && u.coins >= 0 && u.coins <= MAX_COINS) user.coins = u.coins; else ok = false;
    if (typeof u.initials === 'string' && INITIALS_RE.test(u.initials)) user.initials = u.initials; else ok = false;
    if (Number.isInteger(u.tickets) && u.tickets >= 0 && u.tickets <= MAX_TICKETS) user.tickets = u.tickets; else ok = false;
    if (Array.isArray(u.prizes) && u.prizes.every((p) => typeof p === 'string' && ID_RE.test(p)) && u.prizes.length <= MAX_PRIZES) user.prizes = u.prizes.slice();
    else ok = false;
    if (u.achievements && typeof u.achievements === 'object' && !Array.isArray(u.achievements)) {
      for (const k in u.achievements) {
        if (ID_RE.test(k) && isIsoDate(u.achievements[k])) user.achievements[k] = u.achievements[k]; else ok = false;
      }
    } else ok = false;
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

  const hof = sanitizeHallOfFame(raw.hallOfFame);
  data.hallOfFame = hof.value;
  if (!hof.ok) ok = false;

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
