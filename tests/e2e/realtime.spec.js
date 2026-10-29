// Uso real, sin ganchos de prueba ni pasos manuales: tiempo real, teclado y ratón capturado.
// Va en un proyecto aparte que se ejecuta al final y solo: el 3D se dibuja por software y, con
// otras pruebas en paralelo, Chromium tarda en devolver el ESC que suelta el ratón.
import { test, expect, open, PAGE } from './helpers.js';

test('tiempo real: andar, capturar el ratón, ESC abre el menú y CONTINUAR lo recupera', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 800, height: 600 });
  await open(page, PAGE);
  expect(await page.evaluate(() => typeof window.__arcadeTest)).toBe('undefined');
  await page.fill('[data-testid=user-name-input]', 'REAL');
  await page.keyboard.press('Enter');
  await page.click('[data-testid=enter-room]');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ROOM');

  // Al entrar se captura el ratón (si el navegador lo permite) y se puede andar en tiempo real.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await page.mouse.move(420, 300);
  await page.mouse.click(400, 300);
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await expect(page.locator('#lock-hint')).toBeHidden();

  // ESC: el navegador suelta el ratón y la sala abre su menú.
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ROOM_MENU');
  await expect(page.locator('#panel-menu')).toBeVisible();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);

  // CONTINUAR (un clic: el gesto que exige el navegador) vuelve a la sala y recaptura el ratón.
  await page.click('[data-testid=menu-resume]');
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ROOM');
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await page.waitForTimeout(500);
});
