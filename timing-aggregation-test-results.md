# Timing Data Aggregation Test Results

## Script Overview
The enhanced `scripts/aggregate-timing-data.js` script provides comprehensive timing analysis with proper statistical calculations.

## Acceptance Criteria Verification

### ✅ 1. Node.js script that reads timing data from test runs
- Script reads from `test-timing-results/` directory
- Supports both `timing-*.json` and `e2e-timing-*.json` file patterns
- Error handling for missing directories and invalid JSON files

### ✅ 2. Aggregate data across multiple runs
- Processes multiple test runs in a single execution
- Configurable number of runs via `--runs` parameter
- Supports analyzing specific runs via `--run` pattern matching

### ✅ 3. Calculate comprehensive statistics
The script now calculates **all** required statistics properly:

#### Overall Statistics:
- **Mean (Average)**: Calculated as sum of durations / count
- **Median**: Middle value when sorted, or average of two middle values for even-length datasets
- **Min**: Minimum value from the sorted dataset
- **Max**: Maximum value from the sorted dataset
- **Standard Deviation**: Population standard deviation calculated as √(Σ(x - μ)² / N)

#### Per-Test Statistics:
- Individual test duration tracking across all runs
- Mean, median, min, max, and standard deviation per test
- Failure rate tracking (failures / total runs)

#### Per-File Statistics:
- File-level aggregation across all tests within each file
- Same statistical measures as per-test analysis

### ✅ 4. Output results in readable formats
Three output formats are supported:

#### Console Output (default):
```
=== Aggregated Test Timing Statistics ===
--- Overall Statistics ---
Mean Duration: 5.34s
Median Duration: 0.25s
Min Duration: 0.21s
Max Duration: 18.53s
Std Deviation: ±7.82s
```

#### JSON Output (`--format json`):
Complete structured data with all statistics for programmatic consumption.

#### Markdown Output (`--format markdown`):
Formatted tables for documentation and reporting:
```markdown
| Metric | Value |
|--------|-------|
| Mean Duration | 5.34s |
| Median Duration | 0.25s |
| Min Duration | 0.21s |
| Max Duration | 18.53s |
| Std Deviation | ±7.82s |
```

### ✅ 5. Added to package.json scripts
```json
"test:timing": "node scripts/aggregate-timing-data.js",
"test:timing:json": "node scripts/aggregate-timing-data.js --format json",
"test:timing:md": "node scripts/aggregate-timing-data.js --format markdown"
```

### ✅ 6. Tested with sample timing data
Tested with actual timing data from multiple test runs:
- 10+ timing files in test-timing-results directory
- Different test run durations (0.2s to 18.5s)
- Multiple test files and individual tests
- Various test outcomes (passed, failed, skipped)

## Key Features

### Statistical Calculations
```javascript
function calculateStatistics(values) {
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

  // Standard Deviation
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev };
}
```

### Command Line Options
- `--runs <n>`: Analyze last n runs (default: 10)
- `--format <fmt>`: Output format: console, json, markdown (default: console)
- `--run <pattern>`: Analyze specific run by filename pattern
- `--help, -h`: Show help message

### Usage Examples
```bash
# Analyze last 5 runs in markdown format
npm run test:timing -- --runs 5 --format markdown

# Analyze specific run
node scripts/aggregate-timing-data.js --run "timing-2026-07-24T12-00-00"

# Output to JSON file
npm run test:timing:json > timing-summary.json

# Generate markdown report
npm run test:timing:md > timing-report.md
```

## Performance Analysis Capabilities

1. **Trend Analysis**: Track test performance over time with run history
2. **Outlier Detection**: Identifies tests with high variance or consistently slow execution
3. **Per-Test Analysis**: Detailed statistics for individual tests across runs
4. **File-Level Analysis**: Aggregated statistics per test file
5. **Top Slowest Tests**: Identifies performance bottlenecks

## Integration with CI/CD

The script integrates with existing CI workflows:
- Compatible with timing data from both Vitest and Playwright
- Works with timing reporter in `tests/playwright-timing-reporter.js`
- Supports automated performance regression detection
