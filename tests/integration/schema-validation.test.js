/**
 * JSON Schema Validation Integration Tests
 *
 * Validates every game's levels.json against its JSON Schema (draft-07).
 * Each level must conform to the schema — no additional properties beyond
 * what the schema declares, all required fields present and correctly typed.
 *
 * Games covered: all 13 games that have both a schema and a levels.json.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync }  from 'node:fs';
import { fileURLToPath }             from 'node:url';
import { join, dirname }             from 'node:path';
import Ajv                           from 'ajv';

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '../..');
const SCHEMAS = join(ROOT, 'schemas');
const GAMES   = join(ROOT, 'src/games');

const GAME_NAMES = [
  'brain-teaser',
  'bus-jam',
  'giant-runner',
  'jelly-shift',
  'pull-the-pin',
  'save-the-character',
  'water-sort',
  'crowd-runner',
  'bridge-race',
  'makeover-run',
  'parking-escape',
  'merge-games',
  'satisfying-asmr',
];

const ajv = new Ajv({ allErrors: true });

// Pre-load schemas + levels for each game that has both files
const entries = GAME_NAMES
  .map(name => ({
    name,
    schemaPath: join(SCHEMAS, `${name}.schema.json`),
    levelsPath: join(GAMES, name, 'levels.json'),
  }))
  .filter(({ schemaPath, levelsPath }) =>
    existsSync(schemaPath) && existsSync(levelsPath)
  )
  .map(({ name, schemaPath, levelsPath }) => ({
    name,
    schema:  JSON.parse(readFileSync(schemaPath, 'utf8')),
    levels:  JSON.parse(readFileSync(levelsPath, 'utf8')),
  }));

// ── top-level: every game has a schema ─────────────────────────────────────

describe('schema-validation — coverage', () => {
  it('all 13 games have a schema and levels.json', () => {
    expect(entries.length).toBe(13);
  });
});

// ── per-game suites ─────────────────────────────────────────────────────────

for (const { name, schema, levels } of entries) {
  describe(`schema-validation — ${name}`, () => {
    const validate = ajv.compile(schema);

    it('levels.json is a non-empty array', () => {
      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBeGreaterThan(0);
    });

    it('every level passes the JSON schema', () => {
      const failures = [];
      for (const level of levels) {
        if (!validate(level)) {
          failures.push({
            id:     level.id ?? '(no id)',
            errors: validate.errors.map(e => `${e.dataPath || '.'} ${e.message}`),
          });
        }
      }
      if (failures.length > 0) {
        const summary = failures
          .map(f => `  ${f.id}: ${f.errors.join('; ')}`)
          .join('\n');
        throw new Error(
          `${failures.length}/${levels.length} level(s) failed schema validation:\n${summary}`
        );
      }
    });

    it('every level has a defined id field', () => {
      for (const level of levels) {
        expect(level.id, `level at index ${levels.indexOf(level)}`).toBeDefined();
      }
    });
  });
}
