# Level Corpus Quality Audit - Final Report (bf-1iidp)

## Executive Summary

The committed level corpus meets all target counts (244 levels total across 12 games). However, the quality curation pipeline specified in the plan was **not implemented** for water-sort and parking-escape.

## Level Counts vs Plan Targets

| Game | Plan Target | Actual | Status |
|------|-------------|--------|--------|
| water-sort | 30 | 30 | ✅ Count met |
| brain-teaser | 25 | 25 | ✅ Count met |
| pull-the-pin | 20 | 20 | ✅ Count met |
| parking-escape | 30 | 30 | ✅ Count met |
| save-the-character | 20 | 20 | ✅ Count met |
| merge-games | 15 | 15 | ✅ Count met |
| satisfying-asmr | 10 | 10 | ✅ Count met |
| crowd-runner | 20 | 20 | ✅ Count met |
| giant-runner | 20 | 20 | ✅ Count met |
| jelly-shift | 15 | 15 | ✅ Count met |
| makeover-run | 15 | 15 | ✅ Count met |
| bridge-race | 15 | 15 | ✅ Count met |
| bus-jam | unspecified | 30 | ✅ Count met |

**Total: 244 levels committed**

## Quality Bar Assessment

### Plan Specification (§Content Pipeline)

For water-sort and parking-escape, the plan explicitly required:
> "Generate 200, rank by solver move count, pick levels with interesting intermediate states"

### Actual Implementation

**Water Sort (30 levels):**
- 24 levels from existing levels.json
- 6 levels (ws-025..ws-030) hand-written in curate-levels.js
- No "generate 200" pool was created
- No solver-based ranking occurred
- `optimal` values appear to be estimates, not solver-verified

**Parking Escape (30 levels):**
- All 30 levels hand-written in curate-levels.js
- Each has explicit `targetMoves` value
- No "generate 200" pool was created
- No solver-based ranking occurred

### Other Games (Context)
- **Brain Teaser, Save the Character**: Plan specified hand-authoring with LLM assistance ✅
- **Merge Games, Satisfying ASMR, Runner games**: Plan specified generator → verify (no curation/ranking) ✅

## Conclusion

**Quality Gap**: The plan's "generate 200 → rank → pick best" pipeline for water-sort and parking-escape was **never implemented**.

**Impact**: The committed levels are playable and have reasonable difficulty progressions, but they do not meet the plan's explicit quality bar. The levels were hand-crafted rather than selected from a large generated-and-ranked candidate pool.

## Recommendation

To fully satisfy the plan requirements, implement the curation pipeline:
1. Generate 200+ levels per difficulty tier
2. Run BFS solver on each to get true optimal move count
3. Rank by move count and select best 30 based on intermediate state diversity

---

**Audit Date**: 2026-05-22
**Auditor**: Claude Code (bf-1iidp)
**Previous Audit**: 84e2c1b (notes/bf-1iidp-quality-audit.md)
