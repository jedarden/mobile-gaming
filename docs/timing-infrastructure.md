# Test Timing Measurement Infrastructure

## Overview
The mobile-gaming project has a comprehensive test timing measurement system that captures detailed execution times for all tests and provides statistical analysis across multiple runs.

## Components

### 1. Custom Vitest Reporter
**File:** `tests/timing-reporter.js`

A custom Vitest reporter that:
- Captures detailed timing data for every test
- Records test results (passed/failed/skipped) with durations
- Tracks per-file and per-test statistics
- Identifies slowest tests and files
- Outputs data to JSON files for aggregation

**Configuration:** `vitest.config.js`
```javascript
reporters: ['verbose', './tests/timing-reporter.js']
```

### 2. Timing Data Storage
**Directory:** `test-timing-results/`

Each test run creates a timestamped JSON file:
- `timing-2026-07-25T02-16-30.json`
- Contains complete test results with durations
- Stores summary statistics
- Tracks file-level and test-level metrics

### 3. Aggregation Script
**File:** `scripts/aggregate-timing-data.js`

Processes multiple timing files to generate:
- **Overall statistics:** Mean, median, min, max, standard deviation
- **Per-test statistics:** Individual test performance across runs
- **Per-file statistics:** Test file performance metrics
- **Outlier detection:** Identifies tests with high variance or consistently slow execution
- **Run history:** Tracks performance over time

**Usage:**
```bash
# Console output (default)
npm run test:timing

# JSON format
npm run test:timing:json

# Markdown report
npm run test:timing:md

# Custom options
node scripts/aggregate-timing-data.js --runs 10 --format markdown
node scripts/aggregate-timing-data.js --run timing-2026-07-25T02-16-30.json
```

## Usage Workflow

### 1. Run Tests with Timing Capture
```bash
npm test
```

This automatically:
- Runs all tests with timing instrumentation
- Captures individual test durations
- Generates timing JSON file in `test-timing-results/`
- Prints summary of slowest tests and files to stderr

### 2. Analyze Timing Data
```bash
# Quick console summary
npm run test:timing

# Generate markdown report
npm run test:timing:md

# Export JSON for further analysis
npm run test:timing:json > timing-analysis.json
```

### 3. Interpret Results

**Console Output:**
- Overall duration statistics (mean, median, min, max)
- Top 20 slowest tests with detailed statistics
- Top 10 slowest test files
- Outlier tests (high variance or consistently slow)
- Recent run history

**Markdown Output:**
- Formatted tables for easy reading
- Same data as console but structured for documentation
- Useful for reports and documentation

**JSON Output:**
- Complete data structure for programmatic analysis
- Includes all raw timing data
- Useful for custom analysis or visualization

## Data Structure

### Timing File Format
```json
{
  "startTime": "2026-07-25T02:16:14.222Z",
  "endTime": "2026-07-25T02:16:30.366Z",
  "suiteName": "mobile-gaming",
  "tests": [
    {
      "name": "test name",
      "file": "/path/to/test.js",
      "result": "passed",
      "duration": 35.204,
      "startTime": 1784945675479
    }
  ],
  "files": {
    "/path/to/test.js": {
      "file": "/path/to/test.js",
      "tests": [...],
      "testCount": 10,
      "passedCount": 10,
      "failedCount": 0,
      "skippedCount": 0,
      "duration": 1234
    }
  },
  "summary": {
    "totalTests": 5360,
    "passedTests": 5360,
    "failedTests": 0,
    "skippedTests": 0,
    "totalDuration": 16144,
    "slowestTests": [...],
    "slowestFiles": [...]
  }
}
```

### Aggregated Data Format
```json
{
  "runCount": 6,
  "runs": [...],
  "overall": {
    "totalTests": 32160,
    "passedTests": 32160,
    "stats": {
      "min": 16144,
      "max": 20039,
      "mean": 17659.5,
      "median": 17264,
      "stdDev": 1501.38
    }
  },
  "byTest": {...},
  "byFile": {...},
  "outliers": [...]
}
```

## Performance Insights

The timing system helps identify:
1. **Consistently slow tests** - Tests that always take a long time
2. **High variance tests** - Tests with unstable execution times
3. **Slow test files** - Files that need optimization
4. **Performance trends** - Changes in test execution time over runs
5. **Test flakiness** - Correlation between timing and failures

## Integration with CI

The timing reporter is automatically integrated with the Vitest test runner. To use in CI:

1. Run tests as normal: `npm test`
2. Timing data is automatically captured to `test-timing-results/`
3. Aggregate results for analysis: `npm run test:timing:md`
4. Store timing JSON files as build artifacts for trend analysis

## Maintenance

- Timing files accumulate over time - consider cleanup of old files
- For long-running projects, archive old timing results periodically
- The aggregation script automatically uses the most recent files by default
- Use `--runs` parameter to control how many files to analyze

## Troubleshooting

**No timing data generated:**
- Check that `tests/timing-reporter.js` exists and is properly configured in `vitest.config.js`
- Verify tests are actually running (check test output)

**Aggregation script finds no files:**
- Ensure `test-timing-results/` directory exists
- Run tests first to generate timing data
- Check file permissions

**Missing test data in aggregation:**
- Verify timing files are valid JSON
- Check that test runs completed successfully
- Look for error messages in test output
