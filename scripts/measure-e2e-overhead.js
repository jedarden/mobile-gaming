/**
 * Measure E2E test setup/teardown overhead
 *
 * This script analyzes Playwright E2E test timing to understand how much time
 * is spent on setup vs. actual test execution.
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('=== E2E Test Setup/Teardown Overhead Analysis ===\n');

// First, let's see what E2E tests we have
console.log('Listing E2E test files...');
const testFiles = fs.readdirSync('tests/e2e')
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log(`Found ${testFiles.length} E2E test files\n`);

// Get the wall-clock time for running a single test file
console.log('Measuring wall-clock time for individual E2E test files...');

const e2eResults = [];

for (const testFile of testFiles.slice(0, 5)) { // Sample first 5 files
  console.log(`  Testing ${testFile}...`);

  const start = Date.now();
  try {
    // Run just this one test file
    const result = execSync(
      `npx playwright test tests/e2e/${testFile} --reporter=json`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    const playwrightResults = JSON.parse(result);

    if (playwrightResults.tests && playwrightResults.tests.length > 0) {
      const totalTestTime = playwrightResults.tests
        .reduce((sum, test) => sum + (test.duration || 0), 0);

      const wallClockTime = Date.now() - start;
      const overhead = wallClockTime - totalTestTime;

      e2eResults.push({
        file: testFile,
        numTests: playwrightResults.tests.length,
        totalTestTime,
        wallClockTime,
        overhead,
        overheadPerTest: playwrightResults.tests.length > 0
          ? overhead / playwrightResults.tests.length
          : 0
      });
    }
  } catch (e) {
    console.log(`    Failed: ${e.message}`);
  }
}

// Print E2E results
if (e2eResults.length > 0) {
  console.log('\n=== E2E Test File Overhead Analysis ===\n');
  console.log('File | Tests | Total Test Time | Wall-Clock Time | Overhead | Overhead per Test');
  console.log('--- | --- | --- | --- | --- | ---');

  e2eResults.forEach(r => {
    console.log(
      `${r.file} | ${r.numTests} | ${r.totalTestTime.toFixed(0)}ms | ` +
      `${r.wallClockTime}ms | ${r.overhead}ms | ${r.overheadPerTest.toFixed(1)}ms`
    );
  });

  const totalOverhead = e2eResults.reduce((sum, r) => sum + r.overhead, 0);
  const avgOverheadPercent = e2eResults.reduce((sum, r) => {
    return sum + (r.overhead / r.wallClockTime);
  }, 0) / e2eResults.length * 100;

  console.log('\n=== E2E Overhead Summary ===\n');
  console.log(`Average overhead per test file: ${totalOverhead / e2eResults.length.toFixed(0)}ms`);
  console.log(`Average overhead ratio: ${avgOverheadPercent.toFixed(1)}%`);
} else {
  console.log('\nNo E2E test results collected (tests may have failed or no tests found)');
}

// Save results
fs.writeFileSync('e2e-overhead-analysis.json', JSON.stringify(e2eResults, null, 2));
console.log('\nDetailed E2E results saved to: e2e-overhead-analysis.json');
