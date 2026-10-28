/* Texto bitmap en canvas: atlas de glifos 8×8 generado a partir de la fuente incrustada. */
(function (A) {
  'use strict';

  var CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
              '¡¿ÁÉÍÓÚÑÜ©×';
  var CELL = 8;
  var COLS = 16;

  var index = {};
  var atlas = null;
  var tinted = {};
  var ready = false;

  function buildAtlas() {
    var rows = Math.ceil(CHARS.length / COLS);
    var c = A.gfx.sprites.makeCanvas(COLS * CELL, rows * CELL);
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.textBaseline = 'top';
    g.font = '8px ArcadeFont, monospace';
    for (var i = 0; i < CHARS.length; i++) {
      var cx = (i % COLS) * CELL;
      var cy = Math.floor(i / COLS) * CELL;
      g.fillText(CHARS.charAt(i), cx, cy);
      index[CHARS.charAt(i)] = i;
    }
    // Umbral: píxeles duros, sin antialiasing.
    var img = g.getImageData(0, 0, c.width, c.height);
    var d = img.data;
    for (var p = 0; p < d.length; p += 4) {
      var on = d[p + 3] > 100;
      d[p] = d[p + 1] = d[p + 2] = 255;
      d[p + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function tint(color) {
    var t = tinted[color];
    if (t) return t;
    t = A.gfx.sprites.makeCanvas(atlas.width, atlas.height);
    var g = t.getContext('2d');
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, t.width, t.height);
    tinted[color] = t;
    return t;
  }

  var text = { CELL: CELL };

  text.init = function () {
    atlas = buildAtlas();
    tinted = {};
    ready = true;
  };

  text.width = function (str) { return String(str).length * CELL; };

  // align: 'left' | 'center' | 'right'. (x, y) = esquina superior. scale: entero opcional.
  text.draw = function (g, str, x, y, color, align, scale) {
    if (!ready) return;
    str = String(str);
    var s = scale || 1;
    var size = CELL * s;
    var img = tint(color || '#fff');
    var w = str.length * size;
    if (align === 'center') x -= w / 2;
    else if (align === 'right') x -= w;
    x = Math.round(x);
    y = Math.round(y);
    for (var i = 0; i < str.length; i++) {
      var k = index[str.charAt(i)];
      if (k === undefined) k = index['?'];
      if (k === 0) continue;
      g.drawImage(img, (k % COLS) * CELL, Math.floor(k / COLS) * CELL, CELL, CELL, x + i * size, y, size, size);
    }
  };

  // Número con relleno a la izquierda sin crear cadenas intermedias innecesarias.
  text.pad = function (n, len) {
    var s = String(n);
    while (s.length < len) s = ' ' + s;
    return s;
  };

  A.gfx = A.gfx || {};
  A.gfx.text = text;
})(window.Arcade = window.Arcade || {});
