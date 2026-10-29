import { describe, it, expect } from 'vitest';
import { MazeGame } from '../../src/games/maze/MazeGame.js';
import M from '../../src/games/maze/mazeMap.js';
import AI from '../../src/games/maze/ghostAI.js';
import { makeRng } from '../../src/core/rng.js';

const T = M.TILE;

// Entrada mínima con la misma forma que core/input.js.
function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags(), lastDir: null };
}

// Partida en PLAYING con semilla fija, entrada propia y registro de sonidos.
function playing(opts = {}) {
  const sounds = [];
  const game = new MazeGame({ rng: makeRng(12345), sfx: (n) => sounds.push(n), ...opts });
  game.test.startPlaying();
  const input = makeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(input);
      for (const k in input.pressed) input.pressed[k] = false;
    }
  };
  const press = (dir) => { input.pressed[dir] = true; input.lastDir = dir; };
  return { game, t: game.test, input, step, press, sounds };
}

describe('MAZE MUNCHER: mapa', () => {
  it('tiene 240 puntos, 4 superpíldoras y todo es alcanzable', () => {
    let dots = 0, power = 0;
    for (const t of M.base) { if (t === T.DOT) dots++; if (t === T.POWER) power++; }
    const seen = new Set();
    const stack = [[13, 23]];
    while (stack.length) {
      const [x, y] = stack.pop();
      const k = x + ',' + y;
      if (seen.has(k)) continue;
      seen.add(k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = (x + dx + 28) % 28, ny = y + dy;
        if (!M.isWall(nx, ny)) stack.push([nx, ny]);
      }
    }
    let open = 0, unreachableDots = 0;
    for (let y = 0; y < 31; y++) for (let x = 0; x < 28; x++) {
      if (!M.isWall(x, y)) open++;
      const t = M.base[y * 28 + x];
      if ((t === T.DOT || t === T.POWER) && !seen.has(x + ',' + y)) unreachableDots++;
    }
    expect({ dots, power, cols: M.COLS, rows: M.ROWS, unreachableDots }).toEqual({ dots: 240, power: 4, cols: 28, rows: 31, unreachableDots: 0 });
    expect(seen.size).toBe(open);
  });
});

describe('MAZE MUNCHER: contrato', () => {
  it('expone score, lives, level, state y gameOver, y arranca en READY', () => {
    const g = new MazeGame({ rng: makeRng(1) });
    expect([g.score, g.lives, g.level, g.state, g.gameOver]).toEqual([0, 3, 1, 'READY', false]);
    expect(new MazeGame({ level: 4 }).level).toBe(4);
  });

  it('pasa de READY a PLAYING sin entrada', () => {
    const g = new MazeGame({ rng: makeRng(1) });
    for (let i = 0; i < 150; i++) g.update(makeInput());
    expect(g.state).toBe('PLAYING');
  });

  it('con la misma semilla y la misma entrada, la partida es idéntica', () => {
    const a = playing(), b = playing();
    for (const run of [a, b]) { run.press('right'); run.step(400); run.press('up'); run.step(400); }
    expect(a.t.state()).toEqual(b.t.state());
  });
});

describe('MAZE MUNCHER: movimiento', () => {
  it('el jugador responde a las cuatro direcciones', () => {
    const { t, step, press } = playing();
    t.parkGhosts();
    // (6,5) es un cruce: pasillo horizontal fila 5 y vertical columna 6.
    const moves = { right: ['x', 1], left: ['x', -1], down: ['y', 1], up: ['y', -1] };
    for (const [dir, [axis, sign]] of Object.entries(moves)) {
      t.setPlayer(6, 5, 'left');
      const before = t.state().player;
      press(dir);
      step(12);
      expect(Math.sign(t.state().player[axis] - before[axis]), dir).toBe(sign);
    }
  });

  it('no atraviesa paredes (barrido de todas las casillas pared)', () => {
    const { game, t, step } = playing();
    t.parkGhosts();
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    let checks = 0;
    const violations = [];
    for (let y = 0; y < 31; y++) for (let x = 0; x < 28; x++) {
      if (M.isWall(x, y)) continue;
      for (const [d, [dx, dy]] of Object.entries(dirs)) {
        if (!M.isWall(x + dx, y + dy)) continue;
        t.setPlayer(x, y, d);
        game.want = d;
        for (let i = 0; i < 20; i++) {
          step(1);
          const p = t.state().player;
          if (M.isWall(p.tx, p.ty)) { violations.push([x, y, d, p.tx, p.ty]); break; }
        }
        const p = t.state().player;
        if (p.tx !== x || p.ty !== y) violations.push(['moved', x, y, d, p.tx, p.ty]);
        checks++;
      }
    }
    expect(t.walls().length).toBeGreaterThan(400);
    expect(checks).toBeGreaterThan(300);
    expect(violations).toEqual([]);
  });

  it('el giro pedido se conserva hasta poder hacerse', () => {
    const { t, step, press } = playing();
    t.parkGhosts();
    t.setPlayer(2, 5, 'right');       // fila 5: abajo hay pared hasta la columna 5
    press('down');
    step(40);
    const p = t.state().player;
    expect(M.isWall(5, 6)).toBe(false);
    expect([p.dir, p.tx]).toEqual(['down', 5]);
    expect(p.ty).toBeGreaterThan(5);
  });
});

describe('MAZE MUNCHER: reglas', () => {
  it('punto: +10 y desaparece; superpíldora: +50 y modo vulnerable', () => {
    const { t, step, sounds } = playing();
    t.setGhostsEnabled(false);
    const s0 = t.state().score;
    expect(t.tileAt(2, 1)).toBe(T.DOT);
    t.setPlayer(2, 1, 'right');
    step(1);
    const s1 = t.state().score;
    expect(s1 - s0).toBe(10);
    expect(t.tileAt(2, 1)).toBe(T.EMPTY);
    expect(sounds).toContain('chomp');
    expect(t.tileAt(1, 3)).toBe(T.POWER);
    t.setPlayer(1, 3, 'down');
    step(1);
    const st = t.state();
    expect(st.score - s1).toBe(50);
    expect(t.tileAt(1, 3)).toBe(T.EMPTY);
    expect(st.frightTimer).toBeGreaterThan(0);
    expect(st.ghosts.filter((x) => x.frightened)).toHaveLength(4);
    expect(sounds).toContain('power');
  });

  it('los 4 enemigos salen de casa, se mueven y cambian de modo según el temporizador', () => {
    const { t, step } = playing();
    t.setInvulnerable(true);
    t.setPlayer(1, 29, 'right');
    const start = t.state().ghosts.map((x) => [x.x, x.y]);
    expect(t.state().mode).toBe('scatter');
    step(415);
    expect(t.state().mode).toBe('scatter');
    step(10);
    expect(t.state().mode).toBe('chase');
    step(600);
    const end = t.state().ghosts;
    for (let i = 0; i < 4; i++) {
      expect([end[i].x, end[i].y], 'enemigo ' + i).not.toEqual(start[i]);
      expect(end[i].state, 'enemigo ' + i + ' fuera de casa').toBe('active');
    }
  });

  it('cada enemigo tiene un objetivo de persecución distinto', () => {
    const { game, t } = playing();
    t.setPlayer(14, 23, 'left');
    for (let i = 0; i < 4; i++) t.setGhost(i, [1, 26, 1, 26][i], [1, 1, 29, 29][i]);
    game.mode = 'chase';
    const targets = game.ghosts.map((gh) => { AI.target(gh, game); return [gh.tgtX, gh.tgtY]; });
    expect(targets[0]).toEqual([14, 23]);                  // la casilla del jugador
    expect(targets[1]).toEqual([10, 23]);                  // 4 por delante (mira a la izquierda)
    expect(targets[2]).toEqual([12 * 2 - 1, 23 * 2 - 1]);  // vector desde el enemigo 1
    expect(targets[3]).toEqual([14, 23]);                  // lejos: persigue
    // Cerca, el tímido se retira a su esquina.
    t.setGhost(3, 15, 23);
    AI.target(game.ghosts[3], game);
    expect([game.ghosts[3].tgtX, game.ghosts[3].tgtY]).toEqual([M.SCATTER[3].x, M.SCATTER[3].y]);
  });

  it('en dispersión cada enemigo apunta a su esquina', () => {
    const { game } = playing();
    game.mode = 'scatter';
    game.ghosts.forEach((gh, i) => {
      AI.target(gh, game);
      expect([gh.tgtX, gh.tgtY]).toEqual([M.SCATTER[i].x, M.SCATTER[i].y]);
    });
  });

  it('la colisión con un enemigo normal quita una vida y reinicia posiciones', () => {
    const { t, step } = playing();
    t.setPlayer(6, 5, 'left');
    t.setGhost(0, 6, 5);
    expect(t.state().lives).toBe(3);
    step(1);
    expect(t.state().phase).toBe('LIFE_LOST');
    expect(t.state().lives).toBe(2);
    step(150);
    const s = t.state();
    expect(s.phase).toBe('READY');
    expect([s.player.x, s.player.y]).toEqual([112, 188]);
    expect([s.ghosts[0].x, s.ghosts[0].y, s.ghosts[0].state]).toEqual([112, 92, 'active']);
  });

  it('comer enemigos encadenados da 200 / 400 / 800 / 1600', () => {
    const { t, step } = playing();
    t.setGhostsEnabled(false);
    for (let i = 0; i < 4; i++) t.setGhost(i, 1, 29);
    t.frighten();
    const out = [];
    for (let i = 0; i < 4; i++) {
      t.setPlayer(13, 23, 'left');
      t.setGhost(i, 13, 23);
      const s0 = t.state().score;
      step(1);
      out.push(t.state().score - s0);
      step(46);
    }
    expect(out).toEqual([200, 400, 800, 1600]);
    expect(t.state().ghosts.map((x) => x.state)).toEqual(['eyes', 'eyes', 'eyes', 'eyes']);
  });

  it('la cadena se reinicia con cada superpíldora', () => {
    const { t, step } = playing();
    t.setGhostsEnabled(false);
    t.frighten();
    t.setPlayer(13, 23, 'left');
    t.setGhost(0, 13, 23);
    step(1);
    t.frighten();
    expect(t.state().chain).toBe(0);
  });

  it('los ojos de un enemigo comido vuelven a la casa y salen de nuevo', () => {
    const { t, step } = playing();
    t.setInvulnerable(true);
    t.setPlayer(1, 29, 'right');
    t.setGhost(0, 6, 5);
    t.frighten();
    t.setPlayer(6, 5, 'left');
    step(1);
    t.setPlayer(1, 29, 'right');
    const seen = new Set();
    for (let i = 0; i < 900; i++) { step(1); seen.add(t.state().ghosts[0].state); }
    expect([...seen]).toEqual(expect.arrayContaining(['eyes', 'entering', 'leaving', 'active']));
  });

  it('el modo vulnerable termina y los enemigos vuelven a la normalidad', () => {
    const { t, step } = playing();
    t.setInvulnerable(true);
    t.setPlayer(1, 29, 'right');
    t.frighten();
    step(6 * 60 + 1);
    expect(t.state().frightTimer).toBe(0);
    expect(t.state().ghosts.some((g) => g.frightened)).toBe(false);
  });

  it('perder las 3 vidas lleva a GAME_OVER y luego a gameOver', () => {
    const { game, t, step, sounds } = playing();
    const seen = [];
    for (let k = 0; k < 3; k++) {
      const p = t.state().player;
      t.setGhost(0, p.tx, p.ty);
      step(1);
      seen.push(t.state().phase + ':' + t.state().lives);
      step(150);
      if (t.state().phase === 'READY') step(121);
    }
    seen.push(game.state);
    expect(seen).toEqual(['LIFE_LOST:2', 'LIFE_LOST:1', 'LIFE_LOST:0', 'GAME_OVER']);
    expect(game.gameOver).toBe(false);
    step(181);
    expect(game.gameOver).toBe(true);
    expect(sounds).toContain('gameOver');
  });

  it('al comer todos los puntos se pasa al nivel 2', () => {
    const { t, step } = playing();
    t.setGhostsEnabled(false);
    t.clearDotsExcept(1);
    const d = t.firstDot();
    t.setPlayer(d.tx, d.ty, 'left');
    step(1);
    expect(t.state().phase).toBe('LEVEL_CLEAR');
    step(151);
    const s = t.state();
    expect([s.phase, s.level, s.dotsLeft]).toEqual(['READY', 2, 244]);
  });

  it('fruta de bonificación a los 70 y a los 170 puntos comidos', () => {
    const { game, t, step } = playing();
    t.setGhostsEnabled(false);
    for (let i = 0; i < 69; i++) game.dotEaten();
    expect(t.state().fruit.active).toBe(false);
    game.dotEaten();
    expect(t.state().fruit).toEqual({ active: true, value: 100 });
    t.setPlayer(13, 17, 'right');
    const s0 = t.state().score;
    step(3);
    expect(t.state().score - s0).toBe(100);
    expect(t.state().fruit.active).toBe(false);
    for (let i = 0; i < 100; i++) game.dotEaten();
    expect(t.state().fruit.active).toBe(true);
  });

  it('vida extra a los 10 000 puntos, una sola vez', () => {
    const { t, step } = playing();
    t.setGhostsEnabled(false);
    t.setScore(9995);
    t.setPlayer(2, 1, 'right');
    step(1);
    expect(t.state().lives).toBe(4);
    t.setPlayer(3, 1, 'right');
    step(10);
    expect(t.state().lives).toBe(4);
  });

  it('velocidades, vulnerabilidad y ciclos cambian con el nivel', () => {
    expect(AI.speeds(5).ghost).toBeGreaterThan(AI.speeds(1).ghost);
    expect(AI.speeds(5).player).toBeGreaterThan(AI.speeds(1).player);
    expect(AI.frightSeconds(5)).toBeLessThan(AI.frightSeconds(1));
    expect(AI.modeSchedule(5)[0]).toBeLessThan(AI.modeSchedule(1)[0]);
    expect(AI.frightSeconds(40)).toBe(1);
  });
});
