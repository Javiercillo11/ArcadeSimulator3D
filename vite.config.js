import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Un único dist/arcade.html con todo dentro (JS, CSS y fuente), que se abre con doble clic.
export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile({ removeViteModuleLoader: true }),
    {
      name: 'rename-to-arcade',
      closeBundle() {
        const from = resolve('dist/index.html');
        if (existsSync(from)) renameSync(from, resolve('dist/arcade.html'));
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    target: 'es2020'
  }
});
