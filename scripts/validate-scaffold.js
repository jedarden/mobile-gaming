#!/usr/bin/env node

/**
 * CI Scaffold Validation script
 *
 * Local parity for the structural checks of the mobile-gaming-ci Argo
 * WorkflowTemplate's lint step (declarative-config,
 * k8s/iad-ci/argo-workflows/): every src/games/<name>/ directory must
 * contain the seven required scaffold files, and every levels.json must
 * hold at least 3 levels. CI runs those as inline shell; this script is
 * the npm-runnable equivalent, wired into `npm test` via pretest so a
 * violation is visible locally without an Argo round-trip.
 *
 * Usage:
 *   npm run test:scaffold
 *   node scripts/validate-scaffold.js [gamesDir]   # default: src/games
 *
 * Deviations from the Argo shell check, both deliberate:
 *   - all errors are collected and reported, not exit-on-first;
 *   - levels.json must be a top-level array (the shell's `jq 'length'`
 *     would accept any JSON with >= 3 keys).
 *
 * The required-file list is the CLAUDE.md scaffold contract — if its
 * reconciliation (mobgame-1f6de961) settles on a different list, update
 * REQUIRED_FILES here and the CI template together.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export const REQUIRED_FILES = [
  'index.html',
  'game.js',
  'state.js',
  'renderer.js',
  'input.js',
  'styles.css',
  'levels.json',
];

export const MIN_LEVELS = 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const GAMES_DIR = join(ROOT_DIR, 'src', 'games');

/**
 * Validate one game directory. Returns an array of error strings
 * (empty = valid). Pure apart from fs reads — never logs or exits.
 */
export function checkGame(gameDir, displayName = gameDir) {
  const errors = [];

  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(gameDir, file))) {
      errors.push(`${displayName}/ missing required file: ${file}`);
    }
  }

  const levelsPath = join(gameDir, 'levels.json');
  if (existsSync(levelsPath)) {
    let data;
    try {
      data = JSON.parse(readFileSync(levelsPath, 'utf-8'));
    } catch (e) {
      errors.push(`${displayName}/levels.json is not valid JSON: ${e.message}`);
    }
    if (data !== undefined) {
      if (!Array.isArray(data)) {
        errors.push(`${displayName}/levels.json must be a top-level array`);
      } else if (data.length < MIN_LEVELS) {
        errors.push(
          `${displayName}/levels.json has only ${data.length} levels (need >= ${MIN_LEVELS})`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate every game directory under gamesDir.
 * Returns { games: [{ name, errors }], errors: [...] } — errors is the
 * flattened per-game list plus any discovery-level problem (unreadable
 * or empty games directory).
 */
export function validateScaffold(gamesDir = GAMES_DIR) {
  let entries;
  try {
    entries = readdirSync(gamesDir, { withFileTypes: true });
  } catch (e) {
    return { games: [], errors: [`cannot read games directory ${gamesDir}: ${e.message}`] };
  }

  const names = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  const games = names.map(name => ({ name, errors: checkGame(join(gamesDir, name), name) }));
  const errors = games.flatMap(g => g.errors);

  if (names.length === 0) {
    errors.push(
      `no game directories found under ${gamesDir} — the scaffold check would ` +
        'pass vacuously; fix the path'
    );
  }

  return { games, errors };
}

function main() {
  const gamesDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : GAMES_DIR;

  console.log('Mobile Gaming — Scaffold Validation');
  console.log('===================================');

  const { games, errors } = validateScaffold(gamesDir);

  for (const { name, errors: gameErrors } of games) {
    if (gameErrors.length === 0) {
      const levels = JSON.parse(readFileSync(join(gamesDir, name, 'levels.json'), 'utf-8'));
      console.log(
        `✓ ${name} (${REQUIRED_FILES.length}/${REQUIRED_FILES.length} files, ${levels.length} levels)`
      );
    }
  }
  for (const error of errors) {
    console.error(`✗ ${error}`);
  }

  console.log('\n── Summary ──────────────────────────────────────────────────');
  console.log(`Games checked: ${games.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.error(`\n✗ Scaffold validation FAILED (${errors.length} error(s))`);
    process.exit(1);
  }
  console.log(
    `\n✓ All ${games.length} games have the ${REQUIRED_FILES.length} scaffold files and >= ${MIN_LEVELS} levels`
  );
  process.exit(0);
}

// Run as a CLI only when invoked directly (tests import the functions above).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
