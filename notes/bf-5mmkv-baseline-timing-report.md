# Test Timing Analysis Report

Generated: 2026-07-25T02:19:51.882Z
Based on 5 runs

## Overall Statistics

| Metric | Value |
|--------|-------|
| Mean Duration | 18.94s |
| Median Duration | 18.95s |
| Min Duration | 16.14s |
| Max Duration | 21.50s |
| Std Deviation | ±1.81s |
| Average Tests per Run | 5360 |
| Average Pass Rate | 100.0% |

## Top 20 Slowest Tests

| Rank | Test | File | Mean | Median | Min | Max | StdDev | Failures |
|------|------|------|------|--------|-----|-----|--------|----------|
| 1 | generates different levels from different seeds | parking-escape.test.js | 1.184s | 1.236s | 0.989s | 1.360s | ±0.130s | 0/5 |
| 2 | medium levels are structurally valid when generated | pull-the-pin-generator.test.js | 0.305s | 0.306s | 0.253s | 0.356s | ±0.042s | 0/5 |
| 3 | is deterministic | pull-the-pin-generator.test.js | 0.225s | 0.236s | 0.176s | 0.257s | ±0.030s | 0/5 |
| 4 | always includes a hero vehicle | parking-escape-generator.test.js | 0.213s | 0.198s | 0.184s | 0.244s | ±0.026s | 0/5 |
| 5 | generated hard level 0 is BFS-solvable | water-sort-solver.test.js | 0.206s | 0.205s | 0.180s | 0.246s | ±0.024s | 0/5 |
| 6 | medium levels have 3 colors and 3 cups/balls | pull-the-pin-generator.test.js | 0.198s | 0.205s | 0.162s | 0.237s | ±0.027s | 0/5 |
| 7 | hard levels have 4 colors and 4 cups/balls | pull-the-pin-generator.test.js | 0.191s | 0.192s | 0.175s | 0.208s | ±0.014s | 0/5 |
| 8 | falls back to medium config for an unknown difficulty string | pull-the-pin-generator.test.js | 0.189s | 0.194s | 0.159s | 0.208s | ±0.019s | 0/5 |
| 9 | hero is horizontal and on exit row (y=2) | parking-escape-generator.test.js | 0.166s | 0.162s | 0.142s | 0.190s | ±0.018s | 0/5 |
| 10 | vehicles have no overlapping cells | parking-escape-generator.test.js | 0.159s | 0.169s | 0.132s | 0.176s | ±0.017s | 0/5 |
| 11 | all vehicles fit within grid bounds | parking-escape-generator.test.js | 0.157s | 0.157s | 0.133s | 0.172s | ±0.014s | 0/5 |
| 12 | generates a daily level from known seed and can create initial state | parking-escape.test.js | 0.154s | 0.159s | 0.119s | 0.200s | ±0.029s | 0/5 |
| 13 | appends overlay to document.body when no container provided | fail-speedrun.test.js | 0.153s | 0.154s | 0.129s | 0.168s | ±0.014s | 0/5 |
| 14 | returns the requested number of levels | pull-the-pin-generator.test.js | 0.132s | 0.124s | 0.104s | 0.158s | ±0.020s | 0/5 |
| 15 | does not exceed 500 events | analytics.test.js | 0.129s | 0.124s | 0.092s | 0.180s | ±0.029s | 0/5 |
| 16 | level pe-60 solution path contains only valid vehicle ids | parking-escape-solver.test.js | 0.125s | 0.124s | 0.105s | 0.145s | ±0.013s | 0/5 |
| 17 | keeps the most recent events when evicting | analytics.test.js | 0.124s | 0.119s | 0.110s | 0.149s | ±0.013s | 0/5 |
| 18 | level pe-60 solution uses at most maxMoves | parking-escape-solver.test.js | 0.121s | 0.138s | 0.084s | 0.150s | ±0.029s | 0/5 |
| 19 | appends an overlay to the container | fail-speedrun-overlay.test.js | 0.120s | 0.120s | 0.092s | 0.150s | ±0.019s | 0/5 |
| 20 | returns saved progress after completeLevel | level-nav.test.js | 0.118s | 0.101s | 0.091s | 0.155s | ±0.027s | 0/5 |

## Top 10 Slowest Test Files

| Rank | File | Tests | Mean | Median | Min | Max | StdDev |
|------|------|-------|------|--------|-----|-----|--------|
| 1 | pull-the-pin-generator.test.js | 33 | 2.38s | 2.53s | 2.05s | 2.65s | ±0.24s |
| 2 | parking-escape-solver.test.js | 84 | 1.99s | 2.04s | 1.63s | 2.33s | ±0.23s |
| 3 | parking-escape.test.js | 65 | 1.61s | 1.68s | 1.33s | 1.86s | ±0.19s |
| 4 | parking-escape-generator.test.js | 25 | 1.51s | 1.58s | 1.30s | 1.70s | ±0.15s |
| 5 | level-nav.test.js | 66 | 0.84s | 0.77s | 0.72s | 1.04s | ±0.12s |
| 6 | water-sort-solver.test.js | 92 | 0.47s | 0.45s | 0.38s | 0.54s | ±0.06s |
| 7 | analytics.test.js | 42 | 0.43s | 0.43s | 0.38s | 0.49s | ±0.04s |
| 8 | lifecycle.test.js | 50 | 0.40s | 0.42s | 0.28s | 0.53s | ±0.08s |
| 9 | level-coverage.test.js | 216 | 0.40s | 0.36s | 0.29s | 0.58s | ±0.10s |
| 10 | retry.test.js | 70 | 0.36s | 0.36s | 0.29s | 0.45s | ±0.06s |

## Test Timing Outliers

Tests with high variance or consistently slow execution times:

| Test | File | Reason | Avg Time | StdDev |
|------|------|--------|----------|--------|
| every level has a hero vehicle | parking-escape-solver.test.js | high_variance | 0.002s | ±0.001s |
| no vehicle overlaps in initial state | parking-escape-solver.test.js | high_variance | 0.002s | ±0.002s |
| level pe-52 solution replays to won | parking-escape-solver.test.js | high_variance | 0.005s | ±0.003s |
| returns null when exit.direction is an invalid string (isWon falls through all 4 directions → return false) | parking-escape.test.js | high_variance | 0.001s | ±0.000s |
| returns null when no hero vehicle exists (isWon guard: hi < 0) | parking-escape.test.js | high_variance | 0.000s | ±0.000s |
| checkWin returns false when a vehicle blocks the upward path | parking-escape.test.js | high_variance | 0.000s | ±0.001s |
| ws-105 (diff=0.2) is solvable | water-sort-solver.test.js | high_variance | 0.000s | ±0.000s |
| generated easy level 2 solution is valid | water-sort-solver.test.js | high_variance | 0.000s | ±0.000s |
| generated easy level 4 is BFS-solvable | water-sort-solver.test.js | high_variance | 0.002s | ±0.001s |
| generated easy level 4 solution is valid | water-sort-solver.test.js | high_variance | 0.001s | ±0.001s |

## Recent Run History

| Timestamp | Duration | Passed | Failed | Skipped |
|-----------|----------|--------|--------|---------|
| 2026-07-25T02:18:40.675Z | 21.50s | 5360 | 0 | 0 |
| 2026-07-25T02:17:06.075Z | 18.07s | 5360 | 0 | 0 |
| 2026-07-25T02:16:14.222Z | 16.14s | 5360 | 0 | 0 |
| 2026-07-25T02:14:35.159Z | 18.95s | 5360 | 0 | 0 |
| 2026-07-25T02:14:14.653Z | 20.04s | 5360 | 0 | 0 |
