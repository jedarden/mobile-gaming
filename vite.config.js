// vite.config.js
import { defineConfig } from 'vite';
import { readdirSync, existsSync, renameSync, rmSync, copyFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Auto-discover game entry points by globbing src/games/*/index.html
// Adding a new game means adding a directory with index.html, not editing config
const gamesDir = resolve(__dirname, 'src/games');
const gameEntries = existsSync(gamesDir)
  ? Object.fromEntries(
      readdirSync(gamesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => [d.name, resolve(gamesDir, d.name, 'index.html')])
        .filter(([, htmlPath]) => existsSync(htmlPath))
    )
  : {};

// Vite outputs HTML relative to project root, so src/hub/index.html -> dist/src/hub/index.html.
// Cloudflare Pages _redirects expect /hub/ and /<game>/, not /src/hub/ and /src/games/<game>/.
// This plugin moves dist/src/* up to dist/* after build.
function flattenSrcOutput() {
  return {
    name: 'flatten-src-output',
    closeBundle() {
      const distSrc = resolve(__dirname, 'dist/src');
      if (!existsSync(distSrc)) return;

      // Move dist/src/hub -> dist/hub
      const srcHub = resolve(distSrc, 'hub');
      if (existsSync(srcHub)) {
        renameSync(srcHub, resolve(__dirname, 'dist/hub'));
      }

      // Move dist/src/games/* -> dist/*
      const srcGames = resolve(distSrc, 'games');
      if (existsSync(srcGames)) {
        for (const entry of readdirSync(srcGames, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            renameSync(resolve(srcGames, entry.name), resolve(__dirname, 'dist', entry.name));
          }
        }
      }

      // Clean up empty dist/src
      rmSync(distSrc, { recursive: true, force: true });

      // Copy hub/index.html to root index.html so / serves the hub directly
      const hubIndex = resolve(__dirname, 'dist/hub/index.html');
      if (existsSync(hubIndex)) {
        copyFileSync(hubIndex, resolve(__dirname, 'dist/index.html'));
      }

      // Write version.json with the current git SHA for deploy verification
      let sha = 'unknown';
      try { sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch (_) {}
      writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify({ sha }));
    }
  };
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'src/hub/index.html'),
        ...gameEntries   // auto-discovers all games
      }
    }
  },
  plugins: [flattenSrcOutput()],
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'   // solvers are pure functions, no DOM needed
  }
});
