#!/usr/bin/env node

/**
 * Test Framework Profiler
 *
 * Measures setup/teardown overhead across different test patterns.
 * Creates instrumented test runs to capture detailed timing metrics.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Test categories to profile
const TEST_CATEGORIES = {
  'no-setup': {
    description: 'Tests without setup/teardown',
    pattern: 'tests/shared/colors.test.js'
  },
  'beforeEach': {
    description: 'Tests with beforeEach only',
    pattern: 'tests/unit/quick-play.test.js'
  },
  'beforeEach-afterEach': {
    description: 'Tests with beforeEach and afterEach',
    pattern: 'tests/unit/level-nav.test.js'
  },
  'all-hooks': {
    description: 'Tests with all hooks (beforeAll, beforeEach, afterEach, afterAll)',
    pattern: 'tests/unit/water-sort.test.js'
  }
};

// Results storage
const results = {
  framework: {
    initialization: [],
    overallSetup: [],
    overallTeardown: []
  },
  byCategory: {},
  summary: {}
};

/**
 * Run a single test file with timing instrumentation
 */
function runTestWithInstrumentation(testFile, category) {
  console.log(`\n🔬 Profiling: ${testFile}`);

  const startTime = performance.now();

  try {
    // Run with Vitest's built-in reporters and capture timing
    const output = execSync(
      `npx vitest run ${testFile} --reporter=verbose --no-coverage`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      }
    );

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Parse Vitest output for timing information
    const timings = parseVitestOutput(output);

    return {
      success: true,
      totalTime,
      timings,
      output
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      success: false,
      totalTime: endTime - startTime,
      error: error.message,
      output: error.stdout || error.stderr
    };
  }
}

/**
 * Parse Vitest verbose output for timing information
 */
function parseVitestOutput(output) {
  const timings = {
    files: [],
    setup: [],
    teardown: [],
    tests: []
  };

  const lines = output.split('\n');

  for (const line of lines) {
    // Parse file timing: "tests/colors.test.js (234ms)"
    const fileMatch = line.match(/^(.+\.test\.js)\s+\((\d+)ms\)/);
    if (fileMatch) {
      timings.files.push({
        file: fileMatch[1],
        time: parseInt(fileMatch[2], 10)
      });
    }

    // Parse test timing from verbose output
    const testMatch = line.match(/^\s+(✓|×)\s+(.+)\s+(\d+)ms/);
    if (testMatch) {
      timings.tests.push({
        name: testMatch[2],
        time: parseInt(testMatch[3], 10),
        passed: testMatch[1] === '✓'
      });
    }
  }

  return timings;
}

/**
 * Create instrumented test files to measure hook overhead
 */
function createInstrumentedTests() {
  // Put instrumented tests inside tests/ so Vitest picks them up
  const instrumentDir = resolve(projectRoot, 'tests', 'profile');

  if (!existsSync(instrumentDir)) {
    mkdirSync(instrumentDir, { recursive: true });
  }

  // Test 1: No hooks
  writeFileSync(
    resolve(instrumentDir, 'no-hooks.test.js'),
    `
import { describe, it, expect } from 'vitest';

describe('No Hooks', () => {
  it('test 1', () => {
    expect(true).toBe(true);
  });

  it('test 2', () => {
    expect(true).toBe(true);
  });

  it('test 3', () => {
    expect(true).toBe(true);
  });
});
    `
  );

  // Test 2: beforeEach only
  writeFileSync(
    resolve(instrumentDir, 'beforeEach-only.test.js'),
    `
import { describe, it, expect, beforeEach } from 'vitest';

describe('beforeEach Only', () => {
  let counter = 0;

  beforeEach(() => {
    counter++;
  });

  it('test 1', () => {
    expect(counter).toBe(1);
  });

  it('test 2', () => {
    expect(counter).toBe(2);
  });

  it('test 3', () => {
    expect(counter).toBe(3);
  });
});
    `
  );

  // Test 3: beforeEach and afterEach
  writeFileSync(
    resolve(instrumentDir, 'both-hooks.test.js'),
    `
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Both Hooks', () => {
  let counter = 0;
  let afterCount = 0;
  let testNumber = 0;

  beforeEach(() => {
    counter = 1;
    testNumber++;
  });

  afterEach(() => {
    afterCount++;
  });

  it('test 1', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(1);
    expect(afterCount).toBe(0);
  });

  it('test 2', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(2);
    expect(afterCount).toBe(1);
  });

  it('test 3', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(3);
    expect(afterCount).toBe(2);
  });
});
    `
  );

  // Test 4: All hooks
  writeFileSync(
    resolve(instrumentDir, 'all-hooks.test.js'),
    `
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

describe('All Hooks', () => {
  let setupCounter = 0;
  let testCounter = 0;

  beforeAll(() => {
    setupCounter = 100;
  });

  beforeEach(() => {
    testCounter++;
  });

  afterEach(() => {
    testCounter = 0;
  });

  afterAll(() => {
    setupCounter = 0;
  });

  it('test 1', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });

  it('test 2', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });

  it('test 3', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });
});
    `
  );

  return instrumentDir;
}

/**
 * Profile framework initialization cost
 */
function profileFrameworkInit() {
  console.log('\n📊 Measuring Framework Initialization Overhead\n');

  const instrumentDir = createInstrumentedTests();
  const frameworkTests = [
    'no-hooks.test.js',
    'beforeEach-only.test.js',
    'both-hooks.test.js',
    'all-hooks.test.js'
  ];

  for (const testFile of frameworkTests) {
    const fullPath = resolve(instrumentDir, testFile);
    const result = runTestWithInstrumentation(fullPath, 'framework');

    if (result.success) {
      results.framework[testFile.replace('.test.js', '')] = {
        totalTime: result.totalTime,
        testCount: result.timings.tests.length,
        avgTestTime: result.timings.tests.length > 0
          ? result.timings.tests.reduce((sum, t) => sum + t.time, 0) / result.timings.tests.length
          : 0
      };
    }
  }
}

/**
 * Profile scaling behavior with increasing test counts
 */
function profileScalingBehavior() {
  console.log('\n📈 Measuring Setup Scaling with Test Count\n');

  const instrumentDir = resolveInstrumentedDir();
  const testCounts = [1, 5, 10, 20, 50];

  for (const count of testCounts) {
    const testFile = createTestWithNTests(count);
    const result = runTestWithInstrumentation(testFile, `scale-${count}`);

    results.framework[`scale-${count}tests`] = {
      testCount: count,
      totalTime: result.totalTime,
      avgTimePerTest: result.totalTime / count
    };
  }
}

function resolveInstrumentedDir() {
  const dir = resolve(projectRoot, 'tests', 'profile');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function createTestWithNTests(n) {
  const instrumentDir = resolveInstrumentedDir();
  const testFile = resolve(instrumentDir, `scale-${n}-tests.test.js`);

  const testCases = Array.from({ length: n }, (_, i) =>
    `  it('test ${i + 1}', () => {\n    expect(true).toBe(true);\n  });`
  ).join('\n');

  writeFileSync(
    testFile,
    `
import { describe, it, expect, beforeEach } from 'vitest';

describe('Scale Test ${n} Tests', () => {
  let setupCalled = 0;

  beforeEach(() => {
    setupCalled++;
  });

${testCases}
});
    `
  );

  return testFile;
}

/**
 * Profile actual project test files
 */
function profileProjectTests() {
  console.log('\n🔬 Profiling Project Test Files\n');

  // Profile a representative sample
  const testFiles = [
    'tests/shared/colors.test.js',
    'tests/shared/audio.test.js',
    'tests/unit/quick-play.test.js',
    'tests/unit/jelly-shift.test.js',
    'tests/unit/retry.test.js'
  ];

  for (const testFile of testFiles) {
    const fullPath = resolve(projectRoot, testFile);
    if (!existsSync(fullPath)) {
      console.log(`⚠️  Skipping ${testFile} (not found)`);
      continue;
    }

    const category = testFile.split('/')[1]; // 'shared' or 'unit'
    const result = runTestWithInstrumentation(fullPath, category);

    if (result.success) {
      if (!results.byCategory[category]) {
        results.byCategory[category] = [];
      }

      results.byCategory[category].push({
        file: testFile,
        totalTime: result.totalTime,
        testCount: result.timings.tests.length,
        avgTestTime: result.timings.tests.length > 0
          ? result.timings.tests.reduce((sum, t) => sum + t.time, 0) / result.timings.tests.length
          : 0
      });
    }
  }
}

/**
 * Generate summary statistics
 */
function generateSummary() {
  console.log('\n📊 Generating Summary\n');

  // Calculate framework overhead percentages
  const noHooksTime = results.framework['no-hooks']?.totalTime || 0;
  const beforeEachTime = results.framework['beforeEach-only']?.totalTime || 0;
  const bothHooksTime = results.framework['both-hooks']?.totalTime || 0;
  const allHooksTime = results.framework['all-hooks']?.totalTime || 0;

  results.summary.frameworkOverhead = {
    beforeEachOnly: noHooksTime > 0 ? ((beforeEachTime - noHooksTime) / noHooksTime * 100).toFixed(2) : 0,
    bothHooks: noHooksTime > 0 ? ((bothHooksTime - noHooksTime) / noHooksTime * 100).toFixed(2) : 0,
    allHooks: noHooksTime > 0 ? ((allHooksTime - noHooksTime) / noHooksTime * 100).toFixed(2) : 0
  };

  // Calculate scaling behavior
  const scaleData = Object.entries(results.framework)
    .filter(([key]) => key.startsWith('scale-'))
    .map(([key, data]) => data)
    .sort((a, b) => a.testCount - b.testCount);

  results.summary.scaling = scaleData;

  // Calculate category averages
  for (const [category, files] of Object.entries(results.byCategory)) {
    const totalTime = files.reduce((sum, f) => sum + f.totalTime, 0);
    const totalTests = files.reduce((sum, f) => sum + f.testCount, 0);

    results.summary[category] = {
      fileCount: files.length,
      totalTests,
      totalTime,
      avgTimePerTest: totalTests > 0 ? totalTime / totalTests : 0
    };
  }
}

/**
 * Print results report
 */
function printReport() {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST FRAMEWORK SETUP/TEARDOWN OVERHEAD REPORT');
  console.log('='.repeat(80));

  // Framework Overhead
  console.log('\n🔧 Framework Initialization & Hook Overhead:\n');
  console.log('Configuration                | Total Time | Overhead % | Avg/Test');
  console.log('-'.repeat(70));

  const configurations = [
    { name: 'No Hooks', data: results.framework['no-hooks'] },
    { name: 'beforeEach Only', data: results.framework['beforeEach-only'] },
    { name: 'beforeEach + afterEach', data: results.framework['both-hooks'] },
    { name: 'All Hooks', data: results.framework['all-hooks'] }
  ];

  const baselineTime = results.framework['no-hooks']?.totalTime || 1;

  for (const { name, data } of configurations) {
    if (!data) continue;

    const overhead = ((data.totalTime - baselineTime) / baselineTime * 100).toFixed(1);
    const avgPerTest = (data.totalTime / data.testCount).toFixed(2);

    console.log(
      `${name.padEnd(30)} | ${data.totalTime.toString().padStart(9)}ms | ${overhead.padStart(8)}% | ${avgPerTest}ms`
    );
  }

  // Scaling Behavior
  console.log('\n📈 Setup Time Scaling with Test Count:\n');
  console.log('Test Count | Total Time | Time/Test | Overhead Factor');
  console.log('-'.repeat(65));

  const baseline = results.framework['no-hooks']?.totalTime || 1;
  const scaleData = Object.entries(results.framework)
    .filter(([key]) => key.startsWith('scale-'))
    .sort((a, b) => a[1].testCount - b[1].testCount);

  for (const [key, data] of scaleData) {
    const overheadFactor = (data.totalTime / baseline).toFixed(2);
    const timePerTest = data.avgTimePerTest.toFixed(2);

    console.log(
      `${data.testCount.toString().padStart(10)} | ${data.totalTime.toFixed(0).padStart(10)}ms | ${timePerTest.padStart(8)}ms | ${overheadFactor}x`
    );
  }

  // Category Summary
  console.log('\n📁 Test Category Summary:\n');
  console.log('Category    | Files | Tests | Total Time | Avg/Test');
  console.log('-'.repeat(60));

  for (const [category, data] of Object.entries(results.summary)) {
    if (typeof data !== 'object' || !data.fileCount) continue;

    console.log(
      `${category.padEnd(11)} | ${data.fileCount.toString().padStart(5)} | ${data.totalTests.toString().padStart(5)} | ${data.totalTime.toFixed(0).padStart(10)}ms | ${data.avgTimePerTest.toFixed(2)}ms`
    );
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Save results to file
 */
function saveResults() {
  const resultsPath = resolve(projectRoot, 'test-framework-profile.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${resultsPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Starting Test Framework Profiler\n');
  console.log('This will measure:');
  console.log('  • Framework initialization time');
  console.log('  • beforeAll/beforeEach/afterEach/afterAll overhead');
  console.log('  • Setup time scaling with test count');
  console.log('  • Overhead across different test patterns');

  profileFrameworkInit();
  profileScalingBehavior();
  profileProjectTests();
  generateSummary();
  printReport();
  saveResults();

  console.log('\n✅ Profiling complete!\n');
}

main();
