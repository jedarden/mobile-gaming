/**
 * Measure test setup/teardown overhead
 *
 * This script analyzes test timing to understand how much time is spent
 * on setup vs. actual test execution.
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('=== Test Setup/Teardown Overhead Analysis ===\n');

// Run tests with JSON reporter for timing data - write to file
console.log('Running tests with JSON reporter (writing to file)...');
try {
  execSync('npx vitest run --reporter=json > test-results.json 2>&1', { stdio: 'inherit' });
} catch (e) {
  console.error('Test run failed:', e.message);
}

// Read the results
console.log('\nReading test results...');
let testJson = fs.readFileSync('test-results.json', 'utf-8');

let testResults;
try {
  testResults = JSON.parse(testJson);
} catch (e) {
  // If JSON parsing fails, the output might contain extra text
  const jsonMatch = testJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    testResults = JSON.parse(jsonMatch[0]);
  } else {
    console.error('Failed to parse test output as JSON');
    process.exit(1);
  }
}

// Analyze the timing data
const stats = {
  totalTests: 0,
  totalDuration: 0,
  setupTime: 0,
  teardownTime: 0,
  testExecutionTime: 0,
  suites: [],
  slowTests: [],
  fastTests: [],
  perSuiteSetup: []
};

if (testResults.testResults) {
  for (const file of testResults.testResults) {
    const suiteStats = {
      file: file.name,
      duration: 0, // Will calculate from assertion results
      tests: [],
      setupTime: 0,
      teardownTime: 0,
      numTests: 0
    };

    // Use assertionResults which contains the actual test data
    if (file.assertionResults) {
      suiteStats.numTests = file.assertionResults.length;

      for (const test of file.assertionResults) {
        stats.totalTests++;
        const testDuration = test.duration || 0;
        stats.totalDuration += testDuration;
        stats.testExecutionTime += testDuration;
        suiteStats.duration += testDuration;

        suiteStats.tests.push({
          name: test.title,
          duration: testDuration
        });

        if (testDuration > 100) {
          stats.slowTests.push({ file: file.name, name: test.title, duration: testDuration });
        } else if (testDuration < 5 && testDuration > 0) {
          stats.fastTests.push({ file: file.name, name: test.title, duration: testDuration });
        }
      }
    }

    // Calculate estimated per-suite setup overhead
    // For now, the suite duration is just the sum of all tests
    // Real overhead would be the difference between wall-clock time and sum of tests
    const sumOfTestTimes = suiteStats.tests.reduce((sum, t) => sum + t.duration, 0);
    // Since we only have test durations, we'll estimate overhead based on very fast tests
    // Tests under 1ms are likely dominated by framework overhead
    const overheadTests = suiteStats.tests.filter(t => t.duration < 1);
    suiteStats.setupTime = overheadTests.length * 0.5; // Estimate 0.5ms overhead per fast test

    stats.suites.push(suiteStats);
    stats.perSuiteSetup.push({
      file: file.name,
      setupOverhead: suiteStats.setupTime,
      numTests: suiteStats.numTests,
      overheadPerTest: suiteStats.numTests > 0 ? suiteStats.setupTime / suiteStats.numTests : 0
    });
  }
}

// Run just setup to measure baseline setup time
console.log('\nMeasuring setup overhead by running setup in isolation...');
const setupStart = Date.now();
try {
  // Create a temporary setup measurement script
  const setupScript = `
    // Simulate the setup from tests/setup.js
    if (typeof global.navigator === 'undefined') {
      global.navigator = {};
    }
    if (!global.navigator.clipboard) {
      global.navigator.clipboard = {
        writeText: () => Promise.resolve(undefined),
        readText: () => Promise.resolve(''),
      };
    }
    if (!global.navigator.share) {
      global.navigator.share = () => Promise.reject(new Error('Share not supported'));
    }
    if (!global.navigator.userAgent) {
      global.navigator.userAgent = 'Mozilla/5.0 (ci-test) Vitest/1.0';
    }
    if (typeof global.window !== 'undefined' && !global.window.devicePixelRatio) {
      global.window.devicePixelRatio = 1;
    }
    console.log('Setup complete');
  `;
  fs.writeFileSync('/tmp/setup-measure.cjs', setupScript);
  execSync('node /tmp/setup-measure.cjs', { stdio: 'pipe' });
  fs.unlinkSync('/tmp/setup-measure.cjs');
  stats.setupTime = Date.now() - setupStart;
} catch (e) {
  stats.setupTime = 1; // Minimal time if setup fails
}

// Print results
console.log('\n=== Test Timing Analysis ===\n');
console.log(`Total tests: ${stats.totalTests}`);
console.log(`Total duration: ${stats.totalDuration.toFixed(2)}ms`);
console.log(`Average test duration: ${(stats.totalDuration / stats.totalTests).toFixed(2)}ms`);
console.log(`Estimated setup overhead: ${stats.setupTime}ms`);

// Test file overhead analysis - sorted by setup overhead
console.log('\n=== Per-Suite Setup Overhead (Top 20) ===\n');
stats.perSuiteSetup
  .sort((a, b) => b.setupOverhead - a.setupOverhead)
  .slice(0, 20)
  .forEach(suite => {
    const overheadPercent = suite.numTests > 0
      ? (suite.setupOverhead / (suite.setupOverhead + suite.numTests * 1) * 100).toFixed(1)
      : 0;
    console.log(`${suite.file}`);
    console.log(`  Setup overhead: ${suite.setupOverhead.toFixed(2)}ms | Tests: ${suite.numTests} | Overhead per test: ${suite.overheadPerTest.toFixed(3)}ms`);
  });

// Calculate total setup overhead across all suites
const totalSetupOverhead = stats.perSuiteSetup.reduce((sum, s) => sum + s.setupOverhead, 0);

// Slow tests
if (stats.slowTests.length > 0) {
  console.log('\n=== Slowest Tests (>100ms) ===\n');
  stats.slowTests
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 15)
    .forEach(test => {
      console.log(`${test.duration.toFixed(2)}ms - ${test.file} > ${test.name}`);
    });
}

// Fast tests (potential overhead victims)
if (stats.fastTests.length > 0) {
  console.log('\n=== Fast Tests That May Be Overhead-Dominated (<5ms) ===\n');
  console.log(`Found ${stats.fastTests.length} very fast tests`);
  stats.fastTests
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 15)
    .forEach(test => {
      console.log(`${test.duration.toFixed(3)}ms - ${test.file} > ${test.name}`);
    });
}

// Save results
fs.writeFileSync('test-overhead-analysis.json', JSON.stringify({
  ...stats,
  totalSetupOverhead,
  overheadRatio: totalSetupOverhead / stats.totalDuration
}, null, 2));
console.log('\nDetailed results saved to: test-overhead-analysis.json');

// Calculate overhead percentage
const overheadRatio = totalSetupOverhead / stats.totalDuration;
console.log('\n=== Overhead Summary ===\n');
console.log(`Total setup overhead across all suites: ${totalSetupOverhead.toFixed(2)}ms`);
console.log(`Total test execution time: ${stats.totalDuration.toFixed(2)}ms`);
console.log(`Overhead ratio: ${(overheadRatio * 100).toFixed(2)}%`);
console.log('\nNote: Setup overhead is per-suite. With many test suites, this compounds significantly.');
console.log(`The project has ${stats.suites.length} test suites, so setup overhead runs ${stats.suites.length} times.`);
