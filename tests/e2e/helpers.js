// Utilidades compartidas por las pruebas e2e (sobre el HTML final, dist/arcade.html).
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as base from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PAGE = 'file://' + path.join(ROOT, 'dist', 'arcade.html');
export const TEST_URL = PAGE + '?test=1';

// En WSL sin dependencias del sistema, una copia local de libasound permite arrancar Chromium.
export function launchEnv() {
  const env = Object.assign({}, process.env);
  const local = path.join(os.homedir(), '.cache', 'arcade-libs', 'root', 'usr', 'lib', 'x86_64-linux-gnu');
  if (fs.existsSync(local)) env.LD_LIBRARY_PATH = local + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
  return env;
}

// Mensajes del driver gráfico por software (SwiftShader) que no son errores de la aplicación.
const IGNORED = [/GPU stall due to ReadPixels/, /GL Driver Message/];

// Cada prueba falla si aparece cualquier error en consola o excepción de página.
export const test = base.test.extend({
  consoleErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
    base.expect(errors, 'errores en consola').toEqual([]);
  }, { auto: true }]
});
export const expect = base.expect;

export async function open(page, url) {
  await page.goto(url || TEST_URL);
  await page.waitForSelector('html[data-ready]');
}

export const hook = (page, fn, arg) => page.evaluate(fn, arg);
export const state = (page) => page.evaluate(() => window.__arcadeTest.state());
export const step = (page, n) => page.evaluate((k) => window.__arcadeTest.step(k), n);
export const storage = (page) => page.evaluate(() => window.__arcadeTest.storage());

export async function createUser(page, name) {
  await page.fill('[data-testid=user-name-input]', name);
  await page.click('[data-testid=user-create]');
}

// Crea (o elige) un jugador y entra en la sala.
export async function enterRoom(page, name = 'TEST') {
  await open(page);
  await createUser(page, name);
  await page.click('[data-testid=enter-room]');
  await expect.poll(async () => (await state(page)).app).toBe('ROOM');
}

// Deja al jugador delante de una máquina, mirándola, y se sienta con E.
export async function sitAt(page, id) {
  const cab = await page.evaluate((cid) => window.__arcadeTest.cabinets().find((c) => c.id === cid), id);
  await page.evaluate(([x, z]) => window.__arcadeTest.teleport(x, z, 0), [cab.front.x, cab.front.z + 1.0]);
  await step(page, 2);
  expect((await state(page)).prompt).toBe(id);
  await page.keyboard.press('KeyE');
  await step(page, 60);
  const s = await state(page);
  expect(s.app).toBe('CABINET');
  expect(s.machines[id]).toBe('TITLE');
}

// Sentado: empieza la partida con ENTER y la deja en PLAYING.
export async function startPlaying(page, id, name) {
  await enterRoom(page, name);
  await page.evaluate(() => window.__arcadeTest.setSeed(12345));
  await sitAt(page, id);
  await page.keyboard.press('Enter');
  await step(page, 1);
  expect((await state(page)).machines[id]).toBe('PLAYING');
}
