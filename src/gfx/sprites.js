/* Decodificador de sprites definidos como matrices de caracteres + paleta. */
var cache = {};
var flipped = {};    // caché aparte: evita concatenar cadenas en cada fotograma

function makeCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// rows: array de strings; palette: { char: '#color' }. '.' o ' ' = transparente.
function decode(rows, palette, flip) {
  var h = rows.length;
  var w = rows[0].length;
  var c = makeCanvas(w, h);
  var g = c.getContext('2d');
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var ch = rows[y].charAt(flip ? w - 1 - x : x);
      var col = palette[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export const sprites = {};

sprites.define = function (name, rows, palette) {
  cache[name] = decode(rows, palette, false);
  flipped[name] = decode(rows, palette, true);
  return cache[name];
};

sprites.get = function (name, flip) {
  return flip ? flipped[name] : cache[name];
};

sprites.has = function (name) { return !!cache[name]; };

// Dibuja centrado en (x, y) con píxeles enteros.
sprites.draw = function (g, name, x, y, flip) {
  var s = flip ? flipped[name] : cache[name];
  if (!s) return;
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
};

// Dibuja con la esquina inferior centrada en (x, y): útil para personajes de plataformas.
sprites.drawFeet = function (g, name, x, y, flip) {
  var s = flip ? flipped[name] : cache[name];
  if (!s) return;
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
};

sprites.makeCanvas = makeCanvas;
