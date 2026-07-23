# Bead bf-5l3y7: Visibilitychange Lifecycle Handlers - Already Complete

## Finding

The task description claims that "No game pauses on backgrounding" and that visibilitychange handlers are missing. However, **this work was already completed** in prior commits.

## Evidence of Completion

### 1. All 13 Games Import Lifecycle Module
```bash
grep -rl "shared/lifecycle" src/games/*/game.js
# Returns all 13 games
```

### 2. All Runner/Timed Games (5) Use setupVisibilityHandler()
- `crowd-runner` (line 119)
- `giant-runner` (line 142)
- `bridge-race` (line 126)
- `jelly-shift` (line 126)
- `makeover-run` (line 130)

Each calls:
```javascript
import { initLifecycle, setupVisibilityHandler, ... } from '../../shared/lifecycle.js';
// Later in init():
setupVisibilityHandler();
```

### 3. All Puzzle Games (8) Use setupPuzzleVisibilityHandler()
- `water-sort`
- `pull-the-pin`
- `parking-escape`
- `brain-teaser`
- `save-the-character`
- `satisfying-asmr`
- `bus-jam`
- `merge-games`

Each calls:
```javascript
import { setupPuzzleVisibilityHandler } from '../../shared/lifecycle.js';
// Later in init():
setupPuzzleVisibilityHandler({ onSave: () => this.saveState() });
```

### 4. Git History Confirms Implementation
- `cfccff1` feat(crowd-runner): integrate lifecycle system for pause/resume
- `05b479c` feat(lifecycle): apply runner/timed lifecycle pattern to 4 games
- `c9d70a4` feat(puzzles): add visibilitychange handling to 3 puzzle games
- `b5a00cf` feat(puzzles): add visibilitychange handling to 5 puzzle games
- `303c16d` test(e2e): add visibilitychange lifecycle tests for runner and puzzle games

### 5. E2E Tests Exist
`tests/e2e/lifecycle.spec.js` (267 lines) tests:
- Runner games: Resume overlay appears, no auto-resume, tap required
- Puzzle games: State persists without overlay

### 6. Helper Functions Internally Add Event Listeners
The lifecycle module's `setupVisibilityHandler()` and `setupPuzzleVisibilityHandler()` both call:
```javascript
document.addEventListener('visibilitychange', () => { ... });
```

So games don't need the literal string "visibilitychange" in their code - the helper handles it.

## Conclusion

This bead's task description is outdated. All acceptance criteria are already met:
- ✅ Every game's game.js registers a visibilitychange handler (via helper)
- ✅ Puzzle games persist state on hidden (via setupPuzzleVisibilityHandler)
- ✅ Runner/timed games show resume overlay (via setupVisibilityHandler)
- ✅ E2E tests exist (tests/e2e/lifecycle.spec.js)
- ✅ Implementation pattern follows plan.md requirements

**No additional work is needed.**
