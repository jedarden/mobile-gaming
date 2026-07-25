#!/usr/bin/env node
/**
 * Test suite profiling script
 * Runs the test suite 5 times and collects detailed timing data
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const RUNS = 5;
const OUTPUT_DIR = resolve(process.cwd(), 'test-profiling-results');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'test-profile-results.json');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  execSync(`mkdir -p ${OUTPUT_DIR}`);
}

console.log(`Running test suite ${RUNS} times to collect timing data...`);
console.log(`Output directory: ${OUTPUT_DIR}\n`);

const results = [];

for (let i = 1; i <= RUNS; i++) {
  console.log(`Run ${i}/${RUNS}...`);
  const startTime = Date.now();

  try {
    // Run vitest with JSON reporter to get structured timing data
    const output = execSync('npx vitest run --reporter=verbose', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Parse the output to extract timing information
    const lines = output.split('\n');
    const summaryLine = lines.find(line => line.includes('Duration'));

    result = {
      run: i,
      duration: duration,
      timestamp: new Date().toISOString(),
      output: output,
      summary: summaryLine || 'No summary found'
    };

    results.push(result);
    console.log(`  Completed in ${duration}ms`);

  } catch (error) {
    console.error(`  Run ${i} failed:`, error.message);
    results.push({
      run: i,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  // Small delay between runs to avoid any caching issues
  if (i < RUNS) {
    console.log('  Waiting 2s before next run...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Save results
writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
console.log(`\nResults saved to: ${OUTPUT_FILE}`);

// Print summary
console.log('\n=== SUMMARY ===');
const successfulRuns = results.filter(r => !r.error);
if (successfulRuns.length > 0) {
  const durations = successfulRuns.map(r => r.duration);
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  console.log(`Successful runs: ${successfulRuns.length}/${RUNS}`);
  console.log(`Average duration: ${avg}ms`);
  console.log(`Min duration: ${min}ms`);
  console.log(`Max duration: ${max}ms`);
} else {
  console.log('No successful runs!');
}
