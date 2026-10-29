// Monedas (cada partida cuesta una; la máquina de cambio da más) e iniciales en el TOP 10.
import { test, expect, state, step, storage, enterRoom, sitAt, startPlaying } from './helpers.js';

async function goToChange(page) {
  const ch = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'reception'));
  // La recepción está en la pared derecha y mira hacia -x.
  await page.evaluate(([x, z]) => window.__arcadeTest.teleport(x - 1.0, z, -Math.PI / 2), [ch.front.x, ch.front.z]);
  await step(page, 2);
}

test.describe('monedas', () => {
  test('cada partida cuesta una; sin monedas no se puede jugar', async ({ page }) => {
    await enterRoom(page, 'POBRE');
    await expect(page.locator('[data-testid=hud-coins]')).toHaveText('3');
    await sitAt(page, 'maze');
    for (let left = 2; left >= 0; left--) {
      await page.keyboard.press('Enter');
      await step(page, 1);
      expect((await state(page)).machines.maze).toBe('PLAYING');
      expect((await state(page)).coins).toBe(left);
      await page.keyboard.press('Escape');
      await page.click('[data-testid=pause-stand]');
      await step(page, 60);
      await sitAt(page, 'maze');
    }
    // Sin monedas: ENTER no empieza y la pantalla de título lo avisa.
    await page.keyboard.press('Enter');
    await step(page, 5);
    expect((await state(page)).machines.maze).toBe('TITLE');
    await expect(page.locator('[data-testid=hud-coins]')).toHaveText('0');
    await expect(page.locator('#hud-coins')).toHaveClass(/is-empty/);
    // REINICIAR también cuesta una moneda: desactivado sin monedas.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid=pause-restart]')).toBeDisabled();
    await expect(page.locator('[data-testid=pause-restart]')).toHaveText('REINICIAR (SIN MONEDAS)');
  });

  test('Mari, en recepción, da 5 monedas, hasta 30, y se guardan al recargar', async ({ page }) => {
    await enterRoom(page, 'RICO');
    await goToChange(page);
    const s = await state(page);
    expect(s.prompt).toBe('reception');
    await expect(page.locator('[data-testid=prompt]')).toContainText('HABLAR CON MARI');
    await page.keyboard.press('KeyE');
    expect((await state(page)).app).toBe('RECEPTION');
    expect((await state(page)).said).toContain('¡HOLA, RICO!');
    await page.click('[data-testid=reception-coins]');
    await step(page, 60);
    expect((await state(page)).coins).toBe(8);
    await expect(page.locator('[data-testid=hud-coins]')).toHaveText('8');
    await expect(page.locator('#toast')).toContainText('+5 MONEDAS');
    // Mari deja las monedas en el mostrador.
    expect(await page.evaluate(() => window.__arcadeTest.coinsVisible())).toBe(5);
    expect((await state(page)).said).toContain('5 MONEDAS');
    await expect(page.locator('[data-testid=reception-wallet]')).toContainText('TIENES 8 MONEDAS');
    // Hasta el máximo de 30 (la última vez da solo las que faltan).
    for (let i = 0; i < 6; i++) await page.click('[data-testid=reception-coins]');
    expect((await state(page)).coins).toBe(30);
    await page.click('[data-testid=reception-coins]');
    await expect(page.locator('#toast')).toContainText('30 MONEDAS');
    expect((await state(page)).coins).toBe(30);
    await page.click('[data-testid=reception-bye]');
    expect((await state(page)).app).toBe('ROOM');
    // El mostrador no se puede atravesar.
    await page.keyboard.down('KeyW');
    await step(page, 200);
    await page.keyboard.up('KeyW');
    const ch = await page.evaluate(() => window.__arcadeTest.cabinets().find((c) => c.id === 'reception'));
    expect((await state(page)).player.x).toBeLessThanOrEqual(ch.minX - 0.27);
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    expect((await storage(page)).users[0].coins).toBe(30);
  });
});

test.describe('iniciales', () => {
  test('una puntuación del TOP 10 pide tres iniciales con la palanca y las pone en el tablero', async ({ page }) => {
    await startPlaying(page, 'climb', 'JAVI');
    await page.evaluate(() => window.__arcadeTest.finishWith(7200, 4, false));
    let m = await page.evaluate(() => window.__arcadeTest.machine('climb'));
    expect(m.state).toBe('ENTER_INITIALS');
    expect(m.initials).toEqual({ value: 'JAV', cursor: 0 });
    // ↑ cambia la letra, → mueve el cursor, ↓ va hacia atrás, ESPACIO confirma.
    await page.keyboard.press('ArrowUp');
    await step(page, 2);
    await page.keyboard.press('ArrowRight');
    await step(page, 2);
    await page.keyboard.press('ArrowDown');
    await step(page, 2);
    m = await page.evaluate(() => window.__arcadeTest.machine('climb'));
    // Antes de la «A» va el espacio: el alfabeto da la vuelta.
    expect(m.initials).toEqual({ value: 'K V', cursor: 1 });
    await page.keyboard.press('Space');
    await step(page, 2);
    await page.keyboard.press('ArrowUp');
    await step(page, 2);
    await page.keyboard.press('Enter');
    await step(page, 2);
    m = await page.evaluate(() => window.__arcadeTest.machine('climb'));
    expect(m.state).toBe('NEW_RECORD');
    expect(m.result).toMatchObject({ score: 7200, initials: 'K W', rank: 2, isRecord: true });
    const hof = await page.evaluate(() => window.__arcadeTest.hallOfFame('climb'));
    expect(hof[2]).toMatchObject({ initials: 'K W', score: 7200, level: 4 });
    expect(hof).toHaveLength(10);
    expect((await page.evaluate(() => window.__arcadeTest.boardRows())).climb[2].initials).toBe('K W');
    // Las iniciales se recuerdan para la próxima vez.
    expect((await storage(page)).users[0].initials).toBe('K W');
    await step(page, 61);
    await page.keyboard.press('Enter');
    await step(page, 1);
    await page.evaluate(() => window.__arcadeTest.finishWith(6100, 1, false));
    expect((await page.evaluate(() => window.__arcadeTest.machine('climb'))).initials.value).toBe('K W');
  });

  test('una puntuación que no entra en el TOP 10 no pide iniciales', async ({ page }) => {
    await startPlaying(page, 'maze', 'BAJO');
    const s = await page.evaluate(() => window.__arcadeTest.finishWith(300, 1, false));
    expect(s.machines.maze).toBe('NEW_RECORD');
    const m = await page.evaluate(() => window.__arcadeTest.machine('maze'));
    expect(m.result).toMatchObject({ score: 300, rank: -1, isRecord: true });
    expect((await page.evaluate(() => window.__arcadeTest.hallOfFame('maze'))).some((e) => e.userId)).toBe(false);
  });

  test('levantarse mientras se ponen las iniciales las guarda igualmente', async ({ page }) => {
    await startPlaying(page, 'maze', 'PRISA');
    await page.evaluate(() => window.__arcadeTest.finishWith(9000, 2, false));
    await page.keyboard.press('KeyQ');
    await step(page, 60);
    expect((await state(page)).app).toBe('ROOM');
    const hof = await page.evaluate(() => window.__arcadeTest.hallOfFame('maze'));
    expect(hof[1]).toMatchObject({ initials: 'PRI', score: 9000 });
  });
});
