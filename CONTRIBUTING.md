# Contributing to Mobile Gaming

Thank you for your interest in contributing! This guide will help you get started.

## Ways to Contribute

### 🎮 Add a New Game

The best way to contribute is by adding a new puzzle game!

1. **Evaluate Your Idea** - Use our [Game Evaluation Template](docs/templates/game-evaluation.md)
2. **Create an Issue** - Use the [New Game Request](.github/ISSUE_TEMPLATE/new-game-request.yml) template
3. **Wait for Approval** - We'll review and prioritize
4. **Build It** - Follow the [Game Pipeline](docs/GAME_PIPELINE.md)
5. **Submit a PR** - Use the [PR Template](.github/PULL_REQUEST_TEMPLATE.md)

### 🐛 Report Bugs

Found a bug? [Open a bug report](.github/ISSUE_TEMPLATE/bug-report.yml).

### 💡 Suggest Features

Have an idea for improving an existing game? Open an issue with the "enhancement" label.

### 📝 Improve Documentation

Documentation improvements are always welcome!

## Development Setup

### Prerequisites

- Node.js 20+
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/anthropics/mobile-gaming.git
cd mobile-gaming

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |

## Adding a New Game

### Quick Start

```bash
# Generate scaffold
./scripts/new-game.sh "My Game"

# Start developing
cd src/games/my-game
# Edit files...

# Test locally
npm run dev
# Open http://localhost:5173/src/games/my-game/
```

### Required Files

Every game must have these files:

| File | Purpose |
|------|---------|
| `index.html` | Game page with proper meta tags |
| `main.js` | Entry point and orchestration |
| `state.js` | State management, win conditions |
| `renderer.js` | Canvas rendering |
| `input.js` | Input handling |
| `styles.css` | Game-specific styles |
| `levels.json` | Level data (20+ levels) |
| `generator.js` | Procedural generation |
| `README.md` | Documentation |

### Implementation Checklist

- [ ] Core mechanic works
- [ ] Win condition detected
- [ ] Undo/redo functional
- [ ] Hint system implemented
- [ ] Level navigation works
- [ ] Settings modal works
- [ ] Progress saves correctly
- [ ] Daily challenge works
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] QA checklist complete

### Shared Modules

Use shared modules from `src/shared/`:

```javascript
import { initStorage, getGameStats } from '../../shared/storage.js';
import { createRNG } from '../../shared/rng.js';
import { announce } from '../../shared/accessibility.js';
import { COLORS } from '../../shared/colors.js';
```

## Code Style

### JavaScript

- Use ES modules (import/export)
- Prefer `const` over `let`
- Use descriptive variable names
- Add JSDoc comments for public functions
- Handle errors gracefully

### Example

```javascript
/**
 * Check if the game is won
 * @param {GameState} state - Current game state
 * @returns {boolean} True if win condition met
 */
export function checkWin(state) {
  return state.tubes.every(tube => 
    tube.colors.length === 0 || 
    new Set(tube.colors).size === 1
  );
}
```

## Testing

### Unit Tests

Place tests in `tests/games/<slug>/`:

```javascript
import { describe, it, expect } from 'vitest';
import { checkWin } from '../../../src/games/my-game/state.js';

describe('checkWin', () => {
  it('returns true when all tubes are sorted', () => {
    const state = { tubes: [{ colors: ['red', 'red'] }] };
    expect(checkWin(state)).toBe(true);
  });
});
```

### E2E Tests

Place in `tests/e2e/`:

```javascript
import { test, expect } from '@playwright/test';

test('completes level', async ({ page }) => {
  await page.goto('/src/games/my-game/');
  // ... test interactions
});
```

## Pull Request Process

1. **Create Branch** - `feat/game-slug` or `fix/issue-description`
2. **Make Changes** - Follow code style and patterns
3. **Run Tests** - Ensure all tests pass
4. **Create PR** - Fill out the PR template
5. **Address Feedback** - Respond to review comments
6. **Merge** - After approval and CI passes

### PR Requirements

- All CI checks pass
- PR template completed
- No merge conflicts
- At least one approval (for non-trivial changes)

## Questions?

- Check the [Game Pipeline Documentation](docs/GAME_PIPELINE.md)
- Open an issue for discussion
- Review existing games as examples

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎮
