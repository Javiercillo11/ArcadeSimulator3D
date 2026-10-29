// Resoluciones, táctil, uso sin ganchos de prueba y navegador sin WebGL.
import { chromium } from '@playwright/test';
import { test, expect, open, state, step, createUser, enterRoom, sitAt, PAGE, launchEnv } from './helpers.js';

for (const [w, h] of [[1366, 768], [1920, 1080], [1024, 768], [800, 600]]) {
  test(`resolución ${w}×${h}: sin scroll y con los paneles dentro de la ventana`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    for (const sel of ['#panel-users']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(box.y + box.height).toBeLessThanOrEqual(h);
    }
    const canvas = await page.locator('#scene canvas').boundingBox();
    expect([canvas.width, canvas.height]).toEqual([w, h]);
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(scroll).toEqual([w, h]);
    await createUser(page, 'RES');
    await page.click('[data-testid=enter-room]');
    await sitAt(page, 'maze');
    // Sentado, la pantalla de la máquina queda centrada y se ve entera.
    await page.keyboard.press('Escape');
    const box = await page.locator('#panel-pause').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(h);
  });
}

test('móvil táctil (390×844): palanca virtual, botón E, cruceta, A, START y SALIR', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) errors.push(m.text()); });
  await open(page);
  const box = await page.locator('#panel-users').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.locator('[data-testid=user-name-input]').fill('MOVIL');
  await page.locator('[data-testid=user-create]').tap();
  await page.locator('[data-testid=enter-room]').tap();
  await expect(page.locator('#touch-room')).toBeVisible();
  await expect(page.locator('#touch-cab')).toBeHidden();
  await expect(page.locator('#lock-hint')).toBeHidden();

  // La palanca virtual mueve al jugador hacia delante.
  const z0 = (await state(page)).player.z;
  const stick = await page.locator('[data-testid=touch-stick]').boundingBox();
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 60);
  await step(page, 60);
  await page.mouse.up();
  await step(page, 10);
  expect((await state(page)).player.z).toBeLessThan(z0 - 0.5);

  // Botón E delante de la máquina.
  const cab = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'climb'));
  await page.evaluate(([x, z]) => window.__arcadeTest.teleport(x, z, 0), [cab.front.x, cab.front.z + 1.0]);
  await page.locator('[data-testid=touch-e]').tap();
  await step(page, 60);
  expect((await state(page)).app).toBe('CABINET');
  await expect(page.locator('#touch-cab')).toBeVisible();

  // START empieza; A salta.
  await page.locator('[data-testid=touch-start]').tap();
  await step(page, 1);
  expect((await state(page)).machines.climb).toBe('PLAYING');
  await page.evaluate(() => { const g = window.__arcadeTest.game('climb'); g.startPlaying(); g.setThrowing(false); g.clearHazards(); g.setPlayer(100, 0); });
  const a = await page.locator('[data-testid=touch-a]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await step(page, 4);
  await page.mouse.up();
  expect((await page.evaluate(() => window.__arcadeTest.machine('climb').game)).player.state).toBe('jump');

  // SALIR devuelve a la sala.
  await page.locator('[data-testid=touch-exit]').tap();
  await step(page, 60);
  expect((await state(page)).app).toBe('ROOM');
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll).toBe(390);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('sin WebGL aparece un mensaje claro en lugar de una página en blanco', async () => {
  const browser = await chromium.launch({ env: launchEnv(), args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.waitForSelector('html[data-ready]');
  await expect(page.locator('#no-webgl')).toBeVisible();
  await expect(page.locator('#no-webgl')).toContainText('WEBGL');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'NO_WEBGL');
  expect(errors).toEqual([]);
  await browser.close();
});

test('persistencia tras cerrar y volver a abrir el navegador', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-profile-'));
  try {
    let ctx = await chromium.launchPersistentContext(dir, { env: launchEnv() });
    let page = await ctx.newPage();
    await enterRoom(page, 'PERSIST');
    await sitAt(page, 'maze');
    await page.keyboard.press('Enter');
    await step(page, 1);
    await page.evaluate(() => window.__arcadeTest.finishWith(5150, 3));
    await ctx.close();
    ctx = await chromium.launchPersistentContext(dir, { env: launchEnv() });
    page = await ctx.newPage();
    await open(page);
    await expect(page.locator('[data-testid=user-PERSIST]')).toContainText('MZ 5150');
    const rows = await page.evaluate(() => window.__arcadeTest.boardRows());
    expect(rows.maze[0]).toMatchObject({ name: 'PERSIST', best: 5150, level: 3 });
    await ctx.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
