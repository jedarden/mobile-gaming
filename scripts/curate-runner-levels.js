#!/usr/bin/env node

/**
 * Level Curation Pipeline for Runner Games
 *
 * Implements the generate → rank → curate pipeline for the 5 runner games:
 * - crowd-runner
 * - giant-runner
 * - bridge-race
 * - jelly-shift
 * - makeover-run
 *
 * Usage: node scripts/curate-runner-levels.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

// Games to process
const GAMES = [
  'crowd-runner',
  'giant-runner',
  'bridge-race',
  'jelly-shift',
  'makeover-run'
];

// Configuration for each game
const CURATION_CONFIG = {
  'crowd-runner': {
    generateCount: { easy: 20, medium: 20, hard: 20 },
    curateCount: { easy: 5, medium: 5, hard: 5 }
  },
  'giant-runner': {
    generateCount: { easy: 20, medium: 20, hard: 20 },
    curateCount: { easy: 5, medium: 5, hard: 5 }
  },
  'bridge-race': {
    generateCount: { easy: 20, medium: 20, hard: 20 },
    curateCount: { easy: 5, medium: 5, hard: 5 }
  },
  'jelly-shift': {
    generateCount: { easy: 20, medium: 20, hard: 20 },
    curateCount: { easy: 5, medium: 5, hard: 5 }
  },
  'makeover-run': {
    generateCount: { easy: 20, medium: 20, hard: 20 },
    curateCount: { easy: 5, medium: 5, hard: 5 }
  }
};

/**
 * Load game generator module
 */
async function loadGenerator(game) {
  const generatorPath = path.join(projectRoot, 'src', 'games', game, 'generator.js');
  const module = await import(`file://${generatorPath}`);
  return module;
}

/**
 * Generate, rank, and curate levels for a single game
 */
async function processGame(game) {
  console.log(`\n🎮 Processing ${game}...`);

  const generator = await loadGenerator(game);
  const config = CURATION_CONFIG[game];

  const curatedLevels = [];
  const metrics = { easy: [], medium: [], hard: [] };

  for (const difficulty of ['easy', 'medium', 'hard']) {
    console.log(`  📊 Generating ${config.generateCount[difficulty]} ${difficulty} levels...`);

    // Step 1: Generate levels
    const baseSeed = 1;
    let seed = baseSeed;
    const generated = [];

    for (let i = 0; i < config.generateCount[difficulty]; i++) {
      const level = generator.generateLevel(seed, difficulty, i);
      const validation = generator.validateLevel(level);

      if (validation.valid) {
        generated.push(level);
      } else {
        console.log(`    ⚠️  Seed ${seed} rejected: ${validation.reason || validation.errors?.join(', ')}`);
      }
      seed++;
    }

    console.log(`    ✓ Generated ${generated.length} valid levels`);

    // Step 2: Rank by playability
    console.log(`  🏆 Ranking levels by playability...`);
    const ranked = generator.rankLevels ? generator.rankLevels(generated) : generated;

    if (ranked.length > 0 && ranked[0].metrics) {
      console.log(`    Best score: ${ranked[0].metrics.overall}/100`);
      console.log(`    Worst score: ${ranked[ranked.length - 1].metrics.overall}/100`);
      metrics[difficulty] = ranked.map(l => l.metrics.overall);
    }

    // Step 3: Curate the best
    const curateCount = config.curateCount[difficulty];
    const curated = generator.curateBestLevels ?
      generator.curateBestLevels(ranked, curateCount) :
      ranked.slice(0, curateCount);

    curatedLevels.push(...curated);
    console.log(`    ✓ Curated ${curated.length} levels`);
  }

  return { curatedLevels, metrics };
}

/**
 * Write curated levels to levels.json
 */
function writeLevels(game, curatedLevels) {
  const levelsPath = path.join(projectRoot, 'src', 'games', game, 'levels.json');

  // Read existing levels to preserve structure
  let existingLevels = [];
  if (fs.existsSync(levelsPath)) {
    const content = fs.readFileSync(levelsPath, 'utf-8');
    existingLevels = JSON.parse(content);
  }

  // Map curated levels to the expected format (remove metrics before saving)
  const cleanLevels = curatedLevels.map(({ metrics, ...level }) => level);

  // Write curated levels
  fs.writeFileSync(levelsPath, JSON.stringify(cleanLevels, null, 2));
  console.log(`  💾 Wrote ${cleanLevels.length} levels to ${levelsPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 Level Curation Pipeline for Runner Games');
  console.log('=' .repeat(50));

  const results = {};

  for (const game of GAMES) {
    try {
      const { curatedLevels, metrics } = await processGame(game);
      writeLevels(game, curatedLevels);
      results[game] = { success: true, count: curatedLevels.length, metrics };
    } catch (error) {
      console.error(`❌ Error processing ${game}:`, error);
      results[game] = { success: false, error: error.message };
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 Summary:');
  console.log('='.repeat(50));

  for (const [game, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`✅ ${game}: ${result.count} levels curated`);
      const avgScoreEasy = result.metrics.easy.length > 0 ?
        (result.metrics.easy.reduce((a,b) => a+b, 0) / result.metrics.easy.length).toFixed(1) : 'N/A';
      const avgScoreMedium = result.metrics.medium.length > 0 ?
        (result.metrics.medium.reduce((a,b) => a+b, 0) / result.metrics.medium.length).toFixed(1) : 'N/A';
      const avgScoreHard = result.metrics.hard.length > 0 ?
        (result.metrics.hard.reduce((a,b) => a+b, 0) / result.metrics.hard.length).toFixed(1) : 'N/A';
      console.log(`   Avg playability scores - Easy: ${avgScoreEasy}, Medium: ${avgScoreMedium}, Hard: ${avgScoreHard}`);
    } else {
      console.log(`❌ ${game}: Failed - ${result.error}`);
    }
  }

  console.log('\n✨ Curation complete!');
}

main().catch(console.error);
