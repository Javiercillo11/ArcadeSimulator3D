/* Sprites propios de BARREL CLIMB: PIP (héroe), GROG (antagonista), LUNA (a rescatar), barriles y llamas. */
import { sprites as S } from '../../gfx/sprites.js';
var built = false;

function grid(w, h, fn) {
  var rows = [];
  for (var y = 0; y < h; y++) {
    var r = '';
    for (var x = 0; x < w; x++) r += fn(x, y) || '.';
    rows.push(r);
  }
  return rows;
}

var PIP_PAL = { h: '#39d353', s: '#ffcc99', o: '#ff8c1a', d: '#3a1d08', w: '#ffffff', b: '#4a4a7a' };
var PIP_TOP = [
  '....hhhh....',
  '...hhhhhhh..',
  '..hhhhhhhhhh',
  '...sssds....',
  '...ssssss...',
  '....ssss....'
];
var PIP_STAND = PIP_TOP.concat([
  '...oooooo...',
  '..oooooooo..',
  '.ssoooooooss',
  '.s.oowwoo.s.',
  '...oooooo...',
  '...oooooo...',
  '...oo..oo...',
  '...oo..oo...',
  '..bbb..bbb..',
  '..bbb..bbbb.'
]);
var PIP_WALK1 = PIP_TOP.concat([
  '...oooooo...',
  '..oooooooo..',
  '.soooooooos.',
  '...oowwoo...',
  '...oooooo...',
  '...oooooo...',
  '..oo....oo..',
  '.oo......oo.',
  '.bb.....bbb.',
  'bbb......bb.'
]);
var PIP_WALK2 = PIP_TOP.concat([
  '...oooooo...',
  '..oooooooo..',
  '..sooooooos.',
  '...oowwoo...',
  '...oooooo...',
  '...oooooo...',
  '....oooo....',
  '....ooo.....',
  '...bbbbb....',
  '...bbbbbb...'
]);
var PIP_JUMP = PIP_TOP.concat([
  '.s.oooooo.s.',
  '.soooooooos.',
  '..oooooooo..',
  '...oowwoo...',
  '...oooooo...',
  '...oooooo...',
  '..oo....oo..',
  '.oo......oo.',
  '.bb......bb.',
  '............'
]);
var PIP_CLIMB = [
  '....hhhh....',
  '...hhhhhh...',
  '...hhhhhh...',
  '...hhhhhh...',
  's...ssss....',
  'so.oooooo...',
  '.ooooooooo.s',
  '..oooooooooo',
  '...oooooo...',
  '...oowwoo...',
  '...oooooo...',
  '...oo..oo...',
  '...oo..oo...',
  '...bb..oo...',
  '..bbb..bb...',
  '.......bbb..'
];
var PIP_MINI = [
  '..hhh..',
  '.hhhhh.',
  '..sss..',
  '.ooooo.',
  'sooooos',
  '..ooo..',
  '.oo.oo.',
  '.bb.bb.'
];

var GROG_PAL = { h: '#e6e6f0', p: '#9b4dff', d: '#5a1f9a', e: '#ffe14d', m: '#2a0a3a', t: '#ffffff', c: '#c79bff' };
var GROG_IDLE = [
  '...hh..............hh...',
  '...hhh............hhh...',
  '....hhpppppppppppphh....',
  '.....pppppppppppppp.....',
  '....pppppppppppppppp....',
  '....ppeeeppppppeeepp....',
  '....ppemeppppppemepp....',
  '....pppppppppppppppp....',
  '....ppmmmmmmmmmmmmpp....',
  '....ppmtmtmtmtmtmtpp....',
  '.....pppppppppppppp.....',
  '..dddppppppppppppppddd..',
  '.ddppppccccccccccppppdd.',
  'ddpppppccccccccccpppppdd',
  'ddpp.ppccccccccccpp.ppdd',
  'ddpp.ppccccccccccpp.ppdd',
  'ddd..pppppppppppppp..ddd',
  'dd...pppppppppppppp...dd',
  '.....pppppppppppppp.....',
  '.....pppppp..pppppp.....',
  '.....ppppp....ppppp.....',
  '.....ppppp....ppppp.....',
  '....dddddd....dddddd....',
  '....dddddd....dddddd....'
];

// Pose de lanzamiento: brazos arriba.
function grogThrow() {
  var rows = GROG_IDLE.slice();
  function set(y, x, ch) { rows[y] = rows[y].substr(0, x) + ch + rows[y].substr(x + 1); }
  for (var y = 11; y <= 17; y++) {
    for (var x = 0; x < 24; x++) if (x < 5 || x > 18) set(y, x, '.');
  }
  for (var y2 = 0; y2 <= 11; y2++) {
    set(y2, 0, 'd'); set(y2, 1, 'd'); set(y2, 22, 'd'); set(y2, 23, 'd');
  }
  set(11, 2, 'd'); set(11, 3, 'd'); set(11, 4, 'd'); set(11, 19, 'd'); set(11, 20, 'd'); set(11, 21, 'd');
  return rows;
}

var LUNA_PAL = { a: '#ff3366', k: '#4a5070', g: '#c8d0e0', e: '#33e6ff', p: '#ff8ad8' };
var LUNA_TOP = [
  '.....a......',
  '.....k......',
  '...gggggg...',
  '..gggggggg..',
  '..gkeggkeg..',
  '..gggggggg..',
  '..gkkkkkkg..',
  '...gggggg...'
];
var LUNA_A = LUNA_TOP.concat([
  '....pppp....',
  '..gppppppg..',
  '.g.pppppp.g.',
  '...pppppp...',
  '..pppppppp..',
  '..pppppppp..',
  '...kk..kk...',
  '...kk..kk...'
]);
var LUNA_B = LUNA_TOP.concat([
  'g...pppp...g',
  '.g.pppppp.g.',
  '...pppppp...',
  '...pppppp...',
  '..pppppppp..',
  '..pppppppp..',
  '...kk..kk...',
  '...kk..kk...'
]);

function barrel(angle, light, dark) {
  return grid(10, 10, function (x, y) {
    var dx = x - 4.5;
    var dy = y - 4.5;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 4.9) return '.';
    if (d > 4.0) return 'd';
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    var band = Math.abs(dx * s - dy * c);
    if (band < 0.8) return 'd';
    if (Math.abs(dx * c + dy * s) < 0.8 && d < 2.5) return 'd';
    return 'b';
  });
}

var FLAME_A = [
  '....r.....',
  '...rr..r..',
  '..rror.rr.',
  '..roorrro.',
  '.rooyyoor.',
  '.royyyyor.',
  'royeyyeyor',
  'royyyyyyor',
  'rooyyyyoor',
  '.roooooor.',
  '..rrrrrr..'
];
var FLAME_B = [
  '.....r....',
  '..r..rr...',
  '.rr.rorr..',
  '.orrroor..',
  '.rooyyoor.',
  '.royyyyor.',
  'royeyyeyor',
  'royyyyyyor',
  'rooyyyyoor',
  '.roooooor.',
  '..rrrrrr..'
];
var FLAME_PAL = { r: '#ff3355', o: '#ff8c1a', y: '#ffe14d', e: '#1b1b3a' };

var HAMMER = [
  'mmmmmmmm',
  'mwmmmmmm',
  'mmmmmmmm',
  '...hh...',
  '...hh...',
  '...hh...',
  '...hh...',
  '...hh...',
  '...hh...',
  '...hh...'
];
var HAMMER_PAL = { m: '#b8c0d8', w: '#ffffff', h: '#c8742c' };

var OIL = [
  '.cccccccccccccc.',
  'cwwwwwwwwwwwwwwc',
  'cccccccccccccccc',
  'cbbbbbbbbbbbbbbc',
  'cbbbbbbbbbbbbbbc',
  'cbwwbwbbwbbbwwbc',
  'cbwbbwbbwbbbwbbc',
  'cbwbbwbbwbbbwwbc',
  'cbwbbwbbwbbbbwbc',
  'cbwwbwbbwwbbwwbc',
  'cbbbbbbbbbbbbbbc',
  'cccccccccccccccc',
  'cwwwwwwwwwwwwwwc',
  'cbbbbbbbbbbbbbbc',
  'cbbbbbbbbbbbbbbc',
  '.cccccccccccccc.'
];
var OIL_PAL = { c: '#1b3d99', b: '#3c7dff', w: '#d8e4ff' };

var HEART = [
  '.rr...rr.',
  'rrrr.rrrr',
  'rwrrrrrrr',
  'rrrrrrrrr',
  '.rrrrrrr.',
  '..rrrrr..',
  '...rrr...',
  '....r....'
];

var sprites = {};

sprites.build = function () {
  if (built) return;
  built = true;
  S.define('pipStand', PIP_STAND, PIP_PAL);
  S.define('pipWalk1', PIP_WALK1, PIP_PAL);
  S.define('pipWalk2', PIP_WALK2, PIP_PAL);
  S.define('pipJump', PIP_JUMP, PIP_PAL);
  S.define('pipClimb', PIP_CLIMB, PIP_PAL);
  S.define('pipMini', PIP_MINI, PIP_PAL);
  S.define('grogIdle', GROG_IDLE, GROG_PAL);
  S.define('grogThrow', grogThrow(), GROG_PAL);
  S.define('lunaA', LUNA_A, LUNA_PAL);
  S.define('lunaB', LUNA_B, LUNA_PAL);
  for (var i = 0; i < 4; i++) {
    S.define('barrel' + i, barrel(i * Math.PI / 4, 'b', 'd'), { b: '#c8742c', d: '#6a3410' });
    S.define('fireBarrel' + i, barrel(i * Math.PI / 4, 'b', 'd'), { b: '#3c7dff', d: '#1b3d99' });
  }
  S.define('barrelSide', grid(12, 10, function (x, y) {
    if (y === 0 || y === 9) return (x > 0 && x < 11) ? 'd' : '.';
    if (x === 0 || x === 11) return 'd';
    return (x === 3 || x === 8) ? 'd' : 'b';
  }), { b: '#c8742c', d: '#6a3410' });
  S.define('flameA', FLAME_A, FLAME_PAL);
  S.define('flameB', FLAME_B, FLAME_PAL);
  S.define('hammer', HAMMER, HAMMER_PAL);
  S.define('oil', OIL, OIL_PAL);
  S.define('heart', HEART, { r: '#ff3366', w: '#ffd0dc' });
};

// Fondo estático: escaleras y vigas pre-renderizadas una vez.
sprites.paintBoard = function (L) {
  var c = S.makeCanvas(224, 288);
  var g = c.getContext('2d');
  var i;
  for (i = 0; i < L.ladders.length; i++) {
    var l = L.ladders[i];
    var top = Math.round(L.surface(l.top, l.x)) + 8;
    var bottom = Math.round(L.surface(l.bottom, l.x));
    g.fillStyle = '#33e6ff';
    for (var y = top; y < bottom; y++) {
      var gap = l.broken && y > top + 6 && y < bottom - 8;
      if (gap) continue;
      g.fillRect(l.x - 4, y, 1, 1);
      g.fillRect(l.x + 3, y, 1, 1);
      if ((y - top) % 4 === 1) g.fillRect(l.x - 3, y, 6, 1);
    }
  }
  for (i = 0; i < L.platforms.length; i++) {
    var p = L.platforms[i];
    for (var x = p.x1; x < p.x2; x++) {
      var sy = Math.round(L.surface(i, x + 0.5));
      g.fillStyle = '#ff7aa2';
      g.fillRect(x, sy, 1, 1);
      g.fillStyle = '#c41e5a';
      g.fillRect(x, sy + 1, 1, 6);
      g.fillStyle = '#7a0f35';
      g.fillRect(x, sy + 7, 1, 1);
      // Celosía en diagonal.
      g.fillStyle = '#ff7aa2';
      for (var r = 2; r <= 5; r++) {
        var m = (x - p.x1) % 8;
        if (m === r || m === 7 - r) g.fillRect(x, sy + r, 1, 1);
      }
    }
  }
  return c;
};

export default sprites;
