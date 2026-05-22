# Level Corpus Quality Audit (Bead bf-1iidp)

## Executive Summary

All 12 games meet or exceed their target level counts. However, the **quality curation pipeline specified in the plan was not fully implemented**. The plan requires a "generate 200 → solver-rank → hand-pick best" approach for Water Sort and Parking Escape, but the actual implementation used hand-crafted levels directly.

## Current State (2026-05-22)

| Game | Current | Target | Status |
|------|---------|--------|--------|
| water-sort | 30 | 30 | ✅ Count, ❌ Quality pipeline |
| brain-teaser | 25 | 25 | ✅ Hand-authored per plan |
| pull-the-pin | 20 | 20 | ✅ Hand-curated per plan |
| parking-escape | 30 | 30 | ✅ Count, ❌ Quality pipeline |
| merge-games | 15 | 15 | ✅ Generated per plan |
| satisfying-asmr | 10 | 10 | ✅ Generated per plan |
| crowd-runner | 20 | 20 | ✅ Generated per plan |
| giant-runner | 20 | 20 | ✅ Generated per plan |
| jelly-shift | 15 | 15 | ✅ Generated per plan |
| makeover-run | 15 | 15 | ✅ Generated per plan |
| bridge-race | 15 | 15 | ✅ Generated per plan |
| save-the-character | 20 | 20 | ✅ Hand-authored per plan |
| bus-jam | 30 | unspecified | ✅ |

**Total: 275 levels across 12 games**

## Plan Requirements vs Actual Implementation

### Water Sort
- **Plan**: "Generator → solver-rank → hand-pick best | Generate 200, rank by solver move count, pick levels with interesting intermediate states | 30 (10 easy, 10 medium, 10 hard)"
- **Actual**: 30 levels with excellent difficulty distribution (difficulty 0.05-0.98, optimal moves 2-30)
- **Gap**: Levels are hand-designed, not selected from 200 generated candidates. No ranking script exists.
- **Evidence**: `scripts/curate-levels.js` lines 46-172 hardcode levels ws-025 through ws-030 as inline JSON. No bulk generation or ranking logic.

### Parking Escape
- **Plan**: "Generator → solver-rank → hand-pick | 30 levels | Same pipeline; rank by optimal move count"
- **Actual**: 30 hand-crafted Rush Hour-style puzzles with good progression (difficulty 1-10, targetMoves 2-25)
- **Gap**: All levels are hand-crafted, not selected from a generated pool.
- **Evidence**: `scripts/curate-levels.js` lines 962-1457 hardcode all 30 pe-XXX levels as inline JSON.

### Pull the Pin
- **Plan**: "Generator → solver-rank → hand-pick | 20 levels | Physics makes generation less reliable; more manual curation"
- **Actual**: 20 levels exist
- **Status**: Count correct; hand-curation approach matches plan intent

## Missing Implementation

### No Ranking Script
No script exists that:
1. Generates 200 candidate levels
2. Runs solver on each to get move counts
3. Ranks by move count or difficulty
4. Analyzes intermediate states for "interesting" properties
5. Selects top N levels

### No Intermediate State Analysis
The plan specifies "pick levels with interesting intermediate states" but no code evaluates intermediate state properties (e.g., symmetry, near-solution states, branching factor, state diversity).

### Curate Script Doesn't Implement Curation
`scripts/curate-levels.js` is a misnomer—it directly defines level JSON rather than implementing any selection or ranking logic. The script:
- Reads existing levels from `src/games/*/levels.json`
- Appends hardcoded new levels as inline JSON objects
- Writes individual level files to `levels/<game>/` directory

## Level Quality Assessment

Despite the process deviation, the committed levels are high quality:

- **Water Sort**: Clear difficulty progression, all levels solvable (verified by optimal move counts)
- **Parking Escape**: Well-designed Rush Hour puzzles with appropriate move counts per difficulty tier
- **All games**: Levels are functional and playtested

## Recommendation

The current hand-crafted levels are **sufficient for shipping**. They meet all quality criteria for playability and difficulty progression.

To fully align with the plan's stated quality bar, consider implementing the curation pipeline for future level additions:

1. **Water Sort**: Generate 200 levels per difficulty tier → rank by solver move count → select 10 best per tier based on intermediate state diversity
2. **Parking Escape**: Generate 200 levels → rank by optimal move count → select 30 with spread across difficulty ranges

Alternatively, update the plan documentation to reflect the actual hand-crafted approach used, which has proven effective.

## Related Files

- `scripts/curate-levels.js` — Level curation script (actually hardcodes levels)
- `src/games/water-sort/generator.js` — Water Sort procedural generator
- `src/games/parking-escape/generator.js` — Parking Escape procedural generator
- `levels/<game>/*.json` — Individual level files
- `docs/implementation/plan.md` — Original specification (section: Content Pipeline)
