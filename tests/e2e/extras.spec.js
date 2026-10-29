// Juegos nuevos, recepción, premios, grúa, gramola, refrescos, máquina averiada, pantalla grande y logros.
import { test, expect, open, state, step, storage, enterRoom, sitAt, startPlaying } from './helpers.js';

// Se coloca delante de un objeto que mira hacia los lados (recepción, gramola, refrescos).
async function faceSide(page, id) {
  const o = await page.evaluate((oid) => window.__arcadeTest.cabinets().find((c) => c.id === oid), id);
  const cx = (o.minX + o.maxX) / 2, cz = (o.minZ + o.maxZ) / 2;
  const dx = o.front.x - cx, dz = o.front.z - cz, len = Math.hypot(dx, dz);
  await page.evaluate(([x, z, yaw]) => window.__arcadeTest.teleport(x, z, yaw), [o.front.x + dx / len, o.front.z + dz / len, Math.atan2(dx / len, dz / len)]);
  await step(page, 2);
  expect((await state(page)).prompt).toBe(id);
}

test.describe('juegos nuevos', () => {
  test('BRICK BLAST: se juega en su máquina y da tickets al terminar', async ({ page }) => {
    await startPlaying(page, 'brick', 'LADRI');
    await step(page, 121);                // READY: la bola espera en la pala
    await page.keyboard.press('Space');
    await step(page, 30);
    const g = await page.evaluate(() => window.__arcadeTest.machine('brick').game);
    expect(g.ball.stuck).toBe(false);
    const s = await page.evaluate(() => window.__arcadeTest.finishWith(3200, 2));
    expect(s.machines.brick).toBe('NEW_RECORD');
    expect(s.tickets).toBe(3);
    await expect(page.locator('[data-testid=hud-tickets]')).toHaveText('3');
    expect((await page.evaluate(() => window.__arcadeTest.machine('brick'))).result.tickets).toBe(3);
  });

  test('AIR HOCKEY: la mesa se juega con las flechas; ganar da 10 tickets + goles y el logro', async ({ page }) => {
    await startPlaying(page, 'hockey', 'HOCKEY');
    await step(page, 90);
    const before = (await page.evaluate(() => window.__arcadeTest.machine('hockey').game)).player;
    await page.keyboard.down('ArrowUp');
    await step(page, 20);
    await page.keyboard.up('ArrowUp');
    expect((await page.evaluate(() => window.__arcadeTest.machine('hockey').game)).player.y).toBeLessThan(before.y);
    const s = await page.evaluate(() => window.__arcadeTest.finishWith(9000, 1, 'HOC', { won: true, goals: { player: 7, cpu: 2 } }));
    expect(s.tickets).toBe(17);
    expect(s.achievements).toEqual(expect.arrayContaining(['first', 'hockeyWin']));
  });

  test('SKEE-BALL: mantener y soltar ESPACIO lanza la bola y suma puntos y tickets', async ({ page }) => {
    await startPlaying(page, 'skee', 'BOLOS');
    let g;
    await page.keyboard.down('Space');
    await step(page, 14);
    await page.keyboard.up('Space');
    await step(page, 1);
    g = await page.evaluate(() => window.__arcadeTest.machine('skee').game);
    expect(['ROLL', 'FLY', 'SCORED']).toContain(g.phase);
    for (let i = 0; i < 30 && g.history.length === 0; i++) { await step(page, 10); g = await page.evaluate(() => window.__arcadeTest.machine('skee').game); }
    expect(g.history).toHaveLength(1);
    expect(g.score).toBeGreaterThanOrEqual(10);
    await step(page, 60);                 // tras mostrar los puntos, la siguiente bola
    g = await page.evaluate(() => window.__arcadeTest.machine('skee').game);
    expect([g.phase, g.ballsLeft]).toEqual(['AIM', 8]);
    const s = await page.evaluate(() => window.__arcadeTest.finishWith(330, 1, 'BOL'));
    expect(s.tickets).toBe(33);
  });

  test('las máquinas nuevas muestran su demo y alternan con su TOP 10', async ({ page }) => {
    await enterRoom(page);
    const lit = await page.evaluate(() => ['brick', 'hockey', 'skee'].map((id) => window.__arcadeTest.screenPixel(id)));
    for (const n of lit) expect(n).toBeGreaterThan(500);
    const m = await page.evaluate(() => ['brick', 'hockey', 'skee'].map((id) => window.__arcadeTest.machine(id).state));
    expect(m).toEqual(['ATTRACT', 'ATTRACT', 'ATTRACT']);
  });
});

test.describe('grúa y premios', () => {
  test('la grúa cuesta una moneda y, si agarra un peluche, va a la vitrina', async ({ page }) => {
    await enterRoom(page, 'GRUA');
    await sitAt(page, 'claw');
    await page.keyboard.press('Enter');
    await step(page, 1);
    let s = await state(page);
    expect(s.machines.claw).toBe('PLAYING');
    expect(s.coins).toBe(2);
    // Mueve la pinza con las flechas.
    const c0 = (await page.evaluate(() => window.__arcadeTest.machine('claw'))).claw;
    await page.keyboard.down('ArrowRight');
    await step(page, 30);
    await page.keyboard.up('ArrowRight');
    expect((await page.evaluate(() => window.__arcadeTest.machine('claw'))).claw.x).toBeGreaterThan(c0.x);
    const id = await page.evaluate(() => window.__arcadeTest.clawCheat());
    await page.keyboard.press('Space');
    for (let i = 0; i < 40 && (await state(page)).machines.claw === 'PLAYING'; i++) await step(page, 20);
    s = await state(page);
    expect(s.machines.claw).toBe('TITLE');
    expect(s.prizes).toEqual([id]);
    expect(s.achievements).toContain('claw');
    expect(await page.evaluate(() => window.__arcadeTest.prizeCaseCount())).toBe(1);
    await expect(page.locator('#toast')).toContainText('HAS GANADO');
  });

  test('en recepción se canjean tickets por premios, que aparecen en la vitrina', async ({ page }) => {
    await enterRoom(page, 'CANJE');
    await page.evaluate(() => window.__arcadeTest.setTickets(100));
    await faceSide(page, 'reception');
    await page.keyboard.press('KeyE');
    await expect(page.locator('#panel-reception')).toBeVisible();
    await expect(page.locator('[data-testid=redeem-gold]')).toBeDisabled();
    await expect(page.locator('[data-testid=redeem-duck]')).toBeEnabled();
    await page.click('[data-testid=redeem-duck]');
    let s = await state(page);
    expect([s.tickets, s.prizes]).toEqual([70, ['duck']]);
    expect(s.said).toContain('PATITO');
    expect(s.achievements).toContain('prize');
    await page.click('[data-testid=redeem-ghostPlush]');
    s = await state(page);
    expect([s.tickets, s.prizes]).toEqual([10, ['duck', 'ghostPlush']]);
    await expect(page.locator('[data-testid=redeem-keychain]')).toBeDisabled();
    expect(await page.evaluate(() => window.__arcadeTest.prizeCaseCount())).toBe(2);
    await page.keyboard.press('Escape');
    expect((await state(page)).app).toBe('ROOM');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    expect((await storage(page)).users[0]).toMatchObject({ tickets: 10, prizes: ['duck', 'ghostPlush'] });
  });
});

test.describe('salón', () => {
  test('la gramola cambia la canción, se recuerda y da un logro', async ({ page }) => {
    await enterRoom(page, 'MUSICA');
    await faceSide(page, 'jukebox');
    await page.keyboard.press('KeyE');
    expect((await state(page)).app).toBe('JUKEBOX');
    await page.click('[data-testid=track-funk]');
    let s = await state(page);
    expect([s.jukebox, s.settings.jukebox]).toEqual([null === s.jukebox ? null : 'funk', 'funk']);
    expect(s.achievements).toContain('jukebox');
    await expect(page.locator('#jukebox-now')).toContainText('PÍXEL FUNK');
    await page.click('[data-testid=track-off]');
    expect((await state(page)).settings.jukebox).toBe(null);
    await page.click('[data-testid=track-road]');
    await page.click('[data-testid=jukebox-close]');
    expect((await state(page)).app).toBe('ROOM');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    expect((await storage(page)).settings.jukebox).toBe('road');
  });

  test('la máquina de refrescos cobra una moneda y deja una lata en la mano', async ({ page }) => {
    await enterRoom(page, 'SED');
    await faceSide(page, 'vending');
    await page.keyboard.press('KeyE');
    let s = await state(page);
    expect([s.coins, s.hands.can]).toEqual([2, true]);
    expect(s.achievements).toContain('soda');
    await step(page, 13 * 60);
    expect((await state(page)).hands.can).toBe(false);
    await page.evaluate(() => window.__arcadeTest.setCoins(0));
    await step(page, 80);
    await page.keyboard.press('KeyE');
    await expect(page.locator('#toast')).toContainText('1 MONEDA');
    s = await state(page);
    expect([s.coins, s.hands.can]).toEqual([0, false]);
  });

  test('la máquina averiada no se puede usar', async ({ page }) => {
    await enterRoom(page);
    const b = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'broken'));
    await page.evaluate(([x, z]) => window.__arcadeTest.teleport(x, z, 0), [b.front.x, b.front.z + 1.0]);
    await step(page, 2);
    await expect(page.locator('[data-testid=prompt]')).toContainText('FUERA DE SERVICIO');
    await page.keyboard.press('KeyE');
    await step(page, 10);
    expect((await state(page)).app).toBe('ROOM');
    await expect(page.locator('#toast')).toContainText('NO FUNCIONA');
  });

  test('G pone el juego a pantalla grande y otra G vuelve al salón; Q también sale', async ({ page }) => {
    await startPlaying(page, 'maze', 'GRANDE');
    await page.keyboard.press('KeyG');
    let s = await state(page);
    expect(s.big).toBe(true);
    await expect(page.locator('[data-testid=bigscreen]')).toBeVisible();
    await expect(page.locator('#bigscreen-slot canvas')).toHaveCount(1);
    const box = await page.locator('#bigscreen-slot canvas').boundingBox();
    expect(box.height).toBeGreaterThan(600);
    // Se sigue jugando.
    await step(page, 60);
    expect((await state(page)).machines.maze).toBe('PLAYING');
    await page.keyboard.press('KeyG');
    expect((await state(page)).big).toBe(false);
    await expect(page.locator('[data-testid=bigscreen]')).toBeHidden();
    await page.keyboard.press('KeyG');
    await page.keyboard.press('KeyQ');
    await step(page, 60);
    s = await state(page);
    expect([s.app, s.big]).toEqual(['ROOM', false]);
    // También desde el menú de pausa.
    await sitAt(page, 'climb');
    await page.keyboard.press('Escape');
    await page.click('[data-testid=pause-big]');
    expect((await state(page)).big).toBe(true);
  });

  test('PANTALLA COMPLETA desde el menú, sin errores', async ({ page }) => {
    await enterRoom(page);
    await page.keyboard.press('Escape');
    await page.click('[data-testid=menu-fullscreen]');
    await expect.poll(async () => {
      const fs = await page.evaluate(() => !!document.fullscreenElement);
      const toast = await page.locator('#toast').textContent();
      return fs || /PANTALLA COMPLETA/.test(toast);
    }).toBe(true);
  });

  test('el panel de LOGROS muestra los conseguidos', async ({ page }) => {
    await startPlaying(page, 'maze', 'LOGRO');
    await page.evaluate(() => window.__arcadeTest.finishWith(12000, 2));
    await expect(page.locator('#toast')).toContainText(/LOGRO|TICKETS/);
    await page.keyboard.press('KeyQ');
    await step(page, 60);
    await page.keyboard.press('Escape');
    await page.click('[data-testid=menu-achievements]');
    await expect(page.locator('[data-testid=ach-first]')).toHaveClass(/is-done/);
    await expect(page.locator('[data-testid=ach-champion]')).toHaveClass(/is-done/);
    await expect(page.locator('[data-testid=ach-claw]')).not.toHaveClass(/is-done/);
    await expect(page.locator('#achievements-count')).toContainText('DE 14');
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel-menu')).toBeVisible();
  });
});
