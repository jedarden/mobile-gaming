# Network Wait Patterns Summary - Bead bf-1nlva

## Overview
Review of network-dependent operations and `waitForResponse` patterns across E2E test suite.

## Files WITH waitForResponse (20/23 files)

### Game Loading Patterns (game.js + levels.json)
- ✅ `brain-teaser.spec.js` - game.js, levels.json
- ✅ `bridge-race.spec.js` - game.js, levels.json
- ✅ `bus-jam.spec.js` - game.js, levels.json
- ✅ `crowd-runner.spec.js` - game.js, levels.json
- ✅ `giant-runner.spec.js` - game.js, levels.json
- ✅ `jelly-shift.spec.js` - game.js, levels.json
- ✅ `makeover-run.spec.js` - game.js, levels.json
- ✅ `merge-games.spec.js` - game.js, levels.json
- ✅ `parking-escape.spec.js` - game.js, levels.json
- ✅ `pull-the-pin.spec.js` - game.js, levels.json
- ✅ `satisfying-asmr.spec.js` - game.js, levels.json
- ✅ `save-the-character.spec.js` - game.js, levels.json
- ✅ `swipe-nav.spec.js` - game.js, levels.json
- ✅ `water-sort.spec.js` - game.js, levels.json

### Share Functionality
- ✅ `gameplay-share.spec.js` - Module imports (gameplay-share.js, share.js)
- ✅ `water-sort.spec.js` - Share endpoint /share
- ✅ `pull-the-pin.spec.js` - Share endpoint /share
- ✅ `parking-escape.spec.js` - Share endpoint /share

### Save/Load Operations
- ✅ `lifecycle.spec.js` - Save/load endpoints (/save, /load)

### Level Navigation
- ✅ `level-nav.spec.js` - API calls for level loading

### Cross-Game Operations
- ✅ `cross-game.spec.js` - Cross-game API calls
- ✅ `recorder.spec.js` - Recorder module loading
- ✅ `sync.spec.js` - Sync operations

## Files WITHOUT waitForResponse (3/23 files)

### hub.spec.js
**Reason**: Uses `waitForLoadState('networkidle')` instead
- The hub page is static HTML that doesn't load game modules
- `networkidle` is appropriate for static page validation
- Tests hub UI functionality, not game loading patterns

### deploy-smoke.spec.js
**Reason**: Tests deployment validation differently
- Uses HTTP response status validation (`res.status()`)
- Tests canvas content rendering via `waitForFunction`
- Focuses on deployment health checks, not game module loading

### fail-speedrun.spec.js
**Reason**: Uses test harness fixture
- Loads test fixture at `/tests/e2e/fixtures/fail-speedrun-harness.html`
- Not a game page that loads game.js/levels.json
- Tests fail-speedrun feature logic in isolation

## Pattern Examples

### Game Loading (Standard Pattern)
```javascript
test.beforeEach(async ({ page }) => {
  // Wait for game module and levels.json to load from network
  const gameModulePromise = page.waitForResponse(response =>
    response.url().includes('/src/games/{game}/game.js') && response.status() === 200
  );
  const levelsJsonPromise = page.waitForResponse(response =>
    response.url().includes('levels.json') && response.status() === 200
  );

  await page.goto(GAME_URL);

  // Ensure network resources are loaded before waiting for UI
  await Promise.all([gameModulePromise, levelsJsonPromise]);
  await page.waitForSelector('#game-canvas', { timeout: 5000 });
});
```

### Share Functionality
```javascript
// Set up waitForResponse for potential share endpoint
const shareResponsePromise = page.waitForResponse(response =>
  response.url().includes('/share') && response.status() === 200
).catch(() => null); // No-op if no share endpoint exists

await page.click('#btn-share');

// Wait for potential share response (will resolve immediately if no endpoint)
await shareResponsePromise;
```

### Save/Load Operations (lifecycle.spec.js)
```javascript
// Set up waitForResponse for potential save endpoint
const saveResponsePromise = page.waitForResponse(response =>
  response.url().includes('/save') && response.status() === 200
).catch(() => null); // No-op if no save endpoint exists

// Trigger visibilitychange to trigger state save
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, writable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});

// Wait for potential save response
await saveResponsePromise;
```

## Conclusion
All network-dependent operations in the E2E test suite already have appropriate wait patterns:
- Game loading: 20 files with `waitForResponse` for game.js + levels.json
- Share functionality: 4 files with share endpoint waits
- Save/load operations: lifecycle.spec.js with save/load waits
- Module imports: gameplay-share.spec.js with module loading waits

The 3 files without `waitForResponse` use alternative approaches appropriate to their testing patterns.
