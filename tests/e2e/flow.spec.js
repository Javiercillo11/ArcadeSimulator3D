// Flujo completo sobre el HTML final: usuario → sala → máquina → partida → récord → sala.
import { test, expect, open, state, step, storage, createUser, enterRoom, sitAt, startPlaying } from './helpers.js';

test.describe('flujo', () => {
  test('al arrancar se ve la sala de fondo y la pregunta de usuario', async ({ page }) => {
    await open(page);
    await expect(page.locator('#panel-users')).toBeVisible();
    await expect(page.locator('#users-title')).toContainText('¿QUÉ USUARIO');
    await expect(page.locator('[data-testid=enter-room]')).toBeDisabled();
    const a = await state(page);
    await step(page, 120);
    const b = await state(page);
    expect(a.app).toBe('USER_SELECT');
    // La cámara gira despacio alrededor de la sala.
    expect(b.camera.x).not.toBeCloseTo(a.camera.x, 3);
    expect(b.hands.visible).toBe(false);
    await expect(page.locator('#scene canvas')).toBeVisible();
  });

  test('usuario → sala → caminar → E → partida → récord → Q → sala, y persiste al recargar', async ({ page }) => {
    await open(page);
    await createUser(page, 'javi');
    await expect(page.locator('[data-testid=enter-room]')).toHaveText('ENTRAR AL SALÓN COMO JAVI');
    await page.click('[data-testid=enter-room]');
    let s = await state(page);
    expect(s.app).toBe('ROOM');
    expect(s.hands.visible).toBe(true);
    await expect(page.locator('[data-testid=hud-user]')).toHaveText('JAVI');

    // Camina con el teclado: de la entrada hasta delante de MAZE MUNCHER (x = -0.95).
    await page.evaluate(() => window.__arcadeTest.teleport(-0.95, 2.6, 0));
    await expect(page.locator('[data-testid=prompt]')).toBeHidden();
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 40 && !(await state(page)).prompt; i++) await step(page, 10);
    await page.keyboard.up('KeyW');
    s = await state(page);
    expect(s.prompt).toBe('maze');
    expect(s.player.z).toBeLessThan(2.6 - 1);
    await expect(page.locator('[data-testid=prompt]')).toBeVisible();
    await expect(page.locator('[data-testid=prompt]')).toContainText('JUGAR A MAZE MUNCHER');

    // E: transición de ~0,8 s hasta la pantalla.
    await page.keyboard.press('KeyE');
    await step(page, 20);
    s = await state(page);
    expect(s.app).toBe('SITTING');
    expect(s.hands.sit).toBeGreaterThan(0);
    expect(s.hands.sit).toBeLessThan(1);
    await step(page, 40);
    s = await state(page);
    expect(s.app).toBe('CABINET');
    expect(s.cabinet).toBe('maze');
    expect(s.machines).toEqual({ maze: 'TITLE', climb: 'ATTRACT' });
    expect(s.hands.sit).toBe(1);
    await expect(page.locator('#cabinet-hint')).toBeVisible();

    await page.keyboard.press('Enter');
    await step(page, 1);
    expect((await state(page)).machines.maze).toBe('PLAYING');
    await step(page, 200);
    const g = await page.evaluate(() => window.__arcadeTest.machine('maze').game);
    expect(g.phase).toBe('PLAYING');

    s = await page.evaluate(() => window.__arcadeTest.finishWith(2500, 2));
    expect(s.machines.maze).toBe('NEW_RECORD');
    const m = await page.evaluate(() => window.__arcadeTest.machine('maze'));
    expect(m.result).toMatchObject({ score: 2500, level: 2, isRecord: true, previous: 0 });
    let u = (await storage(page)).users[0];
    expect(u.records.maze).toMatchObject({ best: 2500, level: 2 });
    expect(u.history.at(-1)).toMatchObject({ game: 'maze', score: 2500, level: 2 });

    // Q: se levanta y vuelve a la sala, delante de la máquina.
    await page.keyboard.press('KeyQ');
    await step(page, 60);
    s = await state(page);
    expect(s.app).toBe('ROOM');
    expect(s.cabinet).toBe(null);
    expect(s.machines.maze).toBe('ATTRACT');
    expect(s.player.mode).toBe('walk');

    // Récords en el menú.
    await page.keyboard.press('Escape');
    expect((await state(page)).app).toBe('ROOM_MENU');
    await page.click('[data-testid=menu-records]');
    await expect(page.locator('[data-testid=best-maze-JAVI] .rec-score')).toHaveText('2500');
    await expect(page.locator('[data-testid=best-climb-JAVI] .rec-score')).toHaveText('0');

    // Recarga: el récord sigue ahí.
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    await expect(page.locator('[data-testid=user-JAVI]')).toContainText('MZ 2500');
    u = (await storage(page)).users[0];
    expect(u.records.maze.best).toBe(2500);
  });

  test('una partida que no supera el récord no lo cambia y muestra FIN DE PARTIDA', async ({ page }) => {
    await startPlaying(page, 'climb', 'ANA');
    await page.evaluate(() => window.__arcadeTest.finishWith(3000, 1));
    await step(page, 61);
    await page.keyboard.press('Enter');
    await step(page, 1);
    expect((await state(page)).machines.climb).toBe('PLAYING');
    const s = await page.evaluate(() => window.__arcadeTest.finishWith(1200, 1));
    expect(s.machines.climb).toBe('GAME_OVER');
    const m = await page.evaluate(() => window.__arcadeTest.machine('climb'));
    expect(m.result).toMatchObject({ score: 1200, best: 3000, isRecord: false });
    expect((await storage(page)).users[0].records.climb.best).toBe(3000);
    // Tras unos segundos vuelve sola al título.
    await step(page, 8 * 60);
    expect((await state(page)).machines.climb).toBe('TITLE');
  });

  test('pausa dentro de la máquina: congela, continúa, reinicia y permite levantarse', async ({ page }) => {
    await startPlaying(page, 'maze');
    await step(page, 200);
    await page.keyboard.press('Escape');
    let s = await state(page);
    expect(s.app).toBe('CABINET_PAUSE');
    expect(s.machines.maze).toBe('PAUSED');
    await expect(page.locator('[data-testid=pause-resume]')).toBeVisible();
    const frozen = await page.evaluate(() => window.__arcadeTest.machine('maze').game);
    await step(page, 120);
    expect(await page.evaluate(() => window.__arcadeTest.machine('maze').game)).toEqual(frozen);

    await page.click('[data-testid=pause-resume]');
    s = await state(page);
    expect([s.app, s.machines.maze]).toEqual(['CABINET', 'PLAYING']);
    await step(page, 2);
    const resumed = await page.evaluate(() => window.__arcadeTest.machine('maze').game);
    expect(resumed.player.x !== frozen.player.x || resumed.player.y !== frozen.player.y).toBe(true);

    await page.keyboard.press('Escape');
    await page.click('[data-testid=pause-restart]');
    s = await state(page);
    expect([s.app, s.machines.maze]).toEqual(['CABINET', 'PLAYING']);
    const fresh = await page.evaluate(() => window.__arcadeTest.machine('maze').game);
    expect([fresh.score, fresh.lives, fresh.phase]).toEqual([0, 3, 'READY']);

    await page.keyboard.press('Escape');
    await page.click('[data-testid=pause-stand]');
    await step(page, 60);
    s = await state(page);
    expect([s.app, s.machines.maze]).toEqual(['ROOM', 'ATTRACT']);
  });

  test('F acerca y aleja la pantalla', async ({ page }) => {
    await enterRoom(page);
    await sitAt(page, 'climb');
    const far = (await state(page)).camera;
    await page.keyboard.press('KeyF');
    await step(page, 30);
    const near = await state(page);
    expect(near.player.zoomed).toBe(true);
    expect(near.camera.z).toBeLessThan(far.z - 0.2);
    await page.keyboard.press('KeyF');
    await step(page, 30);
    expect((await state(page)).camera.z).toBeCloseTo(far.z, 3);
  });

  test('las máquinas inactivas muestran su demo en movimiento', async ({ page }) => {
    await enterRoom(page);
    const read = () => page.evaluate(() => {
      const t = window.__arcadeTest;
      return [t.machine('maze').state, t.machine('climb').state, t.screenPixel('maze'), t.screenPixel('climb')];
    });
    const a = await read();
    await step(page, 240);
    const b = await read();
    expect([a[0], a[1]]).toEqual(['ATTRACT', 'ATTRACT']);
    expect(a[2]).toBeGreaterThan(500);
    expect(a[3]).toBeGreaterThan(500);
    expect(b[2] !== a[2] || b[3] !== a[3]).toBe(true);
  });

  test('cambiar de usuario desde el menú: los récords van a cada uno', async ({ page }) => {
    await startPlaying(page, 'maze', 'UNO');
    await page.evaluate(() => window.__arcadeTest.finishWith(700, 1));
    await page.keyboard.press('KeyQ');
    await step(page, 60);
    await page.keyboard.press('Escape');
    await page.click('[data-testid=menu-switch]');
    expect((await state(page)).app).toBe('USER_SELECT');
    await createUser(page, 'DOS');
    await page.click('[data-testid=enter-room]');
    await sitAt(page, 'maze');
    await page.keyboard.press('Enter');
    await step(page, 1);
    await page.evaluate(() => window.__arcadeTest.finishWith(300, 1));
    const st = await storage(page);
    const byName = Object.fromEntries(st.users.map((u) => [u.name, u.records.maze.best]));
    expect(byName).toEqual({ UNO: 700, DOS: 300 });
    expect((await page.evaluate(() => window.__arcadeTest.machine('maze'))).result.isRecord).toBe(true);
  });
});
