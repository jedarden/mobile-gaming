Found 3 timing files to analyze
# Test Timing Analysis Report

Generated: 2026-07-25T02:12:56.582Z
Based on 3 runs

## Overall Statistics

| Metric | Value |
|--------|-------|
| Mean Duration | 19.30s |
| Median Duration | 19.09s |
| Min Duration | 17.97s |
| Max Duration | 20.85s |
| Std Deviation | ±1.19s |
| Average Tests per Run | 5360 |
| Average Pass Rate | 0.0% |

## Top 20 Slowest Tests

| Rank | Test | File | Mean | Median | Min | Max | StdDev | Failures |
|------|------|------|------|--------|-----|-----|--------|----------|
| 1 | generates different levels from different seeds | parking-escape.test.js | 1.099s | 1.120s | 0.998s | 1.179s | ±0.075s | 0/3 |
| 2 | medium levels are structurally valid when generated | pull-the-pin-generator.test.js | 0.370s | 0.379s | 0.337s | 0.395s | ±0.025s | 0/3 |
| 3 | always includes a hero vehicle | parking-escape-generator.test.js | 0.263s | 0.236s | 0.211s | 0.342s | ±0.057s | 0/3 |
| 4 | medium levels have 3 colors and 3 cups/balls | pull-the-pin-generator.test.js | 0.220s | 0.205s | 0.195s | 0.261s | ±0.029s | 0/3 |
| 5 | is deterministic | pull-the-pin-generator.test.js | 0.218s | 0.204s | 0.165s | 0.284s | ±0.050s | 0/3 |
| 6 | generated hard level 0 is BFS-solvable | water-sort-solver.test.js | 0.210s | 0.200s | 0.185s | 0.246s | ±0.026s | 0/3 |
| 7 | falls back to medium config for an unknown difficulty string | pull-the-pin-generator.test.js | 0.188s | 0.193s | 0.167s | 0.205s | ±0.016s | 0/3 |
| 8 | hard levels have 4 colors and 4 cups/balls | pull-the-pin-generator.test.js | 0.183s | 0.183s | 0.167s | 0.199s | ±0.013s | 0/3 |
| 9 | generates a daily level from known seed and can create initial state | parking-escape.test.js | 0.170s | 0.172s | 0.148s | 0.189s | ±0.017s | 0/3 |
| 10 | hero is horizontal and on exit row (y=2) | parking-escape-generator.test.js | 0.165s | 0.166s | 0.147s | 0.183s | ±0.015s | 0/3 |
| 11 | returns the requested number of levels | pull-the-pin-generator.test.js | 0.157s | 0.153s | 0.147s | 0.171s | ±0.010s | 0/3 |
| 12 | vehicles have no overlapping cells | parking-escape-generator.test.js | 0.154s | 0.151s | 0.142s | 0.168s | ±0.011s | 0/3 |
| 13 | all vehicles fit within grid bounds | parking-escape-generator.test.js | 0.150s | 0.154s | 0.138s | 0.158s | ±0.009s | 0/3 |
| 14 | does not exceed 500 events | analytics.test.js | 0.149s | 0.149s | 0.115s | 0.184s | ±0.028s | 0/3 |
| 15 | level pe-60 solver cost equals targetMoves | parking-escape-solver.test.js | 0.141s | 0.155s | 0.109s | 0.159s | ±0.023s | 0/3 |
| 16 | simulates a win on daily level and calls completeDailyChallenge exactly once | parking-escape.test.js | 0.135s | 0.147s | 0.101s | 0.157s | ±0.024s | 0/3 |
| 17 | level pe-60 solution path contains only valid vehicle ids | parking-escape-solver.test.js | 0.132s | 0.138s | 0.098s | 0.161s | ±0.026s | 0/3 |
| 18 | level pe-60 is solvable | parking-escape-solver.test.js | 0.132s | 0.118s | 0.117s | 0.161s | ±0.021s | 0/3 |
| 19 | generated hard level 1 is BFS-solvable | water-sort-solver.test.js | 0.128s | 0.125s | 0.114s | 0.147s | ±0.014s | 0/3 |
| 20 | level pe-60 solution uses at most maxMoves | parking-escape-solver.test.js | 0.127s | 0.119s | 0.098s | 0.165s | ±0.028s | 0/3 |

## Top 10 Slowest Test Files

| Rank | File | Tests | Mean | Median | Min | Max | StdDev |
|------|------|-------|------|--------|-----|-----|--------|
| 1 | pull-the-pin-generator.test.js | 33 | 2.53s | 2.59s | 2.33s | 2.66s | ±0.14s |
| 2 | parking-escape-solver.test.js | 84 | 2.17s | 2.22s | 1.84s | 2.43s | ±0.24s |
| 3 | parking-escape.test.js | 65 | 1.56s | 1.64s | 1.41s | 1.64s | ±0.11s |
| 4 | parking-escape-generator.test.js | 25 | 1.52s | 1.51s | 1.35s | 1.71s | ±0.15s |
| 5 | level-nav.test.js | 66 | 0.89s | 0.93s | 0.78s | 0.96s | ±0.08s |
| 6 | water-sort-solver.test.js | 92 | 0.48s | 0.50s | 0.43s | 0.52s | ±0.04s |
| 7 | analytics.test.js | 42 | 0.47s | 0.49s | 0.39s | 0.53s | ±0.06s |
| 8 | lifecycle.test.js | 50 | 0.45s | 0.48s | 0.35s | 0.52s | ±0.07s |
| 9 | level-coverage.test.js | 216 | 0.39s | 0.40s | 0.33s | 0.43s | ±0.04s |
| 10 | retry.test.js | 70 | 0.35s | 0.34s | 0.34s | 0.36s | ±0.01s |

## Test Timing Outliers

Tests with high variance or consistently slow execution times:

| Test | File | Reason | Avg Time | StdDev |
|------|------|--------|----------|--------|
| every level has a hero vehicle | parking-escape-solver.test.js | high_variance | 0.002s | ±0.002s |
| every level has a valid exit | parking-escape-solver.test.js | high_variance | 0.002s | ±0.002s |
| returns false if another vehicle is in path | parking-escape.test.js | high_variance | 0.001s | ±0.001s |
| returns null when no hero vehicle exists (isWon guard: hi < 0) | parking-escape.test.js | high_variance | 0.001s | ±0.001s |
| generated easy level 2 is BFS-solvable | water-sort-solver.test.js | high_variance | 0.000s | ±0.000s |
| generated easy level 4 is BFS-solvable | water-sort-solver.test.js | high_variance | 0.002s | ±0.001s |
| has index.html | level-coverage.test.js | high_variance | 0.000s | ±0.000s |
| has state.js | level-coverage.test.js | high_variance | 0.000s | ±0.000s |
| has game.js | level-coverage.test.js | high_variance | 0.000s | ±0.000s |
| has levels.json | level-coverage.test.js | high_variance | 0.000s | ±0.000s |

## Recent Run History

| Timestamp | Duration | Passed | Failed | Skipped |
|-----------|----------|--------|--------|---------|
| 2026-07-25T02:12:25.177Z | 20.85s | 0 | 0 | 0 |
| 2026-07-25T02:12:02.475Z | 17.97s | 0 | 0 | 0 |
| 2026-07-25T02:11:22.279Z | 19.09s | 0 | 0 | 0 |
