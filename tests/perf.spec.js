// Rendimiento y robustez: coste por fotograma, memoria estable y partidas largas con entradas aleatorias.
const { chromium } = require('@playwright/test');
const { test, expect, open, createUser, TEST_URL, launchEnv } = require('./helpers');

// Pone el juego en marcha con peligros activos y un jugador que no muere (para medir mucho tiempo seguido).
async function setup(page, id) {
  await open(page, TEST_URL);
  await createUser(page, 'PERF');
  await page.evaluate((gid) => {
    const t = window.__arcadeTest;
    t.setSeed(99);
    t.startGame(gid);
    t.game().startPlaying();
    t.game().setInvulnerable(true);
  }, id);
}

for (const id of ['maze', 'climb']) {
  test(`${id}: cada fotograma cuesta mucho menos de 16 ms y el heap no crece`, async () => {
    const browser = await chromium.launch({ env: launchEnv(), args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page, id);
    const r = await page.evaluate(() => {
      const t = window.__arcadeTest;
      const loop = window.Arcade.core.loop;
      t.step(300);                         // calentamiento (JIT, cachés de texto teñido)
      window.gc();
      const h0 = performance.memory.usedJSHeapSize;
      const t0 = performance.now();
      for (let i = 0; i < 1200; i++) loop.step(1); // update + render por paso
      const ms = (performance.now() - t0) / 1200;
      const churn = performance.memory.usedJSHeapSize - h0;
      for (let i = 0; i < 1200; i++) loop.step(1);
      window.gc();
      const h1 = performance.memory.usedJSHeapSize;
      for (let i = 0; i < 2400; i++) loop.step(1);
      window.gc();
      const h2 = performance.memory.usedJSHeapSize;
      return { ms, churnBytesPerFrame: churn / 1200, leakKB: (h2 - h1) / 1024 };
    });
    await browser.close();
    console.log(id, JSON.stringify(r));
    expect(errors).toEqual([]);
    expect(r.ms).toBeLessThan(4);
    // Sin fugas: con el JIT ya caliente, la memoria retenida no crece en 40 s más de partida.
    expect(r.leakKB).toBeLessThan(16);
    // Solo quedan números temporales del motor (HeapNumber): menos de 1 KB por fotograma.
    expect(r.churnBytesPerFrame).toBeLessThan(1024);
  });

  test(`${id}: 20 000 pasos con entradas aleatorias sin errores ni estados imposibles`, async ({ page }) => {
    await setup(page, id);
    const r = await page.evaluate((gid) => {
      const t = window.__arcadeTest;
      const input = window.Arcade.core.input;
      const rnd = window.Arcade.core.makeRng(4242);
      const acts = ['up', 'down', 'left', 'right', 'jump'];
      const bad = [];
      const phases = new Set();
      for (let i = 0; i < 20000; i++) {
        if (i % 15 === 0) {
          for (const a of acts) input.release(a);
          input.press(acts[Math.floor(rnd() * acts.length)]);
        }
        t.step(1);
        const g = t.game();
        if (!g) break;
        const s = g.state();
        phases.add(s.phase);
        if (s.phase === 'GAME_OVER') g.startPlaying(), g.setLives(3);
        if (gid === 'maze') {
          if (window.Arcade.games.mazeMap.isWall(s.player.tx, s.player.ty)) bad.push(['wall', i, s.player]);
        } else if (s.player.state === 'walk') {
          const floor = g.surface(s.player.platform, s.player.x);
          if (Math.abs(floor - s.player.y) > 0.01) bad.push(['floor', i, s.player]);
        }
        if (bad.length > 5) break;
      }
      for (const a of acts) input.release(a);
      return { bad, phases: [...phases] };
    }, id);
    expect(r.bad).toEqual([]);
    expect(r.phases).toContain('PLAYING');
  });
}
