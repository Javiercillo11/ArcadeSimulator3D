/* Sprites propios de MAZE MUNCHER, generados como matrices de píxeles. */
import { sprites as S } from '../../gfx/sprites.js';
var built = false;

// Genera filas de texto evaluando fn(x, y) → carácter de paleta.
function grid(w, h, fn) {
  var rows = [];
  for (var y = 0; y < h; y++) {
    var r = '';
    for (var x = 0; x < w; x++) r += fn(x, y) || '.';
    rows.push(r);
  }
  return rows;
}

// Munchy: bola dorada con contorno, ojo y boca en cuña (mira a la derecha).
function muncher(mouth) {
  return grid(13, 13, function (x, y) {
    var dx = x - 6;
    var dy = y - 6;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 6.3) return '.';
    var a = Math.atan2(dy, dx);
    if (mouth > 0 && d > 0.6 && Math.abs(a) < mouth) return '.';
    if (dx >= 0 && dx <= 1 && dy >= -4 && dy <= -3) return (dx === 1 && dy === -3) ? 'p' : 'e';
    if (d > 5.3) return 'k';
    return 'y';
  });
}
var MUNCH_PAL = { y: '#ffc93c', k: '#d9771e', e: '#ffffff', p: '#1b1b3a' };

// Spook: cúpula con dos antenas y tentáculos; los ojos se dibujan aparte.
function spook(frame, pal) {
  return grid(14, 14, function (x, y) {
    if (y === 0) return (x === 2 || x === 11) ? 'a' : '.';
    if (y === 1) return (x === 3 || x === 10) ? 'a' : '.';
    if (y <= 7) {
      var dx = x - 6.5;
      var dy = y - 7.5;
      return (dx * dx + dy * dy <= 6.6 * 6.6) ? 'b' : '.';
    }
    if (y <= 11) return 'b';
    var patA = ['bb.bbb..bbb.bb', 'b...bb..bb...b'];
    var patB = ['.bbb.bbbb.bbb.', '.b...b..b...b.'];
    var pat = frame ? patB : patA;
    return pat[y - 12].charAt(x) === 'b' ? 'b' : '.';
  });
}

function addFace(rows, faceChar) {
  // Cara del modo vulnerable: ojitos y boca en zigzag.
  var out = rows.slice();
  function put(x, y) { out[y] = out[y].substr(0, x) + faceChar + out[y].substr(x + 1); }
  put(4, 5); put(5, 5); put(4, 6); put(5, 6);
  put(8, 5); put(9, 5); put(8, 6); put(9, 6);
  var zig = [[2, 10], [3, 9], [4, 9], [5, 10], [6, 9], [7, 9], [8, 10], [9, 9], [10, 9], [11, 10]];
  for (var i = 0; i < zig.length; i++) put(zig[i][0], zig[i][1]);
  return out;
}

function circleFruit(main, shade, stem) {
  return grid(12, 12, function (x, y) {
    if (y <= 2) {
      if (x === 6 && y >= 1) return 's';
      if (y === 1 && (x === 7 || x === 8)) return 'l';
      if (y === 0 && x === 8) return 'l';
      return '.';
    }
    var dx = x - 5.5;
    var dy = y - 7;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 4.8) return '.';
    if (dx < -1 && dx > -3 && dy < -1 && dy > -3) return 'w';
    return d > 3.8 ? 'd' : 'm';
  });
}

var FRUITS = [
  { name: 'fruit0', rows: [ // bayas
    '.......ll...',
    '......l.l...',
    '.....l...l..',
    '....l....l..',
    '...l.....l..',
    '..mmm...mmm.',
    '.mwmmm.mwmmm',
    '.mmmmm.mmmmm',
    '.mmmmd.mmmmd',
    '..mmd...mmd.',
    '............',
    '............'], pal: { m: '#ff3355', d: '#b0103a', w: '#ffd0d8', l: '#4fd45a' } },
  { name: 'fruit1', rows: [ // fresa
    '....llll....',
    '...llllll...',
    '..mmmmmmmm..',
    '.mmwmmmmwmm.',
    '.mmmmmwmmmm.',
    '.mwmmmmmmwm.',
    '..mmmwmmmm..',
    '..mmmmmmwm..',
    '...mmwmmm...',
    '....mmmm....',
    '.....mm.....',
    '............'], pal: { m: '#ff2a4d', w: '#ffe2a0', l: '#4fd45a' } },
  { name: 'fruit2', fn: function () { return circleFruit(); }, pal: { m: '#ff9a1f', d: '#d0650a', w: '#ffe0b0', s: '#7a4a1a', l: '#4fd45a' } },
  { name: 'fruit3', fn: function () { return circleFruit(); }, pal: { m: '#3ddc5a', d: '#1d9a3a', w: '#d8ffd0', s: '#7a4a1a', l: '#a6ff5a' } },
  { name: 'fruit4', rows: [ // uvas
    '.....ss.....',
    '......s.....',
    '..mm.mm.mm..',
    '.mwmmwmmwmm.',
    '.mmmmmmmmmm.',
    '..mmmmmmmm..',
    '...mwmmwm...',
    '...mmmmmm...',
    '....mwmm....',
    '....mmmm....',
    '.....mm.....',
    '............'], pal: { m: '#b44dff', w: '#ecd0ff', s: '#7a4a1a' } },
  { name: 'fruit5', rows: [ // estrella
    '.....mm.....',
    '.....mm.....',
    '....mwmm....',
    'mmmmmwmmmmmm',
    '.mmmmmmmmmm.',
    '..mmmmmmmm..',
    '...mmmmmm...',
    '..mmmmmmmm..',
    '..mmm..mmm..',
    '.mmm....mmm.',
    '.mm......mm.',
    '............'], pal: { m: '#ffe14d', w: '#ffffff' } }
];

var sprites = {
  FRUIT_COUNT: FRUITS.length,
  GHOST_COLORS: ['#ff3b3b', '#ff8ad8', '#33e6ff', '#ffa133'],
  GHOST_NAMES: ['RUSTY', 'PETAL', 'FROST', 'AMBER']
};

sprites.build = function () {
  if (built) return;
  built = true;
  S.define('munch0', muncher(0.12), MUNCH_PAL);
  S.define('munch1', muncher(0.5), MUNCH_PAL);
  S.define('munch2', muncher(0.9), MUNCH_PAL);
  for (var i = 0; i < 11; i++) {
    S.define('munchDie' + i, muncher(0.9 + i * 0.23), MUNCH_PAL);
  }
  for (var g = 0; g < 4; g++) {
    var pal = { b: sprites.GHOST_COLORS[g], a: sprites.GHOST_COLORS[g] };
    S.define('spook' + g + '_0', spook(0), pal);
    S.define('spook' + g + '_1', spook(1), pal);
  }
  for (var f = 0; f < 2; f++) {
    S.define('scared_' + f, addFace(spook(f), 'f'), { b: '#2a36ff', a: '#2a36ff', f: '#ffc0a8' });
    S.define('scaredFlash_' + f, addFace(spook(f), 'f'), { b: '#f4f4ff', a: '#f4f4ff', f: '#ff2a2a' });
  }
  for (var k = 0; k < FRUITS.length; k++) {
    var fr = FRUITS[k];
    S.define(fr.name, fr.rows || fr.fn(), fr.pal);
  }
  S.define('power', grid(8, 8, function (x, y) {
    var dx = x - 3.5;
    var dy = y - 3.5;
    return dx * dx + dy * dy <= 12.5 ? 'p' : '.';
  }), { p: '#ffd6a8' });
};

export default sprites;
