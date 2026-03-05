## Description

<!-- Brief description of changes in this PR -->

## Type of Change

- [ ] 🎮 **New Game** - Adding a new game to the platform
- [ ] ✨ **Feature** - New feature for existing game or platform
- [ ] 🐛 **Bug Fix** - Fixing a bug
- [ ] 🎨 **Polish** - Visual improvements, animations, UX
- [ ] ♻️ **Refactor** - Code cleanup without functional changes
- [ ] 📝 **Documentation** - Documentation updates
- [ ] 🔧 **Infrastructure** - Build, CI/CD, tooling changes

---

## New Game Checklist

<!-- Complete this section if adding a new game. Skip otherwise. -->

### Scaffold Files (Required)

- [ ] `index.html` - Game page with proper meta tags
- [ ] `main.js` - Entry point and game orchestration
- [ ] `state.js` - State management with `createInitialState`, `cloneState`, `checkWin`
- [ ] `renderer.js` - Canvas rendering with `resize`, `render`, `screenToGame`
- [ ] `input.js` - Input handling for mouse, touch, keyboard
- [ ] `styles.css` - Game-specific styles
- [ ] `levels.json` - At least 20 levels with difficulty progression
- [ ] `generator.js` - Procedural level generation with `generateLevel`, `validateLevel`
- [ ] `README.md` - Game documentation

### Implementation

- [ ] Core mechanic implemented and working
- [ ] Win condition correctly detected
- [ ] Undo/redo functionality works
- [ ] Hint system provides helpful guidance
- [ ] Level navigation works (prev/next)
- [ ] Settings modal functional (sound, haptic, reduced motion)
- [ ] Progress saves to localStorage
- [ ] Daily challenge mode works

### Testing

- [ ] Unit tests for state management (`tests/games/<slug>/state.test.js`)
- [ ] E2E tests for core gameplay flow
- [ ] Tested on mobile viewport (375x667)
- [ ] Tested on tablet viewport (768x1024)
- [ ] Tested on desktop viewport (1920x1080)

### Quality Assurance

- [ ] [QA Checklist](docs/templates/qa-checklist.md) completed
- [ ] No console errors in browser
- [ ] No performance issues (60fps maintained)
- [ ] Touch controls responsive (< 100ms)
- [ ] Visual feedback on all interactions

### Documentation

- [ ] Game added to main README game list
- [ ] README.md in game folder describes mechanics
- [ ] Level format documented

---

## Feature/Bug Fix Checklist

<!-- Complete this section if not adding a new game -->

- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] No new warnings introduced
- [ ] Tests added/updated for changes
- [ ] All tests passing locally

---

## Testing

### Manual Testing Performed

<!-- List what you tested manually -->

- [ ] 
- [ ] 
- [ ] 

### Test Results

```bash
# Run these commands to verify
npm test           # Unit tests
npm run test:e2e   # E2E tests
npm run build      # Production build
```

---

## Screenshots/Videos

<!-- Add screenshots or screen recordings for visual changes -->

| Before | After |
|--------|-------|
|        |       |

---

## Related Issues

<!-- Link any related issues -->

Closes #

---

## Checklist for Reviewers

- [ ] Code quality and maintainability
- [ ] Performance implications
- [ ] Security considerations
- [ ] Accessibility (a11y) compliance
- [ ] Mobile-first responsive design
- [ ] Progressive enhancement

---

🤖 Generated with [Claude Code](https://claude.ai/code)
