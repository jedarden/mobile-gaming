#!/usr/bin/env node

/**
 * OG image uniqueness gate
 *
 * Every game must ship a game-specific og:image so social/Discord/iMessage
 * link previews are distinct. A generation bug once left all 14 files in
 * public/og/ byte-identical (see scripts/generate-og.js), silently defeating
 * the rich-preview feature. This gate fails if any two og/*.png files share
 * the same content hash so that regression can't slip through again.
 *
 * Usage: node scripts/check-og-images.js
 */

import { readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OG_DIR = join(__dirname, '..', 'public', 'og');

function main() {
  let files;
  try {
    files = readdirSync(OG_DIR).filter((f) => f.endsWith('.png')).sort();
  } catch (err) {
    console.error(`❌ Could not read ${OG_DIR}: ${err.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`❌ No og/*.png files found in ${OG_DIR}`);
    process.exit(1);
  }

  // Map each content hash to the files that produced it.
  const byHash = new Map();
  for (const file of files) {
    const hash = createHash('md5').update(readFileSync(join(OG_DIR, file))).digest('hex');
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(file);
  }

  const duplicateGroups = [...byHash.values()].filter((group) => group.length > 1);

  if (duplicateGroups.length > 0) {
    console.error('❌ OG image uniqueness check failed!\n');
    console.error('The following og/*.png files are byte-identical:');
    for (const group of duplicateGroups) {
      console.error(`  - ${group.join(', ')}`);
    }
    console.error('\nEach game needs a distinct preview. Regenerate with:');
    console.error('  npm run build && node scripts/generate-og.js');
    process.exit(1);
  }

  console.log(`✅ All ${files.length} OG images are unique.`);
}

main();
