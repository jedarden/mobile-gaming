#!/usr/bin/env node

/**
 * Quick test profiling - single pass for baseline data
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = '.beads/traces/bf-6b3eu';

// Ensure results directory exists
mkdirSync(RESULTS_DIR, { recursive: true });

/**
 * Run a test file and get timing
 */
async function runTest(testFile, type) {
  const start = Date.now();
  const testName = testFile.split('/').pop();

  let command, args;
  if (type === 'e2e') {
    command = 'npx';
    args = ['playwright', 'test', testFile, '--reporter=json'];
  } else {
    command = 'npx';
    args = ['vitest', 'run', testFile, '--reporter=json'];
  }

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - start;
      resolve({
        file: testName,
        path: testFile,
        duration,
        code,
        stdout,
        stderr
      });
    });

    proc.on('error', (err) => {
      const duration = Date.now() - start;
      resolve({
        file: testName,
        path: testFile,
        duration,
        code: -1,
        error: err.message
      });
    });
  });
}

/**
 * Get test files
 */
async function getTestFiles(pattern) {
  const { exec } = await import('child_process');
  return new Promise((resolve) => {
    exec(pattern, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      const files = stdout.trim().split('\n').filter(Boolean);
      resolve(files);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 QUICK TEST PROFILING\n');

  const results = {
    timestamp: new Date().toISOString(),
    unitTests: [],
    e2eTests: [],
    summary: {}
  };

  // Get test files
  console.log('📝 Finding test files...');
  const unitFiles = await getTestFiles('find tests/unit tests/shared -name "*.test.js" -type f');
  const e2eFiles = await getTestFiles('ls tests/e2e/*.spec.js');

  console.log(`Found ${unitFiles.length} unit test files`);
  console.log(`Found ${e2eFiles.length} E2E test files\n`);

  // Profile unit tests
  console.log('⏱️  Profiling unit tests...');
  let unitIdx = 0;
  for (const testFile of unitFiles) {
    unitIdx++;
    process.stdout.write(`  [${unitIdx}/${unitFiles.length}] ${testFile.split('/').pop()}...`);
    const result = await runTest(testFile, 'unit');
    process.stdout.write(` ${(result.duration/1000).toFixed(1)}s\n`);
    results.unitTests.push(result);
  }

  // Profile E2E tests
  console.log('\n⏱️  Profiling E2E tests...');
  let e2eIdx = 0;
  for (const testFile of e2eFiles) {
    e2eIdx++;
    process.stdout.write(`  [${e2eIdx}/${e2eFiles.length}] ${testFile.split('/').pop()}...`);
    const result = await runTest(testFile, 'e2e');
    process.stdout.write(` ${(result.duration/1000).toFixed(1)}s\n`);
    results.e2eTests.push(result);
  }

  // Calculate summary
  const slowUnitTests = results.unitTests
    .filter(t => t.duration > 5000)
    .sort((a, b) => b.duration - a.duration);

  const slowE2ETests = results.e2eTests
    .filter(t => t.duration > 5000)
    .sort((a, b) => b.duration - a.duration);

  const totalUnitTime = results.unitTests.reduce((sum, t) => sum + t.duration, 0);
  const totalE2eTime = results.e2eTests.reduce((sum, t) => sum + t.duration, 0);

  results.summary = {
    totalUnitTests: results.unitTests.length,
    totalE2ETests: results.e2eTests.length,
    totalUnitTime,
    totalE2eTime,
    totalTestTime: totalUnitTime + totalE2eTime,
    slowUnitTestsCount: slowUnitTests.length,
    slowE2ETestsCount: slowE2ETests.length,
    slowUnitTests: slowUnitTests.map(t => ({
      file: t.file,
      path: t.path,
      durationSeconds: (t.duration / 1000).toFixed(2)
    })),
    slowE2ETests: slowE2ETests.map(t => ({
      file: t.file,
      path: t.path,
      durationSeconds: (t.duration / 1000).toFixed(2)
    }))
  };

  // Save results
  const resultsPath = join(RESULTS_DIR, 'quick-profile.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TIMING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Unit Tests: ${results.summary.totalUnitTests} files, ${(totalUnitTime/1000).toFixed(2)}s total`);
  console.log(`E2E Tests: ${results.summary.totalE2ETests} files, ${(totalE2eTime/1000).toFixed(2)}s total`);
  console.log(`Total: ${(results.summary.totalTestTime/1000).toFixed(2)}s`);

  console.log(`\n⚠️  Slow Unit Tests (>5s): ${results.summary.slowUnitTestsCount}`);
  if (slowUnitTests.length > 0) {
    console.log('  File                                     Time    Path');
    console.log('  ' + '-'.repeat(80));
    slowUnitTests.forEach(t => {
      const time = t.durationSeconds.padEnd(8);
      const file = t.file.padEnd(40);
      console.log(`  ${file} ${time}s ${t.path}`);
    });
  }

  console.log(`\n⚠️  Slow E2E Tests (>5s): ${results.summary.slowE2ETestsCount}`);
  if (slowE2ETests.length > 0) {
    console.log('  File                                     Time    Path');
    console.log('  ' + '-'.repeat(80));
    slowE2ETests.forEach(t => {
      const time = t.durationSeconds.padEnd(8);
      const file = t.file.padEnd(40);
      console.log(`  ${file} ${time}s ${t.path}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
