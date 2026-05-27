#!/usr/bin/env node

/**
 * Bundle size CI gate
 *
 * Enforces JS bundle size limits per game:
 * - 2D games (Phaser-based): ≤200KB gzipped
 * - 3D games (Three.js-based): ≤400KB gzipped
 *
 * Usage: node scripts/check-bundle-size.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

// Bundle size budget (KB, gzipped)
const BUDGET_2D = 200;
const BUDGET_3D = 400;

// 2D games use Phaser, 3D games use Three.js
const GAMES_2D = [
  'pull-the-pin',
  'water-sort',
  'brain-teaser',
  'parking-escape',
  'bus-jam',
  'merge-games',
  'satisfying-asmr',
  'save-the-character',
];

const GAMES_3D = [
  'crowd-runner',
  'bridge-race',
  'giant-runner',
  'jelly-shift',
  'makeover-run',
];

// Shared chunks that are included in each game's bundle
// These are extracted by Vite and loaded by each entry point
const SHARED_CHUNKS = {
  phaser: 'phaser',
  three: 'three-setup',
};

/**
 * Get gzipped size of a file in KB
 */
function getGzipSize(filePath) {
  try {
    const output = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf8' });
    return parseInt(output.trim()) / 1024; // bytes to KB
  } catch (err) {
    return null;
  }
}

/**
 * Parse Vite's build output from the manifest to get chunks for each entry point
 */
function getEntryChunks() {
  // Vite doesn't generate a manifest by default, so we parse the HTML files
  const entries = {};

  for (const game of [...GAMES_2D, ...GAMES_3D]) {
    const htmlPath = join(distDir, game, 'index.html');
    try {
      const html = readFileSync(htmlPath, 'utf8');
      // Find all <script src="..."> tags
      const scriptMatches = html.matchAll(/<script[^>]*src="([^"]+)"/g);
      const scripts = [];
      for (const match of scriptMatches) {
        scripts.push(match[1]);
      }
      entries[game] = scripts;
    } catch (err) {
      console.error(`Failed to read ${htmlPath}: ${err.message}`);
      process.exit(1);
    }
  }

  // Also check the hub
  const hubPath = join(distDir, 'hub', 'index.html');
  try {
    const html = readFileSync(hubPath, 'utf8');
    const scriptMatches = html.matchAll(/<script[^>]*src="([^"]+)"/g);
    const scripts = [];
    for (const match of scriptMatches) {
      scripts.push(match[1]);
    }
    entries.hub = scripts;
  } catch (err) {
    // Hub may not exist in all builds
  }

  return entries;
}

/**
 * Get all JS files in the assets directory with their sizes
 */
function getAssetSizes() {
  const assetsDir = join(distDir, 'assets');
  const files = {};

  try {
    for (const file of readdirSync(assetsDir)) {
      if (file.endsWith('.js')) {
        const filePath = join(assetsDir, file);
        const gzipSize = getGzipSize(filePath);
        if (gzipSize !== null) {
          files[file] = gzipSize;
        }
      }
    }
  } catch (err) {
    // Assets directory may not exist yet
  }

  return files;
}

/**
 * Determine if a game is 2D or 3D based on which shared chunks it references
 */
function getGameType(scripts) {
  for (const script of scripts) {
    if (script.includes(SHARED_CHUNKS.phaser)) {
      return '2D';
    }
    if (script.includes(SHARED_CHUNKS.three)) {
      return '3D';
    }
  }
  // Default to checking known game lists
  return null;
}

/**
 * Find shared chunk filename by pattern
 */
function findSharedChunk(assetSizes, pattern) {
  for (const filename in assetSizes) {
    if (filename.toLowerCase().includes(pattern)) {
      return { filename, size: assetSizes[filename] };
    }
  }
  return null;
}

/**
 * Calculate total bundle size for an entry point
 * Includes both entry-specific chunks and shared dependencies (Phaser/Three.js)
 */
function calculateBundleSize(entryScripts, assetSizes, is2D) {
  let total = 0;
  const details = [];

  // Add entry-specific scripts
  for (const script of entryScripts) {
    // Extract filename from path (e.g., "../assets/game-abc123.js" -> "game-abc123.js")
    const filename = script.split('/').pop();
    if (filename && assetSizes[filename]) {
      total += assetSizes[filename];
      details.push({ filename, size: assetSizes[filename] });
    }
  }

  // Add shared chunks (Phaser for 2D, Three.js for 3D)
  // These are loaded by the entry scripts and count toward the total bundle size
  const sharedPattern = is2D ? SHARED_CHUNKS.phaser : SHARED_CHUNKS.three;
  const sharedChunk = findSharedChunk(assetSizes, sharedPattern);
  if (sharedChunk) {
    total += sharedChunk.size;
    details.push({ filename: `${sharedChunk.filename} (shared)`, size: sharedChunk.size });
  }

  return { total, details };
}

/**
 * Main check function
 */
function checkBundleSizes() {
  const entryChunks = getEntryChunks();
  const assetSizes = getAssetSizes();

  let failures = [];
  const results = [];

  // Check each game
  for (const game of [...GAMES_2D, ...GAMES_3D]) {
    const scripts = entryChunks[game];
    if (!scripts) {
      console.error(`No scripts found for game: ${game}`);
      continue;
    }

    const is2D = GAMES_2D.includes(game);
    const { total, details } = calculateBundleSize(scripts, assetSizes, is2D);
    const budget = is2D ? BUDGET_2D : BUDGET_3D;
    const type = is2D ? '2D' : '3D';

    const passed = total <= budget;
    results.push({
      game,
      type,
      total,
      budget,
      passed,
      details,
    });

    if (!passed) {
      failures.push({ game, total, budget });
    }
  }

  // Print results
  console.log('\n📊 Bundle Size Report\n');

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const overBudget = result.total > result.budget
      ? ` (${(result.total - result.budget).toFixed(1)}KB over)`
      : '';
    console.log(`${status} ${result.game.padEnd(20)} ${result.type}  ${result.total.toFixed(1).padStart(6)}KB / ${result.budget}KB${overBudget}`);

    // Show breakdown if verbose or if it failed
    if (!result.passed) {
      for (const detail of result.details) {
        console.log(`   └─ ${detail.filename.padEnd(35)} ${detail.size.toFixed(1).padStart(6)}KB`);
      }
    }
  }

  // Exit with error if any failures
  if (failures.length > 0) {
    console.log('\n❌ Bundle size check failed!\n');
    console.log('The following games exceed their budget:');
    for (const failure of failures) {
      console.log(`  - ${failure.game}: ${failure.total.toFixed(1)}KB / ${failure.budget}KB`);
    }
    console.log('\nTips to reduce bundle size:');
    console.log('  - Use dynamic import() for code-splitting');
    console.log('  - Remove unused dependencies');
    console.log('  - Configure Vite manual chunks for better sharing');
    console.log('  - For Phaser: use Phaser Compressor to strip unused subsystems');
    process.exit(1);
  }

  console.log('\n✅ All bundle sizes within budget!\n');
}

// Run the check
checkBundleSizes();
