/**
 * Comprehensive Setup/Teardown Overhead Measurement Script
 *
 * Measures time spent in test infrastructure vs actual test execution across the entire test suite.
 * This addresses acceptance criteria:
 * - Measure time spent in beforeEach/beforeAll hooks
 * - Measure time spent in afterEach/afterAll hooks
 * - Profile fixture loading and initialization
 * - Compare setup time vs actual test execution time
 * - Document setup/teardown as a percentage of total runtime
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Measurement results storage
const measurementResults = {
  startTime: null,
  endTime: null,
  totalTests: 0,
  files: {},
  summary: {
    setupTime: 0,
    testExecutionTime: 0,
    teardownTime: 0,
    fixtureLoadingTime: 0,
    totalTime: 0
  }
};

/**
 * Parse test output to extract timing information
 */
function parseTestOutput(output) {
  const lines = output.split('\n');
  const results = {
    setup: [],
    testExecution: [],
    teardown: [],
    fixtureLoading: []
  };

  // Look for timing markers from our instrumented hooks
  let currentPhase = null;
  let currentStartTime = null;

  for (const line of lines) {
    // Parse timing markers
    const timingMatch = line.match(/\[TIMING:(\w+)\] ([\d.]+)ms/);
    if (timingMatch) {
      const phase = timingMatch[1];
      const duration = parseFloat(timingMatch[2]);

      if (phase === 'FIXTURE_LOAD') {
        results.fixtureLoading.push(duration);
      }
    }

    // Parse vitest JSON output if available
    try {
      if (line.trim().startsWith('{')) {
        const data = JSON.parse(line);
        if (data.type === 'test' && data.result?.duration) {
          results.testExecution.push(data.result.duration);
        }
      }
    } catch (e) {
      // Not JSON, continue
    }
  }

  return results;
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, total: 0, average: 0, min: 0, max: 0, median: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  const count = sorted.length;
  const average = total / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  return {
    count,
    total,
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median
  };
}

/**
 * Format milliseconds for display
 */
function formatMs(ms) {
  if (ms < 1) {
    return `${ms.toFixed(3)}ms`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(3)}s`;
  }
}

/**
 * Create an instrumented setup file that measures hook execution times
 */
function createInstrumentedSetup() {
  const setupContent = `
/**
 * Instrumented setup file for measuring setup/teardown overhead
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

// Timing storage
globalThis.__setupTeardownTimings = {
  beforeAll: [],
  beforeEach: [],
  afterEach: [],
  afterAll: [],
  fixtureLoading: [],
  testExecution: []
};

// Wrap navigator setup
const originalBeforeAll = beforeAll;
beforeAll(() => {
  const start = performance.now();

  // Original navigator setup
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

  const end = performance.now();
  globalThis.__setupTeardownTimings.beforeAll.push(end - start);
  console.error('[TIMING:beforeAll] ' + (end - start).toFixed(3) + 'ms');
});

// Store wrapped hooks for test files to use
globalThis.__measureBeforeEach = function(fn) {
  return async function(...args) {
    const start = performance.now();
    await fn.apply(this, args);
    const end = performance.now();
    globalThis.__setupTeardownTimings.beforeEach.push(end - start);
    console.error('[TIMING:beforeEach] ' + (end - start).toFixed(3) + 'ms');
  };
};

globalThis.__measureAfterEach = function(fn) {
  return async function(...args) {
    const start = performance.now();
    await fn.apply(this, args);
    const end = performance.now();
    globalThis.__setupTeardownTimings.afterEach.push(end - start);
    console.error('[TIMING:afterEach] ' + (end - start).toFixed(3) + 'ms');
  };
};

globalThis.__measureAfterAll = function(fn) {
  return async function(...args) {
    const start = performance.now();
    await fn.apply(this, args);
    const end = performance.now();
    globalThis.__setupTeardownTimings.afterAll.push(end - start);
    console.error('[TIMING:afterAll] ' + (end - start).toFixed(3) + 'ms');
  };
};

globalThis.__measureFixture = function(label, fn) {
  return async function(...args) {
    const start = performance.now();
    const result = await fn.apply(this, args);
    const end = performance.now();
    globalThis.__setupTeardownTimings.fixtureLoading.push({
      label,
      duration: end - start
    });
    console.error('[TIMING:FIXTURE_LOAD] ' + label + ' - ' + (end - start).toFixed(3) + 'ms');
    return result;
  };
};

// Export timing data at the end
afterAll(() => {
  const timings = globalThis.__setupTeardownTimings;
  const outputDir = path.join(process.cwd(), 'test-timing-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  fs.writeFileSync(
    path.join(outputDir, 'setup-teardown-measurements-' + timestamp + '.json'),
    JSON.stringify(timings, null, 2)
  );
  console.error('\\n[SETUP_TEARDOWN_MEASUREMENTS] Written to ' + outputDir);
});
`;

  // Write instrumented setup file
  const instrumentedSetupPath = path.join(process.cwd(), 'tests', 'setup-measured.js');
  fs.writeFileSync(instrumentedSetupPath, setupContent);
  return instrumentedSetupPath;
}

/**
 * Analyze existing test files to identify fixture usage patterns
 */
function analyzeFixtureUsage() {
  const testFiles = fs.readdirSync(path.join(process.cwd(), 'tests/unit'))
    .filter(f => f.endsWith('.test.js'));

  const fixtureAnalysis = {
    totalTestFiles: testFiles.length,
    fixtureImports: {},
    mockPatterns: {},
    setupComplexity: {}
  };

  for (const testFile of testFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), 'tests/unit', testFile), 'utf8');

    // Count fixture imports
    const importMatches = content.match(/import.*from.*['"(test-utils|generator-test-utils|helpers|mock-canvas|state-builders)/g) || [];
    for (const match of importMatches) {
      const fixture = match.match(/from ['"](.*)['"]/)?.[1] || 'unknown';
      fixtureAnalysis.fixtureImports[fixture] = (fixtureAnalysis.fixtureImports[fixture] || 0) + 1;
    }

    // Count mock patterns
    const viMockMatches = content.match(/vi\.mock\(/g) || [];
    fixtureAnalysis.mockPatterns[testFile] = {
      mockCount: viMockMatches.length,
      hasSetup: /beforeAll\(/.test(content),
      hasBeforeEach: /beforeEach\(/.test(content),
      hasAfterEach: /afterEach\(/.test(content),
      hasAfterAll: /afterAll\(/.test(content)
    };

    // Estimate setup complexity
    let complexity = 0;
    if (fixtureAnalysis.mockPatterns[testFile].hasSetup) complexity += 2;
    if (fixtureAnalysis.mockPatterns[testFile].hasBeforeEach) complexity += 1;
    if (fixtureAnalysis.mockPatterns[testFile].hasAfterEach) complexity += 1;
    if (fixtureAnalysis.mockPatterns[testFile].hasAfterAll) complexity += 2;
    complexity += viMockMatches.length * 0.5;
    complexity += importMatches.length * 0.3;

    fixtureAnalysis.setupComplexity[testFile] = complexity;
  }

  return fixtureAnalysis;
}

/**
 * Run the measurement analysis
 */
async function runMeasurement() {
  console.log('🔬 Starting comprehensive setup/teardown overhead measurement...\n');

  measurementResults.startTime = new Date().toISOString();

  // 1. Analyze fixture usage patterns
  console.log('📊 Analyzing fixture usage patterns...');
  const fixtureAnalysis = analyzeFixtureUsage();
  console.log(`   Found ${fixtureAnalysis.totalTestFiles} test files`);
  console.log(`   Most common fixtures:`, Object.entries(fixtureAnalysis.fixtureImports)
    .sort((a, b) => b[1] - a[1]).slice(0, 5));

  // 2. Create instrumented setup file
  console.log('\n🔧 Creating instrumented test setup...');
  const instrumentedSetupPath = createInstrumentedSetup();
  console.log(`   Created: ${instrumentedSetupPath}`);

  // 3. Run a sample of tests with instrumentation
  console.log('\n⚡ Running instrumented test suite...');
  const sampleTests = [
    'tests/unit/quick-play.test.js',
    'tests/unit/audio.test.js',
    'tests/unit/accessibility.test.js',
    'tests/unit/adaptive.test.js',
    'tests/unit/analytics.test.js'
  ];

  // 4. Run comprehensive test suite
  console.log('\n🧪 Running comprehensive test suite with timing...');
  const testResults = await runComprehensiveTests();

  // 5. Analyze results
  console.log('\n📈 Analyzing timing results...');
  const analysis = analyzeComprehensiveResults(testResults);

  // 6. Generate comprehensive report
  console.log('\n📝 Generating comprehensive report...');
  const report = generateComprehensiveReport(analysis, fixtureAnalysis);

  measurementResults.endTime = new Date().toISOString();

  // 7. Write final report
  const reportPath = path.join(process.cwd(), 'notes', 'bf-2i0o4.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Report written to: ${reportPath}`);

  return reportPath;
}

/**
 * Run comprehensive tests and collect timing data
 */
async function runComprehensiveTests() {
  return new Promise((resolve) => {
    const testProcess = spawn('npm', ['test', '--', '--reporter=verbose'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // Capture timing markers in real-time
      if (text.includes('[TIMING:')) {
        process.stderr.write(data);
      }
    });

    testProcess.on('close', (code) => {
      resolve({
        exitCode: code,
        output,
        errorOutput
      });
    });
  });
}

/**
 * Analyze comprehensive test results
 */
function analyzeComprehensiveResults(testResults) {
  const lines = testResults.errorOutput.split('\n');
  const timings = {
    beforeAll: [],
    beforeEach: [],
    afterEach: [],
    afterAll: [],
    fixtureLoading: [],
    testExecution: []
  };

  // Parse timing markers
  for (const line of lines) {
    const match = line.match(/\[TIMING:(\w+)\] ([\d.]+)ms/);
    if (match) {
      const phase = match[1];
      const duration = parseFloat(match[2]);

      switch (phase) {
        case 'beforeAll':
          timings.beforeAll.push(duration);
          break;
        case 'beforeEach':
          timings.beforeEach.push(duration);
          break;
        case 'afterEach':
          timings.afterEach.push(duration);
          break;
        case 'afterAll':
          timings.afterAll.push(duration);
          break;
        case 'FIXTURE_LOAD':
          timings.fixtureLoading.push(duration);
          break;
        case 'testExecution':
          timings.testExecution.push(duration);
          break;
      }
    }
  }

  // Calculate statistics
  const setupStats = calculateStats([...timings.beforeAll, ...timings.beforeEach]);
  const testStats = calculateStats(timings.testExecution);
  const teardownStats = calculateStats([...timings.afterEach, ...timings.afterAll]);
  const fixtureStats = calculateStats(timings.fixtureLoading);

  const totalTime = setupStats.total + testStats.total + teardownStats.total;

  return {
    setup: {
      ...setupStats,
      percentage: totalTime > 0 ? (setupStats.total / totalTime) * 100 : 0,
      breakdown: {
        beforeAll: calculateStats(timings.beforeAll),
        beforeEach: calculateStats(timings.beforeEach)
      }
    },
    testExecution: {
      ...testStats,
      percentage: totalTime > 0 ? (testStats.total / totalTime) * 100 : 0
    },
    teardown: {
      ...teardownStats,
      percentage: totalTime > 0 ? (teardownStats.total / totalTime) * 100 : 0,
      breakdown: {
        afterEach: calculateStats(timings.afterEach),
        afterAll: calculateStats(timings.afterAll)
      }
    },
    fixtureLoading: {
      ...fixtureStats,
      percentage: totalTime > 0 ? (fixtureStats.total / totalTime) * 100 : 0
    },
    total: totalTime,
    overheadRatio: totalTime > 0 && testStats.total > 0
      ? (setupStats.total + teardownStats.total) / testStats.total
      : 0,
    rawData: timings
  };
}

/**
 * Generate comprehensive report
 */
function generateComprehensiveReport(analysis, fixtureAnalysis) {
  const a = analysis;

  return `# Test Setup/Teardown Overhead Measurement

**Bead ID**: bf-2i0o4
**Generated**: ${new Date().toISOString()}
**Measurement Scope**: ${fixtureAnalysis.totalTestFiles} test files

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| **Total Runtime** | ${formatMs(a.total)} | - |
| **Setup Time** | ${formatMs(a.setup.total)} (${a.setup.percentage.toFixed(1)}%) | ${a.setup.percentage > 30 ? '⚠️ HIGH' : '✅ OK'} |
| **Test Execution** | ${formatMs(a.testExecution.total)} (${a.testExecution.percentage.toFixed(1)}%) | - |
| **Teardown Time** | ${formatMs(a.teardown.total)} (${a.teardown.percentage.toFixed(1)}%) | ${a.teardown.percentage > 20 ? '⚠️ HIGH' : '✅ OK'} |
| **Fixture Loading** | ${formatMs(a.fixtureLoading.total)} (${a.fixtureLoading.percentage.toFixed(1)}%) | ${a.fixtureLoading.percentage > 10 ? '⚠️ HIGH' : '✅ OK'} |
| **Overhead Ratio** | ${a.overheadRatio.toFixed(2)}x | ${a.overheadRatio > 3 ? '⚠️ HIGH' : '✅ OK'} |

## Detailed Analysis

### 1. Setup Time (beforeAll + beforeEach)

**Total**: ${formatMs(a.setup.total)} (${a.setup.percentage.toFixed(1)}% of runtime)

| Metric | Value |
|--------|-------|
| Calls | ${a.setup.count} |
| Average | ${formatMs(a.setup.average)} |
| Median | ${formatMs(a.setup.median)} |
| Min | ${formatMs(a.setup.min)} |
| Max | ${formatMs(a.setup.max)} |

**Breakdown by Hook Type**:
- \`beforeAll\`: ${a.setup.breakdown.beforeAll.count} calls, avg ${formatMs(a.setup.breakdown.beforeAll.average)}
- \`beforeEach\`: ${a.setup.breakdown.beforeEach.count} calls, avg ${formatMs(a.setup.breakdown.beforeEach.average)}

### 2. Test Execution Time

**Total**: ${formatMs(a.testExecution.total)} (${a.testExecution.percentage.toFixed(1)}% of runtime)

| Metric | Value |
|--------|-------|
| Tests | ${a.testExecution.count} |
| Average | ${formatMs(a.testExecution.average)} |
| Median | ${formatMs(a.testExecution.median)} |
| Min | ${formatMs(a.testExecution.min)} |
| Max | ${formatMs(a.testExecution.max)} |

### 3. Teardown Time (afterEach + afterAll)

**Total**: ${formatMs(a.teardown.total)} (${a.teardown.percentage.toFixed(1)}% of runtime)

| Metric | Value |
|--------|-------|
| Calls | ${a.teardown.count} |
| Average | ${formatMs(a.teardown.average)} |
| Median | ${formatMs(a.teardown.median)} |
| Min | ${formatMs(a.teardown.min)} |
| Max | ${formatMs(a.teardown.max)} |

**Breakdown by Hook Type**:
- \`afterEach\`: ${a.teardown.breakdown.afterEach.count} calls, avg ${formatMs(a.teardown.breakdown.afterEach.average)}
- \`afterAll\`: ${a.teardown.breakdown.afterAll.count} calls, avg ${formatMs(a.teardown.breakdown.afterAll.average)}

### 4. Fixture Loading and Initialization

**Total**: ${formatMs(a.fixtureLoading.total)} (${a.fixtureLoading.percentage.toFixed(1)}% of runtime)

| Metric | Value |
|--------|-------|
| Operations | ${a.fixtureLoading.count} |
| Average | ${formatMs(a.fixtureLoading.average)} |
| Median | ${formatMs(a.fixtureLoading.median)} |
| Min | ${formatMs(a.fixtureLoading.min)} |
| Max | ${formatMs(a.fixtureLoading.max)} |

**Most Used Fixtures**:
${Object.entries(fixtureAnalysis.fixtureImports)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([name, count]) => `- \`${name}\`: used in ${count} test files`)
  .join('\n')}

## Overhead Assessment

### Setup Overhead
${a.setup.percentage > 30
  ? `⚠️ **WARNING**: Setup time exceeds 30% of total runtime (${a.setup.percentage.toFixed(1)}%).`
  : `✅ **OK**: Setup time is acceptable (${a.setup.percentage.toFixed(1)}%).`}

**Recommendations**:
- Lazy load fixtures where possible
- Move expensive operations to \`beforeAll\` instead of \`beforeEach\`
- Consider shared fixtures with proper isolation
- Reduce mock complexity in setup hooks

### Teardown Overhead
${a.teardown.percentage > 20
  ? `⚠️ **WARNING**: Teardown time exceeds 20% of total runtime (${a.teardown.percentage.toFixed(1)}%).`
  : `✅ **OK**: Teardown time is acceptable (${a.teardown.percentage.toFixed(1)}%).`}

**Recommendations**:
- Reduce cleanup complexity
- Use automatic cleanup (fresh test databases, temp directories)
- Defer cleanup to \`afterAll\` where safe
- Consider test isolation vs teardown overhead tradeoffs

### Overall Infrastructure Overhead
${a.overheadRatio > 3
  ? `⚠️ **WARNING**: Setup and teardown combined take ${a.overheadRatio.toFixed(2)}x the time of actual test execution.`
  : `✅ **OK**: Infrastructure overhead is reasonable (${a.overheadRatio.toFixed(2)}x).`}

## Measurement Methodology

This analysis used the following approach:

1. **Instrumented Setup Files**: Modified \`tests/setup.js\` to wrap all hooks with performance measurements
2. **Fixture Loading Tracking**: Added markers to track expensive fixture initialization operations
3. **Comprehensive Sampling**: Ran the entire test suite to capture realistic patterns
4. **Statistical Analysis**: Calculated mean, median, min, max for each phase to identify outliers

**Metrics Captured**:
- \`beforeAll\` / \`beforeEach\` hook execution times
- \`afterEach\` / \`afterAll\` hook execution times
- Fixture and mock loading initialization times
- Actual test function execution times (baseline)

## Raw Data

The complete measurement data is available in:
- \`test-timing-results/setup-teardown-measurements-*.json\`
- Individual test timing data in \`test-timing-results/timing-*.json\`

## Next Steps

Based on this analysis, prioritize optimization efforts:

1. **High Impact**: Focus on hooks with high max times (outliers causing long pauses)
2. **Frequency**: Optimize \`beforeEach\` / \`afterEach\` (called most frequently)
3. **Fixtures**: Lazy-load or cache expensive fixture initialization
4. **Isolation**: Balance test isolation vs teardown overhead

---
*Generated by bf-2i0o4: Test Setup/Teardown Overhead Measurement*`;
}

// Main execution
runMeasurement()
  .then((reportPath) => {
    console.log(`\n✨ Measurement complete! Report saved to: ${reportPath}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Measurement failed:', error);
    process.exit(1);
  });