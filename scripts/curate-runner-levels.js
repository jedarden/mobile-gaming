#!/usr/bin/env node

/**
 * Level Curation Pipeline for Runner Games
 *
 * Generates, ranks, and curates the best levels for 5 runner games:
 * - crowd-runner
 * - giant-runner
 * - bridge-race
 * - jelly-shift
 * - makeover-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GAMES = [
  'crowd-runner',
  'giant-runner',
  'bridge-race',
  'jelly-shift',
  'makeover-run'
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LEVELS_PER_DIFFICULTY = 3;
const GENERATION_BATCH_SIZE = 20;

// ID prefix patterns for each game
const ID_PREFIXES = {
  'crowd-runner': 'cr',
  'giant-runner': null,  // numeric ID
  'bridge-race': 'br',
  'jelly-shift': null,   // numeric ID
  'makeover-run': 'mr'
};

// Games that have 'difficulty' field in schema (bridge-race doesn't)
const GAMES_WITH_DIFFICULTY = new Set(['crowd-runner', 'giant-runner', 'jelly-shift', 'makeover-run']);

async function importModule(path) {
  return await import(path);
}

async function curateGame(gameName) {
  console.log(`\n=== ${gameName} ===`);

  const generatorPath = join(__dirname, '..', 'src', 'games', gameName, 'generator.js');
  const generator = await importModule(generatorPath);

  const allCuratedLevels = [];
  let totalGenerated = 0;
  let totalCurated = 0;

  for (const difficulty of DIFFICULTIES) {
    console.log(`  Generating ${GENERATION_BATCH_SIZE} ${difficulty} levels...`);

    const levels = generator.generateBatch(
      Date.now() + Math.random() * 10000,
      difficulty,
      GENERATION_BATCH_SIZE
    );

    totalGenerated += levels.length;
    console.log(`    Generated ${levels.length} levels`);

    if (levels.length === 0) {
      console.log(`    WARNING: No valid levels generated for ${difficulty}`);
      continue;
    }

    const ranked = generator.rankLevels(levels);

    console.log(`    Top 3 ${difficulty} scores:`);
    ranked.slice(0, 3).forEach((level, i) => {
      console.log(`      ${i + 1}. ${level.id}: ${level.metrics.overall} (${JSON.stringify(level.metrics.details)})`);
    });

    const curated = generator.curateBestLevels(ranked, LEVELS_PER_DIFFICULTY);
    curated.forEach(level => {
      const { metrics, ...levelWithoutMetrics } = level;
      // Remove 'difficulty' field if game schema doesn't include it
      if (!GAMES_WITH_DIFFICULTY.has(gameName) && 'difficulty' in levelWithoutMetrics) {
        delete levelWithoutMetrics.difficulty;
      }
      allCuratedLevels.push(levelWithoutMetrics);
    });

    totalCurated += curated.length;
    console.log(`    Curated ${curated.length} levels`);
  }

  console.log(`  Total: generated ${totalGenerated}, curated ${totalCurated}`);

  // Assign proper sequential IDs to curated levels
  const idPrefix = ID_PREFIXES[gameName];
  const levelsWithIds = allCuratedLevels.map((level, index) => {
    const { id, ...levelWithoutId } = level;
    if (idPrefix) {
      // String ID format (e.g., "cr-001")
      return {
        ...levelWithoutId,
        id: `${idPrefix}-${String(index + 1).padStart(3, '0')}`
      };
    } else {
      // Numeric ID format
      return {
        ...levelWithoutId,
        id: index + 1
      };
    }
  });

  const levelsPath = join(__dirname, '..', 'src', 'games', gameName, 'levels.json');
  writeFileSync(levelsPath, JSON.stringify(levelsWithIds, null, 2));
  console.log(`  ✓ Wrote ${levelsWithIds.length} levels to ${gameName}/levels.json`);

  return { generated: totalGenerated, curated: totalCurated };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Runner Games Level Curation Pipeline                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();
  let totalGenerated = 0;
  let totalCurated = 0;

  for (const game of GAMES) {
    try {
      const stats = await curateGame(game);
      totalGenerated += stats.generated;
      totalCurated += stats.curated;
    } catch (error) {
      console.error(`ERROR processing ${game}:`, error.message);
      console.error(error.stack);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Summary                                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Games processed: ${GAMES.length}`);
  console.log(`  Total levels generated: ${totalGenerated}`);
  console.log(`  Total levels curated: ${totalCurated}`);
  console.log(`  Time elapsed: ${elapsed}s`);
  console.log('\n✓ Curation pipeline complete!');
}

main().catch(error => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
