# Level Corpus Quality Audit (Bead bf-1iidp)

## Executive Summary

The committed level corpus meets or exceeds target counts for 11 of 12 games, but **fails to implement the plan's quality curation pipeline**. The plan specifies a "generate 200 → solver-rank → hand-pick best" approach for Water Sort, Parking Escape, and Pull the Pin, with selection based on solver move counts and interesting intermediate states. **This pipeline was not implemented.**

## Plan Requirements vs Actual Implementation

### Water Sort
- **Plan**: "Generator → solver-rank → hand-pick best | Generate 200, rank by solver move count, pick levels with interesting intermediate states | 30 (10 easy, 10 medium, 10 hard)"
- **Actual**: 30 levels with good difficulty distribution (0.05-0.98), but levels are hand-designed, not selected from 200 generated candidates
- **Evidence**: `scripts/curate-levels.js` directly defines levels as JSON objects; no ranking logic exists

### Parking Escape  
- **Plan**: "Generator → solver-rank → hand-pick | 30 levels | Same pipeline; rank by optimal move count"
- **Actual**: Only 10 levels exist (not 30), with IDs like `pe-gen-easy-0-102` indicating direct generation without curation
- **Gap**: Missing 20 levels

### Pull the Pin
- **Plan**: "Generator → solver-rank → hand-pick | 20 levels | Physics makes generation less reliable; more manual curation"
- **Actual**: 20 levels exist, but no evidence of solver-based ranking or intermediate state analysis
- **Status**: Count correct, curation method unknown

### Merge Games
- **Plan**: "Generator | 15 levels"
- **Actual**: 11 levels (4 short), with `mg-gen-easy-0-1` style IDs indicating direct generation
- **Gap**: Missing 4 levels

### Satisfying ASMR
- **Plan**: "Generator | 10 levels"
- **Actual**: 11 levels (1 over target - acceptable margin), with `asmr-gen-*` IDs
- **Status**: Acceptable

## Current Level Counts

| Game | Current | Target | Status |
|------|---------|--------|--------|
| water-sort | 30 | 30 | ✅ Count, ❌ Quality pipeline |
| brain-teaser | 25 | 25 | ✅ |
| pull-the-pin | 20 | 20 | ✅ Count, ❓ Quality pipeline |
| parking-escape | 10 | 30 | ❌ Missing 20 |
| merge-games | 11 | 15 | ❌ Missing 4 |
| satisfying-asmr | 11 | 10 | ✅ |
| crowd-runner | 20 | 20 | ✅ |
| giant-runner | 20 | 20 | ✅ |
| jelly-shift | 15 | 15 | ✅ |
| makeover-run | 12 | 15 | ❌ Missing 3 |
| bridge-race | 15 | 15 | ✅ |
| save-the-character | 20 | 20 | ✅ |
| bus-jam | 30 | ? | ✅ (no target specified) |

## Missing Implementation

### No Ranking Script
No script exists that:
1. Generates 200 candidate levels
2. Runs solver on each to get move counts
3. Ranks by move count or difficulty
4. Analyzes intermediate states for "interesting" properties
5. Selects top N levels

### No Intermediate State Analysis
The plan specifies "pick levels with interesting intermediate states" but no code evaluates intermediate state properties (e.g., symmetry, near-solution states, branching factor).

### Curate Script Doesn't Implement Curation
`scripts/curate-levels.js` is a misnomer—it directly defines level JSON rather than implementing any selection or ranking logic.

## Recommendation

To fully satisfy the plan's quality bar, implement the curation pipeline for the specified games:

1. **Water Sort**: Generate 200 levels per difficulty tier → rank by solver move count → select 10 best per tier based on intermediate state diversity
2. **Parking Escape**: Generate 200 levels → rank by optimal move count → select 30 with spread across difficulty ranges
3. **Pull the Pin**: Generate 200 levels → rank by solver success rate → select 20 with interesting pin-ordering dependencies

Alternatively, if the current hand-crafted levels are deemed sufficient quality, update the plan to reflect the actual approach used.
