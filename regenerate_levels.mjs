import { generateBatch } from './src/games/pull-the-pin/generator.js';

const problematicIds = ['ptp-006', 'ptp-009', 'ptp-011', 'ptp-014', 'ptp-016', 'ptp-018', 'ptp-019', 'ptp-020'];

console.log('// Regenerated solvable levels for problematic IDs');
console.log('[');

for (let i = 0; i < problematicIds.length; i++) {
  const id = problematicIds[i];
  const index = parseInt(id.split('-')[1]) - 1;
  
  // Generate a few solvable levels for each ID  
  const levels = generateBatch(2000 + index * 100, 'medium', 1);
  
  if (levels.length > 0) {
    const level = levels[0];
    level.id = id;
    console.log(JSON.stringify(level));
    if (i < problematicIds.length - 1) {
      console.log(',');
    }
  }
}

console.log(']');
