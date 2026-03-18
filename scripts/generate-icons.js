#!/usr/bin/env node

/**
 * Icon generation script
 *
 * Uses sharp to generate app icons from SVG source. Generates
 * multiple sizes for different platforms and device densities.
 * Run only in CI (not in production bundle).
 *
 * Sizes generated:
 * - 72x72 (hdpi)
 * - 96x96 (xhdpi)
 * - 128x128 (xxhdpi)
 * - 144x144 (xxxhdpi)
 * - 152x152 (iPad)
 * - 192x192 (Android adaptive)
 * - 384x384 (Android adaptive XXXL)
 * - 512x512 (PWA/Apple)
 */

import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SOURCE_SVG = join(ROOT_DIR, 'public', 'icons', 'icon.svg');
const OUTPUT_DIR = join(ROOT_DIR, 'public', 'icons');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 72, name: 'icon-72.png', suffix: '-hdpi' },
  { size: 96, name: 'icon-96.png', suffix: '-xhdpi' },
  { size: 128, name: 'icon-128.png', suffix: '-xxhdpi' },
  { size: 144, name: 'icon-144.png', suffix: '-xxxhdpi' },
  { size: 152, name: 'icon-152.png', suffix: '-ipad' },
  { size: 192, name: 'icon-192.png', suffix: '-mdpi' },
  { size: 384, name: 'icon-384.png', suffix: '-xxxl' },
  { size: 512, name: 'icon-512.png', suffix: '-pwa' }
];

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error(`Failed to create output directory: ${error.message}`);
      process.exit(1);
    }
  }
}

/**
 * Generate a single icon size
 *
 * @param {number} size - Icon size in pixels
 * @param {string} filename - Output filename
 * @returns {Promise<void>}
 */
async function generateIcon(size, filename) {
  const outputPath = join(OUTPUT_DIR, filename);

  try {
    await sharp(SOURCE_SVG)
      .resize(size, size, {
        fit: 'cover',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`\u2705 Generated ${filename} (${size}x${size})`);
  } catch (error) {
    console.error(`\u274C Failed to generate ${filename}: ${error.message}`);
    throw error;
  }
}

/**
 * Generate favicon ICO file with multiple sizes
 *
 * @returns {Promise<void>}
 */
async function generateFavicon() {
  const outputPath = join(OUTPUT_DIR, 'favicon.ico');

  try {
    // Create a simple 32x32 favicon
    await sharp(SOURCE_SVG)
      .resize(32, 32, {
        fit: 'cover',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(OUTPUT_DIR, 'favicon-32.png'));

    console.log(`\u2705 Generated favicon-32.png (32x32)`);
    console.log(`   Note: Use favicon-32.png in HTML link tag (ICO format deprecated)`);
  } catch (error) {
    console.error(`\u274C Failed to generate favicon: ${error.message}`);
    throw error;
  }
}

/**
 * Main generation function
 *
 * @returns {Promise<number>} Exit code
 */
async function main() {
  console.log('Generating app icons from SVG source...\n');

  // Check if source SVG exists
  try {
    readFileSync(SOURCE_SVG, 'utf-8');
  } catch (error) {
    console.error(`Source SVG not found: ${SOURCE_SVG}`);
    console.error('Please create the icon source file first.');
    return 1;
  }

  ensureOutputDir();

  let successCount = 0;
  let failCount = 0;

  // Generate all sizes
  for (const { size, name } of ICON_SIZES) {
    try {
      await generateIcon(size, name);
      successCount++;
    } catch (error) {
      failCount++;
    }
  }

  // Generate favicon
  try {
    await generateFavicon();
  } catch (error) {
    failCount++;
  }

  // Summary
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Results: ${successCount} generated, ${failCount} failed`);

  if (failCount > 0) {
    console.log('\nIcon generation failed.');
    return 1;
  }

  console.log('\nAll icons generated successfully!');
  console.log('\nGenerated files:');
  ICON_SIZES.forEach(({ name }) => {
    console.log(`  public/icons/${name}`);
  });
  console.log('  public/icons/favicon-32.png');

  return 0;
}

// Run generation
main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
