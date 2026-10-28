/* Récords por jugador y juego, e historial de partidas. */
(function (A) {
  'use strict';

  var S = A.data.storage;

  var scores = {};

  scores.GAME_NAMES = { maze: 'MAZE MUNCHER', climb: 'BARREL CLIMB' };

  scores.record = function (userId, game) {
    var u = A.data.users.get(userId);
    return u ? u.records[game] : null;
  };

  // Registra una partida. El récord solo cambia si se supera.
  scores.submit = function (userId, game, score, level) {
    var u = A.data.users.get(userId);
    if (!u || S.GAMES.indexOf(game) < 0) return { isRecord: false, best: 0, previous: 0 };
    score = Math.max(0, Math.floor(score));
    var now = new Date().toISOString();
    var rec = u.records[game];
    var previous = rec.best;
    var isRecord = score > previous;
    if (isRecord) {
      rec.best = score;
      rec.date = now;
      rec.level = level;
    }
    u.history.push({ game: game, score: score, level: level, date: now });
    var count = 0;
    for (var i = u.history.length - 1; i >= 0; i--) {
      if (u.history[i].game !== game) continue;
      count++;
      if (count > S.MAX_HISTORY) u.history.splice(i, 1);
    }
    S.save();
    return { isRecord: isRecord, best: rec.best, previous: previous };
  };

  // Mejor puntuación de cualquier jugador en un juego (para el marcador HIGH).
  scores.globalBest = function (game) {
    var best = 0;
    var list = S.data.users;
    for (var i = 0; i < list.length; i++) best = Math.max(best, list[i].records[game].best);
    return best;
  };

  scores.formatDate = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    function two(n) { return n < 10 ? '0' + n : String(n); }
    return two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2);
  };

  A.data.scores = scores;
})(window.Arcade = window.Arcade || {});
