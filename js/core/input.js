/* Entrada unificada: teclado + controles táctiles. Detección de flanco y buffer de dirección. */
(function (A) {
  'use strict';

  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump',
    Enter: 'start', NumpadEnter: 'start',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute'
  };
  var ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'start', 'pause', 'mute'];
  var DIRS = { up: 1, down: 1, left: 1, right: 1 };

  var down = {};
  var pressed = {};
  var listeners = [];
  var input = {
    down: down,
    pressed: pressed,
    lastDir: null,       // buffer: última dirección pulsada
    enabled: true
  };

  function reset() {
    for (var i = 0; i < ACTIONS.length; i++) {
      down[ACTIONS[i]] = false;
      pressed[ACTIONS[i]] = false;
    }
  }
  reset();

  function isTextField(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }

  function isControl(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    return t === 'BUTTON' || t === 'A' || isTextField(el);
  }

  // source: 'key' | 'virtual'
  function press(action, source) {
    if (!down[action]) {
      pressed[action] = true;
      if (DIRS[action]) input.lastDir = action;
    }
    down[action] = true;
    for (var i = 0; i < listeners.length; i++) listeners[i](action, source || 'key');
  }

  function release(action) {
    down[action] = false;
  }

  window.addEventListener('keydown', function (e) {
    if (isTextField(e.target)) return;
    var action = KEYMAP[e.code];
    if (!action) return;
    var isArrow = e.code.indexOf('Arrow') === 0;
    // Flechas nunca desplazan la página; espacio/Enter solo si no hay un control enfocado.
    if (isArrow || (!isControl(e.target) && (e.code === 'Space' || action === 'start'))) {
      e.preventDefault();
    }
    if (e.repeat) return;
    press(action, 'key');
  });

  window.addEventListener('keyup', function (e) {
    var action = KEYMAP[e.code];
    if (action) release(action);
  });

  window.addEventListener('blur', function () {
    for (var i = 0; i < ACTIONS.length; i++) down[ACTIONS[i]] = false;
  });

  // Controles táctiles / ratón: cualquier elemento con data-action.
  input.bindVirtual = function (el) {
    var action = el.getAttribute('data-action');
    function on(e) {
      e.preventDefault();
      if (el.setPointerCapture && e.pointerId !== undefined) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      }
      el.classList.add('is-down');
      press(action, 'virtual');
    }
    function off() {
      el.classList.remove('is-down');
      release(action);
    }
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  // Escucha inmediata (fuera del bucle) para pausa, silencio y navegación.
  input.on = function (fn) { listeners.push(fn); };

  // Llamar al final de cada paso fijo: los flancos solo duran un paso.
  input.endStep = function () {
    for (var i = 0; i < ACTIONS.length; i++) pressed[ACTIONS[i]] = false;
  };

  input.clear = function () {
    reset();
    input.lastDir = null;
  };

  input.press = press;
  input.release = release;

  A.core = A.core || {};
  A.core.input = input;
})(window.Arcade = window.Arcade || {});
