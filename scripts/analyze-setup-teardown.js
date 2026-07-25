#!/usr/bin/env node

/**
 * Setup/Teardown Analysis Script
 *
 * Analyzes test timing data to measure setup/teardown overhead.
 * This script:
 * 1. Runs the measurement test suite
 * 2. Analyzes existing test timing data
 * 3. Compares setup/teardown vs test execution time
 * 4. Generates a comprehensive report
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_DIR = path.join(process.cwd(), 'test-timing-results');

/**
 * Run the measurement test suite
 */
function runMeasurementTests() {
  console.log('Running setup/teardown measurement tests...');
  try {
    execSync('npm test -- tests/profile/setup-teardown-measurement.test.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.error('Error running measurement tests:', error.message);
    process.exit(1);
  }
}

/**
 * Find the latest measurement file
 */
function findLatestMeasurement() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error('No timing results directory found');
    return null;
  }

  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('setup-teardown-measurements-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('No measurement files found');
    return null;
  }

  return path.join(RESULTS_DIR, files[0]);
}

/**
 * Find all timing files for analysis
 */
function findAllTimingFiles() {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }

  return fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(RESULTS_DIR, f))
    .sort();
}

/**
 * Analyze measurement data
 */
function analyzeMeasurementData(filepath) {
  console.log(`\nAnalyzing: ${filepath}`);

  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const summary = data.summary;

  console.log('\n=== Setup/Teardown Analysis ===');
  console.log(`Total Duration: ${formatMs(summary.total)}`);
  console.log(`\nBreakdown by Category:`);

  console.log(`\nSetup (beforeAll + beforeEach):`);
  console.log(`  Total:     ${formatMs(summary.setup.totalTime)} (${summary.setup.percentage.toFixed(2)}%)`);
  console.log(`  Calls:     ${summary.setup.count}`);
  console.log(`  Average:   ${formatMs(summary.setup.average)}`);
  console.log(`  Min:       ${formatMs(summary.setup.min)}`);
  console.log(`  Max:       ${formatMs(summary.setup.max)}`);
  console.log(`  Median:    ${formatMs(summary.setup.median)}`);

  console.log(`\nTest Execution:`);
  console.log(`  Total:     ${formatMs(summary.testExecution.totalTime)} (${summary.testExecution.percentage.toFixed(2)}%)`);
  console.log(`  Calls:     ${summary.testExecution.count}`);
  console.log(`  Average:   ${formatMs(summary.testExecution.average)}`);
  console.log(`  Min:       ${formatMs(summary.testExecution.min)}`);
  console.log(`  Max:       ${formatMs(summary.testExecution.max)}`);
  console.log(`  Median:    ${formatMs(summary.testExecution.median)}`);

  console.log(`\nTeardown (afterEach + afterAll):`);
  console.log(`  Total:     ${formatMs(summary.teardown.totalTime)} (${summary.teardown.percentage.toFixed(2)}%)`);
  console.log(`  Calls:     ${summary.teardown.count}`);
  console.log(`  Average:   ${formatMs(summary.teardown.average)}`);
  console.log(`  Min:       ${formatMs(summary.teardown.min)}`);
  console.log(`  Max:       ${formatMs(summary.teardown.max)}`);
  console.log(`  Median:    ${formatMs(summary.teardown.median)}`);

  console.log(`\nDetailed Hook Breakdown:`);
  console.log(`  beforeAll:  ${formatMs(summary.details.beforeAll.total)} (${summary.details.beforeAll.count} calls, avg ${formatMs(summary.details.beforeAll.average)})`);
  console.log(`  beforeEach: ${formatMs(summary.details.beforeEach.total)} (${summary.details.beforeEach.count} calls, avg ${formatMs(summary.details.beforeEach.average)})`);
  console.log(`  afterEach:  ${formatMs(summary.details.afterEach.total)} (${summary.details.afterEach.count} calls, avg ${formatMs(summary.details.afterEach.average)})`);
  console.log(`  afterAll:   ${formatMs(summary.details.afterAll.total)} (${summary.details.afterAll.count} calls, avg ${formatMs(summary.details.afterAll.average)})`);

  // Analysis
  console.log('\n=== Analysis ===');
  const overheadRatio = (summary.setup.totalTime + summary.teardown.totalTime) / summary.testExecution.totalTime;
  console.log(`Setup/Teardown to Test Execution Ratio: ${overheadRatio.toFixed(2)}x`);

  if (summary.setup.percentage > 30) {
    console.log('⚠️  WARNING: Setup time is > 30% of total runtime');
    console.log('   Consider: lazy loading, shared fixtures, or reducing setup complexity');
  } else if (summary.setup.percentage > 20) {
    console.log('⚠️  NOTICE: Setup time is > 20% of total runtime');
  } else {
    console.log('✓ Setup time is within acceptable range');
  }

  if (summary.teardown.percentage > 20) {
    console.log('⚠️  WARNING: Teardown time is > 20% of total runtime');
    console.log('   Consider: reducing cleanup complexity or using automatic cleanup');
  } else if (summary.teardown.percentage > 10) {
    console.log('⚠️  NOTICE: Teardown time is > 10% of total runtime');
  } else {
    console.log('✓ Teardown time is within acceptable range');
  }

  return {
    summary,
    overheadRatio,
    filepath
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
 * Generate markdown report
 */
function generateMarkdownReport(analysis) {
  const { summary, overheadRatio } = analysis;

  const md = `# Setup/Teardown Overhead Analysis

Generated: ${new Date().toISOString()}

## Summary

- **Total Duration**: ${formatMs(summary.total)}
- **Setup Time**: ${formatMs(summary.setup.totalTime)} (${summary.setup.percentage.toFixed(2)}%)
- **Test Execution Time**: ${formatMs(summary.testExecution.totalTime)} (${summary.testExecution.percentage.toFixed(2)}%)
- **Teardown Time**: ${formatMs(summary.teardown.totalTime)} (${summary.teardown.percentage.toFixed(2)}%)
- **Overhead Ratio**: ${overheadRatio.toFixed(2)}x (setup+teardown / test execution)

## Detailed Breakdown

### Setup (beforeAll + beforeEach)

| Metric | Value |
|--------|-------|
| Total | ${formatMs(summary.setup.totalTime)} |
| Percentage | ${summary.setup.percentage.toFixed(2)}% |
| Calls | ${summary.setup.count} |
| Average | ${formatMs(summary.setup.average)} |
| Min | ${formatMs(summary.setup.min)} |
| Max | ${formatMs(summary.setup.max)} |
| Median | ${formatMs(summary.setup.median)} |

**Hook Breakdown:**
- beforeAll: ${formatMs(summary.details.beforeAll.total)} (${summary.details.beforeAll.count} calls, avg ${formatMs(summary.details.beforeAll.average)})
- beforeEach: ${formatMs(summary.details.beforeEach.total)} (${summary.details.beforeEach.count} calls, avg ${formatMs(summary.details.beforeEach.average)})

### Test Execution

| Metric | Value |
|--------|-------|
| Total | ${formatMs(summary.testExecution.totalTime)} |
| Percentage | ${summary.testExecution.percentage.toFixed(2)}% |
| Tests | ${summary.testExecution.count} |
| Average | ${formatMs(summary.testExecution.average)} |
| Min | ${formatMs(summary.testExecution.min)} |
| Max | ${formatMs(summary.testExecution.max)} |
| Median | ${formatMs(summary.testExecution.median)} |

### Teardown (afterEach + afterAll)

| Metric | Value |
|--------|-------|
| Total | ${formatMs(summary.teardown.totalTime)} |
| Percentage | ${summary.teardown.percentage.toFixed(2)}% |
| Calls | ${summary.teardown.count} |
| Average | ${formatMs(summary.teardown.average)} |
| Min | ${formatMs(summary.teardown.min)} |
| Max | ${formatMs(summary.teardown.max)} |
| Median | ${formatMs(summary.teardown.median)} |

**Hook Breakdown:**
- afterEach: ${formatMs(summary.details.afterEach.total)} (${summary.details.afterEach.count} calls, avg ${formatMs(summary.details.afterEach.average)})
- afterAll: ${formatMs(summary.details.afterAll.total)} (${summary.details.afterAll.count} calls, avg ${formatMs(summary.details.afterAll.average)})

## Analysis & Recommendations

### Overhead Assessment

${overheadRatio > 1.0
  ? `⚠️ **HIGH OVERHEAD**: Setup and teardown combined take ${overheadRatio.toFixed(2)}x the time of actual test execution.`
  : overheadRatio > 0.5
    ? `⚠️ **MODERATE OVERHEAD**: Setup and teardown combined take ${overheadRatio.toFixed(2)}x the time of actual test execution.`
    : `✓ **LOW OVERHEAD**: Setup and teardown combined take ${overheadRatio.toFixed(2)}x the time of actual test execution.`}

### Setup Analysis

${summary.setup.percentage > 30
  ? `⚠️ **WARNING**: Setup time exceeds 30% of total runtime. Consider:
  - Lazy loading fixtures
  - Using shared fixtures with proper isolation
  - Reducing setup complexity
  - Moving expensive operations to beforeAll where possible`
  : summary.setup.percentage > 20
    ? `⚠️ **NOTICE**: Setup time exceeds 20% of total runtime. Monitor this metric.`
    : `✓ Setup time is within acceptable range.`}

### Teardown Analysis

${summary.teardown.percentage > 20
  ? `⚠️ **WARNING**: Teardown time exceeds 20% of total runtime. Consider:
  - Reducing cleanup complexity
  - Using automatic cleanup (e.g., fresh test databases)
  - Deferring cleanup to afterAll where possible`
  : summary.teardown.percentage > 10
    ? `⚠️ **NOTICE**: Teardown time exceeds 10% of total runtime. Monitor this metric.`
    : `✓ Teardown time is within acceptable range.`}

## Methodology

This analysis measures the time spent in test hooks compared to actual test execution:
- **Setup**: beforeAll + beforeEach hooks
- **Test Execution**: Time spent in test functions (it/test blocks)
- **Teardown**: afterEach + afterAll hooks

The measurement is performed by instrumenting the hooks with performance.now() calls and aggregating the results across all tests in the suite.

`;

  return md;
}

/**
 * Main execution
 */
function main() {
  console.log('=== Setup/Teardown Overhead Analysis ===\n');

  // Check if we should run new measurements
  const args = process.argv.slice(1);
  const shouldRun = args.includes('--run') || args.includes('-r');

  if (shouldRun) {
    runMeasurementTests();
  }

  // Find and analyze latest measurement
  const latestMeasurement = findLatestMeasurement();
  if (!latestMeasurement) {
    console.error('\nNo measurement data found. Run with --run to generate measurements.');
    process.exit(1);
  }

  const analysis = analyzeMeasurementData(latestMeasurement);

  // Generate markdown report
  const markdown = generateMarkdownReport(analysis);
  const reportPath = path.join(RESULTS_DIR, 'setup-teardown-analysis.md');
  fs.writeFileSync(reportPath, markdown);
  console.log(`\n✓ Markdown report written to: ${reportPath}`);

  // Save JSON report
  const jsonPath = path.join(RESULTS_DIR, 'setup-teardown-analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  console.log(`✓ JSON report written to: ${jsonPath}`);
}

main();
