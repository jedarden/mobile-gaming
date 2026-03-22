#!/usr/bin/env node

/**
 * OG image generation script
 *
 * Uses Playwright to generate 1200x630 PNG thumbnails of each game's initial
 * state. Screenshots are saved to public/og/ and committed to the repo so
 * social-share meta tags can reference them without a server.
 *
 * Requires the project to be built first: npm run build
 * Then start preview server separately or rely on the webServer spawn here.
 *
 * Usage: node scripts/generate-og.js
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'public', 'og');

const PORT = 4174; // use a separate port to avoid conflicts with default preview
const BASE_URL = `http://localhost:${PORT}`;

// Games to screenshot — slug matches src/games/<slug>/index.html
// Hub uses a special path (src/hub/index.html) handled below
const GAMES = [
  { slug: 'water-sort',         title: 'Water Sort' },
  { slug: 'brain-teaser',       title: 'Brain Teaser' },
  { slug: 'bus-jam',            title: 'Bus Jam' },
  { slug: 'save-the-character', title: 'Save the Character' },
  { slug: 'pull-the-pin',       title: 'Pull the Pin' },
  { slug: 'jelly-shift',        title: 'Jelly Shift' },
  { slug: 'giant-runner',       title: 'Giant Runner' },
  { slug: 'crowd-runner',       title: 'Crowd Runner' },
  { slug: 'bridge-race',        title: 'Bridge Race' },
  { slug: 'makeover-run',       title: 'Makeover Run' },
];

/**
 * Start vite preview server, resolve when it's ready
 *
 * @returns {Promise<import('child_process').ChildProcess>}
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(
      'npx',
      ['vite', 'preview', '--port', String(PORT), '--strictPort'],
      { cwd: ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let ready = false;

    server.stdout.on('data', (data) => {
      const text = data.toString();
      if (!ready && (text.includes('Local:') || text.includes('localhost'))) {
        ready = true;
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      if (!ready && (text.includes('Local:') || text.includes('localhost'))) {
        ready = true;
        resolve(server);
      }
    });

    server.on('error', reject);
    server.on('exit', (code) => {
      if (!ready) reject(new Error(`Server exited with code ${code}`));
    });

    // Fallback: give it 5 seconds to start
    setTimeout(() => {
      if (!ready) {
        ready = true;
        resolve(server);
      }
    }, 5000);
  });
}

/**
 * Wait until the server responds to a HEAD request
 *
 * @param {string} url
 * @param {number} retries
 */
async function waitForServer(url, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const { default: http } = await import('http');
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => { res.resume(); resolve(); });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Server at ${url} did not respond after ${retries} attempts`);
}

/**
 * Screenshot a single game
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} slug
 * @param {string} outputPath
 */
async function screenshotGame(context, slug, outputPath) {
  const page = await context.newPage();
  try {
    const url = `${BASE_URL}/src/games/${slug}/index.html`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for canvas or Three.js renderer to paint at least one frame
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      // Check for any drawn content via a 1x1 pixel sample
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const d = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
          return d[3] > 0; // alpha > 0 means something was drawn
        }
        // WebGL canvas (3D games) — just wait for it to be visible
        return canvas.width > 0 && canvas.height > 0;
      } catch {
        return canvas.width > 0 && canvas.height > 0;
      }
    }, { timeout: 10000 }).catch(() => {
      // Best effort — continue anyway
    });

    // Extra settle time for 3D games
    await page.waitForTimeout(1000);

    await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`✅ ${slug} → ${outputPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Generating OG images (1200×630)...\n');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Build must already exist (run npm run build first)
  console.log('Starting vite preview server...');
  const server = await startServer();

  try {
    await waitForServer(BASE_URL);
    console.log(`Server ready at ${BASE_URL}\n`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });

    let success = 0;
    let failed = 0;

    // Screenshot the hub
    const hubOutputPath = join(OUTPUT_DIR, 'hub.png');
    try {
      const hubPage = await context.newPage();
      await hubPage.goto(`${BASE_URL}/src/hub/index.html`, { waitUntil: 'networkidle', timeout: 15000 });
      await hubPage.waitForTimeout(500);
      await hubPage.screenshot({ path: hubOutputPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      await hubPage.close();
      console.log(`✅ hub → ${hubOutputPath}`);
      success++;
    } catch (err) {
      console.error(`❌ hub: ${err.message}`);
      failed++;
    }

    for (const { slug } of GAMES) {
      const outputPath = join(OUTPUT_DIR, `${slug}.png`);
      try {
        await screenshotGame(context, slug, outputPath);
        success++;
      } catch (err) {
        console.error(`❌ ${slug}: ${err.message}`);
        failed++;
      }
    }

    await browser.close();

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Results: ${success} generated, ${failed} failed`);

    if (failed > 0) {
      process.exitCode = 1;
    } else {
      console.log('\nAll OG images generated successfully!');
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
