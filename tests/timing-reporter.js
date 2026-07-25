/**
 * Custom Vitest reporter that captures detailed timing data for all tests.
 * Compatible with Vitest 3.x
 */

import fs from 'fs';
import path from 'path';

class TimingReporter {
  constructor() {
    this.timingData = {
      startTime: null,
      endTime: null,
      suiteName: 'mobile-gaming',
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

  onInit(ctx) {
    this.ctx = ctx;
    this.timingData.startTime = new Date().toISOString();
  }

  onTestRunEnd() {
    this.timingData.endTime = new Date().toISOString();

    // Get state from context
    const state = this.ctx?.state || this.ctx?._state;
    if (!state) {
      console.error('Warning: No test state available');
      this.writeTimingData();
      return;
    }

    // Debug: log available state properties
    console.error('Available state properties:', Object.keys(state).join(', '));

    // Try different methods to get files
    let filesData = [];

    // Method 1: filesMap (Vitest 3.x)
    if (state.filesMap) {
      console.error('Using state.filesMap');

      // Iterate through the map and extract file objects
      for (const [key, value] of state.filesMap.entries()) {
        // The value might be an array containing the file object
        if (Array.isArray(value) && value.length > 0) {
          filesData.push(...value);
        } else if (value && typeof value === 'object' && value.name) {
          // Value is directly a file object
          filesData.push(value);
        } else {
          // Key might be the file object
          if (key && typeof key === 'object' && key.name) {
            filesData.push(key);
          }
        }
      }
    }
    // Method 2: getFiles method
    else if (typeof state.getFiles === 'function') {
      const result = state.getFiles();
      if (Array.isArray(result)) {
        filesData = result;
        console.error('Using state.getFiles() array');
      } else {
        for (const [key, value] of result.entries()) {
          if (Array.isArray(value) && value.length > 0) {
            filesData.push(...value);
          } else if (value && typeof value === 'object' && value.name) {
            filesData.push(value);
          }
        }
        console.error('Using state.getFiles() map');
      }
    }
    // Method 3: Direct files array
    else if (state.files && Array.isArray(state.files)) {
      filesData = state.files;
      console.error('Using state.files array');
    }

    if (filesData.length === 0) {
      console.error('Warning: No files data available in state');
      this.writeTimingData();
      return;
    }

    console.error(`Processing ${filesData.length} test files`);

    // Debug: check the first file entry
    const firstFile = filesData[0];
    if (firstFile) {
      console.error(`Sample file - name: ${firstFile.name}, type: ${firstFile.type}`);
      console.error(`Sample file has tasks: ${firstFile.tasks ? firstFile.tasks.length : 'no'}`);
    }

    // Process each file
    filesData.forEach((testFile) => {
      const fileId = testFile.filepath || testFile.name || 'unknown';
      const tests = [];

      // Process tasks to extract individual test results
      if (testFile.tasks && testFile.tasks.length > 0) {
        testFile.tasks.forEach(task => {
          this.processTask(task, tests, fileId);
        });
      }

      const fileData = {
        file: fileId,
        tests: tests,
        testCount: tests.length,
        passedCount: tests.filter(t => t.result === 'passed').length,
        failedCount: tests.filter(t => t.result === 'failed').length,
        skippedCount: tests.filter(t => t.result === 'skipped' || t.result === 'todo').length,
        duration: testFile.result?.duration || 0
      };

      this.timingData.files[fileId] = fileData;
      this.timingData.tests.push(...tests);
    });

    console.error(`Extracted ${this.timingData.tests.length} test results`);
    this.writeTimingData();
  }

  processTask(task, tests, file) {
    if (task.type === 'test' && task.result) {
      const timingInfo = {
        name: task.name,
        file: file,
        result: task.result.state || 'unknown',
        duration: task.result.duration || 0,
        startTime: task.result.startTime,
        endTime: task.result.endTime
      };
      tests.push(timingInfo);
    } else if (task.type === 'suite' && task.tasks) {
      // Recursively process nested suites
      task.tasks.forEach(subtask => {
        this.processTask(subtask, tests, file);
      });
    }
  }

  writeTimingData() {
    // Calculate summary statistics
    const allTests = this.timingData.tests;
    this.timingData.summary.totalTests = allTests.length;
    this.timingData.summary.passedTests = allTests.filter(t => t.result === 'passed').length;
    this.timingData.summary.failedTests = allTests.filter(t => t.result === 'failed').length;
    this.timingData.summary.skippedTests = allTests.filter(t => t.result === 'skipped' || t.result === 'todo').length;

    // Calculate total duration
    if (this.timingData.startTime && this.timingData.endTime) {
      this.timingData.summary.totalDuration =
        new Date(this.timingData.endTime).getTime() - new Date(this.timingData.startTime).getTime();
    }

    // Find slowest tests (top 10)
    this.timingData.summary.slowestTests = [...allTests]
      .filter(t => t.result !== 'skipped' && t.result !== 'todo' && t.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Find slowest files (top 10)
    this.timingData.summary.slowestFiles = Object.values(this.timingData.files)
      .filter(f => !isNaN(f.duration) && f.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Output timing data
    const timingDir = path.join(process.cwd(), 'test-timing-results');
    if (!fs.existsSync(timingDir)) {
      fs.mkdirSync(timingDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const timingFile = path.join(timingDir, `timing-${timestamp}.json`);

    fs.writeFileSync(timingFile, JSON.stringify(this.timingData, null, 2));

    console.error(`\n✓ Timing data written to: ${timingFile}`);
    this.printSummary();
  }

  printSummary() {
    console.error('\n=== Test Timing Summary ===');
    console.error(`Total Tests: ${this.timingData.summary.totalTests}`);
    console.error(`Passed: ${this.timingData.summary.passedTests}, Failed: ${this.timingData.summary.failedTests}, Skipped: ${this.timingData.summary.skippedTests}`);
    console.error(`Total Duration: ${(this.timingData.summary.totalDuration / 1000).toFixed(2)}s`);

    if (this.timingData.summary.slowestTests.length > 0) {
      console.error('\nTop 10 Slowest Tests:');
      this.timingData.summary.slowestTests.forEach((test, i) => {
        console.error(`  ${i + 1}. ${test.name} - ${(test.duration / 1000).toFixed(3)}s (${path.basename(test.file)})`);
      });
    }

    if (this.timingData.summary.slowestFiles.length > 0) {
      console.error('\nTop 10 Slowest Files:');
      this.timingData.summary.slowestFiles.forEach((file, i) => {
        console.error(`  ${i + 1}. ${path.basename(file.file)} - ${(file.duration / 1000).toFixed(2)}s (${file.testCount} tests)`);
      });
    }
  }
}

export default TimingReporter;
