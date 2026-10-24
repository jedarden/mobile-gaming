/**
 * Scaffold Validation - Unit Tests
 *
 * Tests for scripts/validate-scaffold.js, the local parity of the
 * mobile-gaming-ci Argo lint step's structural checks: the seven
 * required scaffold files per game and the >= 3 levels rule. The
 * fixtures here are the regression proof that the check actually fires
 * on each violation class, not just that it passes the real tree.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  REQUIRED_FILES,
  MIN_LEVELS,
  checkGame,
  validateScaffold,
} from '../../scripts/validate-scaffold.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

let fixtureRoot;

function writeGame(name, { levels = [{}, {}, {}], omit = [] } = {}) {
  const gameDir = join(fixtureRoot, name);
  mkdirSync(gameDir, { recursive: true });
  for (const file of REQUIRED_FILES) {
    if (omit.includes(file)) continue;
    if (file === 'levels.json') {
      writeFileSync(join(gameDir, file), JSON.stringify(levels));
    } else {
      writeFileSync(join(gameDir, file), '// fixture\n');
    }
  }
  return gameDir;
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'validate-scaffold-'));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

// ── REQUIRED_FILES / MIN_LEVELS contract ───────────────────────────────────

describe('contract', () => {
  it('lists exactly the seven CLAUDE.md scaffold files', () => {
    expect(REQUIRED_FILES).toEqual([
      'index.html',
      'game.js',
      'state.js',
      'renderer.js',
      'input.js',
      'styles.css',
      'levels.json',
    ]);
  });

  it('requires at least 3 levels', () => {
    expect(MIN_LEVELS).toBe(3);
  });
});

// ── checkGame ───────────────────────────────────────────────────────────────

describe('checkGame', () => {
  it('accepts a complete game with 3 levels', () => {
    const dir = writeGame('complete-game');
    expect(checkGame(dir, 'complete-game')).toEqual([]);
  });

  it('flags each missing scaffold file', () => {
    const dir = writeGame('incomplete', { omit: ['styles.css', 'input.js'] });
    const errors = checkGame(dir, 'incomplete');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBe('incomplete/ missing required file: input.js');
    expect(errors[1]).toBe('incomplete/ missing required file: styles.css');
  });

  it('flags levels.json with fewer than 3 levels', () => {
    const dir = writeGame('too-few', { levels: [{ id: 'a' }, { id: 'b' }] });
    expect(checkGame(dir, 'too-few')).toEqual([
      'too-few/levels.json has only 2 levels (need >= 3)',
    ]);
  });

  it('flags levels.json that is not a top-level array', () => {
    const dir = writeGame('not-an-array');
    writeFileSync(join(dir, 'levels.json'), JSON.stringify({ a: 1, b: 2, c: 3, d: 4 }));
    expect(checkGame(dir, 'not-an-array')).toEqual([
      'not-an-array/levels.json must be a top-level array',
    ]);
  });

  it('flags levels.json that does not parse', () => {
    const dir = writeGame('bad-json');
    writeFileSync(join(dir, 'levels.json'), '[{"id": "a"},');
    const errors = checkGame(dir, 'bad-json');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/bad-json\/levels\.json is not valid JSON/);
  });

  it('reports only the missing file when levels.json is absent', () => {
    const dir = writeGame('no-levels', { omit: ['levels.json'] });
    expect(checkGame(dir, 'no-levels')).toEqual([
      'no-levels/ missing required file: levels.json',
    ]);
  });
});

// ── validateScaffold ────────────────────────────────────────────────────────

describe('validateScaffold', () => {
  it('passes the real repository tree', () => {
    const { games, errors } = validateScaffold();
    expect(errors).toEqual([]);
    const names = games.map(g => g.name);
    expect(names.length).toBeGreaterThanOrEqual(13);
    expect(names).toContain('water-sort');
    for (const game of games) {
      expect(game.errors).toEqual([]);
    }
  });

  it('collects errors across games instead of stopping at the first', () => {
    writeGame('good-game');
    writeGame('missing-file', { omit: ['index.html'] });
    writeGame('too-few', { levels: [] });

    const { games, errors } = validateScaffold(fixtureRoot);
    expect(errors).toHaveLength(2);
    expect(games.map(g => g.name)).toEqual(['good-game', 'missing-file', 'too-few']);
  });

  it('fails rather than passing vacuously on an empty games directory', () => {
    const { games, errors } = validateScaffold(fixtureRoot);
    expect(games).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no game directories found/);
  });

  it('reports an unreadable games directory', () => {
    const { games, errors } = validateScaffold(join(fixtureRoot, 'does-not-exist'));
    expect(games).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/cannot read games directory/);
  });
});
