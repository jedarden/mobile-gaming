# EPIC: Game Pipeline Infrastructure

## Strategic Context

The game pipeline is the operational framework for continuously expanding the game library. Without systematic processes, adding new games becomes ad-hoc and quality inconsistent.

## Why This Matters

1. **Scalability:** Add games without reinventing process each time
2. **Quality Consistency:** Same standards for every game
3. **Contributor Friendly:** External contributors can follow process
4. **Time Savings:** Templates and automation reduce overhead
5. **Maintainability:** Standardized code is easier to maintain

## Pipeline Phases

```
DISCOVER ──> BUILD ──> TEST ──> DEPLOY

Find games    Scaffold &    QA, perf,    PR, review,
worth making  implement     playtest     release
```

## Phase 1: Discovery

### Source Channels

**Primary:**
- App Store / Play Store ads (fake gameplay clips)
- TikTok/Reels (viral puzzle game clips)
- Reddit r/mobilegaming, r/puzzles
- Itch.io game jams

**Secondary:**
- Player requests (GitHub issues)
- Direct competitor analysis
- Classic puzzle game adaptations

### Evaluation Criteria

Each potential game gets scored on:
- Technical feasibility (client-side only, no backend)
- Gameplay appeal (satisfying, clear, depth)
- Mobile-friendliness (touch controls, portrait)
- Shareability (GIF-worthy solutions)

### Prototyping Gate

Before full implementation, 1-2 day "fun validation":
- Core mechanic only
- 3 playable levels
- Basic touch controls
- Answer: "Is this fun?" Yes/No

## Phase 2: Build

### Scaffold Generator

`scripts/new-game.sh` creates standardized structure:
- index.html (game page)
- main.js (entry point)
- game.js (core logic)
- renderer.js (canvas rendering)
- input.js (touch/mouse handling)
- styles.css (game-specific)
- levels.json (level data)
- generator.js (procedural generation)
- assets/ (sprites, audio)

### Code Patterns

All games follow consistent patterns:
- State immutability (structuredClone)
- Event-driven input
- Animation queue system
- Shared color palette

## Phase 3: Test

### Test Suites

**Unit Tests (Vitest):**
- Game logic validation
- Generator determinism
- Solvability verification

**E2E Tests (Playwright):**
- Level completion flows
- Touch control verification
- Mobile viewport testing

### QA Checklist

44-item manual testing checklist covering:
- Core gameplay
- Controls
- History system
- Progression
- Visual polish
- Audio
- Responsive design
- Performance
- Edge cases

### Playtest Protocol

1. Internal playtest (developer)
2. Friend playtest (3-5 people)
3. Public beta (GitHub issue)

## Phase 4: Deploy

### CI/CD Pipeline

- Tests run on PR
- Preview deploy for PRs
- Production deploy on merge to main
- Bundle size budgets enforced

### PR Checklist

Required for new game PRs:
- All scaffold files present
- 20+ levels
- Unit tests passing
- E2E tests passing
- QA checklist completed
- Bundle under budget

### Release Process

1. Feature branch (feat/game-slug)
2. PR with checklist
3. Review
4. Merge to main
5. Auto-deploy
6. Social announcement

## Dependencies

**Requires:**
- Foundation complete

**Enables:**
- All future game additions
- Contributor onboarding

## Acceptance Criteria

- [ ] Evaluation template exists
- [ ] Scaffold generator works
- [ ] All templates documented
- [ ] CI validates new games
- [ ] PR checklist enforced

## Estimated Effort

**Total:** 10-15 hours (infrastructure setup)
**Complexity:** Low-Medium
**Priority:** P2 (Enables scaling)
