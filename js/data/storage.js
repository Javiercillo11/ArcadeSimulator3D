/* Persistencia en localStorage con versión de esquema, validación, copia de seguridad y modo memoria. */
(function (A) {
  'use strict';

  var KEY = 'arcade.v1';
  var BACKUP_KEY = 'arcade.backup';
  var SCHEMA_VERSION = 1;
  var GAMES = ['maze', 'climb'];
  var MAX_USERS = 5;
  var MAX_HISTORY = 20;
  var NAME_RE = /^[A-Z0-9ÑÁÉÍÓÚÜÇ _.\-]{1,10}$/;

  var storage = {
    KEY: KEY,
    BACKUP_KEY: BACKUP_KEY,
    GAMES: GAMES,
    MAX_USERS: MAX_USERS,
    MAX_HISTORY: MAX_HISTORY,
    NAME_RE: NAME_RE,
    mode: 'local',        // 'local' | 'memory'
    repaired: false,      // true si al cargar hubo que recuperar datos
    data: null
  };

  function emptyRecord() { return { best: 0, date: null, level: 0 }; }

  function emptyData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeUserId: null,
      users: [],
      settings: { muted: false, crt: true }
    };
  }

  function isIsoDate(v) {
    return typeof v === 'string' && !isNaN(Date.parse(v));
  }

  function toInt(v) {
    var n = Math.floor(Number(v));
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function lsAvailable() {
    try {
      var k = '__arcade_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sanitizeRecord(r) {
    if (!r || typeof r !== 'object') return { value: emptyRecord(), ok: false };
    var out = {
      best: toInt(r.best),
      date: isIsoDate(r.date) ? r.date : null,
      level: toInt(r.level)
    };
    var ok = out.best === r.best && out.date === r.date && out.level === r.level;
    return { value: out, ok: ok };
  }

  function sanitizeHistory(list) {
    if (!Array.isArray(list)) return { value: [], ok: false };
    var out = [];
    var ok = true;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h && GAMES.indexOf(h.game) >= 0 && isIsoDate(h.date)) {
        out.push({ game: h.game, score: toInt(h.score), level: toInt(h.level), date: h.date });
      } else {
        ok = false;
      }
    }
    // Máximo 20 por juego: conserva las más recientes (al final).
    for (var g = 0; g < GAMES.length; g++) {
      var count = 0;
      for (var j = out.length - 1; j >= 0; j--) {
        if (out[j].game !== GAMES[g]) continue;
        count++;
        if (count > MAX_HISTORY) { out.splice(j, 1); ok = false; }
      }
    }
    return { value: out, ok: ok };
  }

  // Valida y repara: nunca descarta todo, recupera lo que sea válido.
  function validate(raw) {
    var data = emptyData();
    var ok = true;
    if (!raw || typeof raw !== 'object') return { data: data, ok: false };

    raw = migrate(raw);
    if (raw.schemaVersion !== SCHEMA_VERSION) ok = false;

    var seen = {};
    var users = Array.isArray(raw.users) ? raw.users : [];
    if (!Array.isArray(raw.users)) ok = false;
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (!u || typeof u !== 'object' || typeof u.id !== 'string' || typeof u.name !== 'string') { ok = false; continue; }
      var name = u.name.trim().toUpperCase();
      if (!NAME_RE.test(name) || seen[name] || data.users.length >= MAX_USERS) { ok = false; continue; }
      if (name !== u.name) ok = false;
      seen[name] = true;
      var user = {
        id: u.id,
        name: name,
        createdAt: isIsoDate(u.createdAt) ? u.createdAt : new Date().toISOString(),
        records: {},
        history: []
      };
      if (!isIsoDate(u.createdAt)) ok = false;
      var recs = u.records && typeof u.records === 'object' ? u.records : {};
      for (var g = 0; g < GAMES.length; g++) {
        var r = sanitizeRecord(recs[GAMES[g]]);
        user.records[GAMES[g]] = r.value;
        if (!r.ok) ok = false;
      }
      var h = sanitizeHistory(u.history);
      user.history = h.value;
      if (!h.ok) ok = false;
      data.users.push(user);
    }

    var active = raw.activeUserId;
    data.activeUserId = null;
    for (var k = 0; k < data.users.length; k++) {
      if (data.users[k].id === active) data.activeUserId = active;
    }
    if (active !== data.activeUserId) ok = false;

    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    data.settings.muted = s.muted === true;
    data.settings.crt = s.crt !== false;
    if (typeof s.muted !== 'boolean' || typeof s.crt !== 'boolean') ok = false;

    return { data: data, ok: ok };
  }

  // Migraciones entre versiones de esquema (v0 = datos sin schemaVersion).
  function migrate(raw) {
    if (raw.schemaVersion === undefined || raw.schemaVersion === 0) {
      var copy = JSON.parse(JSON.stringify(raw));
      copy.schemaVersion = SCHEMA_VERSION;
      return copy;
    }
    return raw;
  }

  storage.validate = validate;
  storage.emptyData = emptyData;
  storage.emptyRecord = emptyRecord;

  storage.load = function () {
    storage.repaired = false;
    if (!lsAvailable()) {
      storage.mode = 'memory';
      storage.data = emptyData();
      return storage.data;
    }
    storage.mode = 'local';
    var text = null;
    try { text = window.localStorage.getItem(KEY); } catch (e) { text = null; }
    if (text === null) {
      storage.data = emptyData();
      return storage.data;
    }
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    var result = validate(parsed);
    if (!result.ok) {
      // Copia de seguridad del contenido original antes de reparar.
      try { window.localStorage.setItem(BACKUP_KEY, text); } catch (e) { /* sin espacio */ }
      storage.repaired = true;
      storage.data = result.data;
      storage.save();
    } else {
      storage.data = result.data;
    }
    return storage.data;
  };

  storage.save = function () {
    if (storage.mode !== 'local') return false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(storage.data));
      return true;
    } catch (e) {
      storage.mode = 'memory';
      return false;
    }
  };

  storage.exportJSON = function () {
    return JSON.stringify(storage.data, null, 2);
  };

  // Devuelve true si el JSON se pudo importar (con reparación si hacía falta).
  storage.importJSON = function (text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return false; }
    if (!parsed || !Array.isArray(parsed.users)) return false;
    storage.data = validate(parsed).data;
    storage.save();
    return true;
  };

  A.data = A.data || {};
  A.data.storage = storage;
})(window.Arcade = window.Arcade || {});
