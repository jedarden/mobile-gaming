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
  let outputDir = resolve(__dirname, 'dist');

  return {
    name: 'flatten-src-output',
    configResolved(config) {
      outputDir = config.build.outDir;
    },
    closeBundle() {
      const distSrc = resolve(outputDir, 'src');
      if (!existsSync(distSrc)) return;

      // Move <outDir>/src/hub -> <outDir>/hub
      const srcHub = resolve(distSrc, 'hub');
      if (existsSync(srcHub)) {
        renameSync(srcHub, resolve(outputDir, 'hub'));
      }

      // Move <outDir>/src/games/* -> <outDir>/*
      const srcGames = resolve(distSrc, 'games');
      if (existsSync(srcGames)) {
        for (const entry of readdirSync(srcGames, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            renameSync(resolve(srcGames, entry.name), resolve(outputDir, entry.name));
          }
        }
      }

      // Game levels are fetched at runtime from ./levels.json. Vite does not
      // copy JSON files that are only fetched by URL, so include each game's
      // data file beside its flattened index.html for production previews.
      const sourceGames = resolve(__dirname, 'src/games');
      for (const entry of readdirSync(sourceGames, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const levels = resolve(sourceGames, entry.name, 'levels.json');
        if (existsSync(levels)) {
          copyFileSync(levels, resolve(outputDir, entry.name, 'levels.json'));
        }
      }

      // Clean up empty dist/src
      rmSync(distSrc, { recursive: true, force: true });

      // Copy hub/index.html to root index.html so / serves the hub directly
      const hubIndex = resolve(outputDir, 'hub/index.html');
      if (existsSync(hubIndex)) {
        copyFileSync(hubIndex, resolve(outputDir, 'index.html'));
      }

      // Write version.json with the current git SHA for deploy verification
      let sha = 'unknown';
      try { sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch (_) {}
      writeFileSync(resolve(outputDir, 'version.json'), JSON.stringify({ sha }));
    }
  };
}

export default defineConfig({
  build: {
    // Phaser and Three.js are intentionally retained as shared vendor chunks.
    // The CI bundle gate enforces the 3,000KB total budget explicitly.
    chunkSizeWarningLimit: 3000,
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
