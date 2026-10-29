// Configuración de Playwright (solo desarrollo). Las pruebas abren dist/arcade.html por file://, sin servidor.
import { defineConfig } from '@playwright/test';
import { launchEnv } from './tests/e2e/helpers.js';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.js$/,
  timeout: 60000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1366, height: 768 },
    launchOptions: { env: launchEnv() }
  },
  projects: [
    { name: 'e2e', testIgnore: /realtime\.spec\.js/ },
    // Tiempo real con el ratón capturado: al final y sin otras pruebas compitiendo por la CPU.
    { name: 'realtime', testMatch: /realtime\.spec\.js/, dependencies: ['e2e'] }
  ]
});
