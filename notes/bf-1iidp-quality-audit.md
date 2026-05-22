# Level Corpus Quality Audit (bf-1iidp)

## Audit Scope
Verify whether committed levels for water-sort (30) and parking-escape (30) follow the plan's curation criteria:
- **Plan requirement**: "Generate 200, rank by solver move count, pick levels with interesting intermediate states"

## Findings

### Water Sort (30 levels)
**Status**: ❌ Does NOT follow plan's quality pipeline

**Evidence**:
1. `curate-levels.js` has 24 existing levels + 6 **hand-written** hard levels (ws-025..ws-030)
2. Hand-written levels have explicit tube configurations and `optimal` values
3. No "generate 200 → rank → pick best" pipeline exists
4. Generator estimates optimal moves with `Math.max(colorCount, Math.floor(shuffleRounds / 10))` — NOT solver-verified

**Level distribution** (verified from actual files):
- Move counts: 2-30 moves, well-distributed
- Difficulty scores: 0.05-0.98, appropriate progression

### Parking Escape (30 levels)
**Status**: ❌ Does NOT follow plan's quality pipeline

**Evidence**:
1. All 30 levels are **hand-written** in `curate-levels.js` with explicit vehicle placements
2. Each level has explicit `targetMoves` value
3. No "generate 200 → rank → pick best" pipeline exists
4. Generator DOES run solver (`solve(level)`) to verify difficulty — but committed levels weren't generated this way

**Level distribution** (verified from actual files):
- Move counts: 2-25 moves, well-distributed
- Difficulty tiers 1-10 match plan's target ranges (Easy 4-8, Medium 9-16, Hard 17-30)

### Other Games (for context)
- **Brain Teaser** (25): Hand-authored with LLM assistance ✓
- **Save the Character** (20): Hand-authored with LLM assistance ✓
- **Merge Games**, **Satisfying ASMR**, **Runner games**: Generator → verify (no curation/ranking required per plan)

## Conclusion

**Quality Issue**: The plan's "generate 200 → rank → pick best" pipeline for water-sort and parking-escape was **never implemented**. Instead, levels were hand-written with reasonable difficulty progressions, but without:
1. Generating a large candidate pool (200+ levels)
2. Ranking by actual solver move counts
3. Selecting based on intermediate state quality

**Impact**: The committed levels are playable and reasonably balanced, but they do not meet the plan's explicit quality bar. The `optimal` values in water-sort levels may be estimates rather than solver-verified counts.

## Recommendation

To fully satisfy the plan's requirements, implement the curation pipeline:
1. Generate 200 levels per difficulty tier
2. Run BFS solver on each to get true optimal move count
3. Rank by move count and hand-pick best 30 based on intermediate state diversity
