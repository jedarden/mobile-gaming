/**
 * Setup/Teardown Profiler
 *
 * Instruments Vitest tests to measure time spent in setup/teardown hooks
 * versus actual test execution time.
 */

import fs from 'fs';
import path from 'path';

class SetupTeardownProfiler {
  constructor() {
    this.timingData = {
      startTime: null,
      endTime: null,
      suites: [],
      summary: {
        totalSuites: 0,
        totalTests: 0,
        totalSetupTime: 0,
        totalTeardownTime: 0,
        totalTestExecutionTime: 0,
        totalDuration: 0,
        setupPercentage: 0,
        teardownPercentage: 0,
        testExecutionPercentage: 0,
        slowestSetups: [],
        slowestTeardowns: [],
        slowestTests: []
      }
    };
  }

  onInit(ctx) {
    this.ctx = ctx;
    this.timingData.startTime = new Date().toISOString();

    // Patch Vitest's hook execution to capture timing
    this.patchHooks();
  }

  patchHooks() {
    // This will be implemented by wrapping the test execution
    // For now, we'll collect data from the test run results
  }

  onTestRunEnd() {
    this.timingData.endTime = new Date().toISOString();
    this.collectTimingData();
    this.writeTimingData();
  }

  collectTimingData() {
    const state = this.ctx?.state || this.ctx?._state;
    if (!state) {
      console.error('Warning: No test state available');
      return;
    }

    // Get files data
    let filesData = [];

    if (state.filesMap) {
      for (const [key, value] of state.filesMap.entries()) {
        if (Array.isArray(value) && value.length > 0) {
          filesData.push(...value);
        } else if (value && typeof value === 'object' && value.name) {
          filesData.push(value);
        } else if (key && typeof key === 'object' && key.name) {
          filesData.push(key);
        }
      }
    } else if (typeof state.getFiles === 'function') {
      const result = state.getFiles();
      if (Array.isArray(result)) {
        filesData = result;
      } else {
        for (const [key, value] of result.entries()) {
          if (Array.isArray(value) && value.length > 0) {
            filesData.push(...value);
          } else if (value && typeof value === 'object' && value.name) {
            filesData.push(value);
          }
        }
      }
    } else if (state.files && Array.isArray(state.files)) {
      filesData = state.files;
    }

    // Process each file
    filesData.forEach((testFile) => {
      this.processFile(testFile);
    });

    this.calculateSummary();
  }

  processFile(testFile) {
    const fileId = testFile.filepath || testFile.name || 'unknown';
    const suiteData = {
      file: fileId,
      hooks: {
        beforeAll: [],
        beforeEach: [],
        afterEach: [],
        afterAll: []
      },
      tests: [],
      timing: {
        setupTime: 0,
        teardownTime: 0,
        testExecutionTime: 0,
        totalTime: 0
      }
    };

    // Process tasks to extract hooks and tests
    if (testFile.tasks && testFile.tasks.length > 0) {
      testFile.tasks.forEach(task => {
        this.processTask(task, suiteData);
      });
    }

    suiteData.timing.totalTime = testFile.result?.duration || 0;
    this.timingData.suites.push(suiteData);
  }

  processTask(task, suiteData) {
    if (task.type === 'test' && task.result) {
      const testInfo = {
        name: task.name,
        duration: task.result.duration || 0,
        result: task.result.state || 'unknown'
      };
      suiteData.tests.push(testInfo);
      suiteData.timing.testExecutionTime += testInfo.duration;
    } else if (task.type === 'beforeAll' && task.result) {
      suiteData.hooks.beforeAll.push({
        name: task.name,
        duration: task.result.duration || 0
      });
      suiteData.timing.setupTime += task.result.duration || 0;
    } else if (task.type === 'beforeEach' && task.result) {
      suiteData.hooks.beforeEach.push({
        name: task.name,
        duration: task.result.duration || 0
      });
      suiteData.timing.setupTime += task.result.duration || 0;
    } else if (task.type === 'afterEach' && task.result) {
      suiteData.hooks.afterEach.push({
        name: task.name,
        duration: task.result.duration || 0
      });
      suiteData.timing.teardownTime += task.result.duration || 0;
    } else if (task.type === 'afterAll' && task.result) {
      suiteData.hooks.afterAll.push({
        name: task.name,
        duration: task.result.duration || 0
      });
      suiteData.timing.teardownTime += task.result.duration || 0;
    } else if (task.type === 'suite' && task.tasks) {
      // Recursively process nested suites
      task.tasks.forEach(subtask => {
        this.processTask(subtask, suiteData);
      });
    }
  }

  calculateSummary() {
    const summary = this.timingData.summary;

    summary.totalSuites = this.timingData.suites.length;

    this.timingData.suites.forEach(suite => {
      summary.totalTests += suite.tests.length;
      summary.totalSetupTime += suite.timing.setupTime;
      summary.totalTeardownTime += suite.timing.teardownTime;
      summary.totalTestExecutionTime += suite.timing.testExecutionTime;
    });

    summary.totalDuration = summary.totalSetupTime + summary.totalTeardownTime + summary.totalTestExecutionTime;

    if (summary.totalDuration > 0) {
      summary.setupPercentage = (summary.totalSetupTime / summary.totalDuration * 100).toFixed(2);
      summary.teardownPercentage = (summary.totalTeardownTime / summary.totalDuration * 100).toFixed(2);
      summary.testExecutionPercentage = (summary.totalTestExecutionTime / summary.totalDuration * 100).toFixed(2);
    }

    // Find slowest setups, teardowns, and tests
    const allSetups = [];
    const allTeardowns = [];
    const allTests = [];

    this.timingData.suites.forEach(suite => {
      suite.hooks.beforeAll.forEach(h => allSetups.push({ ...h, file: suite.file, type: 'beforeAll' }));
      suite.hooks.beforeEach.forEach(h => allSetups.push({ ...h, file: suite.file, type: 'beforeEach' }));
      suite.hooks.afterEach.forEach(h => allTeardowns.push({ ...h, file: suite.file, type: 'afterEach' }));
      suite.hooks.afterAll.forEach(h => allTeardowns.push({ ...h, file: suite.file, type: 'afterAll' }));
      suite.tests.forEach(t => allTests.push({ ...t, file: suite.file }));
    });

    summary.slowestSetups = allSetups
      .filter(h => h.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    summary.slowestTeardowns = allTeardowns
      .filter(h => h.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    summary.slowestTests = allTests
      .filter(t => t.duration > 0)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  writeTimingData() {
    const timingDir = path.join(process.cwd(), 'test-timing-results');
    if (!fs.existsSync(timingDir)) {
      fs.mkdirSync(timingDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const timingFile = path.join(timingDir, `setup-teardown-profile-${timestamp}.json`);

    fs.writeFileSync(timingFile, JSON.stringify(this.timingData, null, 2));

    console.error(`\n✓ Setup/Teardown profiling data written to: ${timingFile}`);
    this.printSummary();
  }

  printSummary() {
    const s = this.timingData.summary;
    console.error('\n=== Setup/Teardown Profiling Summary ===');
    console.error(`Total Suites: ${s.totalSuites}`);
    console.error(`Total Tests: ${s.totalTests}`);
    console.error(`\nTiming Breakdown:`);
    console.error(`  Setup Time:       ${(s.totalSetupTime / 1000).toFixed(3)}s (${s.setupPercentage}%)`);
    console.error(`  Test Execution:  ${(s.totalTestExecutionTime / 1000).toFixed(3)}s (${s.testExecutionPercentage}%)`);
    console.error(`  Teardown Time:   ${(s.totalTeardownTime / 1000).toFixed(3)}s (${s.teardownPercentage}%)`);
    console.error(`  Total Duration:  ${(s.totalDuration / 1000).toFixed(3)}s`);

    if (s.slowestSetups.length > 0) {
      console.error('\nTop 10 Slowest Setup Hooks:');
      s.slowestSetups.forEach((hook, i) => {
        console.error(`  ${i + 1}. ${hook.type} in ${path.basename(hook.file)} - ${(hook.duration / 1000).toFixed(3)}s`);
      });
    }

    if (s.slowestTeardowns.length > 0) {
      console.error('\nTop 10 Slowest Teardown Hooks:');
      s.slowestTeardowns.forEach((hook, i) => {
        console.error(`  ${i + 1}. ${hook.type} in ${path.basename(hook.file)} - ${(hook.duration / 1000).toFixed(3)}s`);
      });
    }

    if (s.slowestTests.length > 0) {
      console.error('\nTop 10 Slowest Tests (for comparison):');
      s.slowestTests.forEach((test, i) => {
        console.error(`  ${i + 1}. ${test.name} - ${(test.duration / 1000).toFixed(3)}s (${path.basename(test.file)})`);
      });
    }
  }
}

export default SetupTeardownProfiler;
