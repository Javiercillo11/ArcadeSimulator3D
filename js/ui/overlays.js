/* Overlays: pausa, fin de partida, nuevo récord y controles. Incluye utilidades DOM comunes de la interfaz. */
(function (A) {
  'use strict';

  var ui = A.ui = A.ui || {};

  // Crea un elemento: el('button', { class: 'btn', text: 'OK', onclick: fn }, [hijos]).
  ui.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'text') e.textContent = v;
        else if (k === 'class') e.className = v;
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) for (var i = 0; i < children.length; i++) if (children[i]) e.appendChild(children[i]);
    return e;
  };

  // Mueve el foco entre los elementos navegables visibles de un contenedor.
  ui.navigate = function (container, delta) {
    var items = Array.prototype.filter.call(
      container.querySelectorAll('[data-nav]:not([disabled])'),
      function (n) { return n.offsetParent !== null; }
    );
    if (!items.length) return;
    var i = items.indexOf(document.activeElement);
    var next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : (i + delta + items.length) % items.length;
    items[next].focus();
    if (A.core.audio) A.core.audio.play('menuMove');
  };

  ui.focusFirst = function (container) {
    var first = container.querySelector('[data-nav]:not([disabled])');
    if (first) first.focus();
  };

  var toastTimer = 0;
  ui.toast = function (msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, ms || 3200);
  };

  // ---------------------------------------------------------------- overlays

  var root;
  var box;
  var el = ui.el;

  var overlays = { current: null };

  overlays.init = function () {
    root = document.getElementById('overlay');
    box = document.getElementById('overlay-box');
  };

  function show(kind, children) {
    overlays.current = kind;
    box.textContent = '';
    for (var i = 0; i < children.length; i++) if (children[i]) box.appendChild(children[i]);
    root.hidden = false;
    root.setAttribute('data-kind', kind);
    ui.focusFirst(root);
  }

  overlays.hide = function () {
    overlays.current = null;
    root.hidden = true;
    box.textContent = '';
  };

  overlays.root = function () { return root; };
  overlays.isOpen = function () { return !root.hidden; };

  overlays.showPause = function (handlers) {
    show('pause', [
      el('h2', { class: 'overlay-title', id: 'overlay-title', text: 'PAUSA' }),
      el('div', { class: 'overlay-actions' }, [
        el('button', { type: 'button', class: 'btn btn-primary', 'data-nav': true, 'data-testid': 'pause-resume', text: 'REANUDAR', onclick: handlers.resume }),
        el('button', { type: 'button', class: 'btn', 'data-nav': true, 'data-testid': 'pause-restart', text: 'REINICIAR', onclick: handlers.restart }),
        el('button', { type: 'button', class: 'btn', 'data-nav': true, 'data-testid': 'pause-menu', text: 'VOLVER AL MENÚ', onclick: handlers.menu })
      ]),
      el('p', { class: 'overlay-sub', text: 'ESC / P PARA SEGUIR' })
    ]);
  };

  // info: { game, score, level, best, previous, isRecord }
  overlays.showGameOver = function (info, handlers) {
    show(info.isRecord ? 'record' : 'gameover', [
      el('h2', { class: 'overlay-title', id: 'overlay-title', text: 'FIN DE PARTIDA' }),
      el('p', { class: 'overlay-sub', text: info.gameName + ' · NIVEL ' + info.level }),
      info.isRecord ? el('p', { class: 'record-banner', 'data-testid': 'new-record', text: '¡NUEVO RÉCORD!' }) : null,
      el('p', { class: 'overlay-score', 'data-testid': 'final-score', text: String(info.score) }),
      el('p', { class: 'overlay-line' }, [
        document.createTextNode(info.isRecord ? 'ANTERIOR ' : 'TU RÉCORD '),
        el('b', { text: String(info.isRecord ? info.previous : info.best) })
      ]),
      el('div', { class: 'overlay-actions' }, [
        el('button', { type: 'button', class: 'btn btn-primary', 'data-nav': true, 'data-testid': 'over-retry', text: 'JUGAR OTRA VEZ', onclick: handlers.retry }),
        el('button', { type: 'button', class: 'btn', 'data-nav': true, 'data-testid': 'over-menu', text: 'MENÚ', onclick: handlers.menu })
      ])
    ]);
  };

  overlays.showControls = function (onClose) {
    var rows = [
      ['MOVER / SUBIR', 'FLECHAS · WASD', 'CRUCETA'],
      ['SALTAR', 'ESPACIO', 'BOTÓN A'],
      ['PAUSA', 'ESC · P', '❚❚'],
      ['CONFIRMAR', 'ENTER', 'TOCAR'],
      ['SILENCIO', 'M', 'ALTAVOZ']
    ];
    var body = [];
    for (var i = 0; i < rows.length; i++) {
      body.push(el('tr', null, [el('td', { text: rows[i][0] }), el('td', { text: rows[i][1] }), el('td', { text: rows[i][2] })]));
    }
    show('controls', [
      el('h2', { class: 'overlay-title', id: 'overlay-title', text: 'CONTROLES' }),
      el('table', { class: 'controls-table' }, [
        el('thead', null, [el('tr', null, [el('th', { text: 'ACCIÓN' }), el('th', { text: 'TECLADO' }), el('th', { text: 'TÁCTIL' })])]),
        el('tbody', null, body)
      ]),
      el('button', { type: 'button', class: 'btn btn-primary', 'data-nav': true, text: 'ENTENDIDO', onclick: onClose })
    ]);
  };

  ui.overlays = overlays;
})(window.Arcade = window.Arcade || {});
