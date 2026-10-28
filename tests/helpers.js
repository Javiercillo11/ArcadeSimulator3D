// Utilidades compartidas por las pruebas.
const path = require('path');
const fs = require('fs');
const os = require('os');
const base = require('@playwright/test');

const INDEX = 'file://' + path.resolve(__dirname, '..', 'index.html');
const TEST_URL = INDEX + '?test=1';

// En WSL sin dependencias del sistema, una copia local de libasound permite arrancar Chromium.
function launchEnv() {
  const env = Object.assign({}, process.env);
  const local = path.join(os.homedir(), '.cache', 'arcade-libs', 'root', 'usr', 'lib', 'x86_64-linux-gnu');
  if (fs.existsSync(local)) env.LD_LIBRARY_PATH = local + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
  return env;
}

// Cada prueba falla si aparece cualquier error en consola o excepción de página.
const test = base.test.extend({
  consoleErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
    base.expect(errors, 'errores en consola').toEqual([]);
  }, { auto: true }]
});
const expect = base.expect;

async function open(page, url) {
  await page.goto(url || TEST_URL);
  await page.waitForSelector('html[data-ready]');
}

async function createUser(page, name) {
  if (await page.locator('#panel-users').isHidden()) await page.click('[data-testid=btn-switch]');
  await page.fill('[data-testid=user-name-input]', name);
  await page.click('[data-testid=user-create]');
}

const hook = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => page.evaluate(() => window.__arcadeTest.state());
const gameState = (page) => page.evaluate(() => window.__arcadeTest.game().state());
const step = (page, n) => page.evaluate((k) => window.__arcadeTest.step(k), n);
const storage = (page) => page.evaluate(() => window.__arcadeTest.storage());

// Abre un juego con un jugador y lo deja en PLAYING, con semilla fija.
async function startPlaying(page, gameId, name) {
  await open(page);
  await createUser(page, name || 'TEST');
  await page.evaluate((id) => { window.__arcadeTest.setSeed(12345); window.__arcadeTest.startGame(id); }, gameId);
  await page.evaluate(() => window.__arcadeTest.game().startPlaying());
}

module.exports = { test, expect, INDEX, TEST_URL, launchEnv, open, createUser, hook, state, gameState, step, storage, startPlaying };
