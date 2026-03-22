#!/usr/bin/env node
/**
 * Generate levels for merge-games and satisfying-asmr.
 * Run: node scripts/gen-new-game-levels.js
 */

import { generateLevel as genMerge, validateLevel as validateMerge } from '../src/games/merge-games/generator.js';
import { generateLevel as genAsmr, validateLevel as validateAsmr } from '../src/games/satisfying-asmr/generator.js';

// ─── MERGE GAMES ─────────────────────────────────────────────────────────────
// 5 easy, 5 medium, 5 hard = 15 total
const mgLevels = [];
const mgDifficulties = [
  ...Array(5).fill('easy'),
  ...Array(5).fill('medium'),
  ...Array(5).fill('hard'),
];

let mgIdx = 1;
let seed = 1000;
for (const diff of mgDifficulties) {
  let level = null;
  let attempts = 0;
  while (!level && attempts < 100) {
    const candidate = genMerge(seed++, diff, mgIdx - 1);
    if (candidate) {
      const { valid } = validateMerge(candidate);
      if (valid) level = candidate;
    }
    attempts++;
  }
  if (level) {
    const id = `mg-${String(mgIdx).padStart(3, '0')}`;
    const diffNum = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3;
    mgLevels.push({ ...level, id, difficulty: diffNum, difficultyLabel: diff });
    mgIdx++;
  }
}

// ─── SATISFYING ASMR ─────────────────────────────────────────────────────────
// 4 easy, 3 medium, 3 hard = 10 total
const asmrLevels = [];
const asmrDifficulties = [
  ...Array(4).fill('easy'),
  ...Array(3).fill('medium'),
  ...Array(3).fill('hard'),
];

let asmrIdx = 1;
let asmrSeed = 2000;
for (const diff of asmrDifficulties) {
  const level = genAsmr(asmrSeed++, diff, asmrIdx - 1);
  const { valid } = validateAsmr(level);
  if (valid) {
    const id = `asmr-${String(asmrIdx).padStart(3, '0')}`;
    const diffNum = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3;
    asmrLevels.push({ ...level, id, difficulty: diffNum, difficultyLabel: diff });
    asmrIdx++;
  }
}

// Output JSON for use in curate-levels.js
console.log(JSON.stringify({ mgLevels, asmrLevels }, null, 2));
