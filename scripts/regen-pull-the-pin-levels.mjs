/**
 * Regenerate pull-the-pin levels.json with levels that pass the solver.
 * The hand-crafted levels used complex diagonal channels that the physics
 * simulation (single-line wall collision) doesn't support — balls get
 * deflected sideways instead of guided through the channel.
 * Generated levels are built around the same physics model, so they solve.
 *
 * Run: node scripts/regen-pull-the-pin-levels.mjs
 */
import { generateBatch } from '../src/games/pull-the-pin/generator.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dir, '../src/games/pull-the-pin/levels.json');

const levels = generateBatch(1000, 'easy', 20);

if (levels.length < 20) {
  console.error(`Only generated ${levels.length} levels — need 20`);
  process.exit(1);
}

// Assign sequential IDs with the game prefix
const out = levels.map((l, i) => ({
  ...l,
  id: `ptp-${String(i + 1).padStart(3, '0')}`
}));

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} levels to ${outPath}`);
