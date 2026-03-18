/**
 * Schema version migration pipeline
 *
 * Manages data schema migrations across versions.
 * Migrations are pure functions that transform data from one version to another.
 */

/**
 * Migration registry
 * Each migration: { from: number, to: number, migrate: (data) => newData }
 */
export const migrations = [];

/**
 * Register a new migration
 *
 * @param {Object} migration - Migration definition
 * @param {number} migration.from - Source version
 * @param {number} migration.to - Target version
 * @param {Function} migration.migrate - Migration function (data) => newData
 */
export function registerMigration(migration) {
  migrations.push(migration);
  // Sort by version for proper ordering
  migrations.sort((a, b) => a.from - b.from);
}

/**
 * Run migrations on data
 *
 * @param {*} data - Data to migrate (can be any JSON-serializable value)
 * @param {number} fromVersion - Current version of data
 * @param {number} toVersion - Target version (default: latest)
 * @returns {*} Migrated data
 */
export function runMigrations(data, fromVersion, toVersion = null) {
  if (!toVersion) {
    // Find highest target version
    toVersion = migrations.reduce((max, m) => Math.max(max, m.to), fromVersion);
  }

  if (fromVersion === toVersion) {
    return data;
  }

  if (fromVersion > toVersion) {
    throw new Error(`Cannot migrate backwards: v${fromVersion} -> v${toVersion}`);
  }

  let currentData = data;
  let currentVersion = fromVersion;

  // Run migrations sequentially
  for (const migration of migrations) {
    // Check if this migration applies
    if (migration.from === currentVersion && migration.to <= toVersion) {
      try {
        currentData = migration.migrate(currentData);
        currentVersion = migration.to;
      } catch (e) {
        console.error(`Migration failed: v${migration.from} -> v${migration.to}`, e);
        // Return null to signal failure - caller should use defaults
        return null;
      }
    }
  }

  // Check if we reached the target
  if (currentVersion !== toVersion) {
    // No migration path exists - try to find a default
    console.warn(`No migration path from v${fromVersion} to v${toVersion}, got to v${currentVersion}`);
    return null;
  }

  return currentData;
}

/**
 * Run migrations with fallback to default
 *
 * @param {*} data - Data to migrate
 * @param {number} fromVersion - Current version
 * @param {*} defaultValue - Default value if migration fails
 * @param {number} toVersion - Target version (default: latest)
 * @returns {*} Migrated data or default
 */
export function migrateWithDefault(data, fromVersion, defaultValue, toVersion = null) {
  const result = runMigrations(data, fromVersion, toVersion);
  return result !== null ? result : defaultValue;
}

/**
 * Get the current latest schema version
 * @returns {number} Highest migration target version
 */
export function getLatestVersion() {
  if (migrations.length === 0) {
    return 1;
  }
  return migrations.reduce((max, m) => Math.max(max, m.to), 1);
}

/**
 * Check if a migration exists for a version range
 * @param {number} from - Source version
 * @param {number} to - Target version
 * @returns {boolean}
 */
export function hasMigration(from, to) {
  return migrations.some(m => m.from === from && m.to === to);
}

/**
 * Create a migration helper for array items
 * Migrates each item in an array using the provided migration function
 *
 * @param {Function} itemMigrator - Function to migrate a single item
 * @returns {Function} Migration function for arrays
 */
export function mapItems(itemMigrator) {
  return (data) => {
    if (!Array.isArray(data)) {
      throw new Error('mapItems migration requires array data');
    }
    return data.map(itemMigrator);
  };
}

/**
 * Create a migration helper for object properties
 * Migrates a specific property in an object using the provided migration function
 *
 * @param {string} key - Property key to migrate
 * @param {Function} valueMigrator - Function to migrate the property value
 * @returns {Function} Migration function for objects
 */
export function mapProperty(key, valueMigrator) {
  return (data) => {
    if (typeof data !== 'object' || data === null) {
      throw new Error('mapProperty migration requires object data');
    }
    return {
      ...data,
      [key]: valueMigrator(data[key]),
    };
  };
}

/**
 * Create a migration helper for renaming object properties
 *
 * @param {Object} renames - Map of old names to new names
 * @returns {Function} Migration function
 */
export function renameProperties(renames) {
  return (data) => {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    const result = { ...data };
    for (const [oldName, newName] of Object.entries(renames)) {
      if (oldName in result && !(newName in result)) {
        result[newName] = result[oldName];
        delete result[oldName];
      }
    }
    return result;
  };
}

/**
 * Create a migration helper for adding default values
 *
 * @param {Object} defaults - Default values to add if missing
 * @returns {Function} Migration function
 */
export function addDefaults(defaults) {
  return (data) => {
    if (typeof data !== 'object' || data === null) {
      return { ...defaults };
    }
    const result = { ...data };
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }
    return result;
  };
}

/**
 * Create a migration helper for transforming enum values
 *
 * @param {string} key - Property key
 * @param {Object} valueMap - Map of old values to new values
 * @returns {Function} Migration function
 */
export function transformEnum(key, valueMap) {
  return (data) => {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    const result = { ...data };
    if (key in result && result[key] in valueMap) {
      result[key] = valueMap[result[key]];
    }
    return result;
  };
}

/**
 * Chain multiple migrations together
 * Useful for complex migrations that need multiple steps
 *
 * @param {...Function} migrators - Migration functions to chain
 * @returns {Function} Combined migration function
 */
export function chain(...migrators) {
  return (data) => {
    return migrators.reduce((acc, migrator) => migrator(acc), data);
  };
}

/**
 * Validate migrated data against a schema
 * Throws if validation fails
 *
 * @param {Object} schema - Schema definition (simple type checking)
 * @returns {Function} Validation function that can be chained
 */
export function validate(schema) {
  return (data) => {
    for (const [key, type] of Object.entries(schema)) {
      if (key in data) {
        const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
        if (actualType !== type) {
          throw new Error(`Schema validation failed: ${key} is ${actualType}, expected ${type}`);
        }
      }
    }
    return data;
  };
}
