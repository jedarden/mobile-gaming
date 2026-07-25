#!/usr/bin/env node
/**
 * Aggregate timing data from multiple test runs into summary statistics.
 * Usage: node scripts/aggregate-timing-data.js [options]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMING_DIR = path.join(__dirname, '..', 'test-timing-results');

// Parse command line options
const args = process.argv.slice(2);
let runCount = 10; // Default to analyzing last 10 runs
let outputFormat = 'console'; // 'console', 'json', 'markdown'
let specificRun = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--runs' && args[i + 1]) {
    runCount = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--format' && args[i + 1]) {
    outputFormat = args[i + 1];
    i++;
  } else if (args[i] === '--run' && args[i + 1]) {
    specificRun = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: node scripts/aggregate-timing-data.js [options]

Options:
  --runs <n>        Analyze last n runs (default: 10)
  --format <fmt>   Output format: console, json, markdown (default: console)
  --run <pattern>  Analyze specific run by filename pattern
  --help, -h       Show this help message

Examples:
  node scripts/aggregate-timing-data.js --runs 5 --format markdown
  node scripts/aggregate-timing-data.js --run timing-2026-07-24T12-00-00.json
  node scripts/aggregate-timing-data.js --format json > timing-summary.json
`);
    process.exit(0);
  }
}

// Read timing files from directory
function getTimingFiles() {
  if (!fs.existsSync(TIMING_DIR)) {
    console.error(`Timing directory not found: ${TIMING_DIR}`);
    console.error('Run tests first to generate timing data.');
    process.exit(1);
  }

  let files = fs.readdirSync(TIMING_DIR)
    .filter(f => f.startsWith('timing-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(TIMING_DIR, f),
      time: fs.statSync(path.join(TIMING_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time); // Sort by modification time, newest first

  if (specificRun) {
    files = files.filter(f => f.name.includes(specificRun));
  } else {
    files = files.slice(0, runCount);
  }

  return files;
}

// Load and parse timing data
function loadTimingData(files) {
  const runs = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      const data = JSON.parse(content);
      runs.push({
        file: file.name,
        timestamp: data.startTime,
        ...data
      });
    } catch (error) {
      console.error(`Error reading ${file.name}: ${error.message}`);
    }
  }

  return runs;
}

// Calculate statistical measures
function calculateStatistics(values) {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Mean
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  // Median
  let median;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  // Standard deviation
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev };
}

// Aggregate statistics across runs
function aggregateStats(runs) {
  const stats = {
    runCount: runs.length,
    runs: [],
    overall: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      durations: [] // Track all durations for proper statistics
    },
    byTest: {},
    byFile: {},
    outliers: []
  };

  for (const run of runs) {
    const summary = run.summary;
    const duration = summary.totalDuration;

    // Track overall statistics
    stats.overall.totalTests += summary.totalTests;
    stats.overall.passedTests += summary.passedTests;
    stats.overall.failedTests += summary.failedTests;
    stats.overall.skippedTests += summary.skippedTests;
    stats.overall.totalDuration += duration;
    stats.overall.durations.push(duration);

    // Track per-test statistics
    for (const test of run.tests) {
      const key = `${test.file}::${test.name}`;
      if (!stats.byTest[key]) {
        stats.byTest[key] = {
          name: test.name,
          file: test.file,
          runs: 0,
          totalTime: 0,
          durations: [], // Track all durations for proper statistics
          failures: 0,
          skipped: 0
        };
      }

      const t = stats.byTest[key];
      t.runs++;
      t.totalTime += test.duration;
      t.durations.push(test.duration);

      if (test.result === 'failed') t.failures++;
      if (test.result === 'skipped') t.skipped++;
    }

    // Track per-file statistics
    if (run.files) {
      // files is an object with file paths as keys
      for (const filePath in run.files) {
        const file = run.files[filePath];
        if (!stats.byFile[file.file]) {
          stats.byFile[file.file] = {
            file: file.file,
            runs: 0,
            totalTime: 0,
            durations: [], // Track all durations for proper statistics
            testCount: 0
          };
        }

        const f = stats.byFile[file.file];
        f.runs++;
        f.totalTime += file.duration;
        f.durations.push(file.duration);
        f.testCount = Math.max(f.testCount, file.testCount);
      }
    }

    // Track run summary
    stats.runs.push({
      timestamp: run.startTime,
      duration: duration,
      passed: summary.passedTests,
      failed: summary.failedTests,
      skipped: summary.skippedTests
    });
  }

  // Calculate overall statistics
  stats.overall.stats = calculateStatistics(stats.overall.durations);
  stats.overall.avgDuration = stats.overall.stats.mean;
  stats.overall.minDuration = stats.overall.stats.min;
  stats.overall.maxDuration = stats.overall.stats.max;
  stats.overall.medianDuration = stats.overall.stats.median;
  stats.overall.stdDev = stats.overall.stats.stdDev;

  // Calculate per-test statistics and find outliers
  for (const key in stats.byTest) {
    const test = stats.byTest[key];
    test.stats = calculateStatistics(test.durations);
    test.avgTime = test.stats.mean;
    test.minTime = test.stats.min;
    test.maxTime = test.stats.max;
    test.medianTime = test.stats.median;
    test.stdDev = test.stats.stdDev;

    // Flag outliers: tests with >50% variation or consistently slow
    const cv = test.stats.mean > 0 ? test.stats.stdDev / test.stats.mean : 0; // Coefficient of variation
    if (cv > 0.5 || test.stats.mean > 5000) {
      stats.outliers.push({
        ...test,
        reason: cv > 0.5 ? 'high_variance' : 'consistently_slow'
      });
    }
  }

  // Calculate per-file statistics
  for (const key in stats.byFile) {
    const file = stats.byFile[key];
    file.stats = calculateStatistics(file.durations);
    file.avgTime = file.stats.mean;
    file.minTime = file.stats.min;
    file.maxTime = file.stats.max;
    file.medianTime = file.stats.median;
    file.stdDev = file.stats.stdDev;
  }

  return stats;
}

// Output results
function outputStats(stats, format) {
  if (format === 'json') {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  if (format === 'markdown') {
    outputMarkdown(stats);
    return;
  }

  // Console output (default)
  console.log('\n=== Aggregated Test Timing Statistics ===');
  console.log(`Analyzing ${stats.runCount} runs from ${stats.runs[0].timestamp} to ${stats.runs[stats.runs.length - 1].timestamp}`);

  console.log('\n--- Overall Statistics ---');
  console.log(`Mean Duration: ${(stats.overall.stats.mean / 1000).toFixed(2)}s`);
  console.log(`Median Duration: ${(stats.overall.stats.median / 1000).toFixed(2)}s`);
  console.log(`Min Duration: ${(stats.overall.stats.min / 1000).toFixed(2)}s`);
  console.log(`Max Duration: ${(stats.overall.stats.max / 1000).toFixed(2)}s`);
  console.log(`Std Deviation: ±${(stats.overall.stats.stdDev / 1000).toFixed(2)}s`);
  console.log(`Average Tests per Run: ${Math.round(stats.overall.totalTests / stats.runCount)}`);
  console.log(`Average Pass Rate: ${((stats.overall.passedTests / stats.overall.totalTests) * 100).toFixed(1)}%`);

  console.log('\n--- Top 20 Slowest Tests (by average time) ---');
  const slowestTests = Object.values(stats.byTest)
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 20);

  for (const test of slowestTests) {
    console.log(`  ${(test.avgTime / 1000).toFixed(3)}s | ${test.name} (${path.basename(test.file)})`);
    console.log(`    Range: ${(test.minTime / 1000).toFixed(3)}s - ${(test.maxTime / 1000).toFixed(3)}s | Median: ${(test.medianTime / 1000).toFixed(3)}s | StdDev: ±${(test.stdDev / 1000).toFixed(3)}s | ${test.failures} failures in ${test.runs} runs`);
  }

  console.log('\n--- Top 10 Slowest Test Files (by average time) ---');
  const slowestFiles = Object.values(stats.byFile)
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);

  for (const file of slowestFiles) {
    console.log(`  ${(file.avgTime / 1000).toFixed(2)}s | ${path.basename(file.file)} (${file.testCount} tests)`);
    console.log(`    Range: ${(file.minTime / 1000).toFixed(2)}s - ${(file.maxTime / 1000).toFixed(2)}s | Median: ${(file.medianTime / 1000).toFixed(2)}s | StdDev: ±${(file.stdDev / 1000).toFixed(2)}s`);
  }

  if (stats.outliers.length > 0) {
    console.log('\n--- Test Timing Outliers (high variance or consistently slow) ---');
    stats.outliers.sort((a, b) => b.avgTime - a.avgTime).slice(0, 10).forEach(test => {
      console.log(`  ${test.reason}: ${test.name} (${path.basename(test.file)})`);
      console.log(`    Average: ${(test.avgTime / 1000).toFixed(3)}s | StdDev: ±${(test.stdDev / 1000).toFixed(3)}s`);
    });
  }

  console.log('\n--- Recent Run History ---');
  stats.runs.slice(0, 5).forEach(run => {
    console.log(`  ${run.timestamp} | ${(run.duration / 1000).toFixed(2)}s | ✓${run.passed} ✗${run.failed} −${run.skipped}`);
  });
}

function outputMarkdown(stats) {
  console.log('# Test Timing Analysis Report\n');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Based on ${stats.runCount} runs\n`);

  console.log('## Overall Statistics\n');
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Mean Duration | ${(stats.overall.stats.mean / 1000).toFixed(2)}s |`);
  console.log(`| Median Duration | ${(stats.overall.stats.median / 1000).toFixed(2)}s |`);
  console.log(`| Min Duration | ${(stats.overall.stats.min / 1000).toFixed(2)}s |`);
  console.log(`| Max Duration | ${(stats.overall.stats.max / 1000).toFixed(2)}s |`);
  console.log(`| Std Deviation | ±${(stats.overall.stats.stdDev / 1000).toFixed(2)}s |`);
  console.log(`| Average Tests per Run | ${Math.round(stats.overall.totalTests / stats.runCount)} |`);
  console.log(`| Average Pass Rate | ${((stats.overall.passedTests / stats.overall.totalTests) * 100).toFixed(1)}% |\n`);

  console.log('## Top 20 Slowest Tests\n');
  console.log('| Rank | Test | File | Mean | Median | Min | Max | StdDev | Failures |');
  console.log('|------|------|------|------|--------|-----|-----|--------|----------|');

  const slowestTests = Object.values(stats.byTest)
    .sort((a, b) => b.stats.mean - a.stats.mean)
    .slice(0, 20);

  slowestTests.forEach((test, i) => {
    console.log(`| ${i + 1} | ${test.name} | ${path.basename(test.file)} | ${(test.stats.mean / 1000).toFixed(3)}s | ${(test.stats.median / 1000).toFixed(3)}s | ${(test.stats.min / 1000).toFixed(3)}s | ${(test.stats.max / 1000).toFixed(3)}s | ±${(test.stats.stdDev / 1000).toFixed(3)}s | ${test.failures}/${test.runs} |`);
  });

  console.log('\n## Top 10 Slowest Test Files\n');
  console.log('| Rank | File | Tests | Mean | Median | Min | Max | StdDev |');
  console.log('|------|------|-------|------|--------|-----|-----|--------|');

  const slowestFiles = Object.values(stats.byFile)
    .sort((a, b) => b.stats.mean - a.stats.mean)
    .slice(0, 10);

  slowestFiles.forEach((file, i) => {
    console.log(`| ${i + 1} | ${path.basename(file.file)} | ${file.testCount} | ${(file.stats.mean / 1000).toFixed(2)}s | ${(file.stats.median / 1000).toFixed(2)}s | ${(file.stats.min / 1000).toFixed(2)}s | ${(file.stats.max / 1000).toFixed(2)}s | ±${(file.stats.stdDev / 1000).toFixed(2)}s |`);
  });

  if (stats.outliers.length > 0) {
    console.log('\n## Test Timing Outliers\n');
    console.log('Tests with high variance or consistently slow execution times:\n');
    console.log('| Test | File | Reason | Avg Time | StdDev |');
    console.log('|------|------|--------|----------|--------|');

    stats.outliers.slice(0, 10).forEach(test => {
      console.log(`| ${test.name} | ${path.basename(test.file)} | ${test.reason} | ${(test.stats.mean / 1000).toFixed(3)}s | ±${(test.stats.stdDev / 1000).toFixed(3)}s |`);
    });
  }

  console.log('\n## Recent Run History\n');
  console.log('| Timestamp | Duration | Passed | Failed | Skipped |');
  console.log('|-----------|----------|--------|--------|---------|');

  stats.runs.slice(0, 10).forEach(run => {
    console.log(`| ${run.timestamp} | ${(run.duration / 1000).toFixed(2)}s | ${run.passed} | ${run.failed} | ${run.skipped} |`);
  });
}

// Main execution
const files = getTimingFiles();
console.error(`Found ${files.length} timing files to analyze`);

const runs = loadTimingData(files);
if (runs.length === 0) {
  console.error('No valid timing data found');
  process.exit(1);
}

const stats = aggregateStats(runs);
outputStats(stats, outputFormat);