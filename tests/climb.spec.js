// Pruebas de BARREL CLIMB con ganchos (sección 5).
const { test, expect, open, gameState, step, state, storage, startPlaying } = require('./helpers');

// Deja la partida sin lanzamientos ni peligros.
async function calm(page) {
  await page.evaluate(() => {
    const g = window.__arcadeTest.game();
    g.setThrowing(false);
    g.clearHazards();
  });
}

test.describe('BARREL CLIMB', () => {
  test('el jugador camina sobre las vigas inclinadas sin atravesarlas', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    await page.evaluate(() => window.__arcadeTest.game().setPlayer(40, 0));
    await page.keyboard.down('ArrowRight');
    const samples = [];
    for (let i = 0; i < 12; i++) {
      await step(page, 10);
      const s = await gameState(page);
      const floor = await page.evaluate((x) => window.__arcadeTest.game().surface(0, x), s.player.x);
      samples.push([s.player.x, s.player.y, floor, s.player.state]);
    }
    await page.keyboard.up('ArrowRight');
    for (const [x, y, floor, st] of samples) {
      expect(st).toBe('walk');
      expect(Math.abs(y - floor), `x=${x}`).toBeLessThan(0.001);
    }
    expect(samples.at(-1)[0]).toBeCloseTo(40 + 120 * 0.75, 3);
    // La viga sube hacia la derecha: la y disminuye al avanzar.
    expect(samples.at(-1)[1]).toBeLessThan(samples[0][1]);
  });

  test('sube y baja escaleras solo cuando está alineado', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const g = (fn, a) => page.evaluate(fn, a);
    // Desalineado (10 px): no sube.
    await g(() => window.__arcadeTest.game().setPlayer(166, 0));
    await page.keyboard.down('ArrowUp');
    await step(page, 40);
    let s = await gameState(page);
    expect(s.player.state).toBe('walk');
    expect(s.player.platform).toBe(0);
    // Alineado: sube hasta la viga 1.
    await g(() => window.__arcadeTest.game().setPlayer(176, 0));
    await step(page, 5);
    expect((await gameState(page)).player.state).toBe('climb');
    await step(page, 80);
    s = await gameState(page);
    await page.keyboard.up('ArrowUp');
    expect(s.player.state).toBe('walk');
    expect(s.player.platform).toBe(1);
    // Baja por la misma escalera.
    await page.keyboard.down('ArrowDown');
    await step(page, 90);
    await page.keyboard.up('ArrowDown');
    s = await gameState(page);
    expect(s.player.platform).toBe(0);
    expect(s.player.state).toBe('walk');
    // Escalera rota (x=80): no se puede subir.
    await g(() => window.__arcadeTest.game().setPlayer(80, 0));
    await page.keyboard.down('ArrowUp');
    await step(page, 40);
    await page.keyboard.up('ArrowUp');
    s = await gameState(page);
    expect(s.player.state).toBe('walk');
    expect(s.player.platform).toBe(0);
  });

  test('el salto sigue un arco y aterriza en la viga', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(100, 0);
      const y0 = g.state().player.y;
      window.Arcade.core.input.press('jump');
      window.Arcade.core.input.press('right');
      const ys = [];
      let frames = 0;
      do { t.step(1); frames++; ys.push(g.state().player.y); } while (g.state().player.state === 'jump' && frames < 200);
      window.Arcade.core.input.release('jump');
      window.Arcade.core.input.release('right');
      const p = g.state().player;
      return { y0, ys, frames, end: p, floor: g.surface(0, p.x) };
    });
    const minY = Math.min(...r.ys);
    expect(r.y0 - minY).toBeGreaterThan(12);
    expect(r.y0 - minY).toBeLessThan(20);
    // Sube y luego baja (arco): el mínimo no está en los extremos.
    const iMin = r.ys.indexOf(minY);
    expect(iMin).toBeGreaterThan(5);
    expect(iMin).toBeLessThan(r.ys.length - 5);
    expect(r.frames).toBeGreaterThan(30);
    expect(r.frames).toBeLessThan(45);
    expect(r.end.state).toBe('walk');
    expect(r.end.x).toBeGreaterThan(110);
    expect(Math.abs(r.end.y - r.floor)).toBeLessThan(0.001);
    expect((await gameState(page)).lives).toBe(3);
  });

  test('los barriles ruedan, caen de viga en viga y a veces bajan escaleras', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const roll = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(8, 0);
      g.setBarrelLadders(false);
      g.spawnBarrel(60, 5);
      const platforms = new Set();
      const xs = [];
      for (let i = 0; i < 3000 && g.state().barrels.length; i++) {
        t.step(1);
        const b = g.state().barrels[0];
        if (b) { platforms.add(b.platform); xs.push(b.x); }
      }
      return { platforms: [...platforms], gone: g.state().barrels.length === 0, x0: xs[0], x10: xs[10] };
    });
    expect(roll.x10).toBeGreaterThan(roll.x0);
    expect(roll.platforms.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(roll.gone).toBe(true);

    const ladders = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setBarrelLadders(true);
      g.setSeed(7);
      let used = 0, skipped = 0;
      for (let k = 0; k < 20; k++) {
        g.clearHazards();
        g.spawnBarrel(170, 5, 1);
        let ladder = false;
        for (let i = 0; i < 40; i++) {
          t.step(1);
          const b = g.state().barrels[0];
          if (b && b.state === 'ladder') ladder = true;
        }
        if (ladder) used++; else skipped++;
      }
      return { used, skipped };
    });
    expect(ladders.used).toBeGreaterThan(0);
    expect(ladders.skipped).toBeGreaterThan(0);
  });

  test('el contacto con un barril quita una vida', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(100, 0);
      g.spawnBarrel(130, 0, -1);
      let frames = 0;
      while (g.state().phase === 'PLAYING' && frames < 120) { t.step(1); frames++; }
      return { phase: g.state().phase, lives: g.state().lives, cause: g.state().deathCause };
    });
    expect(r).toEqual({ phase: 'LIFE_LOST', lives: 2, cause: 'hit' });
  });

  test('el contacto con una llama quita una vida', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(100, 0);
      g.spawnFlame(90, 0);
      let frames = 0;
      while (g.state().phase === 'PLAYING' && frames < 300) { t.step(1); frames++; }
      return { phase: g.state().phase, lives: g.state().lives, cause: g.state().deathCause };
    });
    expect(r).toEqual({ phase: 'LIFE_LOST', lives: 2, cause: 'hit' });
  });

  test('una caída alta quita una vida', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    await page.evaluate(() => window.__arcadeTest.game().setPlayer(200, 1));
    await page.keyboard.down('ArrowRight');
    await step(page, 60);
    await page.keyboard.up('ArrowRight');
    const s = await gameState(page);
    expect(s.phase).toBe('LIFE_LOST');
    expect(s.deathCause).toBe('fall');
    expect(s.lives).toBe(2);
  });

  test('saltar un barril suma 100 (fiable en toda la ventana de tiempo)', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    // El barril rueda hacia el jugador parado: se prueba cada instante de salto de la ventana.
    const results = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      const input = window.Arcade.core.input;
      const out = [];
      for (let jumpAt = 22; jumpAt <= 30; jumpAt++) {
        g.clearHazards();
        g.setPlayer(100, 0);
        g.setScore(0);
        g.spawnBarrel(140, 0, -1);
        t.step(jumpAt);
        input.press('jump');
        t.step(1);
        input.release('jump');
        t.step(70);
        const s = g.state();
        out.push({ jumpAt, score: s.score, phase: s.phase, lives: s.lives });
      }
      return out;
    });
    for (const r of results) {
      expect(r, 'salto en el paso ' + r.jumpAt).toEqual({ jumpAt: r.jumpAt, score: 100, phase: 'PLAYING', lives: 3 });
    }
  });

  test('el martillo destruye barriles con 300 / 500 / 800 puntos', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setPlayer(100, 0);
      g.giveHammer();
      g.spawnBarrel(130, 0, -1);
      let frames = 0;
      while (g.state().barrels.length && frames < 120) { t.step(1); frames++; }
      return { score: g.state().score, phase: g.state().phase, lives: g.state().lives, hammer: g.state().hammer };
    });
    expect([300, 500, 800]).toContain(r.score);
    expect(r.phase).toBe('PLAYING');
    expect(r.lives).toBe(3);
    expect(r.hammer).toBeGreaterThan(0);
  });

  test('con el martillo no se puede subir escaleras', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    await page.evaluate(() => { const g = window.__arcadeTest.game(); g.setPlayer(176, 0); g.giveHammer(); });
    await page.keyboard.down('ArrowUp');
    await step(page, 30);
    await page.keyboard.up('ArrowUp');
    expect((await gameState(page)).player.state).toBe('walk');
  });

  test('al llegar a la cima se rescata, se suma la bonificación y se pasa de nivel', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    await page.evaluate(() => window.__arcadeTest.game().setPlayer(128, 5));
    const before = await gameState(page);
    await page.keyboard.down('ArrowUp');
    let s = before;
    for (let i = 0; i < 20 && s.phase === 'PLAYING'; i++) { await step(page, 5); s = await gameState(page); }
    await page.keyboard.up('ArrowUp');
    expect(s.phase).toBe('LEVEL_CLEAR');
    expect(s.score).toBe(s.bonus);
    expect(s.score).toBeGreaterThan(4000);
    await step(page, 301);
    s = await gameState(page);
    expect(s.level).toBe(2);
    expect(s.phase).toBe('READY');
    expect(s.player.platform).toBe(0);
  });

  test('la bonificación decrece con el tiempo', async ({ page }) => {
    await startPlaying(page, 'climb');
    await calm(page);
    const b0 = (await gameState(page)).bonus;
    await step(page, 240);
    expect((await gameState(page)).bonus).toBe(b0 - 200);
  });

  test('GAME OVER y récord persistente tras recargar', async ({ page }) => {
    await startPlaying(page, 'climb', 'JAVI');
    await calm(page);
    const phases = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const g = t.game();
      g.setScore(3000);
      const seen = [];
      for (let k = 0; k < 3; k++) {
        g.setThrowing(false);
        g.clearHazards();
        g.setPlayer(100, 0);
        g.spawnBarrel(110, 0, -1);
        let f = 0;
        while (g.state().phase === 'PLAYING' && f < 60) { t.step(1); f++; }
        seen.push(g.state().phase + ':' + g.state().lives);
        t.step(150);
        if (g.state().phase === 'READY') t.step(121);
      }
      seen.push(g.state().phase);
      t.step(181);
      return seen;
    });
    expect(phases).toEqual(['LIFE_LOST:2', 'LIFE_LOST:1', 'LIFE_LOST:0', 'GAME_OVER']);
    expect((await state(page)).app).toBe('NEW_RECORD');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    await expect(page.locator('[data-testid=best-climb]')).toHaveText('3000');
    expect((await storage(page)).users[0].records.climb.best).toBe(3000);
  });

  test('la dificultad sube por nivel', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => {
      const L = window.Arcade.games.climbLevel;
      return [L.tuning(1), L.tuning(4)];
    });
    expect(r[1].throwInterval).toBeLessThan(r[0].throwInterval);
    expect(r[1].barrelSpeed).toBeGreaterThan(r[0].barrelSpeed);
    expect(r[1].maxFlames).toBeGreaterThan(r[0].maxFlames);
    expect(r[1].ladderProb).toBeGreaterThan(r[0].ladderProb);
  });
});
