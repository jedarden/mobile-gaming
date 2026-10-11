/**
 * Game auto-discovery integration coverage.
 *
 * The production build discovers game entries from src/games/<game>/index.html and
 * flattens them so /<game>/ is a deployable route. This test keeps that
 * contract dynamic: adding a game directory automatically adds coverage.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import viteConfig from '../../vite.config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES_DIR = join(ROOT, 'src/games');

const GAME_DIRS = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

const GAME_INPUTS = Object.fromEntries(
  Object.entries(viteConfig.build.rollupOptions.input)
    .filter(([name]) => name !== 'hub')
);

let temporaryBuildDir;

afterEach(() => {
  if (temporaryBuildDir) {
    rmSync(temporaryBuildDir, { recursive: true, force: true });
    temporaryBuildDir = undefined;
  }
});

describe('game auto-discovery', () => {
  it('registers every game directory as a Vite HTML entry', () => {
    expect(Object.keys(GAME_INPUTS).sort()).toEqual(GAME_DIRS);

    for (const game of GAME_DIRS) {
      expect(GAME_INPUTS[game]).toBe(join(GAMES_DIR, game, 'index.html'));
    }
  });

  it('builds every discovered game and emits its deployable route', async () => {
    temporaryBuildDir = mkdtempSync(join(tmpdir(), 'mobile-gaming-discovery-'));

    await build({
      root: ROOT,
      configFile: false,
      logLevel: 'silent',
      plugins: viteConfig.plugins,
      build: {
        ...viteConfig.build,
        outDir: temporaryBuildDir,
        emptyOutDir: true,
      },
    });

    for (const game of GAME_DIRS) {
      const routeDir = join(temporaryBuildDir, game);
      const routeHtml = join(routeDir, 'index.html');

      expect(existsSync(routeHtml), `missing /${game}/ route`).toBe(true);
      expect(readFileSync(routeHtml, 'utf8')).toContain('<main');
      expect(existsSync(join(routeDir, 'levels.json')), `missing /${game}/levels.json`).toBe(true);
    }
  });
});
