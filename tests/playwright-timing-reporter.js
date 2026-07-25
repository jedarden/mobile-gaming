/**
 * Custom Playwright reporter that captures detailed timing data for all E2E tests.
 * Compatible with Playwright 1.x+
 */

import fs from 'fs';
import path from 'path';

class PlaywrightTimingReporter {
  constructor() {
    this.timingData = {
      startTime: null,
      endTime: null,
      suiteName: 'mobile-gaming-e2e',
      tests: [],
      files: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalDuration: 0,
        slowestTests: [],
        slowestFiles: []
      }
    };
  }

  onBegin(globalInfo) {
    this.timingData.startTime = new Date().toISOString();
  }

  onTestEnd(test, result) {
    const testInfo = {
      name: test.title,
      file: test.location.file,
      line: test.location.line,
      result: result.status,
      duration: result.duration,
      startTime: new Date(result.startTime).toISOString(),
      endTime: new Date(result.startTime + result.duration).toISOString(),
      retries: result.retry,
      project: test.projectName || 'default'
    };

    this.timingData.tests.push(testInfo);

    // Group by file
    const file = test.location.file;
    if (!this.timingData.files[file]) {
      this.timingData.files[file] = {
        file: file,
        tests: [],
        testCount: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        duration: 0
      };
    }

    this.timingData.files[file].tests.push(testInfo);
    this.timingData.files[file].testCount++;
    this.timingData.files[file].duration += result.duration;

    if (result.status === 'passed') {
      this.timingData.files[file].passedCount++;
    } else if (result.status === 'failed') {
      this.timingData.files[file].failedCount++;
    } else if (result.status === 'skipped') {
      this.timingData.files[file].skippedCount++;
    }
  }

  onEnd() {
    this.timingData.endTime = new Date().toISOString();

    // Calculate summary statistics
    const allTests = this.timingData.tests;
    this.timingData.summary.totalTests = allTests.length;
    this.timingData.summary.passedTests = allTests.filter(t => t.result === 'passed').length;
    this.timingData.summary.failedTests = allTests.filter(t => t.result === 'failed').length;
    this.timingData.summary.skippedTests = allTests.filter(t => t.result === 'skipped' || t.result === 'interrupted').length;

    // Calculate total duration
    if (this.timingData.startTime && this.timingData.endTime) {
      this.timingData.summary.totalDuration =
        new Date(this.timingData.endTime).getTime() - new Date(this.timingData.startTime).getTime();
    }

    // Find slowest tests (top 10)
    this.timingData.summary.slowestTests = [...allTests]
      .filter(t => t.result !== 'skipped' && t.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Find slowest files (top 10)
    this.timingData.summary.slowestFiles = Object.values(this.timingData.files)
      .filter(f => !isNaN(f.duration) && f.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    this.writeTimingData();
  }

  writeTimingData() {
    // Output timing data
    const timingDir = path.join(process.cwd(), 'test-timing-results');
    if (!fs.existsSync(timingDir)) {
      fs.mkdirSync(timingDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const timingFile = path.join(timingDir, `e2e-timing-${timestamp}.json`);

    fs.writeFileSync(timingFile, JSON.stringify(this.timingData, null, 2));

    console.error(`\n✓ E2E timing data written to: ${timingFile}`);
    this.printSummary();
  }

  printSummary() {
    console.error('\n=== E2E Test Timing Summary ===');
    console.error(`Total Tests: ${this.timingData.summary.totalTests}`);
    console.error(`Passed: ${this.timingData.summary.passedTests}, Failed: ${this.timingData.summary.failedTests}, Skipped: ${this.timingData.summary.skippedTests}`);
    console.error(`Total Duration: ${(this.timingData.summary.totalDuration / 1000).toFixed(2)}s`);

    if (this.timingData.summary.slowestTests.length > 0) {
      console.error('\nTop 10 Slowest E2E Tests:');
      this.timingData.summary.slowestTests.forEach((test, i) => {
        console.error(`  ${i + 1}. ${test.name} - ${(test.duration / 1000).toFixed(3)}s (${path.basename(test.file)})`);
      });
    }

    if (this.timingData.summary.slowestFiles.length > 0) {
      console.error('\nTop 10 Slowest E2E Files:');
      this.timingData.summary.slowestFiles.forEach((file, i) => {
        console.error(`  ${i + 1}. ${path.basename(file.file)} - ${(file.duration / 1000).toFixed(2)}s (${file.testCount} tests)`);
      });
    }
  }
}

export default PlaywrightTimingReporter;
