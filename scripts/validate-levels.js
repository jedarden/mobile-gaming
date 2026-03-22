#!/usr/bin/env node

/**
 * Level validation script
 *
 * Loads all level JSON files from the levels/ directory and validates
 * each against its corresponding JSON schema. Reports errors and exits
 * with non-zero status on validation failure.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validate } from 'jsonschema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SCHEMAS_DIR = join(ROOT_DIR, 'schemas');
const LEVELS_DIR = join(ROOT_DIR, 'levels');

// Game type to schema mapping
const GAME_SCHEMAS = {
  'pull-the-pin': 'pull-the-pin.schema.json',
  'water-sort': 'water-sort.schema.json',
  'brain-teaser': 'brain-teaser.schema.json',
  'parking-escape': 'parking-escape.schema.json',
  'save-the-character': 'save-the-character.schema.json',
  'merge': 'water-sort.schema.json',
  'satisfying': 'pull-the-pin.schema.json',
  'crowd-runner': 'pull-the-pin.schema.json',
  'bridge-race': 'pull-the-pin.schema.json',
  'giant-runner': 'pull-the-pin.schema.json',
  'jelly-shift': 'parking-escape.schema.json',
  'makeover-run': 'pull-the-pin.schema.json'
};

/**
 * Load a JSON schema file
 *
 * @param {string} schemaFile - Schema filename
 * @returns {Object} Parsed schema
 */
function loadSchema(schemaFile) {
  const schemaPath = join(SCHEMAS_DIR, schemaFile);
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading schema ${schemaFile}: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Detect game type from level ID or filename
 *
 * @param {string} levelId - Level identifier
 * @returns {string|null} Game type or null
 */
function detectGameType(levelId) {
  for (const [gameType, prefix] of [
    ['pull-the-pin', 'ptp'],
    ['water-sort', 'ws'],
    ['brain-teaser', 'bt'],
    ['parking-escape', 'pe'],
    ['save-the-character', 'stc'],
    ['merge', 'mg'],
    ['satisfying', 'sat'],
    ['crowd-runner', 'cr'],
    ['bridge-race', 'br'],
    ['giant-runner', 'gr'],
    ['jelly-shift', 'js'],
    ['makeover-run', 'mr']
  ]) {
    if (levelId.startsWith(prefix)) {
      return gameType;
    }
  }
  return null;
}

/**
 * Recursively get all JSON files in a directory
 *
 * @param {string} dir - Directory path
 * @returns {string[]} Array of file paths
 */
function getJsonFiles(dir) {
  const files = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getJsonFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }

  return files;
}

/**
 * Validate a single level file
 *
 * @param {string} filePath - Path to level JSON file
 * @returns {Object} Validation result
 */
function validateLevel(filePath) {
  let levelData;
  let schema;

  // Load level file
  try {
    const content = readFileSync(filePath, 'utf-8');
    levelData = JSON.parse(content);
  } catch (error) {
    return {
      valid: false,
      file: filePath,
      error: `Failed to parse JSON: ${error.message}`
    };
  }

  // Determine schema
  const relativePath = filePath.replace(LEVELS_DIR + '/', '');
  const pathParts = relativePath.split('/');

  let gameType = null;

  // Try to get game type from directory structure
  if (pathParts.length > 1) {
    const possibleGame = pathParts[0];
    if (GAME_SCHEMAS[possibleGame]) {
      gameType = possibleGame;
    }
  }

  // Fall back to level ID detection
  if (!gameType && levelData.id) {
    gameType = detectGameType(levelData.id);
  }

  if (!gameType) {
    return {
      valid: false,
      file: filePath,
      error: `Could not determine game type for level. Add game-specific directory or ensure level ID has recognizable prefix.`
    };
  }

  // Load schema
  const schemaFile = GAME_SCHEMAS[gameType];
  try {
    schema = loadSchema(schemaFile);
  } catch (error) {
    return {
      valid: false,
      file: filePath,
      error: `Failed to load schema ${schemaFile}: ${error.message}`
    };
  }

  // Validate
  const result = validate(levelData, schema);

  return {
    valid: result.valid,
    file: filePath,
    gameType,
    levelId: levelData.id || 'unknown',
    errors: result.errors.map(e => e.property ? `${e.property}: ${e.message}` : e.message)
  };
}

/**
 * Main validation function
 *
 * @returns {number} Exit code (0 for success, 1 for failure)
 */
function main() {
  const levelFiles = getJsonFiles(LEVELS_DIR);

  if (levelFiles.length === 0) {
    console.log('No level files found in levels/');
    return 0;
  }

  console.log(`Validating ${levelFiles.length} level file(s)...\n`);

  const results = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const file of levelFiles) {
    const result = validateLevel(file);
    results.push(result);

    if (!result.valid) {
      errorCount++;
      console.error(`\u274C ${result.file}`);
      console.error(`   ${result.error || result.errors.join('\n   ')}`);
    } else {
      console.log(`\u2705 ${result.file} (${result.gameType}: ${result.levelId})`);
    }
  }

  // Summary
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Results: ${levelFiles.length - errorCount} passed, ${errorCount} failed`);

  if (errorCount > 0) {
    console.log('\nValidation failed. Please fix the errors above.');
    return 1;
  }

  console.log('All levels validated successfully!');
  return 0;
}

// Run validation
const exitCode = main();
process.exit(exitCode);
