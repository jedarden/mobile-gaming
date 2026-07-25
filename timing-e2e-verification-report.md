Found 5 timing files to analyze
# Test Timing Analysis Report

Generated: 2026-07-25T02:15:07.980Z
Based on 5 runs

## Overall Statistics

| Metric | Value |
|--------|-------|
| Mean Duration | 17.96s |
| Median Duration | 18.20s |
| Min Duration | 16.30s |
| Max Duration | 20.04s |
| Std Deviation | ±1.47s |
| Average Tests per Run | 5360 |
| Average Pass Rate | 100.0% |

## Top 20 Slowest Tests

| Rank | Test | File | Mean | Median | Min | Max | StdDev | Failures |
|------|------|------|------|--------|-----|-----|--------|----------|
| 1 | generates different levels from different seeds | parking-escape.test.js | 1.126s | 1.119s | 0.990s | 1.248s | ±0.103s | 0/5 |
| 2 | medium levels are structurally valid when generated | pull-the-pin-generator.test.js | 0.300s | 0.300s | 0.265s | 0.346s | ±0.027s | 0/5 |
| 3 | is deterministic | pull-the-pin-generator.test.js | 0.212s | 0.196s | 0.183s | 0.257s | ±0.029s | 0/5 |
| 4 | generated hard level 0 is BFS-solvable | water-sort-solver.test.js | 0.194s | 0.194s | 0.168s | 0.218s | ±0.017s | 0/5 |
| 5 | falls back to medium config for an unknown difficulty string | pull-the-pin-generator.test.js | 0.192s | 0.201s | 0.170s | 0.208s | ±0.016s | 0/5 |
| 6 | always includes a hero vehicle | parking-escape-generator.test.js | 0.190s | 0.177s | 0.162s | 0.244s | ±0.029s | 0/5 |
| 7 | medium levels have 3 colors and 3 cups/balls | pull-the-pin-generator.test.js | 0.188s | 0.183s | 0.164s | 0.213s | ±0.018s | 0/5 |
| 8 | hard levels have 4 colors and 4 cups/balls | pull-the-pin-generator.test.js | 0.185s | 0.176s | 0.162s | 0.208s | ±0.018s | 0/5 |
| 9 | hero is horizontal and on exit row (y=2) | parking-escape-generator.test.js | 0.164s | 0.159s | 0.139s | 0.190s | ±0.020s | 0/5 |
| 10 | vehicles have no overlapping cells | parking-escape-generator.test.js | 0.160s | 0.157s | 0.141s | 0.176s | ±0.013s | 0/5 |
| 11 | all vehicles fit within grid bounds | parking-escape-generator.test.js | 0.157s | 0.160s | 0.139s | 0.172s | ±0.014s | 0/5 |
| 12 | appends overlay to document.body when no container provided | fail-speedrun.test.js | 0.145s | 0.150s | 0.125s | 0.165s | ±0.015s | 0/5 |
| 13 | generates a daily level from known seed and can create initial state | parking-escape.test.js | 0.142s | 0.132s | 0.124s | 0.168s | ±0.018s | 0/5 |
| 14 | returns the requested number of levels | pull-the-pin-generator.test.js | 0.132s | 0.125s | 0.110s | 0.158s | ±0.020s | 0/5 |
| 15 | does not exceed 500 events | analytics.test.js | 0.121s | 0.130s | 0.086s | 0.136s | ±0.018s | 0/5 |
| 16 | level pe-60 solution uses at most maxMoves | parking-escape-solver.test.js | 0.120s | 0.115s | 0.086s | 0.150s | ±0.022s | 0/5 |
| 17 | keeps the most recent events when evicting | analytics.test.js | 0.119s | 0.122s | 0.085s | 0.148s | ±0.020s | 0/5 |
| 18 | returns array of levels | parking-escape-generator.test.js | 0.113s | 0.101s | 0.089s | 0.164s | ±0.027s | 0/5 |
| 19 | returns saved progress after completeLevel | level-nav.test.js | 0.112s | 0.105s | 0.093s | 0.155s | ±0.022s | 0/5 |
| 20 | simulates a win on daily level and calls completeDailyChallenge exactly once | parking-escape.test.js | 0.111s | 0.106s | 0.100s | 0.124s | ±0.010s | 0/5 |

## Top 10 Slowest Test Files

| Rank | File | Tests | Mean | Median | Min | Max | StdDev |
|------|------|-------|------|--------|-----|-----|--------|
| 1 | pull-the-pin-generator.test.js | 33 | 2.37s | 2.38s | 2.02s | 2.65s | ±0.22s |
| 2 | parking-escape-solver.test.js | 84 | 1.97s | 2.04s | 1.69s | 2.33s | ±0.25s |
| 3 | parking-escape.test.js | 65 | 1.53s | 1.49s | 1.35s | 1.71s | ±0.15s |
| 4 | parking-escape-generator.test.js | 25 | 1.46s | 1.37s | 1.29s | 1.70s | ±0.16s |
| 5 | level-nav.test.js | 66 | 0.82s | 0.77s | 0.72s | 1.04s | ±0.12s |
| 6 | water-sort-solver.test.js | 92 | 0.45s | 0.45s | 0.40s | 0.54s | ±0.05s |
| 7 | analytics.test.js | 42 | 0.43s | 0.44s | 0.32s | 0.49s | ±0.06s |
| 8 | lifecycle.test.js | 50 | 0.41s | 0.39s | 0.35s | 0.53s | ±0.07s |
| 9 | level-coverage.test.js | 216 | 0.35s | 0.35s | 0.28s | 0.43s | ±0.05s |
| 10 | retry.test.js | 70 | 0.35s | 0.34s | 0.30s | 0.41s | ±0.04s |

## Test Timing Outliers

Tests with high variance or consistently slow execution times:

| Test | File | Reason | Avg Time | StdDev |
|------|------|--------|----------|--------|
| has at least 10 levels | parking-escape-solver.test.js | high_variance | 0.002s | ±0.001s |
| no vehicle overlaps in initial state | parking-escape-solver.test.js | high_variance | 0.001s | ±0.001s |
| level pe-52 solution replays to won | parking-escape-solver.test.js | high_variance | 0.004s | ±0.003s |
| generated easy level 1 is BFS-solvable | parking-escape-solver.test.js | high_variance | 0.003s | ±0.003s |
| generated easy level 3 is BFS-solvable | parking-escape-solver.test.js | high_variance | 0.003s | ±0.001s |
| defaults exit direction to "right" when direction field is absent (exit.direction||"right" false arm) | parking-escape.test.js | high_variance | 0.000s | ±0.000s |
| returns null when exit.direction is an invalid string (isWon falls through all 4 directions → return false) | parking-escape.test.js | high_variance | 0.001s | ±0.000s |
| handles multiple sequential moves | parking-escape.test.js | high_variance | 0.000s | ±0.000s |
| generated easy level 1 solution is valid | water-sort-solver.test.js | high_variance | 0.005s | ±0.003s |
| generated easy level 2 solution is valid | water-sort-solver.test.js | high_variance | 0.000s | ±0.000s |

## Recent Run History

| Timestamp | Duration | Passed | Failed | Skipped |
|-----------|----------|--------|--------|---------|
| 2026-07-25T02:14:35.159Z | 18.95s | 5360 | 0 | 0 |
| 2026-07-25T02:14:14.653Z | 20.04s | 5360 | 0 | 0 |
| 2026-07-25T02:13:56.000Z | 18.20s | 5360 | 0 | 0 |
| 2026-07-25T02:13:39.266Z | 16.30s | 5360 | 0 | 0 |
| 2026-07-25T02:13:11.616Z | 16.33s | 5360 | 0 | 0 |
