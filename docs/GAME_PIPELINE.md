# Game Pipeline Documentation

This document describes the end-to-end process for adding new games to the Mobile Gaming platform.

## Pipeline Overview

```
DISCOVER ──> EVALUATE ──> BUILD ──> TEST ──> DEPLOY
    │           │           │         │         │
    ▼           ▼           ▼         ▼         ▼
 Find games   Score &     Scaffold   QA &      PR &
 worth making  decide     & code     playtest  release
```

---

## Phase 1: Discovery

### Source Channels

**Primary Sources:**
| Source | Why | How to Monitor |
|--------|-----|----------------|
| App Store / Play Store ads | Proven demand, viral mechanics | Browse top charts, watch rewarded ads |
| TikTok / Instagram Reels | Viral puzzle content, fake gameplay | Follow #puzzlegame, #mobilegaming |
| Reddit | Community requests, trending | r/mobilegaming, r/puzzles, r/WebGames |
| Itch.io | Indie innovations, game jams | Browse puzzle tag, sort by new |

**Secondary Sources:**
- Player requests (GitHub Issues)
- Direct competitor analysis
- Classic puzzle game adaptations (Sudoku, Nonograms, etc.)

### Discovery Criteria

Quick filter questions:
1. **Is it a puzzle?** - Strategy/logic over reflex/action
2. **Can it work client-side?** - No backend required
3. **Is it touch-friendly?** - Works on phones
4. **Is there depth?** - Can scale difficulty

If YES to all, proceed to evaluation.

---

## Phase 2: Evaluation

### Using the Evaluation Template

Use [`docs/templates/game-evaluation.md`](templates/game-evaluation.md) for systematic scoring.

### Scoring Summary

| Category | Max Score | Weight |
|----------|-----------|--------|
| Feasibility | 55 | Technical viability |
| Appeal | 45 | Player engagement potential |
| Differentiation | 25 | Competitive advantage |
| **Total** | **125** | |

### Decision Matrix

| Score | Decision | Action |
|-------|----------|--------|
| 100-125 | **BUILD** | High priority, start immediately |
| 80-99 | **BUILD** | Normal priority, good fit |
| 60-79 | **PROTOTYPE** | 1-2 day fun validation first |
| 40-59 | **DEFER** | Needs refinement |
| < 40 | **PASS** | Not a good fit |

### Prototyping Gate

For scores 60-79, create a minimal prototype:
- Core mechanic only
- 3 playable levels
- Basic touch controls
- Answer: "Is this fun?"

---

## Phase 3: Build

### Step 1: Create Scaffold

```bash
# Generate game scaffold
./scripts/new-game.sh "Game Name"

# Creates:
# src/games/game-name/
# ├── index.html       (Game page)
# ├── main.js          (Entry point)
# ├── state.js         (Core logic)
# ├── renderer.js      (Canvas rendering)
# ├── input.js         (Input handling)
# ├── styles.css       (Game styles)
# ├── levels.json      (Level data)
# ├── generator.js     (Procedural generation)
# ├── README.md        (Documentation)
# └── assets/
#     ├── images/
#     ├── audio/
#     └── fonts/
```

### Step 2: Implementation Order

1. **State Management** (`state.js`)
   - Define state structure
   - Implement `createInitialState(level)`
   - Implement `cloneState(state)`
   - Implement `checkWin(state)`
   - Implement `getHint(state)`

2. **Rendering** (`renderer.js`)
   - Draw game board
   - Draw game pieces
   - Handle responsive sizing
   - Add visual feedback

3. **Input Handling** (`input.js`)
   - Handle clicks/taps
   - Handle drag gestures (if needed)
   - Add keyboard shortcuts

4. **Level Design** (`levels.json`)
   - Create 20+ levels
   - Difficulty progression (easy → hard)
   - Test each level is solvable

5. **Polish**
   - Add animations
   - Add sound effects
   - Add haptic feedback
   - Test on mobile devices

### Step 3: Shared Modules

Leverage shared modules from `src/shared/`:

| Module | Purpose |
|--------|---------|
| `storage.js` | Save/load progress and settings |
| `history.js` | Undo/redo functionality |
| `accessibility.js` | Screen reader announcements |
| `rng.js` | Seeded random number generator |
| `meta.js` | XP and achievements |
| `daily.js` | Daily challenges |
| `audio.js` | Sound effects |
| `colors.js` | Color palette |

### Code Patterns

All games follow these patterns:

```javascript
// State immutability
const newState = structuredClone(oldState);

// Event-driven input
input.on('click', (pos) => handleClick(pos));

// Animation queue
renderer.queueAnimation('bounce', element);

// Shared color palette
import { COLORS } from '../../shared/colors.js';
```

---

## Phase 4: Test

### Unit Tests

Create tests in `tests/games/<game-slug>/`:

```javascript
// tests/games/my-game/state.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, checkWin, cloneState } from '../../../src/games/my-game/state.js';

describe('MyGame State', () => {
  it('creates initial state from level', () => {
    const level = { id: 1, difficulty: 0.1 };
    const state = createInitialState(level);
    expect(state.level).toBe(1);
  });

  it('clones state deeply', () => {
    const state = createInitialState({ id: 1 });
    const clone = cloneState(state);
    expect(clone).not.toBe(state);
  });
});
```

Run tests:
```bash
npm test              # All unit tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### E2E Tests

Create Playwright tests in `tests/e2e/`:

```javascript
// tests/e2e/my-game.spec.js
import { test, expect } from '@playwright/test';

test.describe('My Game', () => {
  test('completes level successfully', async ({ page }) => {
    await page.goto('/src/games/my-game/');
    await page.waitForSelector('#game-canvas');
    
    // Play through level
    await page.click('#game-canvas');
    
    // Verify win overlay appears
    await expect(page.locator('#win-overlay')).toBeVisible();
  });
});
```

Run E2E tests:
```bash
npm run test:e2e       # Run all E2E tests
npm run test:e2e:ui    # UI mode
npm run test:e2e:debug # Debug mode
```

### QA Checklist

Complete [`docs/templates/qa-checklist.md`](templates/qa-checklist.md) for each game:

| Section | Items | Status |
|---------|-------|--------|
| Core Gameplay | 10 | All PASS required |
| Controls | 8 | All PASS required |
| History System | 6 | All PASS required |
| Progression | 6 | All PASS required |
| Visual Polish | 8 | 6+ PASS required |
| Audio | 4 | 3+ PASS required |
| Responsive Design | 6 | All PASS required |
| Performance | 4 | All PASS required |
| Edge Cases | 6 | 5+ PASS required |

### Playtest Protocol

1. **Internal Playtest** (Developer)
   - All features working
   - No console errors
   - Performance acceptable

2. **Friend Playtest** (3-5 people)
   - Watch them play without guidance
   - Note confusion points
   - Gather feedback

3. **Public Beta** (GitHub Issue)
   - Create issue with "beta" label
   - Share preview URL
   - Collect feedback

---

## Phase 5: Deploy

### Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feat/game-slug

# 2. Develop and commit
git add .
git commit -m "feat(game-slug): add new puzzle game"

# 3. Push and create PR
git push origin feat/game-slug
gh pr create --title "feat(game-slug): Add Game Name puzzle"
```

### PR Requirements

All PRs must pass:
- ✅ Lint validation (no console.log in game files)
- ✅ Scaffold validation (all required files present)
- ✅ Level count validation (minimum 3 levels)
- ✅ Unit tests passing
- ✅ E2E tests passing
- ✅ Build succeeds
- ✅ Bundle size within budget (500KB JS, 100KB CSS)

### CI Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  lint:        # Validate code quality
  test-unit:   # Run Vitest unit tests
  test-e2e:    # Run Playwright E2E tests
  build:       # Build and check bundle size
```

### Deployment

On merge to `main`:
1. CI runs all checks
2. Build artifacts created
3. Deployed to Cloudflare Pages
4. Live at `https://mobile-gaming.pages.dev`

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `./scripts/new-game.sh "Name"` | Create game scaffold |
| `npm run dev` | Start dev server |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

### File Structure

```
mobile-gaming/
├── src/
│   ├── games/           # Individual games
│   │   └── <slug>/
│   │       ├── index.html
│   │       ├── main.js
│   │       ├── state.js
│   │       ├── renderer.js
│   │       ├── input.js
│   │       ├── styles.css
│   │       ├── levels.json
│   │       ├── generator.js
│   │       └── README.md
│   ├── shared/          # Shared modules
│   ├── styles/          # Global styles
│   └── index.html       # Homepage
├── tests/
│   ├── games/           # Game-specific tests
│   ├── shared/          # Shared module tests
│   └── e2e/             # E2E tests
├── docs/
│   └── templates/       # Evaluation and QA templates
├── scripts/
│   └── new-game.sh      # Scaffold generator
└── .github/
    ├── workflows/
    │   ├── ci.yml       # PR validation
    │   └── deploy.yml   # Production deploy
    └── PULL_REQUEST_TEMPLATE.md
```

### Acceptance Criteria Checklist

Before marking complete, verify:
- [ ] Evaluation template exists and is comprehensive
- [ ] Scaffold generator creates all required files
- [ ] All templates documented
- [ ] CI validates new games on PR
- [ ] PR checklist enforced

---

*Last Updated: 2025-03-05*
