/**
 * Migrations — Unit Tests
 *
 * Tests the schema migration pipeline: registration, sequential application,
 * error handling, and all helper factories (mapItems, renameProperties, etc.).
 * All functions are pure — no mocking required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrations,
  registerMigration,
  runMigrations,
  migrateWithDefault,
  getLatestVersion,
  hasMigration,
  mapItems,
  mapProperty,
  renameProperties,
  addDefaults,
  transformEnum,
  chain,
  validate,
} from '../../src/shared/migrations.js';

// Clear the shared migrations registry before every test
beforeEach(() => {
  migrations.length = 0;
});

// ─── registerMigration ────────────────────────────────────────────────────────

describe('registerMigration', () => {
  it('adds a migration to the registry', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    expect(migrations).toHaveLength(1);
  });

  it('stores the migration with correct from/to/migrate', () => {
    const fn = d => d;
    registerMigration({ from: 1, to: 2, migrate: fn });
    expect(migrations[0]).toEqual({ from: 1, to: 2, migrate: fn });
  });

  it('sorts migrations by from-version after insertion', () => {
    registerMigration({ from: 3, to: 4, migrate: d => d });
    registerMigration({ from: 1, to: 2, migrate: d => d });
    registerMigration({ from: 2, to: 3, migrate: d => d });
    expect(migrations.map(m => m.from)).toEqual([1, 2, 3]);
  });

  it('multiple registrations accumulate', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    registerMigration({ from: 2, to: 3, migrate: d => d });
    expect(migrations).toHaveLength(2);
  });
});

// ─── getLatestVersion ─────────────────────────────────────────────────────────

describe('getLatestVersion', () => {
  it('returns 1 when no migrations are registered', () => {
    expect(getLatestVersion()).toBe(1);
  });

  it('returns the highest target version', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    registerMigration({ from: 2, to: 3, migrate: d => d });
    expect(getLatestVersion()).toBe(3);
  });

  it('works with a single migration', () => {
    registerMigration({ from: 1, to: 5, migrate: d => d });
    expect(getLatestVersion()).toBe(5);
  });
});

// ─── hasMigration ─────────────────────────────────────────────────────────────

describe('hasMigration', () => {
  it('returns false when no migrations registered', () => {
    expect(hasMigration(1, 2)).toBe(false);
  });

  it('returns true when exact from/to match exists', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    expect(hasMigration(1, 2)).toBe(true);
  });

  it('returns false for non-matching from/to', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    expect(hasMigration(2, 3)).toBe(false);
    expect(hasMigration(1, 3)).toBe(false);
  });

  it('returns false when only from matches', () => {
    registerMigration({ from: 1, to: 2, migrate: d => d });
    expect(hasMigration(1, 5)).toBe(false);
  });
});

// ─── runMigrations ────────────────────────────────────────────────────────────

describe('runMigrations — no-op', () => {
  it('returns data unchanged when fromVersion === toVersion', () => {
    const data = { x: 1 };
    expect(runMigrations(data, 1, 1)).toBe(data);
  });

  it('returns data unchanged when no migrations apply', () => {
    // No migrations registered; fromVersion 1, toVersion 1
    const data = { x: 1 };
    expect(runMigrations(data, 1, 1)).toBe(data);
  });
});

describe('runMigrations — backward error', () => {
  it('throws when fromVersion > toVersion', () => {
    expect(() => runMigrations({}, 3, 1)).toThrow(/backwards/i);
  });
});

describe('runMigrations — single step', () => {
  it('applies a single migration and returns transformed data', () => {
    registerMigration({
      from: 1, to: 2,
      migrate: data => ({ ...data, version: 2 }),
    });
    const result = runMigrations({ value: 'hello' }, 1, 2);
    expect(result).toEqual({ value: 'hello', version: 2 });
  });

  it('passes data through the migration function', () => {
    const spy = d => ({ ...d, migrated: true });
    registerMigration({ from: 1, to: 2, migrate: spy });
    const result = runMigrations({ a: 1 }, 1, 2);
    expect(result.migrated).toBe(true);
  });
});

describe('runMigrations — multi-step chain', () => {
  it('chains migrations v1→v2→v3 sequentially', () => {
    registerMigration({ from: 1, to: 2, migrate: d => ({ ...d, step1: true }) });
    registerMigration({ from: 2, to: 3, migrate: d => ({ ...d, step2: true }) });
    const result = runMigrations({ original: true }, 1, 3);
    expect(result).toEqual({ original: true, step1: true, step2: true });
  });

  it('applies only migrations within the requested range', () => {
    registerMigration({ from: 1, to: 2, migrate: d => ({ ...d, step1: true }) });
    registerMigration({ from: 2, to: 3, migrate: d => ({ ...d, step2: true }) });
    // Only migrate 1→2
    const result = runMigrations({ original: true }, 1, 2);
    expect(result).toEqual({ original: true, step1: true });
    expect(result.step2).toBeUndefined();
  });
});

describe('runMigrations — missing path', () => {
  it('returns null when no migration path exists', () => {
    // Registered 1→2 but asking 1→3 with no 2→3
    registerMigration({ from: 1, to: 2, migrate: d => d });
    const result = runMigrations({}, 1, 3);
    expect(result).toBeNull();
  });
});

describe('runMigrations — error handling', () => {
  it('returns null when a migration function throws', () => {
    registerMigration({
      from: 1, to: 2,
      migrate: () => { throw new Error('bad migration'); },
    });
    const result = runMigrations({}, 1, 2);
    expect(result).toBeNull();
  });
});

describe('runMigrations — default toVersion', () => {
  it('migrates to latest version when toVersion omitted', () => {
    registerMigration({ from: 1, to: 2, migrate: d => ({ ...d, v: 2 }) });
    registerMigration({ from: 2, to: 3, migrate: d => ({ ...d, v: 3 }) });
    const result = runMigrations({ v: 1 }, 1);
    expect(result).toEqual({ v: 3 });
  });
});

// ─── migrateWithDefault ───────────────────────────────────────────────────────

describe('migrateWithDefault', () => {
  it('returns migrated data on success', () => {
    registerMigration({ from: 1, to: 2, migrate: d => ({ ...d, ok: true }) });
    const result = migrateWithDefault({ val: 1 }, 1, { default: true }, 2);
    expect(result).toEqual({ val: 1, ok: true });
  });

  it('returns defaultValue when migration returns null', () => {
    // No migration registered → path missing → null
    const def = { fallback: true };
    const result = migrateWithDefault({}, 1, def, 3);
    expect(result).toBe(def);
  });

  it('returns defaultValue when migration throws', () => {
    registerMigration({ from: 1, to: 2, migrate: () => { throw new Error(); } });
    const def = { fallback: true };
    expect(migrateWithDefault({}, 1, def, 2)).toBe(def);
  });
});

// ─── mapItems helper ──────────────────────────────────────────────────────────

describe('mapItems', () => {
  it('maps each item with the provided function', () => {
    const double = x => x * 2;
    const migrator = mapItems(double);
    expect(migrator([1, 2, 3])).toEqual([2, 4, 6]);
  });

  it('throws when data is not an array', () => {
    const migrator = mapItems(x => x);
    expect(() => migrator({ notArray: true })).toThrow(/array/i);
    expect(() => migrator(null)).toThrow(/array/i);
  });

  it('works with empty array', () => {
    const migrator = mapItems(x => x + 1);
    expect(migrator([])).toEqual([]);
  });

  it('can be used in a registerMigration', () => {
    registerMigration({
      from: 1, to: 2,
      migrate: mapItems(item => ({ ...item, migrated: true })),
    });
    const result = runMigrations([{ id: 1 }, { id: 2 }], 1, 2);
    expect(result).toEqual([{ id: 1, migrated: true }, { id: 2, migrated: true }]);
  });
});

// ─── mapProperty helper ───────────────────────────────────────────────────────

describe('mapProperty', () => {
  it('transforms a specific property', () => {
    const migrator = mapProperty('count', n => n * 10);
    expect(migrator({ count: 5, name: 'test' })).toEqual({ count: 50, name: 'test' });
  });

  it('leaves other properties unchanged', () => {
    const migrator = mapProperty('x', v => v + 1);
    const result = migrator({ x: 1, y: 2, z: 3 });
    expect(result.y).toBe(2);
    expect(result.z).toBe(3);
  });

  it('throws when data is not an object', () => {
    const migrator = mapProperty('key', v => v);
    expect(() => migrator(null)).toThrow(/object/i);
    expect(() => migrator('string')).toThrow(/object/i);
  });

  it('handles missing property gracefully (passes undefined to valueMigrator)', () => {
    const migrator = mapProperty('missing', v => v ?? 'default');
    const result = migrator({ other: 1 });
    expect(result.missing).toBe('default');
  });
});

// ─── renameProperties helper ──────────────────────────────────────────────────

describe('renameProperties', () => {
  it('renames a property', () => {
    const migrator = renameProperties({ oldName: 'newName' });
    const result = migrator({ oldName: 'value', other: 1 });
    expect(result.newName).toBe('value');
    expect(result.oldName).toBeUndefined();
  });

  it('does not rename if old key absent', () => {
    const migrator = renameProperties({ missing: 'present' });
    const result = migrator({ other: 1 });
    expect(result.present).toBeUndefined();
    expect(result.other).toBe(1);
  });

  it('does not overwrite existing new key', () => {
    // If newName already exists, skip the rename
    const migrator = renameProperties({ oldName: 'newName' });
    const result = migrator({ oldName: 'old', newName: 'existing' });
    expect(result.newName).toBe('existing');
  });

  it('handles non-object data by returning it unchanged', () => {
    const migrator = renameProperties({ a: 'b' });
    expect(migrator(null)).toBeNull();
    expect(migrator('string')).toBe('string');
  });

  it('renames multiple properties at once', () => {
    const migrator = renameProperties({ a: 'x', b: 'y' });
    const result = migrator({ a: 1, b: 2, c: 3 });
    expect(result).toEqual({ x: 1, y: 2, c: 3 });
  });
});

// ─── addDefaults helper ───────────────────────────────────────────────────────

describe('addDefaults', () => {
  it('adds missing keys with default values', () => {
    const migrator = addDefaults({ sound: true, haptic: false });
    const result = migrator({ sound: false });
    expect(result.sound).toBe(false); // existing value preserved
    expect(result.haptic).toBe(false); // default applied
  });

  it('does not overwrite existing keys', () => {
    const migrator = addDefaults({ x: 99 });
    expect(migrator({ x: 1 })).toEqual({ x: 1 });
  });

  it('adds all defaults to empty object', () => {
    const migrator = addDefaults({ a: 1, b: 2 });
    expect(migrator({})).toEqual({ a: 1, b: 2 });
  });

  it('handles null input', () => {
    const migrator = addDefaults({ a: 1 });
    const result = migrator(null);
    expect(result).toEqual({ a: 1 });
  });

  it('handles primitive number input (non-object, non-null)', () => {
    const migrator = addDefaults({ a: 1, b: 2 });
    const result = migrator(42);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles primitive string input', () => {
    const migrator = addDefaults({ x: 'default' });
    expect(migrator('not-an-object')).toEqual({ x: 'default' });
  });
});

// ─── transformEnum helper ──────────────────────────────────────────────────────

describe('transformEnum', () => {
  it('transforms matching enum value', () => {
    const migrator = transformEnum('status', { active: 'enabled', inactive: 'disabled' });
    expect(migrator({ status: 'active' })).toEqual({ status: 'enabled' });
    expect(migrator({ status: 'inactive' })).toEqual({ status: 'disabled' });
  });

  it('leaves unknown values unchanged', () => {
    const migrator = transformEnum('status', { old: 'new' });
    expect(migrator({ status: 'unknown' })).toEqual({ status: 'unknown' });
  });

  it('leaves other properties untouched', () => {
    const migrator = transformEnum('color', { red: 'crimson' });
    const result = migrator({ color: 'red', name: 'test' });
    expect(result.color).toBe('crimson');
    expect(result.name).toBe('test');
  });

  it('handles non-object data', () => {
    const migrator = transformEnum('k', {});
    expect(migrator(null)).toBeNull();
    expect(migrator(42)).toBe(42);
  });

  it('leaves object unchanged when the target key is absent (key not in result)', () => {
    const migrator = transformEnum('status', { old: 'new' });
    // Object has no 'status' key → guard `key in result` is false → no transform
    const result = migrator({ other: 'value' });
    expect(result).toEqual({ other: 'value' });
    expect(result.status).toBeUndefined();
  });
});

// ─── chain helper ─────────────────────────────────────────────────────────────

describe('chain', () => {
  it('applies all migrators in order', () => {
    const addA = d => ({ ...d, a: true });
    const addB = d => ({ ...d, b: true });
    const migrator = chain(addA, addB);
    expect(migrator({})).toEqual({ a: true, b: true });
  });

  it('passes output of each step to the next', () => {
    const inc = d => ({ ...d, count: (d.count ?? 0) + 1 });
    const migrator = chain(inc, inc, inc);
    expect(migrator({ count: 0 }).count).toBe(3);
  });

  it('single migrator chain works', () => {
    const double = d => d * 2;
    expect(chain(double)(5)).toBe(10);
  });

  it('empty chain returns data unchanged', () => {
    const migrator = chain();
    const data = { x: 1 };
    expect(migrator(data)).toBe(data);
  });

  it('can combine helpers', () => {
    const migrator = chain(
      addDefaults({ newKey: 0 }),
      renameProperties({ oldKey: 'renamedKey' }),
    );
    const result = migrator({ oldKey: 'hello' });
    expect(result.renamedKey).toBe('hello');
    expect(result.newKey).toBe(0);
    expect(result.oldKey).toBeUndefined();
  });
});

// ─── validate helper ──────────────────────────────────────────────────────────

describe('validate', () => {
  it('passes data through when types match', () => {
    const schema = { count: 'number', name: 'string' };
    const migrator = validate(schema);
    const data = { count: 5, name: 'test' };
    expect(migrator(data)).toBe(data);
  });

  it('throws when a field has the wrong type', () => {
    const schema = { count: 'number' };
    const migrator = validate(schema);
    expect(() => migrator({ count: 'five' })).toThrow(/count/i);
  });

  it('passes when field is missing (only validates present keys)', () => {
    const schema = { count: 'number' };
    const migrator = validate(schema);
    expect(() => migrator({})).not.toThrow();
  });

  it('detects array type correctly', () => {
    const schema = { items: 'array' };
    const migrator = validate(schema);
    expect(() => migrator({ items: [1, 2, 3] })).not.toThrow();
    expect(() => migrator({ items: 'not-array' })).toThrow(/items/i);
  });

  it('throws when field is an array but schema expects a non-array type (Array.isArray true → actualType="array" !== type branch)', () => {
    // Array.isArray([]) = true → actualType = 'array'; schema says 'object' → mismatch → throw
    const schema = { items: 'object' };
    const migrator = validate(schema);
    expect(() => migrator({ items: [1, 2, 3] })).toThrow(/items/i);
    expect(() => migrator({ items: [] })).toThrow(/items/i);
  });

  it('can be chained with other helpers', () => {
    const migrator = chain(
      addDefaults({ count: 0 }),
      validate({ count: 'number' }),
    );
    expect(() => migrator({})).not.toThrow();
  });
});
