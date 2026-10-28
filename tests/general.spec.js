// Pruebas generales: bucles, consola, resoluciones, persistencia del navegador y récords (sección 5).
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('@playwright/test');
const { test, expect, open, createUser, state, step, storage, INDEX, TEST_URL, launchEnv } = require('./helpers');

const SHOTS = path.join(__dirname, '..', 'test-results', 'screens');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test.describe('General', () => {
  test('menú → juego → menú → otro juego sin bucles duplicados', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    expect((await state(page)).activeLoops).toBe(0);
    await page.click('[data-testid=play-maze]');
    await wait(150);
    let s = await state(page);
    expect([s.app, s.activeLoops, s.running]).toEqual(['TITLE', 1, true]);
    await page.keyboard.press('Escape');
    await page.click('[data-testid=pause-menu]');
    s = await state(page);
    expect([s.app, s.activeLoops, s.pending]).toEqual(['MENU', 0, 0]);
    await page.click('[data-testid=play-climb]');
    await wait(150);
    s = await state(page);
    expect([s.app, s.gameId, s.activeLoops]).toEqual(['TITLE', 'climb', 1]);
    expect(s.pending).toBeLessThanOrEqual(1);
    expect(s.maxPending).toBe(1);
  });

  test('20 reinicios seguidos dejan un único bucle activo', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await page.click('[data-testid=play-maze]');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Escape');
      await page.click('[data-testid=pause-restart]');
    }
    // Deja correr el bucle real un momento y comprueba que solo hay una cadena de rAF.
    await page.evaluate(() => window.__arcadeTest.setManual(false));
    const before = await page.evaluate(() => window.Arcade.core.loop.totalSteps);
    await wait(500);
    const s = await state(page);
    const after = await page.evaluate(() => window.Arcade.core.loop.totalSteps);
    expect(s.activeLoops).toBe(1);
    expect(s.pending).toBeLessThanOrEqual(1);
    expect(s.maxPending).toBe(1);
    // Paso fijo: ~30 pasos en 500 ms (nunca el doble, que delataría dos bucles).
    expect(after - before).toBeGreaterThan(15);
    expect(after - before).toBeLessThan(45);
  });

  test('la velocidad del juego es igual a 60 y a 144 Hz', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => ({
      hz60: window.__arcadeTest.simulateSteps(1000 / 60, 1000),
      hz144: window.__arcadeTest.simulateSteps(1000 / 144, 1000),
      hz30: window.__arcadeTest.simulateSteps(1000 / 30, 1000),
      tabBack: window.__arcadeTest.simulateSteps(5000, 5000)
    }));
    expect(Math.abs(r.hz60 - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.hz144 - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.hz30 - 60)).toBeLessThanOrEqual(1);
    // Al volver de segundo plano no se intenta recuperar todo el tiempo perdido.
    expect(r.tabBack).toBeLessThanOrEqual(15);
  });

  test('0 errores en consola en todo el recorrido (tiempo real, sin ganchos)', async ({ page }) => {
    // El fixture consoleErrors falla la prueba ante cualquier error.
    await open(page, INDEX);
    await createUser(page, 'JAVI');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await wait(2500);
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) { await page.keyboard.press(k); await wait(250); }
    await page.keyboard.press('Escape');
    await page.click('[data-testid=pause-menu]');
    await page.click('[data-testid=play-climb]');
    await page.keyboard.press('Enter');
    await wait(2500);
    await page.keyboard.down('ArrowRight');
    await wait(600);
    await page.keyboard.press('Space');
    await wait(800);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('KeyM');
    await page.keyboard.press('KeyP');
    await page.click('[data-testid=pause-menu]');
    await page.click('[data-testid=btn-records]');
    await page.click('[data-testid=records-back]');
    await page.click('#menu-controls');
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-state', 'MENU');
    expect(await page.evaluate(() => typeof window.__arcadeTest)).toBe('undefined');
  });

  test('las flechas y el espacio no desplazan la página; todo funciona con teclado', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page);
    await createUser(page, 'JAVI');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement.scrollTop])).toEqual([0, 0, 0]);
    // Solo teclado: el foco empieza en un juego y Enter lo abre.
    const focused = await page.evaluate(() => document.activeElement.getAttribute('data-testid'));
    expect(['play-maze', 'play-climb']).toContain(focused);
    await page.keyboard.press('Enter');
    expect((await state(page)).app).toBe('TITLE');
    await page.keyboard.press('Enter');
    await step(page, 1);
    expect((await state(page)).app).toBe('READY');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
    // Pausa → menú solo con teclado.
    await page.keyboard.press('Escape');
    expect((await state(page)).app).toBe('PAUSED');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect((await state(page)).app).toBe('MENU');
  });

  for (const [w, h] of [[360, 640], [768, 1024], [1366, 768], [1920, 1080]]) {
    test(`resolución ${w}×${h}: sin scroll horizontal y pantalla completa visible`, async ({ page }) => {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: w, height: h });
      await open(page);
      await page.screenshot({ path: path.join(SHOTS, `${w}x${h}-users.png`) });
      await createUser(page, 'JAVI');
      await page.screenshot({ path: path.join(SHOTS, `${w}x${h}-menu.png`) });
      const layout = await page.evaluate(() => {
        // En el mueble imagen la pantalla es apaisada y el canvas vertical va centrado dentro.
        const r = document.getElementById('game').getBoundingClientRect();
        const cab = document.getElementById('cabinet').getBoundingClientRect();
        return {
          scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
          screen: [r.left, r.top, r.right, r.bottom, r.width, r.height],
          cabinet: [cab.left, cab.right], innerH: window.innerHeight
        };
      });
      expect(layout.scrollW).toBeLessThanOrEqual(layout.innerW);
      const [l, t, r, b, sw, sh] = layout.screen;
      expect(l).toBeGreaterThanOrEqual(0);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(w);
      expect(b).toBeLessThanOrEqual(h);
      expect(sw).toBeGreaterThanOrEqual(220);
      expect(Math.abs(sw / sh - 224 / 288)).toBeLessThan(0.01);
      await page.click('[data-testid=play-maze]');
      await page.evaluate(() => window.__arcadeTest.game().startPlaying());
      await step(page, 60);
      await page.screenshot({ path: path.join(SHOTS, `${w}x${h}-maze.png`) });
      await page.keyboard.press('Escape');
      await page.click('[data-testid=pause-menu]');
      await page.click('[data-testid=play-climb]');
      await page.evaluate(() => window.__arcadeTest.game().startPlaying());
      await step(page, 200);
      await page.screenshot({ path: path.join(SHOTS, `${w}x${h}-climb.png`) });
    });
  }

  test('persistencia tras cerrar y volver a abrir el navegador', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-profile-'));
    try {
      let ctx = await chromium.launchPersistentContext(dir, { env: launchEnv() });
      let page = ctx.pages()[0] || await ctx.newPage();
      await open(page);
      await createUser(page, 'JAVI');
      await page.evaluate(() => window.__arcadeTest.startGame('maze'));
      await page.evaluate(() => window.__arcadeTest.finishWith(4321, 3));
      await ctx.close();

      ctx = await chromium.launchPersistentContext(dir, { env: launchEnv() });
      page = ctx.pages()[0] || await ctx.newPage();
      await open(page);
      await expect(page.locator('[data-testid=active-user]')).toHaveText('JAVI');
      await expect(page.locator('[data-testid=best-maze]')).toHaveText('4321');
      const data = await storage(page);
      expect(data.users[0].records.maze).toMatchObject({ best: 4321, level: 3 });
      await ctx.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('una partida con puntuación inferior al récord no lo modifica', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await page.evaluate(() => window.__arcadeTest.startGame('climb'));
    await page.evaluate(() => window.__arcadeTest.finishWith(5000, 2));
    await expect(page.locator('[data-testid=new-record]')).toBeVisible();
    const first = (await storage(page)).users[0].records.climb;
    await page.click('[data-testid=over-retry]');
    await page.evaluate(() => window.__arcadeTest.finishWith(1000, 1));
    expect((await state(page)).app).toBe('GAME_OVER');
    await expect(page.locator('[data-testid=new-record]')).toHaveCount(0);
    const data = await storage(page);
    expect(data.users[0].records.climb).toEqual(first);
    expect(data.users[0].history.filter((h) => h.game === 'climb').map((h) => h.score)).toEqual([5000, 1000]);
  });

  test('el historial se limita a las últimas 20 partidas por juego', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    const r = await page.evaluate(() => {
      const s = window.Arcade.data.scores;
      const id = window.Arcade.data.users.active().id;
      for (let i = 1; i <= 25; i++) s.submit(id, 'maze', i * 10, 1);
      s.submit(id, 'climb', 5, 1);
      const h = window.Arcade.data.users.active().history;
      return { maze: h.filter((x) => x.game === 'maze').map((x) => x.score), climb: h.filter((x) => x.game === 'climb').length };
    });
    expect(r.maze).toHaveLength(20);
    expect(r.maze[0]).toBe(60);
    expect(r.maze.at(-1)).toBe(250);
    expect(r.climb).toBe(1);
  });

  test('silencio y CRT se recuerdan tras recargar', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await page.keyboard.press('KeyM');
    await page.click('#btn-crt');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    await expect(page.locator('[data-testid=btn-mute]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.body.classList.contains('crt-on'))).toBe(false);
    expect((await storage(page)).settings).toEqual({ muted: true, crt: false });
  });

  test('sin localStorage se juega en modo memoria con aviso', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
    });
    await open(page, TEST_URL);
    await expect(page.locator('[data-testid=toast]')).toContainText('MODO MEMORIA');
    await createUser(page, 'JAVI');
    expect((await state(page)).storageMode).toBe('memory');
    await page.click('[data-testid=play-maze]');
    expect((await state(page)).app).toBe('TITLE');
  });
});

test('la versión empaquetada (un único HTML) arranca y se puede jugar', async ({ page }) => {
  const { execFileSync } = require('child_process');
  const out = path.join(__dirname, '..', 'test-results', 'arcade-standalone.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'bundle.js'), out]);
  const html = fs.readFileSync(out, 'utf8');
  expect(html).not.toMatch(/<script src=|<link rel="stylesheet"/);
  await open(page, 'file://' + out + '?test=1');
  await createUser(page, 'SOLO');
  await page.click('[data-testid=play-climb]');
  await page.evaluate(() => window.__arcadeTest.game().startPlaying());
  await step(page, 30);
  expect((await state(page)).app).toBe('PLAYING');
});

test('controles táctiles en móvil: cruceta, botón A y pausa', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await createUser(page, 'MOVIL');
  // La cruceta también navega por el menú y START abre el juego enfocado.
  await page.tap('[data-action=down]');
  await page.tap('[data-action=start]');
  expect((await state(page)).gameId).toBe('climb');
  await page.evaluate(() => {
    const g = window.__arcadeTest.game();
    g.startPlaying(); g.setThrowing(false); g.clearHazards(); g.setPlayer(100, 0);
  });
  await page.tap('[data-action=jump]');
  await step(page, 1);
  expect((await page.evaluate(() => window.__arcadeTest.game().state())).player.state).toBe('jump');
  await step(page, 60);
  // Mantener la cruceta a la derecha mueve al jugador.
  const box = await page.locator('[data-action=right]').boundingBox();
  await page.dispatchEvent('[data-action=right]', 'pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await step(page, 20);
  await page.dispatchEvent('[data-action=right]', 'pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  expect((await page.evaluate(() => window.__arcadeTest.game().state())).player.x).toBeGreaterThan(110);
  expect(box.width).toBeGreaterThanOrEqual(36);
  await page.tap('[data-action=pause]');
  expect((await state(page)).app).toBe('PAUSED');
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, 'movil-tactil-pausa.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(errors).toEqual([]);
  await ctx.close();
});
