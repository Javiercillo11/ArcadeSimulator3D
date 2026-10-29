// Sala 3D: colisiones, aviso de E, bucle único, menú y ajustes.
import { test, expect, open, state, step, storage, enterRoom, sitAt } from './helpers.js';

test.describe('sala', () => {
  test('no se atraviesan las máquinas ni las paredes', async ({ page }) => {
    await enterRoom(page);
    const cabs = await page.evaluate(() => window.__arcadeTest.cabinets().filter((c) => ['maze', 'climb', 'brick'].includes(c.id)));
    for (const c of cabs) {
      const x = (c.minX + c.maxX) / 2;
      await page.evaluate(([px]) => window.__arcadeTest.teleport(px, -1.0, 0), [x]);
      await page.keyboard.down('KeyW');
      await step(page, 300);
      await page.keyboard.up('KeyW');
      // Se para contra el taburete (o la máquina), nunca dentro de ella.
      const p = (await state(page)).player;
      expect(p.z, c.id).toBeGreaterThanOrEqual(c.maxZ + 0.27);
      expect(p.z, c.id).toBeLessThan(-3.0);
    }
    // Paredes: correr en cada dirección durante 6 s.
    const room = await page.evaluate(() => window.__arcadeTest.room());
    const walls = [['KeyA', 'x', room.minX], ['KeyD', 'x', room.maxX], ['KeyS', 'z', room.maxZ]];
    for (const [key, axis, limit] of walls) {
      await page.evaluate(() => window.__arcadeTest.teleport(0.8, -1, 0));   // por un pasillo libre
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down(key);
      await step(page, 480);
      await page.keyboard.up(key);
      await page.keyboard.up('ShiftLeft');
      const v = (await state(page)).player[axis];
      expect(Math.abs(v), key).toBeLessThan(Math.abs(limit));
      expect(Math.abs(v), key).toBeGreaterThan(Math.abs(limit) - 0.4);
    }
  });

  test('se desliza a lo largo de una mesa en lugar de quedarse pegado', async ({ page }) => {
    await enterRoom(page);
    const cab = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'hockey'));
    await page.evaluate(([x, z]) => window.__arcadeTest.teleport(x, z, Math.PI / 4), [cab.maxX - 0.1, cab.maxZ + 0.6]);
    const x0 = (await state(page)).player.x;
    await page.keyboard.down('KeyW');
    await step(page, 30);
    await page.keyboard.up('KeyW');
    const p = (await state(page)).player;
    expect(p.z).toBeGreaterThanOrEqual(cab.maxZ + 0.27);
    expect(p.x).toBeLessThan(x0 - 0.3);
  });

  test('el aviso de E solo aparece cerca, de frente y mirando a la máquina', async ({ page }) => {
    await enterRoom(page);
    const cab = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'climb'));
    const at = async (x, z, yaw) => {
      await page.evaluate(([a, b, c]) => window.__arcadeTest.teleport(a, b, c), [x, z, yaw]);
      return (await step(page, 1)).prompt;
    };
    expect(await at(cab.front.x, cab.front.z + 1.0, 0)).toBe('climb');       // cerca y de frente
    expect(await at(cab.front.x, cab.front.z + 2.2, 0)).toBe(null);          // demasiado lejos
    expect(await at(cab.front.x, cab.front.z + 1.0, Math.PI)).toBe(null);    // de espaldas
    expect(await at(cab.front.x, cab.front.z + 1.0, Math.PI / 2)).toBe(null); // mirando a un lado
    // E sin aviso no hace nada.
    await page.keyboard.press('KeyE');
    expect((await step(page, 5)).app).toBe('ROOM');
  });

  test('un solo bucle de animación tras 10 ciclos de sentarse y levantarse', async ({ page }) => {
    await enterRoom(page);
    for (let i = 0; i < 10; i++) {
      await sitAt(page, i % 2 ? 'climb' : 'maze');
      await page.keyboard.press('Enter');
      await step(page, 30);
      await page.keyboard.press('KeyQ');
      await step(page, 60);
      expect((await state(page)).app).toBe('ROOM');
    }
    expect((await state(page)).loopStarts).toBe(1);
    // Tiempo real durante 2 s: el bucle se llama una vez por fotograma del navegador (no dos)
    // y nunca pasa de 60 pasos por segundo, vaya la máquina de pruebas lo rápido que vaya.
    const r = await page.evaluate(() => new Promise((resolve) => {
      const t = window.__arcadeTest;
      t.setManual(false);
      const a = t.state();
      let ticks = 0;
      const t0 = performance.now();
      const tick = () => {
        ticks++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        else { const b = t.state(); t.setManual(true); resolve({ ticks, frames: b.frames - a.frames, steps: b.steps - a.steps, ms: performance.now() - t0 }); }
      };
      requestAnimationFrame(tick);
    }));
    expect(r.frames / r.ticks).toBeGreaterThan(0.8);
    expect(r.frames / r.ticks).toBeLessThan(1.25);
    expect(r.steps / (r.ms / 1000)).toBeLessThan(66);
    expect(r.steps).toBeGreaterThan(0);
  });

  test('ESC en la sala abre el menú; controles, récords y volver', async ({ page }) => {
    await enterRoom(page, 'MENU');
    await page.keyboard.press('Escape');
    expect((await state(page)).app).toBe('ROOM_MENU');
    await expect(page.locator('#panel-menu')).toBeVisible();
    await expect(page.locator('#menu-user')).toHaveText('JUGADOR: MENU');
    // Las flechas mueven el foco entre botones.
    await expect(page.locator('[data-testid=menu-resume]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid=menu-records]')).toBeFocused();
    await page.click('[data-testid=menu-controls]');
    await expect(page.locator('#panel-controls')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel-menu')).toBeVisible();
    await page.click('[data-testid=menu-records]');
    await expect(page.locator('[data-testid=rec-row-MENU]')).toBeVisible();
    await page.click('[data-testid=records-back]');
    await page.click('[data-testid=menu-resume]');
    expect((await state(page)).app).toBe('ROOM');
    // Andar no funciona con el menú abierto.
    await page.keyboard.press('Escape');
    const z0 = (await state(page)).player.z;
    await page.keyboard.down('KeyW');
    await step(page, 60);
    await page.keyboard.up('KeyW');
    expect((await state(page)).player.z).toBe(z0);
  });

  test('sonido, CRT, calidad y sensibilidad se recuerdan tras recargar', async ({ page }) => {
    await enterRoom(page, 'AJUSTES');
    await page.keyboard.press('Escape');
    await page.click('[data-testid=menu-sound]');
    await expect(page.locator('[data-testid=menu-sound]')).toHaveText('SONIDO: NO');
    await page.click('[data-testid=menu-crt]');
    await page.click('[data-testid=menu-quality]');
    await expect(page.locator('[data-testid=menu-quality]')).toHaveText('CALIDAD: BAJA');
    await page.locator('[data-testid=menu-sens]').fill('2');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    expect((await storage(page)).settings).toEqual({ muted: true, crt: false, quality: 'low', mouseSens: 2, jukebox: null });
    // M alterna el silencio en cualquier momento.
    await page.click('[data-testid=enter-room]');
    await page.keyboard.press('KeyM');
    expect((await storage(page)).settings.muted).toBe(false);
  });

  test('el ratón gira la vista y el cabeceo tiene límite', async ({ page }) => {
    await enterRoom(page);
    const y0 = (await state(page)).player.yaw;
    await page.evaluate(() => window.__arcadeTest.look(300, 0));
    let p = (await step(page, 1)).player;
    expect(p.yaw).toBeLessThan(y0 - 0.3);
    await page.evaluate(() => window.__arcadeTest.look(0, -100000));
    p = (await step(page, 1)).player;
    expect(p.pitch).toBeCloseTo(1.35, 5);
  });

  test('el tablero de récords de la pared se actualiza al batir un récord', async ({ page }) => {
    await enterRoom(page, 'TABLERO');
    // Antes de jugar, el tablero muestra el TOP de fábrica del salón.
    expect((await page.evaluate(() => window.__arcadeTest.boardRows())).climb[0]).toMatchObject({ initials: 'SAL', score: 10000, userId: null });
    await sitAt(page, 'climb');
    await page.keyboard.press('Enter');
    await step(page, 1);
    await page.evaluate(() => window.__arcadeTest.finishWith(4200, 2));
    // El tablero es un canvas: se comprueba con las filas que se le acaban de dibujar.
    const drawn = await page.evaluate(() => window.__arcadeTest.boardRows());
    expect(drawn.climb[4]).toMatchObject({ initials: 'TAB', score: 4200, level: 2 });
    expect(drawn.climb).toHaveLength(10);
  });
});

test('datos de la v1 (schemaVersion 1) se migran sin perder récords, con monedas y TOP 10', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('arcade.v1')) return;
    localStorage.setItem('arcade.v1', JSON.stringify({
      schemaVersion: 1, activeUserId: 'u_old',
      users: [{ id: 'u_old', name: 'VETERANO', createdAt: '2026-10-01T10:00:00.000Z',
        records: { maze: { best: 9100, date: '2026-10-02T10:00:00.000Z', level: 4 }, climb: { best: 0, date: null, level: 0 } },
        history: [] }],
      settings: { muted: false, crt: true }
    }));
  });
  await open(page);
  await expect(page.locator('[data-testid=user-VETERANO]')).toContainText('MZ 9100');
  await expect(page.locator('[data-testid=enter-room]')).toHaveText('ENTRAR AL SALÓN COMO VETERANO');
  const st = await storage(page);
  expect(st.schemaVersion).toBe(4);
  expect(st.settings).toEqual({ muted: false, crt: true, quality: 'high', mouseSens: 1, jukebox: null });
  expect(st.users[0]).toMatchObject({ coins: 3, initials: 'VET' });
  expect(st.hallOfFame.maze[1]).toMatchObject({ initials: 'VET', score: 9100, userId: 'u_old' });
});

test('sin localStorage se juega en modo memoria con aviso', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
  });
  await open(page);
  await expect(page.locator('#toast')).toContainText('MODO MEMORIA');
  expect((await state(page)).storageMode).toBe('memory');
});
