// Configuración de Playwright (solo desarrollo). Las pruebas abren index.html por file://, sin servidor.
const { defineConfig } = require('@playwright/test');
const { launchEnv } = require('./tests/helpers');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js$/,
  timeout: 60000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1366, height: 768 },
    launchOptions: { env: launchEnv() }
  }
});
