/* Laberinto propio de 28×31 casillas: 240 puntos, 4 superpíldoras, casa de enemigos y túnel lateral. */
// Mitad izquierda (columnas 0–13); la derecha es su reflejo.
// # pared · . punto · o superpíldora · espacio = pasillo vacío · - puerta · h interior de la casa
var HALF = [
  '##############',
  '#.............',
  '#.###.#####.##',
  '#o###.#####.##',
  '#.###.#####.##',
  '#.............',
  '#.###.##.#####',
  '#.###.##.#####',
  '#......#....##',
  '######.#### ##',
  '######.#### ##',
  '######.##     ',
  '######.## ###-',
  '######.## #hhh',
  '      .   #hhh',
  '######.## #hhh',
  '######.## ####',
  '######.##     ',
  '######.## ####',
  '######.## ####',
  '#...........##',
  '#.###.#####.##',
  '#.###.#####.##',
  '#o..#........ ',
  '###.#.##.#####',
  '###.#.##.#####',
  '#.....##....##',
  '#.#########.##',
  '#.#########.##',
  '#.............',
  '##############'
];

var COLS = 28;
var ROWS = 31;
var TILE = { EMPTY: 0, WALL: 1, DOT: 2, POWER: 3, DOOR: 4, HOUSE: 5 };
var CHAR = { ' ': TILE.EMPTY, '#': TILE.WALL, '.': TILE.DOT, 'o': TILE.POWER, '-': TILE.DOOR, 'h': TILE.HOUSE };

var base = new Uint8Array(COLS * ROWS);
for (var y = 0; y < ROWS; y++) {
  var row = HALF[y] + HALF[y].split('').reverse().join('');
  for (var x = 0; x < COLS; x++) base[y * COLS + x] = CHAR[row.charAt(x)];
}

var map = {
  COLS: COLS,
  ROWS: ROWS,
  TILE: TILE,
  TUNNEL_ROW: 14,
  base: base,
  // Posiciones en píxeles (centro de entidad), sin el desplazamiento del marcador.
  PLAYER_START: { x: 112, y: 23 * 8 + 4 },
  GHOST_EXIT: { x: 112, y: 11 * 8 + 4 },
  HOUSE_CENTER_Y: 14 * 8 + 4,
  HOUSE_SLOTS: [112, 112, 96, 128],
  FRUIT_POS: { x: 112, y: 17 * 8 + 4 },
  // Esquinas de dispersión de cada enemigo (en casillas, pueden quedar fuera del mapa).
  SCATTER: [{ x: 25, y: -3 }, { x: 2, y: -3 }, { x: 27, y: 31 }, { x: 0, y: 31 }]
};

map.at = function (tiles, tx, ty) {
  if (ty < 0 || ty >= ROWS) return TILE.WALL;
  if (tx < 0 || tx >= COLS) return ty === map.TUNNEL_ROW ? TILE.EMPTY : TILE.WALL;
  return tiles[ty * COLS + tx];
};

map.isWall = function (tx, ty) {
  var t = map.at(base, tx, ty);
  return t === TILE.WALL || t === TILE.DOOR || t === TILE.HOUSE;
};

map.isTunnel = function (tx, ty) {
  return ty === map.TUNNEL_ROW && (tx <= 5 || tx >= 22);
};

map.countDots = function (tiles) {
  var n = 0;
  for (var i = 0; i < tiles.length; i++) if (tiles[i] === TILE.DOT || tiles[i] === TILE.POWER) n++;
  return n;
};

export default map;
