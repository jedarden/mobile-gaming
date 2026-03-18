// vite.config.js
import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Auto-discover game entry points — adding a new game means adding a directory, not editing config
const gamesDir = resolve(__dirname, 'src/games');
const gameEntries = existsSync(gamesDir)
  ? Object.fromEntries(
      readdirSync(gamesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => [d.name, resolve(gamesDir, d.name, 'index.html')])
    )
  : {};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'src/hub/index.html'),
        ...gameEntries   // auto-discovers all games
      }
    }
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'   // solvers are pure functions, no DOM needed
  }
});
