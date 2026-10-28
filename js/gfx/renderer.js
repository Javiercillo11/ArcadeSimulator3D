/* Canvas a resolución nativa 224×288, escalado sin suavizado. */
(function (A) {
  'use strict';

  var W = 224;
  var H = 288;

  var renderer = { W: W, H: H, canvas: null, g: null, scale: 1 };

  renderer.init = function (canvas, screenEl, slotEl, bezelEl) {
    renderer.canvas = canvas;
    renderer.bezel = bezelEl;
    renderer.screen = screenEl;
    renderer.slot = slotEl;
    canvas.width = W;
    canvas.height = H;
    renderer.g = canvas.getContext('2d', { alpha: false });
    renderer.g.imageSmoothingEnabled = false;
    renderer.fit();
    window.addEventListener('resize', renderer.fit);
  };

  function snap(s) {
    var whole = Math.floor(s);
    if (whole >= 2 && whole / s >= 0.9) return whole;
    return s > 0 ? s : 1;
  }

  // Escala: entera si apenas se pierde espacio (≥90 %); si no, fraccionaria para llenar el monitor.
  // Dos montajes:
  //  - mueble CSS: la pantalla mide lo mismo que el canvas y el bisel la rodea;
  //  - mueble imagen (--screen-fill: 1): la pantalla ocupa el hueco apaisado de la imagen
  //    y el canvas vertical se centra dentro; los menús usan todo el hueco.
  renderer.fit = function () {
    var slot = renderer.slot;
    var screen = renderer.screen;
    var canvas = renderer.canvas;
    if (!slot) return;
    var fill = getComputedStyle(screen).getPropertyValue('--screen-fill').trim() === '1';
    var s, w, h, pu;
    if (fill) {
      screen.style.width = '';
      screen.style.height = '';
      var fw = screen.clientWidth;
      var fh = screen.clientHeight;
      s = snap(Math.min(fw / W, fh / H));
      w = Math.floor(W * s);
      h = Math.floor(H * s);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      pu = Math.min(fw / 236, fh / 192);
    } else {
      // Grosor de bisel + marco naranja, medido en el DOM (no fijo en código).
      var bz = renderer.bezel;
      var chromeW = bz ? bz.offsetWidth - screen.offsetWidth : 0;
      var chromeH = bz ? bz.offsetHeight - screen.offsetHeight : 0;
      s = snap(Math.min((slot.clientWidth - chromeW) / W, (slot.clientHeight - chromeH) / H));
      w = Math.floor(W * s);
      h = Math.floor(H * s);
      canvas.style.width = '';
      canvas.style.height = '';
      screen.style.width = w + 'px';
      screen.style.height = h + 'px';
      pu = w / W;
    }
    renderer.scale = s;
    renderer.fill = fill;
    var root = document.documentElement.style;
    root.setProperty('--u', (w / W).toFixed(4) + 'px');
    root.setProperty('--pu', pu.toFixed(4) + 'px');
  };

  renderer.clear = function (color) {
    var g = renderer.g;
    g.fillStyle = color || '#000';
    g.fillRect(0, 0, W, H);
  };

  A.gfx = A.gfx || {};
  A.gfx.renderer = renderer;
})(window.Arcade = window.Arcade || {});
