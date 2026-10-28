// Pruebas de MAZE MUNCHER con ganchos (sección 5).
const { test, expect, open, gameState, step, state, storage, startPlaying } = require('./helpers');

const T = { EMPTY: 0, WALL: 1, DOT: 2, POWER: 3 };

test.describe('MAZE MUNCHER', () => {
  test('el mapa tiene 240 puntos, 4 superpíldoras y todo es alcanzable', async ({ page }) => {
    await startPlaying(page, 'maze');
    const info = await page.evaluate(() => {
      const m = window.Arcade.games.mazeMap;
      let dots = 0, power = 0;
      for (const t of m.base) { if (t === 2) dots++; if (t === 3) power++; }
      // Conectividad desde la salida del jugador.
      const seen = new Set();
      const stack = [[13, 23]];
      while (stack.length) {
        const [x, y] = stack.pop();
        const k = x + ',' + y;
        if (seen.has(k)) continue;
        seen.add(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = (x + dx + 28) % 28, ny = y + dy;
          if (!m.isWall(nx, ny)) stack.push([nx, ny]);
        }
      }
      let open = 0, unreachableDots = 0;
      for (let y = 0; y < 31; y++) for (let x = 0; x < 28; x++) {
        if (!m.isWall(x, y)) { open++; }
        const t = m.base[y * 28 + x];
        if ((t === 2 || t === 3) && !seen.has(x + ',' + y)) unreachableDots++;
      }
      return { dots, power, open, reached: seen.size, unreachableDots, cols: m.COLS, rows: m.ROWS };
    });
    expect(info).toMatchObject({ dots: 240, power: 4, cols: 28, rows: 31, unreachableDots: 0 });
    expect(info.reached).toBe(info.open);
  });

  test('el jugador responde a las cuatro direcciones', async ({ page }) => {
    await startPlaying(page, 'maze');
    await page.evaluate(() => window.__arcadeTest.game().parkGhosts());
    const g = (fn) => page.evaluate(fn);
    // (6,5) es un cruce: pasillo horizontal fila 5 y vertical columna 6.
    const moves = { ArrowRight: ['x', 1], ArrowLeft: ['x', -1], ArrowDown: ['y', 1], ArrowUp: ['y', -1] };
    for (const [key, [axis, sign]] of Object.entries(moves)) {
      await g(() => window.__arcadeTest.game().setPlayer(6, 5, 'left'));
      const before = (await gameState(page)).player;
      await page.keyboard.press(key);
      await step(page, 12);
      const after = (await gameState(page)).player;
      expect(Math.sign(after[axis] - before[axis]), key).toBe(sign);
    }
    // WASD también funciona.
    await g(() => window.__arcadeTest.game().setPlayer(6, 5, 'left'));
    await page.keyboard.press('KeyD');
    await step(page, 12);
    expect((await gameState(page)).player.x).toBeGreaterThan(6 * 8 + 4);
  });

  test('no atraviesa paredes (barrido de todas las casillas pared)', async ({ page }) => {
    await startPlaying(page, 'maze');
    const result = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const game = t.game();
      game.parkGhosts();
      const input = window.Arcade.core.input;
      const m = window.Arcade.games.mazeMap;
      const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      let checks = 0;
      const violations = [];
      for (let y = 0; y < 31; y++) for (let x = 0; x < 28; x++) {
        if (m.isWall(x, y)) continue;
        for (const [d, [dx, dy]] of Object.entries(dirs)) {
          if (!m.isWall(x + dx, y + dy)) continue;
          // Empuja contra la pared durante 20 pasos.
          game.setPlayer(x, y, d);
          input.lastDir = d;
          for (let i = 0; i < 20; i++) {
            t.step(1);
            const p = game.state().player;
            if (m.isWall(p.tx, p.ty)) { violations.push([x, y, d, p.tx, p.ty]); break; }
          }
          const p = game.state().player;
          if (p.tx !== x || p.ty !== y) violations.push(['moved', x, y, d, p.tx, p.ty]);
          checks++;
        }
      }
      return { checks, violations, walls: game.walls().length };
    });
    expect(result.walls).toBeGreaterThan(400);
    expect(result.checks).toBeGreaterThan(300);
    expect(result.violations).toEqual([]);
  });

  test('punto: +10 y desaparece; superpíldora: +50 y modo vulnerable', async ({ page }) => {
    await startPlaying(page, 'maze');
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setGhostsEnabled(false);
      const s0 = g.state().score;
      const before = g.tileAt(2, 1);
      g.setPlayer(2, 1, 'right');
      t.step(1);
      const s1 = g.state().score;
      const after = g.tileAt(2, 1);
      const powerTile = g.tileAt(1, 3);
      g.setPlayer(1, 3, 'down');
      t.step(1);
      const st = g.state();
      return { s0, s1, before, after, powerTile, s2: st.score, fright: st.frightTimer, frightened: st.ghosts.filter((x) => x.frightened).length, powerAfter: g.tileAt(1, 3) };
    });
    expect(r.before).toBe(T.DOT);
    expect(r.s1 - r.s0).toBe(10);
    expect(r.after).toBe(T.EMPTY);
    expect(r.powerTile).toBe(T.POWER);
    expect(r.s2 - r.s1).toBe(50);
    expect(r.powerAfter).toBe(T.EMPTY);
    expect(r.fright).toBeGreaterThan(0);
    expect(r.frightened).toBe(4);
  });

  test('los 4 enemigos cambian de posición y de modo según el temporizador', async ({ page }) => {
    await startPlaying(page, 'maze');
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setInvulnerable(true);
      g.setPlayer(1, 29, 'right');
      const start = g.state().ghosts.map((x) => [x.x, x.y]);
      const m0 = g.state().mode;
      t.step(415);
      const m1 = g.state().mode;
      t.step(10);
      const m2 = g.state().mode;
      t.step(600);
      const end = g.state();
      return { start, m0, m1, m2, end: end.ghosts.map((x) => [x.x, x.y, x.state]) };
    });
    expect(r.m0).toBe('scatter');
    expect(r.m1).toBe('scatter');
    expect(r.m2).toBe('chase');
    for (let i = 0; i < 4; i++) {
      expect(r.end[i].slice(0, 2), 'enemigo ' + i).not.toEqual(r.start[i]);
      expect(r.end[i][2], 'enemigo ' + i + ' fuera de casa').toBe('active');
    }
  });

  test('cada enemigo tiene un objetivo de persecución distinto', async ({ page }) => {
    await startPlaying(page, 'maze');
    const targets = await page.evaluate(() => {
      const g = window.__arcadeTest.game();
      const ai = window.Arcade.games.ghostAI;
      const game = window.Arcade.app.game;
      g.setPlayer(14, 23, 'left');
      for (let i = 0; i < 4; i++) g.setGhost(i, [1, 26, 1, 26][i], [1, 1, 29, 29][i]);
      game.mode = 'chase';
      return game.ghosts.map((gh) => { ai.target(gh, game); return [gh.tgtX, gh.tgtY]; });
    });
    expect(targets[0]).toEqual([14, 23]);              // la casilla del jugador
    expect(targets[1]).toEqual([10, 23]);              // 4 por delante (mira a la izquierda)
    expect(targets[2]).toEqual([12 * 2 - 1, 23 * 2 - 1]); // vector desde el enemigo 1
    expect(targets[3]).toEqual([14, 23]);              // lejos: persigue
  });

  test('la colisión con un enemigo normal quita una vida y reinicia posiciones', async ({ page }) => {
    await startPlaying(page, 'maze');
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(6, 5, 'left');
      g.setGhost(0, 6, 5);
      const lives0 = g.state().lives;
      t.step(1);
      const s1 = g.state();
      t.step(150);
      const s2 = g.state();
      return { lives0, phase1: s1.phase, lives1: s1.lives, phase2: s2.phase, player: s2.player, ghost0: s2.ghosts[0] };
    });
    expect(r.lives0).toBe(3);
    expect(r.phase1).toBe('LIFE_LOST');
    expect(r.lives1).toBe(2);
    expect(r.phase2).toBe('READY');
    expect([r.player.x, r.player.y]).toEqual([112, 188]);
    expect([r.ghost0.x, r.ghost0.y, r.ghost0.state]).toEqual([112, 92, 'active']);
  });

  test('comer enemigos encadenados da 200 / 400 / 800 / 1600', async ({ page }) => {
    await startPlaying(page, 'maze');
    const gains = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setGhostsEnabled(false);
      for (let i = 0; i < 4; i++) g.setGhost(i, 1, 29);
      g.frighten();
      const out = [];
      for (let i = 0; i < 4; i++) {
        g.setPlayer(13, 23, 'left');
        g.setGhost(i, 13, 23);
        const s0 = g.state().score;
        t.step(1);
        out.push(g.state().score - s0);
        t.step(46);
      }
      return { out, states: g.state().ghosts.map((x) => x.state) };
    });
    expect(gains.out).toEqual([200, 400, 800, 1600]);
    expect(gains.states).toEqual(['eyes', 'eyes', 'eyes', 'eyes']);
  });

  test('los ojos de un enemigo comido vuelven a la casa y salen de nuevo', async ({ page }) => {
    await startPlaying(page, 'maze');
    const states = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setInvulnerable(true);
      g.setPlayer(1, 29, 'right');
      g.setGhost(0, 6, 5);
      g.frighten();
      g.setPlayer(6, 5, 'left');
      t.step(1);
      g.setPlayer(1, 29, 'right');
      const seen = new Set();
      for (let i = 0; i < 900; i++) { t.step(1); seen.add(g.state().ghosts[0].state); }
      return [...seen];
    });
    expect(states).toEqual(expect.arrayContaining(['eyes', 'entering', 'leaving', 'active']));
  });

  test('la pausa congela el estado y al reanudar continúa igual', async ({ page }) => {
    await startPlaying(page, 'maze');
    await step(page, 30);
    await page.keyboard.press('Escape');
    expect((await state(page)).app).toBe('PAUSED');
    await expect(page.locator('[data-testid=pause-resume]')).toBeVisible();
    const frozen = await gameState(page);
    await step(page, 120);
    expect(await gameState(page)).toEqual(frozen);
    await page.click('[data-testid=pause-resume]');
    expect((await state(page)).app).toBe('PLAYING');
    await step(page, 1);
    const resumed = await gameState(page);
    expect(resumed.player.x).not.toBe(frozen.player.x);
    expect(resumed.score).toBeGreaterThanOrEqual(frozen.score);
    expect(resumed.lives).toBe(frozen.lives);
  });

  test('perder las 3 vidas lleva a GAME OVER', async ({ page }) => {
    await startPlaying(page, 'maze');
    const phases = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      const seen = [];
      for (let k = 0; k < 3; k++) {
        const p = g.state().player;
        g.setGhost(0, p.tx, p.ty);
        t.step(1);
        seen.push(g.state().phase + ':' + g.state().lives);
        t.step(150);
        if (g.state().phase === 'READY') t.step(121);
      }
      seen.push(g.state().phase);
      t.step(181);
      return seen;
    });
    expect(phases).toEqual(['LIFE_LOST:2', 'LIFE_LOST:1', 'LIFE_LOST:0', 'GAME_OVER']);
    expect((await state(page)).app).toBe('GAME_OVER');
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#overlay-title')).toHaveText('FIN DE PARTIDA');
  });

  test('al comer todos los puntos se pasa al nivel 2', async ({ page }) => {
    await startPlaying(page, 'maze');
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setGhostsEnabled(false);
      g.clearDotsExcept(1);
      const d = g.firstDot();
      g.setPlayer(d.tx, d.ty, 'left');
      t.step(1);
      const p1 = g.state().phase;
      t.step(151);
      const s = g.state();
      return { p1, phase: s.phase, level: s.level, dots: s.dotsLeft };
    });
    expect(r.p1).toBe('LEVEL_CLEAR');
    expect(r.level).toBe(2);
    expect(r.phase).toBe('READY');
    expect(r.dots).toBe(244);
  });

  test('fruta de bonificación a los 70 puntos comidos', async ({ page }) => {
    await startPlaying(page, 'maze');
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setGhostsEnabled(false);
      const game = window.Arcade.app.game;
      for (let i = 0; i < 69; i++) game.dotEaten();
      const before = g.state().fruit.active;
      game.dotEaten();
      const fruit = g.state().fruit;
      g.setPlayer(13, 17, 'right');
      const s0 = g.state().score;
      t.step(3);
      return { before, fruit, gain: g.state().score - s0, after: g.state().fruit.active };
    });
    expect(r.before).toBe(false);
    expect(r.fruit).toEqual({ active: true, value: 100 });
    expect(r.gain).toBe(100);
    expect(r.after).toBe(false);
  });

  test('el récord se guarda y se recupera tras recargar', async ({ page }) => {
    await startPlaying(page, 'maze', 'JAVI');
    await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setScore(2500);
      g.setLives(1);
      const p = g.state().player;
      g.setGhost(0, p.tx, p.ty);
      t.step(1 + 150 + 181);
    });
    expect((await state(page)).app).toBe('NEW_RECORD');
    await expect(page.locator('[data-testid=new-record]')).toHaveText('¡NUEVO RÉCORD!');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    await expect(page.locator('[data-testid=best-maze]')).toHaveText('2500');
    const u = (await storage(page)).users[0];
    expect(u.records.maze.best).toBe(2500);
    expect(u.records.maze.date).not.toBeNull();
    expect(u.history.at(-1)).toMatchObject({ game: 'maze', score: 2500 });
  });

  test('velocidades, vulnerabilidad y ciclos cambian con el nivel', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const ai = window.Arcade.games.ghostAI;
      return { s1: ai.speeds(1), s5: ai.speeds(5), f1: ai.frightSeconds(1), f5: ai.frightSeconds(5), c1: ai.modeSchedule(1)[0], c5: ai.modeSchedule(5)[0] };
    });
    expect(r.s5.ghost).toBeGreaterThan(r.s1.ghost);
    expect(r.s5.player).toBeGreaterThan(r.s1.player);
    expect(r.f5).toBeLessThan(r.f1);
    expect(r.c5).toBeLessThan(r.c1);
  });
});
