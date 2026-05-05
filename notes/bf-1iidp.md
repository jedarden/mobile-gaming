# Level Corpus Quality Audit (bf-1iidp)

## Plan vs Actual

### Plan Specification (Content Pipeline §1849-1850)

| Game | Plan Process |
|------|--------------|
| Water Sort | Generate 200 → rank by solver move count → pick levels with interesting intermediate states |
| Parking Escape | Generate 200 → rank by optimal move count → hand-pick |

### Actual Implementation

The curation script (`scripts/curate-levels.js`) shows a different approach:

**Water Sort:**
- First 24 levels read from existing `src/games/water-sort/levels.json`
- Levels ws-025 through ws-030 hand-crafted with explicit tube configurations
- No evidence of generating 200 levels and ranking them

**Parking Escape:**
- All 30 levels explicitly defined in the curation script
- Each level hand-crafted with `targetMoves` field
- No generation/ranking pipeline executed

**Other Games:**
- Pull the Pin: 20 hand-authored levels
- Merge Games: Generated with specific seeds (5 easy @ seed 1001, 5 medium @ 2001, 5 hard @ 3001)
- Satisfying ASMR: Generated with specific seeds (4 easy @ 2001, 3 medium @ 3001, 3 hard @ 4001)

## Quality Assessment

### What Works
- All levels have verified optimal move counts (`optimal` for water-sort, `targetMoves` for parking-escape)
- Levels are properly sorted by difficulty (easy → medium → hard progression)
- Level counts meet or exceed plan targets

### Gap from Plan
The "interesting intermediate states" criterion from the plan cannot be verified because:
1. No intermediate state data is captured in level files
2. No ranking from a larger pool occurred
3. Selection was hand-crafted, not data-driven

## Conclusion

The committed levels are **high quality and playable**, but they do **not follow the plan's specified curation pipeline**. The levels were hand-crafted rather than generated at scale and ranked. This is a process deviation, not a quality issue—the levels themselves are valid and well-structured.

## Recommendation

If the plan's "generate 200 → rank" approach is desired for future level additions, it would require:
1. A bulk generation script that produces N candidates
2. Solver analysis that captures intermediate state diversity
3. A ranking/scoring function that weights move count + state variety
4. Selection of top-K levels from ranked candidates

For the current corpus, the hand-crafted approach is sufficient for shipping.
