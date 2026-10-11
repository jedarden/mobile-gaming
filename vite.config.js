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
    configureServer(server) {
      // The deployed site flattens source entry points to /<game>/ and /.
      // Mirror those routes in Vite dev mode so E2E tests exercise the same
      // browser URLs while still observing the source modules they assert on.
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const requestURL = new URL(req.url, 'http://localhost');
        const route = requestURL.pathname.replace(/\/+$/, '') || '/';
        let entryPath;
        if (route === '/') entryPath = '/src/hub/index.html';
        else {
          const game = route.slice(1);
          if (gameEntries[game]) entryPath = `/src/games/${game}/index.html`;
        }
        if (entryPath) req.url = `${entryPath}${requestURL.search}`;
        else {
          const match = requestURL.pathname.match(/^\/([^/]+)\/(.+)$/);
          if (match && gameEntries[match[1]]) {
            res.statusCode = 302;
            res.setHeader('Location', `/src/games/${match[1]}/${match[2]}${requestURL.search}`);
            return res.end();
          }
          const sharedStyle = requestURL.pathname.match(/^\/styles\/(.+)$/);
          if (sharedStyle) {
            res.statusCode = 302;
            res.setHeader('Location', `/src/styles/${sharedStyle[1]}${requestURL.search}`);
            return res.end();
          }
          if (requestURL.pathname === '/styles.css') {
            res.statusCode = 302;
            res.setHeader('Location', `/src/hub/styles.css${requestURL.search}`);
            return res.end();
          }
          if (requestURL.pathname === '/hub.js') {
            res.statusCode = 302;
            res.setHeader('Location', `/src/hub/hub.js${requestURL.search}`);
            return res.end();
          }
        }
        next();
      });
    },
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

      // Game levels are fetched at runtime from ./levels.json. Vite does not
      // copy JSON files that are only fetched by URL, so include each game's
      // data file beside its flattened index.html for production previews.
      const sourceGames = resolve(__dirname, 'src/games');
      for (const entry of readdirSync(sourceGames, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const levels = resolve(sourceGames, entry.name, 'levels.json');
        if (existsSync(levels)) {
          copyFileSync(levels, resolve(__dirname, 'dist', entry.name, 'levels.json'));
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
