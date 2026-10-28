/* Bucle de paso fijo (60 Hz) sobre un único requestAnimationFrame. */
(function (A) {
  'use strict';

  var STEP_MS = 1000 / 60;
  var MAX_FRAME_MS = 250;       // límite al volver de segundo plano
  var MAX_STEPS = 15;

  var loop = {
    STEP_MS: STEP_MS,
    activeLoops: 0,             // cadenas de rAF vivas: debe ser 0 o 1
    pending: 0,                 // callbacks de rAF solicitados y aún no ejecutados
    maxPending: 0,
    manual: false,              // modo prueba: solo avanza con step()
    running: false,
    totalSteps: 0
  };

  var updateFn = null;
  var renderFn = null;
  var rafId = 0;
  var last = -1;
  var acc = { value: 0 };

  // Reparte un delta en pasos fijos. Compartido por el bucle real y simulate().
  function accumulate(state, deltaMs, onStep) {
    if (deltaMs > MAX_FRAME_MS) deltaMs = MAX_FRAME_MS;
    if (deltaMs < 0) deltaMs = 0;
    state.value += deltaMs;
    var n = 0;
    while (state.value >= STEP_MS) {
      state.value -= STEP_MS;
      if (onStep) onStep();
      n++;
      if (n >= MAX_STEPS) { state.value = 0; break; }
    }
    return n;
  }

  function doStep() {
    loop.totalSteps++;
    if (updateFn) updateFn(STEP_MS / 1000);
  }

  function request() {
    loop.pending++;
    if (loop.pending > loop.maxPending) loop.maxPending = loop.pending;
    rafId = requestAnimationFrame(tick);
  }

  function tick(ts) {
    loop.pending--;
    if (!loop.running) return;
    request();
    if (last < 0) last = ts;
    var delta = ts - last;
    last = ts;
    if (!loop.manual) accumulate(acc, delta, doStep);
    if (renderFn) renderFn();
  }

  loop.setHandlers = function (update, render) {
    updateFn = update;
    renderFn = render;
  };

  loop.start = function () {
    if (loop.running) return;
    loop.running = true;
    loop.activeLoops++;
    last = -1;
    acc.value = 0;
    request();
  };

  loop.stop = function () {
    if (!loop.running) return;
    cancelAnimationFrame(rafId);
    loop.pending--;
    rafId = 0;
    loop.running = false;
    loop.activeLoops--;
  };

  // Avanza n pasos de forma síncrona (ganchos de prueba).
  loop.step = function (n) {
    for (var i = 0; i < n; i++) doStep();
    if (renderFn) renderFn();
  };

  // Cuenta los pasos que produciría una pantalla a frameMs durante totalMs.
  loop.simulate = function (frameMs, totalMs) {
    var state = { value: 0 };
    var steps = 0;
    for (var t = 0; t + frameMs <= totalMs + 1e-6; t += frameMs) {
      steps += accumulate(state, frameMs, null);
    }
    return steps;
  };

  document.addEventListener('visibilitychange', function () {
    last = -1;
  });

  A.core = A.core || {};
  A.core.loop = loop;
})(window.Arcade = window.Arcade || {});
