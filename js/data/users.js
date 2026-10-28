/* Alta, selección y borrado de jugadores (máximo 5, sin duplicados). */
(function (A) {
  'use strict';

  var S = A.data.storage;

  function newId() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var users = {};

  users.normalize = function (name) {
    return String(name == null ? '' : name).trim().toUpperCase();
  };

  // Devuelve null si es válido o un código de error.
  users.validateName = function (name) {
    var n = users.normalize(name);
    if (n.length === 0) return 'EMPTY';
    if (n.length > 10) return 'TOO_LONG';
    if (!S.NAME_RE.test(n)) return 'INVALID';
    return null;
  };

  users.list = function () { return S.data.users; };

  users.findByName = function (name) {
    var n = users.normalize(name);
    var list = S.data.users;
    for (var i = 0; i < list.length; i++) if (list[i].name === n) return list[i];
    return null;
  };

  users.get = function (id) {
    var list = S.data.users;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  users.isFull = function () { return S.data.users.length >= S.MAX_USERS; };

  // { ok: true, user } | { ok: false, error, user? }
  users.create = function (name) {
    var err = users.validateName(name);
    if (err) return { ok: false, error: err };
    var existing = users.findByName(name);
    if (existing) return { ok: false, error: 'DUPLICATE', user: existing };
    if (users.isFull()) return { ok: false, error: 'LIMIT' };
    var user = {
      id: newId(),
      name: users.normalize(name),
      createdAt: new Date().toISOString(),
      records: { maze: S.emptyRecord(), climb: S.emptyRecord() },
      history: []
    };
    S.data.users.push(user);
    S.data.activeUserId = user.id;
    S.save();
    return { ok: true, user: user };
  };

  users.select = function (id) {
    if (!users.get(id)) return false;
    S.data.activeUserId = id;
    S.save();
    return true;
  };

  users.active = function () {
    return S.data.activeUserId ? users.get(S.data.activeUserId) : null;
  };

  users.remove = function (id) {
    var list = S.data.users;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        if (S.data.activeUserId === id) S.data.activeUserId = null;
        S.save();
        return true;
      }
    }
    return false;
  };

  A.data.users = users;
})(window.Arcade = window.Arcade || {});
