# Implementation Plan

## Objective

Build playable web-based versions of the 12 hyper-casual game types documented in `docs/research/`. Each game is deployed as its own standalone static site. A hub page links to all games but each game is fully self-contained — playable at its own URL with zero dependency on the hub or other games. Every game includes automated playtesting that proves levels are completable and core mechanics function correctly.

---

## Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| Runtime | Browser (HTML5) | Zero-install; works on mobile and desktop; matches hyper-casual distribution model |
| 2D rendering | Canvas 2D API → Phaser 3 (v3.90.0) | Currently raw Canvas 2D; migrating to Phaser game framework for WebGL rendering with Canvas fallback, built-in scene management, tweens, particles, and input. See `docs/research/phaser-evaluation.md` for trade-off analysis |
| 3D rendering | Three.js | Required for Crowd Runner, Giant Runner, Bridge Race, Jelly Shift, Makeover Run, and Merge Games |
| Physics (2D) | Custom per-game → Phaser Arcade Physics / Matter.js | Currently hand-rolled per game; Phaser bundles Arcade (AABB collisions) and Matter.js (rigid-body constraints for Pull the Pin). Determinism maintained via fixed timestep and seeded RNG |
| Physics (3D) | Cannon-es (Cannon.js ES fork) | Lightweight rigid-body + soft-body for Jelly Shift's blob deformation |
| Build | Vite | Fast HMR; native ES module support; trivial multi-page setup |
| Hosting | Cloudflare Pages | Static hosting at `mobile-gaming.pages.dev`; each game is a subpath (`/water-sort/`, `/pull-the-pin/`, etc.) |
| CI/CD | Argo Events + Argo Workflows | GitHub webhook → `webhooks-build.ardenone.com/mobile-gaming` → `website-build` WorkflowTemplate → `wrangler pages deploy` |
| Test runner | Vitest | Unit and integration tests for game logic and solvers |
| E2E testing | Playwright | Browser-based playtest automation; screenshot comparison for visual validation |
| Level format | JSON | Each game defines its own level schema; validated by JSON Schema |

### Vite Configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Auto-discover game entry points — adding a new game means adding a directory, not editing config
const gameEntries = Object.fromEntries(
  readdirSync('src/games', { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => [d.name, resolve(__dirname, `src/games/${d.name}/index.html`)])
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'src/hub/index.html'),
        ...gameEntries   // auto-discovers all games
      }
    }
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'   // solvers are pure functions, no DOM needed
  }
});
```

Games are auto-discovered by globbing `src/games/*/index.html`. Adding a new game requires only creating its directory — no config file changes.

### Dependencies

```json
{
  "name": "mobile-gaming",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:levels": "node scripts/validate-levels.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "phaser": "^3.90.0",
    "three": "^0.170.0",
    "cannon-es": "^0.20.0",
    "pako": "^2.1.0",
    "mp4-muxer": "^5.0.0",
    "qrcode-generator": "^1.4.4"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@playwright/test": "^1.49.0",
    "eslint": "^9.0.0",
    "sharp": "^0.33.0"
  }
}
```

Production dependencies: Phaser (2D games — WebGL/Canvas renderer, scene management, physics, tweens, particles, input, audio), Three.js (3D games only, tree-shaken per entry point), cannon-es (Jelly Shift only), pako (state URL compression). `mp4-muxer` and `qrcode-generator` are production dependencies but both are dynamically imported — Vite code-splits them into separate chunks that are only loaded when the user records a video or shares a QR link. They add zero bytes to the initial page load. `sharp` is dev-only — it runs in `scripts/generate-icons.js` during CI builds, never in the browser.

**Phaser build optimization:** Phaser 3 is monolithic (~310 KB gzipped) and does not tree-shake effectively. To control bundle size, use the Phaser Compressor to strip unused subsystems per game entry point. Games that don't need physics (Brain Teaser, Save the Character) can use a custom build excluding both Arcade and Matter.js (~125-185 KB gzipped). Phaser is only bundled into 2D game entry points — 3D games import Three.js only.

**`.gitignore`:**
```
node_modules/
dist/
*.local
.env
.env.*
.DS_Store
public/icons/icon-*.png
public/og/*.png
```

The generated PNG icons and OG images are in `.gitignore` because they're produced by build scripts. Exception: OG images generated by Playwright screenshot tests are committed manually after review (removed from `.gitignore` via `git add -f`) so they're available at deploy time without Playwright in CI.

---

## Project Structure

```
mobile-gaming/
├── docs/
│   ├── research/           # existing game-type research
│   └── implementation/     # this plan + per-game specs as needed
├── src/
│   ├── hub/                # hub page linking to all games (also a static site)
│   │   ├── index.html      # landing page / game selector with links to each game's URL
│   │   ├── hub.js          # game card rendering, filtering, link generation
│   │   └── styles.css      # hub-specific styles
│   ├── shared/             # cross-game utilities (tree-shaken into each game's bundle)
│   │   ├── canvas.js       # Canvas 2D helper: setup, resize, DPR scaling (→ replaced by Phaser Scale Manager for 2D games)
│   │   ├── three-setup.js  # Three.js scene/camera/renderer bootstrap (3D games only — unchanged)
│   │   ├── input.js        # unified touch/mouse input (tap, drag, swipe) — reusable, wire to Phaser pointer events
│   │   ├── audio.js        # Web Audio API: SFX triggering, gain control — reusable as-is
│   │   ├── colors.js       # shared 10-color accessible palette — reusable as-is
│   │   ├── color-blind.js  # color-blind accessibility patterns and labels — reusable as-is
│   │   ├── shapes.js       # Canvas 2D drawing primitives (→ rewrite to Phaser Graphics API)
│   │   ├── particles.js    # reusable particle system (→ replace rendering with Phaser ParticleEmitter)
│   │   ├── screen-shake.js # shake offset calculation — pure math, apply to Phaser camera
│   │   ├── score.js        # shared scoring + level-complete overlay
│   │   ├── rng.js          # seeded PRNG (Mulberry32) for deterministic level gen — reusable as-is
│   │   ├── storage.js      # namespaced localStorage manager with migrations — reusable as-is
│   │   ├── lifecycle.js    # game loading, pause/resume, error boundary
│   │   ├── level-nav.js    # level select strip and progression
│   │   ├── retry.js        # win/loss/stuck overlay and retry flow
│   │   ├── settings.js     # settings drawer UI and persistence
│   │   ├── viewport.js     # responsive canvas sizing (→ replaced by Phaser Scale Manager for 2D games)
│   │   ├── capabilities.js # browser feature detection matrix
│   │   ├── migrations.js   # schema version migration pipeline
│   │   ├── accessibility.js# a11y announcements — reusable as-is
│   │   ├── adaptive.js     # frustration-aware adaptive difficulty — reusable as-is
│   │   ├── analytics.js    # client-side gameplay telemetry — reusable as-is
│   │   ├── daily.js        # daily seeded challenge — reusable as-is
│   │   ├── endless.js      # endless procedural mode — reusable as-is
│   │   ├── fail-speedrun.js# fail speedrun mode — reusable as-is
│   │   ├── haptics.js      # Vibration API feedback — reusable as-is
│   │   ├── hints.js        # solver-powered hint system — reusable as-is
│   │   ├── hint-worker.js  # Web Worker for non-blocking solver hints — reusable as-is
│   │   ├── history.js      # undo/redo history — reusable as-is
│   │   ├── meta.js         # OG meta tag generation — reusable as-is
│   │   ├── quick-play.js   # zero-friction game selection — reusable as-is
│   │   ├── recorder.js     # video recording via MediaRecorder — reusable as-is
│   │   ├── replay.js       # deterministic replay sharing — reusable as-is
│   │   ├── share.js        # social sharing integration — reusable as-is
│   │   ├── state-url.js    # state compression for shareable URLs — reusable as-is
│   │   ├── swipe-nav.js    # swipe navigation between games — reusable as-is
│   │   ├── sync.js         # cross-device progress sync — reusable as-is
│   │   ├── video-overlay.js# video share card overlay — reusable as-is
│   │   └── ad-compositor.js# ad-style video template compositor — reusable as-is
│   └── games/
│       ├── pull-the-pin/
│       ├── water-sort/
│       ├── crowd-runner/
│       ├── save-the-character/
│       ├── brain-teaser/
│       ├── merge/
│       ├── parking-escape/
│       ├── satisfying/
│       ├── bridge-race/
│       ├── giant-runner/
│       ├── jelly-shift/
│       └── makeover-run/
├── tests/
│   ├── solvers/            # algorithmic solvers that prove levels are completable
│   ├── unit/               # per-game state machine and logic tests
│   ├── e2e/                # Playwright browser tests
│   └── helpers/            # shared test utilities (state builders, assertions)
├── levels/                 # JSON level definitions, one subdir per game
├── package.json
├── vite.config.js
├── vitest.config.js
└── playwright.config.js
```

### Per-Game Directory Structure (Template)

Each game under `src/games/<name>/` is a **self-contained static site**. After build, each game's output directory contains everything needed to serve it independently — no external runtime dependencies, no reliance on the hub or other games.

```
<name>/
├── index.html          # game entry point — works standalone; includes meta tags, OG tags, favicon
├── game.js             # lifecycle: init, update loop, teardown
├── state.js            # pure-function game state (no rendering, no DOM)
├── renderer.js         # Canvas 2D or Three.js rendering (2D games → rewrite to Phaser Scene)
├── input.js            # game-specific input mapping (calls shared/input.js)
├── levels.json         # hand-crafted levels (or generated via gen script)
├── generator.js        # procedural level generation (if applicable)
└── styles.css          # game-specific CSS
```

**Current state (2D games):** `renderer.js` draws to a Canvas 2D context, reading from `state.js`. Each renderer contains both Canvas API draw calls (to be rewritten) and reusable layout math / hit-testing functions (to be extracted and kept).

**Phaser migration target (2D games):** `renderer.js` becomes a Phaser Scene class whose `update()` reads from `state.js` and updates Phaser game objects (Graphics, Sprites, Tweens, Particles). The file name stays `renderer.js` — the contract is the same, only the rendering backend changes. Reusable layout/positioning functions (e.g., `getTubePosition()`, `hitTestVehicle()`) are preserved. `game.js` is refactored to use Phaser's game loop instead of manual `requestAnimationFrame`, keeping its state machine logic (level loading, move dispatch, undo, win check) intact.

**3D games:** `renderer.js` uses Three.js for the 3D scene graph, camera, and materials. Three.js games are not affected by the Phaser migration — they import `shared/input.js` and `shared/audio.js` directly.

The critical architectural rule: **`state.js` must never import rendering or DOM code.** All game logic lives in pure functions that accept a state object and an action, and return a new state. This makes the game logic directly testable by solvers without a browser. Renderers (whether Canvas 2D, Phaser, or Three.js) read state; they never write it.

---

## Implementation Phases

### Phase 0: Scaffolding

Build the shared infrastructure before any individual game.

**Deliverables:**
- Vite config with auto-discovered multi-page entry points (see Vite Configuration above)
- Hub page (`src/hub/`): landing page listing all implemented games as cards, Quick Play button, daily challenge banner. Ships with each new game — the hub dynamically lists whatever games exist at build time.
- `.gitignore` for `node_modules/`, `dist/`, generated icons/OG images (see Dependencies section)
- `shared/canvas.js`: Canvas element creation, DPR-aware resize, requestAnimationFrame loop wrapper. **Phaser migration:** replaced by Phaser's game loop and Scale Manager for 2D games; retained for 3D games via `shared/three-setup.js`.
- `shared/three-setup.js`: Scene + PerspectiveCamera + WebGLRenderer bootstrap, resize handler, RAF loop. **Phaser migration:** unchanged — 3D games continue using Three.js directly.
- `shared/input.js`: Unified pointer events — normalizes `touchstart`/`mousedown`, `touchmove`/`mousemove`, `touchend`/`mouseup` into `{ type, x, y, dx, dy }` streams; exposes `onTap`, `onDrag`, `onSwipe` with configurable thresholds. **Phaser migration:** reusable as-is; 2D games wire Phaser pointer events through this same API.
- `shared/audio.js`: `playSound(name, volume)` using Web Audio API; sounds defined as short oscillator patterns (no audio file dependencies). **Phaser migration:** reusable as-is — Phaser can wrap Web Audio, but the existing synthesis code is renderer-agnostic.
- `shared/colors.js`: 10-color palette designed for color-blind accessibility (derived from Okabe-Ito); each color has `hex`, `name`, `darkVariant`, `lightVariant`
- `shared/rng.js`: Mulberry32 seeded PRNG — `createRng(seed)` returns `{ next(), nextInt(min, max), shuffle(arr), pick(arr) }`
- `shared/storage.js`: Namespaced localStorage manager (see localStorage Schema below)
- `shared/lifecycle.js`: Game lifecycle — loading, pause/resume, error boundary (see below). **Phaser migration:** 2D games call `scene.scene.pause()`/`scene.scene.resume()` instead of freezing the RAF loop manually.
- `shared/level-nav.js`: Level select strip and progression (see below)
- `shared/settings.js`: Settings drawer UI and persistence (see below)
- `shared/viewport.js`: Responsive canvas sizing (see below)
- Vitest config, Playwright config, test helper stubs
- JSON Schema files for level validation
- `public/_redirects` and `public/_headers` for Cloudflare Pages (see Deployment)

#### Responsive Canvas Sizing (`shared/viewport.js`)

All games render at a fixed logical resolution and CSS-scale to fill the viewport. No per-game responsive layout logic.

- **Logical resolution:** 390×844 logical pixels (portrait, matches iPhone 14 — the most common mobile viewport)
- **Canvas creation:** `canvas.width = 390 * dpr; canvas.height = 844 * dpr; canvas.style.width = '390px'; canvas.style.height = '844px'`
- **CSS scaling:** The canvas sits inside a flex container with `object-fit: contain`. The container fills the viewport. The canvas scales up or down uniformly with letterboxing on non-matching aspect ratios.
- **Landscape games:** Runner games (Crowd Runner, Giant Runner, Bridge Race, Jelly Shift, Makeover Run) use 844×390 (landscape logical) — same approach, rotated
- **DPR handling:** `window.devicePixelRatio` multiplied into canvas dimensions for crisp rendering; all game coordinates use logical pixels (390×844), never physical
- **Resize handler:** `ResizeObserver` on the container recalculates scale on orientation change or window resize. No game logic changes — only the CSS transform updates.

**Phaser migration:** For 2D games, `shared/viewport.js` is replaced by Phaser's built-in Scale Manager:
```js
scale: {
  mode: Phaser.Scale.FIT,         // uniform scale with letterboxing
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 390,                      // logical width (portrait)
  height: 844,                     // logical height (matches iPhone 14)
  parent: 'game-container'
}
```
Phaser handles DPR-aware rendering, resize, and orientation change automatically. 3D games continue using `shared/viewport.js` and manual `ResizeObserver`.

#### Game Lifecycle (`shared/lifecycle.js`)

Every game follows the same lifecycle. The lifecycle manager handles loading states, pause/resume, and error recovery.

**Loading:**
- Each game's `index.html` contains an inline `<style>` block and a static loading shell (game name + CSS spinner) — renders in < 50ms with zero JS
- The game's JS bundle loads via `<script type="module" async>`
- On load, the module calls `lifecycle.ready()` which crossfades from the spinner to the game canvas over 200ms
- If the bundle fails to load (network error), the spinner is replaced with "Couldn't load — tap to retry" with a retry button that reloads the module

**Pause/Resume:**
```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lifecycle.pause();
  else lifecycle.showResumeOverlay();
});
```
- `lifecycle.pause()`: saves current state to localStorage via `storage.save(gameId, state)`, freezes the RAF loop, suspends Web Audio context. **Phaser migration:** 2D games call `scene.scene.pause()` instead of manual RAF freeze.
- Resume: shows a semi-transparent "Tap to continue" overlay; tap calls `lifecycle.resume()` which restarts RAF and resumes audio
- For untimed puzzle games (Water Sort, Parking Escape, Brain Teaser, Merge): no overlay on resume — state is persistent, player picks up where they left off
- For timed/real-time games (runners, Jelly Shift): overlay is mandatory — resuming mid-run without the overlay would cause disorientation

**Error boundary:**
- `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')` catch fatal errors
- On error: freeze game, show "Something went wrong — tap to restart level" overlay
- Error details logged to `console.error` with the serialized game state for debugging

#### Game-Over and Retry Flow (`shared/retry.js`)

Universal retry overlay that slides up from the bottom on win or loss.

**On win:**
- Overlay shows: level-complete animation, stats (moves, time, optimality %), "Next Level" button (primary), "Replay" button (secondary), "Share" button
- "Next Level" auto-advances to the next level in the progression

**On loss:**
- Overlay shows: "Retry" button (primary, restarts same level), "Hint then Retry" button (shows first solver hint, then restarts — combines Phase 6.2 hints with retry), "Skip" button (unlocks after 3 failures on the same level — advances without completion credit)
- For runner games: adds "Watch Replay" button showing the last 5 seconds in slow motion before the fail point

**On stuck (puzzle games):**
- If `isStuck(state)` returns true (no valid moves, not won): auto-show the loss overlay without waiting for the player to notice
- "Undo to last good state" button: reverts to the most recent state that had ≥ 2 valid moves

#### Level Select and Progression (`shared/level-nav.js`)

Horizontal scrollable strip at the bottom of the game screen — always visible, no separate screen.

- **Layout:** Row of 30px circular dots, one per level, horizontally scrollable. Fits ~8 levels on screen; finger-scroll to see more.
- **States:** Completed (filled circle with checkmark), current (pulsing ring), locked (dimmed outline), skipped (open circle with dash)
- **Unlock rule:** Linear — complete level N to unlock N+1. Skipped levels (via the retry "Skip" button) are marked but don't block progression.
- **Tap behavior:** Tap any unlocked level → load it. Tap current level → restart.
- **Endless mode indicator:** After the last hand-crafted level, an "∞" symbol with a right arrow indicates endless mode is available.
- **Daily challenge:** A star-shaped indicator at the left end of the strip links to today's daily challenge. Gold if uncompleted, green if completed.
- **Persistence:** Current level index stored in localStorage per game. On load, strip scrolls to show the current level centered.

#### Settings Drawer (`shared/settings.js`)

Gear icon in the top-right of every game and the hub. Tap opens a slide-out drawer from the right edge.

- **Settings list (toggle switches):**
  - Sound (on/off) — default on
  - Haptic feedback (on/off) — default on; hidden on devices without Vibration API
  - Color-blind mode (on/off) — default off; enables pattern overlays
  - Dark mode (on/off) — default follows `prefers-color-scheme`
  - Reduced motion (on/off) — default follows `prefers-reduced-motion`
- **Actions:**
  - "Sync Progress" → opens sync code export/import (Phase 7.1)
  - "About" → version number, link to GitHub repo, credits
- **Persistence:** All settings saved to `mg:global:settings` in localStorage
- **Drawer behavior:** 280px wide, slides in/out with 200ms ease, tap outside or swipe right to dismiss. Game pauses while drawer is open.
- **Developer mode:** Triple-tap the version number in "About" to reveal: adaptive difficulty tier display, localStorage inspector, capability matrix

#### localStorage Schema (`shared/storage.js`)

All localStorage access goes through a `StorageManager` that handles namespacing, serialization, quota management, and versioning.

**Key namespace convention:**
```
mg:global:settings          → { sound, haptic, colorBlind, darkMode, reducedMotion }
mg:global:sync              → { lastExport, lastImport }
mg:global:daily             → { [date]: { [gameId]: { completed, moves, time } } }
mg:global:quickplay         → { history: [{ gameId, timestamp, ... }] }
mg:global:journal           → { unlockedEntries: ["reactance", "curiosity-gap", ...] }
mg:[gameId]:progress        → { currentLevel, completedLevels: [id], bestScores: {[id]: score} }
mg:[gameId]:adaptive        → { difficultyTier, ema, signalHistory: [...] }
mg:[gameId]:state            → { ...serialized current game state for pause/resume }
mg:[gameId]:replays          → { [levelId]: { inputs, seed } }  (capped at 5 per game)
mg:[gameId]:endless          → { personalBest, lastSessionSeed }
```

**Schema version:** Every stored value is wrapped: `{ v: 1, data: ... }`. On read, if `v` doesn't match the current schema version, the migration pipeline runs.

**Quota management:**
- Total budget: 4MB (well within the 5-10MB localStorage limit on all browsers)
- On `QuotaExceededError`: evict in priority order — replays (oldest first) → endless scores → per-level best scores → adaptive signal history. Never evict: settings, progress (completed levels), current state.
- `storage.getUsage()` → returns bytes used; the developer mode dashboard shows this.

**Migration pipeline (`shared/migrations.js`):**
```js
const migrations = [
  { from: 1, to: 2, migrate: (data) => { /* transform */ return data; } },
  { from: 2, to: 3, migrate: (data) => { ... } },
];
```
- On every `storage.read(key)`, the wrapper checks `v` against `CURRENT_VERSION`
- If stale, runs migrations sequentially: v1→v2→v3→...→current
- Migrations are pure functions: `(oldData) → newData`
- If migration fails (corrupt data), falls back to defaults and logs warning
- Schema version is bumped in a single constant — all storage reads auto-migrate

**Feature detection (`shared/capabilities.js`):**

On first load, probe browser capabilities and cache the result:
```js
const caps = {
  canvas2d:       !!document.createElement('canvas').getContext('2d'),
  webgl:          !!document.createElement('canvas').getContext('webgl2'),
  mediaRecorder:  typeof MediaRecorder !== 'undefined',
  webWorker:      typeof Worker !== 'undefined',
  localStorage:   (() => { try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); return true; } catch(e) { return false; } })(),
  vibration:      'vibrate' in navigator,
  shareApi:       'share' in navigator,
  videoEncoder:   typeof VideoEncoder !== 'undefined',
  webAudio:       typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
};
```

**Per-game requirements:**

| Game Category | Required | Optional (graceful degrade) |
|---|---|---|
| 2D puzzle games | `canvas2d`, `localStorage` | `webAudio` (silent if missing), `vibration`. **Phaser migration:** `webgl` preferred (Phaser `AUTO` mode falls back to Canvas 2D) |
| 3D runner games | `canvas2d`, `webgl`, `localStorage` | `webAudio`, `vibration` |
| Video recording | `mediaRecorder` | `videoEncoder` (WebM fallback if missing) |
| Hints | `webWorker` | runs on main thread if missing (may stutter on complex solves) |

If a required capability is missing, the game shows a static message: "This game requires [WebGL / a modern browser]. Try Chrome, Firefox, or Safari." instead of crashing. **Phaser migration:** Phaser auto-detects rendering capability when configured with `Phaser.AUTO` — it uses WebGL if available, falls back to Canvas 2D otherwise.

**Automated test coverage for Phase 0:**
- Unit test: RNG produces identical sequences for identical seeds
- Unit test: input normalization returns consistent events for touch and mouse
- Unit test: color palette has 10 distinct colors, all pass WCAG AA contrast against white and black
- Unit test: `StorageManager` namespaces keys correctly, respects quota, runs migrations
- Unit test: capability detection returns correct booleans in test environment
- E2E test: hub loads, lists all game links, each link navigates to the correct game
- E2E test: game loading shell renders spinner → transitions to game canvas
- E2E test: visibility change pauses game, tap resumes

---

### Phase 1: 2D Puzzle Games

The four pure-puzzle games. Currently rendered with raw Canvas 2D; migrating to Phaser 3 game framework for WebGL rendering, built-in tweens, particles, and input handling. Each game's `renderer.js` will be rewritten to use Phaser game objects while `state.js`, `generator.js`, and solver tests remain unchanged.

---

#### 1.1 Pull the Pin

**State model:**
```
{
  pins: [{ id, x, y, removed: bool }],
  balls: [{ id, x, y, vx, vy, color, settled: bool }],
  cups: [{ id, x, y, width, acceptColor }],
  channels: [{ segments: [{x1,y1,x2,y2}], blockedByPin: pinId | null }],
  gravity: 0.3,
  status: "playing" | "won" | "lost"
}
```

**Level format (JSON):**
```json
{
  "id": "ptp-001",
  "pins": [{ "id": "p1", "x": 150, "y": 200 }, ...],
  "balls": [{ "id": "b1", "x": 100, "y": 50, "color": "red" }, ...],
  "cups": [{ "id": "c1", "x": 80, "y": 450, "width": 60, "acceptColor": "red" }, ...],
  "channels": [
    { "segments": [[100,100,100,200],[100,200,80,300]], "blockedByPin": "p1" }
  ]
}
```

**Core logic (`state.js`):**
1. `removePin(state, pinId)` → returns new state with pin marked removed; unblocks associated channels
2. `simulateStep(state)` → advances all unsettled balls by one physics tick:
   - Apply gravity to `vy`
   - Move ball by `(vx, vy)`
   - Collide against channel walls (reflect with damping)
   - If ball enters a cup's capture zone and cup is not full: settle ball, mark ball as settled
   - If ball exits the play area without reaching a cup: mark lost
3. `checkWin(state)` → all balls settled in correct cups → `"won"`; any ball in wrong cup or out of bounds → `"lost"`; otherwise `"playing"`
4. `simulateToCompletion(state)` → run `simulateStep` in a loop (max 2000 ticks) until all balls are settled or lost. Returns final state.

**Physics requirements:**
- Deterministic: same pin-removal order must always produce the same ball trajectories
- No floating-point nondeterminism: use fixed-step simulation (dt = 1/60), round positions to 2 decimal places each tick
- Channel walls are line segments; ball-to-segment collision uses closest-point projection

**Rendering (`renderer.js`):**
- Background: light pastel gradient
- Pins: metallic cylinder sprites with pull handle; animate slide-out on removal
- Balls: filled circles with specular highlight; color from palette
- Cups: trapezoidal shapes at bottom; color border matches `acceptColor`; fill animation when ball settles
- Channels: dark gray walls with slight bevel shadow
- **Phaser migration:** Rewrite Canvas 2D draw calls to Phaser Graphics objects and Tweens. Replace custom gravity simulation with Phaser Matter.js (fixed 60Hz timestep for determinism — pins as constraints, balls as bodies). Replace manual particle arrays with Phaser ParticleEmitter. Layout positioning functions are pure math and carry over unchanged.

**Input:**
- Tap on a pin → calls `removePin`; plays pull SFX
- After removal, physics simulation runs visually at 60fps until all balls settle
- **Phaser migration:** Replace raw pointer events with Phaser interactive zones on pin game objects.

**Level generation (`generator.js`):**
1. Place cups at bottom with assigned colors
2. Place balls at top with matching colors (shuffled positions)
3. Generate channel paths from ball positions toward cups using random waypoints
4. Place pins at channel intersections — each pin blocks one channel segment
5. Run the solver (below) to verify at least one pin-removal ordering solves the level
6. If unsolvable, regenerate; cap at 10 attempts before falling back to hand-crafted level

**Automated playtesting:**

*Solver (`tests/solvers/pull-the-pin-solver.js`):*
- Input: level JSON
- Algorithm: BFS over pin-removal permutations
  - State = set of removed pins
  - For each state, try removing each remaining pin → simulate physics to completion → check result
  - Prune: if a partial ordering already causes a ball to enter the wrong cup, abandon that branch
  - Return: first valid pin-removal ordering, or `null` if unsolvable
- Complexity: N! in worst case for N pins, but pruning makes real levels tractable (typically N ≤ 8)

*Unit tests:*
- `simulateStep` produces identical state for identical input (determinism check)
- Ball in free-fall reaches cup position within expected tick count (gravity math check)
- Ball-to-wall collision reflects correctly (angle reflection check)
- `removePin` correctly unblocks associated channel
- `checkWin` correctly identifies won/lost/playing states

*Integration tests:*
- For every level in `levels/pull-the-pin/*.json`: run solver → assert solution exists
- For every level: apply solver's solution → simulate → assert final state is `"won"`
- For every level: apply a known-bad ordering (from solver's pruned branches) → simulate → assert state is `"lost"` (confirms that wrong orderings do fail)

*E2E tests (Playwright):*
- Load game → verify all pins render as interactive elements
- Tap pins in solver's order → verify win overlay appears
- Screenshot comparison: initial state, mid-solve, completed state

---

#### 1.2 Water Sort

**State model:**
```
{
  tubes: [
    { id: 0, segments: ["red", "blue", "red", "green"] },  // bottom to top
    { id: 1, segments: ["blue", "green", "blue", "red"] },
    { id: 2, segments: [] },  // empty buffer tube
    ...
  ],
  maxSegments: 4,        // segments per tube
  moves: [],             // history for undo
  status: "playing" | "won" | "stuck"
}
```

**Level format (JSON):**
```json
{
  "id": "ws-001",
  "tubes": [
    ["red", "blue", "red", "green"],
    ["blue", "green", "blue", "red"],
    ["green", "red", "green", "blue"],
    []
  ],
  "maxSegments": 4
}
```

**Core logic (`state.js`):**
1. `canPour(state, fromIdx, toIdx)` → boolean:
   - Source must not be empty
   - Destination must not be full
   - Destination must be empty OR top color of destination must match top color of source
   - Source and destination must differ
2. `pour(state, fromIdx, toIdx)` → new state:
   - Transfer top contiguous same-color group from source to destination (pour as many matching segments as destination can accept)
   - Push move to history
3. `undo(state)` → new state from history
4. `checkWin(state)` → all non-empty tubes contain a single color and are full
5. `getValidMoves(state)` → list of `[fromIdx, toIdx]` pairs where `canPour` is true
6. `isStuck(state)` → `getValidMoves` returns empty list (and not won)

**Rendering (`renderer.js`):**
- Tubes: rounded-bottom rectangles with glass border effect
- Liquid: colored rectangles inside tubes; pour animation slides segments up out of source, arcs through air, slides down into destination
- Pour animation: 400ms cubic-bezier ease; source segments visually "lift" then "flow" into target
- Completion flash: tube border glows gold when a tube is pure-color and full
- **Phaser migration:** Rewrite Canvas 2D draw calls to Phaser Graphics. Replace manual pour animation with Phaser `tweens.chain()` (lift → bezier arc → settle). Replace manual bubble/splash particle arrays with Phaser ParticleEmitter. Add Phaser Shine FX for glass refraction and Glow FX for completion flash. `getTubePosition()` layout math is pure and carries over unchanged.

**Input:**
- Tap tube 1 → selected (highlighted); tap tube 2 → attempt pour
- Tap selected tube again → deselect
- Undo button in UI → calls `undo`
- **Phaser migration:** Replace raw pointer events with Phaser interactive zones on tube game objects.

**Level generation (`generator.js`):**
1. Choose color count C (3–8) and buffer tube count B (1–2)
2. Create C tubes, each containing `maxSegments` copies of one color (the solved state)
3. Perform random valid pours for R iterations (R = C × 20) to shuffle — this guarantees solvability by reversibility
4. Add B empty buffer tubes
5. Verify solver (below) finds a solution in ≤ 200 moves
6. Assign a difficulty score based on solver's minimum move count

**Automated playtesting:**

*Solver (`tests/solvers/water-sort-solver.js`):*
- Input: level JSON
- Algorithm: BFS over game states
  - State key: serialize tube contents as sorted tuple string (canonical form for deduplication)
  - For each state, expand all valid moves → enqueue new states
  - Track visited states (Set of state keys) to avoid cycles
  - Return: move sequence `[fromIdx, toIdx][]` reaching win state, or `null`
- Optimization: prioritize moves that complete a tube (heuristic: count of completed tubes)
- Memory bound: cap visited set at 500,000 states; switch to iterative-deepening DFS if exceeded

*Unit tests:*
- `canPour` returns false for full destination, empty source, color mismatch
- `pour` transfers correct count of segments (contiguous same-color group)
- `undo` perfectly reverses a pour
- `checkWin` identifies pure-color full tubes
- `getValidMoves` returns empty for deadlocked state

*Integration tests:*
- For every level in `levels/water-sort/*.json`: run solver → assert solution exists
- Apply solver's solution step-by-step → assert each intermediate state is valid → assert final state is won
- Generated levels: generate 100 levels at each difficulty tier → all must be solvable

*E2E tests (Playwright):*
- Load game → verify tube count matches level
- Execute solver's move sequence via tap automation → verify win overlay
- Test undo: pour, undo, verify state matches pre-pour screenshot

---

#### 1.3 Brain Teaser

**State model:**
```
{
  puzzle: {
    id: "bt-001",
    type: "tap" | "drag" | "multi-step",
    elements: [{ id, type, x, y, w, h, draggable, clickable, hidden, zIndex }],
    solution: { action: "tap", targetId: "hidden-key" }
                | { action: "drag", sourceId: "rock", targetId: "door" }
                | { action: "sequence", steps: [...] },
    decoys: ["obvious-door", "big-button"],  // wrong answers
    hint: "Look behind the obvious"
  },
  interactions: [],   // player's action log
  status: "playing" | "solved" | "failed",
  attempts: 0
}
```

**Level format (JSON):**
```json
{
  "id": "bt-001",
  "title": "Find the key",
  "prompt": "Which cup has the ball?",
  "type": "tap",
  "elements": [
    { "id": "cup1", "type": "image", "sprite": "cup", "x": 50, "y": 200, "clickable": true },
    { "id": "cup2", "type": "image", "sprite": "cup", "x": 150, "y": 200, "clickable": true },
    { "id": "cup3", "type": "image", "sprite": "cup", "x": 250, "y": 200, "clickable": true },
    { "id": "ball", "type": "image", "sprite": "ball", "x": 150, "y": 220, "hidden": true, "zIndex": -1 }
  ],
  "solution": { "action": "drag", "sourceId": "cup2", "targetId": "offscreen" },
  "decoyActions": [
    { "action": "tap", "targetId": "cup1", "response": "shake" },
    { "action": "tap", "targetId": "cup3", "response": "shake" }
  ],
  "difficulty": 2
}
```

**Core logic (`state.js`):**
1. `applyAction(state, action)` → returns new state:
   - Compare `action` to `puzzle.solution` — if match, status → `"solved"`
   - Compare to decoys — if match, play decoy response animation, increment attempts
   - Otherwise, no-op
2. Each puzzle is a self-contained scenario with one correct interaction (tap the hidden object, drag X onto Y, tap in a specific sequence)
3. Puzzles are entirely data-driven — adding a new puzzle means adding a JSON entry, not new code

**Rendering (`renderer.js`):**
- Elements are sprites (SVG or simple Canvas drawings) positioned per their coordinates
- Prompt text at top ("Which cup has the ball?")
- "Only 1% can solve this!" banner (optional, toggled per level)
- Decoy failure response: element shakes, red flash, "wrong" SFX
- Solution response: element reveals, sparkle particles, "correct" SFX, celebration overlay
- **Phaser migration:** Replace Canvas sprite renderers (15 `renderCircle()`, `renderStar()`, etc.) with Phaser Graphics/Image game objects. Replace manual shake/confetti animation with Phaser Tweens and ParticleEmitter. `hitTest()` and `getElementAt()` are pure coordinate math and carry over unchanged. `wobble(seed)` deterministic function is pure math — reusable as-is.

**Input:**
- Tap element → `{ action: "tap", targetId }`
- Drag element onto another → `{ action: "drag", sourceId, targetId }`
- Sequence: track ordered taps → `{ action: "sequence", steps: [targetId, ...] }`
- **Phaser migration:** Replace raw pointer events with Phaser interactive game objects and `setDraggable()` for drag-and-drop.

**Level generation:**
Brain Teaser levels are hand-crafted — each puzzle is a unique lateral-thinking scenario that cannot be procedurally generated meaningfully. The level set will contain 20–30 hand-authored puzzles.

**Automated playtesting:**

*Solver (`tests/solvers/brain-teaser-solver.js`):*
- Trivial: each puzzle has exactly one solution stored in JSON
- Solver loads the puzzle, reads the `solution` field, and replays it against `applyAction`
- Confirm status is `"solved"`
- Additionally: replay each `decoyAction` → confirm status remains `"playing"` and attempts increments

*Unit tests:*
- `applyAction` with correct solution → status `"solved"`
- `applyAction` with decoy → status `"playing"`, attempts incremented
- `applyAction` with irrelevant tap → no state change

*Integration tests:*
- For every puzzle JSON: load → apply solution → assert solved
- For every puzzle JSON: apply all decoys → assert not solved, then apply solution → assert solved
- Validate every puzzle JSON against schema (all required fields present, solution references valid element IDs)

*E2E tests (Playwright):*
- Load puzzle → verify prompt text renders
- Tap decoy → verify shake animation plays
- Perform solution interaction → verify celebration overlay

---

#### 1.4 Parking Escape

**State model:**
```
{
  gridSize: 6,
  vehicles: [
    { id: "target", x: 0, y: 2, length: 2, orientation: "horizontal", isTarget: true },
    { id: "v1", x: 2, y: 0, length: 3, orientation: "vertical", isTarget: false },
    ...
  ],
  exit: { side: "right", row: 2 },   // target must reach this edge
  moves: [],
  moveCount: 0,
  status: "playing" | "won"
}
```

**Level format (JSON):**
```json
{
  "id": "pe-001",
  "gridSize": 6,
  "vehicles": [
    { "id": "target", "x": 0, "y": 2, "length": 2, "orientation": "horizontal", "isTarget": true },
    { "id": "v1", "x": 2, "y": 0, "length": 3, "orientation": "vertical" },
    { "id": "v2", "x": 3, "y": 3, "length": 2, "orientation": "horizontal" },
    { "id": "v3", "x": 5, "y": 1, "length": 2, "orientation": "vertical" }
  ],
  "exit": { "side": "right", "row": 2 },
  "optimalMoves": 8,
  "difficulty": "medium"
}
```

**Core logic (`state.js`):**
1. `buildOccupancyGrid(state)` → 2D array where each cell is `null` or `vehicleId`
2. `getValidMoves(state, vehicleId)` → list of positions the vehicle can slide to:
   - Horizontal vehicles: slide left/right within unoccupied cells along their row
   - Vertical vehicles: slide up/down within unoccupied cells along their column
   - Return all valid `(vehicleId, newX, newY)` tuples
3. `moveVehicle(state, vehicleId, newX, newY)` → new state with vehicle at new position; push to history; increment moveCount
4. `checkWin(state)` → target vehicle's right edge (if horizontal) reaches exit column, or top/bottom edge reaches exit row
5. `undo(state)` → pop last move from history
6. `getAllValidMoves(state)` → all `(vehicleId, newX, newY)` across all vehicles

**Rendering (`renderer.js`):**
- Grid: 6×6 square grid with subtle gridlines
- Vehicles: rounded rectangles with 3D toy-car shading (depth faces via `lighten()`/`darken()`); target vehicle is red, others are random palette colors
- Exit: gap in grid border with directional arrow
- Drag: vehicle slides along its axis following finger/mouse; snaps to grid on release
- Win: target car slides out through exit with acceleration animation; confetti particles
- **Phaser migration:** Replace Canvas 2D vehicle shading with Phaser Graphics + tint. Replace manual slide animation with Phaser Tweens (`ease: 'Back.easeOut'` for snap bounce). Replace confetti with Phaser ParticleEmitter. `hitTestVehicle()`, `canvasToGrid()`, `computeSnapMove()`, `lighten()`/`darken()` are pure math/utility — all carry over unchanged.

**Input:**
- Drag vehicle along its axis → calls `moveVehicle` on release (snap to nearest valid grid position)
- Tap undo button → calls `undo`
- **Phaser migration:** Replace raw drag handler with Phaser draggable game objects constrained to vehicle axis.

**Level generation (`generator.js`):**
1. Place target vehicle at a random position on the exit row, oriented toward the exit
2. Iteratively add blocker vehicles:
   - Choose random position + orientation that intersects the target's path or another blocker's path
   - Verify grid is not overfull (max occupancy ~60% of cells)
3. Run solver → require solution exists with optimal move count in target difficulty range:
   - Easy: 4–8 moves
   - Medium: 9–16 moves
   - Hard: 17–30 moves
4. Reject and regenerate if solution is outside target range or no solution exists

**Automated playtesting:**

*Solver (`tests/solvers/parking-escape-solver.js`):*
- Input: level JSON
- Algorithm: BFS over board states (this is the standard Rush Hour solver):
  - State key: sorted vehicle positions as string `"target:0,2|v1:2,0|v2:3,3|..."`
  - For each state, enumerate all valid moves for all vehicles → enqueue new states
  - Track visited set for cycle avoidance
  - Return: shortest move sequence `[vehicleId, newX, newY][]`
- Performance: Rush Hour 6×6 has ≤ ~4 billion reachable states but typical levels have ≤ 50,000; BFS completes in <1 second for any well-formed level

*Unit tests:*
- `buildOccupancyGrid` correctly places all vehicles on grid
- `getValidMoves` returns correct set (test with known configuration)
- `moveVehicle` rejects invalid positions (overlap, off-grid, wrong axis)
- `checkWin` detects target at exit
- `undo` reverses exactly one move

*Integration tests:*
- For every level: solver produces solution → replay move sequence → assert won
- Verify solver's move count matches level's `optimalMoves` field
- For every level: verify no vehicle overlaps in initial state
- Generated levels: generate 50 per difficulty → all solvable → move counts within specified range

*E2E tests (Playwright):*
- Load game → verify correct vehicle count renders
- Drag target vehicle when path is blocked → verify it stops at obstruction
- Execute solver's solution via drag automation → verify win animation

---

### Phase 2: 2D Interactive Games

Games that are not pure puzzles — they involve choice, narrative, or feedback loops rather than spatial solving. Currently Canvas 2D; migrating to Phaser 3 framework alongside Phase 1 games.

---

#### 2.1 Save the Character

**State model:**
```
{
  scenario: {
    id: "sc-001",
    background: "cliff-edge",
    character: { sprite: "girl", x: 150, y: 100, state: "danger" },
    threat: { type: "falling-rock", x: 200, y: 50 },
    choices: [
      { id: "c1", label: "Umbrella", correct: false, animation: "crushed" },
      { id: "c2", label: "Shield", correct: true, animation: "saved" },
      { id: "c3", label: "Banana", correct: false, animation: "slip-fall" }
    ]
  },
  selectedChoice: null,
  status: "choosing" | "animating" | "won" | "lost"
}
```

**Level format (JSON):**
```json
{
  "id": "sc-001",
  "background": "cliff-edge",
  "character": { "sprite": "girl", "x": 150, "y": 100 },
  "threat": { "type": "falling-rock" },
  "choices": [
    { "id": "c1", "label": "Umbrella", "correct": false, "outcome": "crushed", "animFrames": 12 },
    { "id": "c2", "label": "Shield", "correct": true, "outcome": "saved", "animFrames": 8 },
    { "id": "c3", "label": "Banana", "correct": false, "outcome": "slip-fall", "animFrames": 15 }
  ]
}
```

**Core logic (`state.js`):**
1. `selectChoice(state, choiceId)` → sets `selectedChoice`, transitions to `"animating"`
2. `resolveChoice(state)` → checks if selected choice is correct → status becomes `"won"` or `"lost"`
3. `nextScenario(state, scenarioData)` → resets for next level

**Rendering (`renderer.js`):**
- Background: simple vector scenes (cliff, room, bridge, etc.) drawn with Canvas path operations
- Character: sprite-sheet-style frame animation; drawn from simple geometric shapes (circles, rectangles) not bitmap assets
- Choices: three large tap targets at bottom of screen with icons and labels
- Outcome animations: correct choice → character celebrates (bouncing, confetti); wrong choice → exaggerated slapstick failure (stretching, spinning, flying offscreen)
- **Phaser migration:** Replace Canvas path drawing with Phaser Graphics. Replace manual frame animation with Phaser AnimationManager. Replace manual slapstick tweens with Phaser Tween chains. Use Phaser Scene transitions for scenario changes.

**Level generation:**
Hand-crafted scenarios. Target: 20 scenarios covering diverse threat/choice combinations. The humor and narrative design of each scenario are the core creative output — these cannot be procedurally generated.

**Automated playtesting:**

*Solver:* Trivial — read `correct: true` from JSON, apply that choice.

*Unit tests:*
- `selectChoice` with correct choice → won
- `selectChoice` with each incorrect choice → lost
- Exactly one choice per scenario has `correct: true`

*Integration tests:*
- For every scenario: apply correct choice → won
- For every scenario: apply each incorrect choice → lost
- Schema validation: every scenario has exactly one correct choice, 2–4 total choices

*E2E tests:*
- Load scenario → verify all choice buttons render
- Tap wrong choice → verify failure animation plays, lost overlay appears
- Tap correct choice → verify celebration animation, level-complete overlay

---

#### 2.2 Merge Games

**State model:**
```
{
  grid: [                    // 2D array, null = empty cell
    [null, {tier: 1, chain: "wood"}, null, ...],
    [{tier: 2, chain: "wood"}, null, {tier: 1, chain: "stone"}, ...],
    ...
  ],
  gridWidth: 7,
  gridHeight: 5,
  chains: {
    "wood":  ["twig", "branch", "log", "lumber", "table", "desk"],    // tier 0–5
    "stone": ["pebble", "rock", "boulder", "slab", "pillar", "monument"]
  },
  tasks: [
    { id: "t1", label: "Fix the door", requires: { chain: "wood", tier: 4 }, completed: false }
  ],
  mergeCount: 0,
  bonusMerges: 0,    // surprise upgrades
  status: "playing" | "task_complete"
}
```

**Level format (JSON):**
```json
{
  "id": "mg-001",
  "gridWidth": 7,
  "gridHeight": 5,
  "initialItems": [
    { "x": 0, "y": 1, "chain": "wood", "tier": 1 },
    { "x": 1, "y": 0, "chain": "wood", "tier": 1 },
    { "x": 3, "y": 2, "chain": "stone", "tier": 0 }
  ],
  "chains": {
    "wood": ["twig", "branch", "log", "lumber", "table", "desk"],
    "stone": ["pebble", "rock", "boulder", "slab", "pillar", "monument"]
  },
  "tasks": [
    { "id": "t1", "label": "Fix the door", "requires": { "chain": "wood", "tier": 4 } }
  ],
  "spawnRate": { "chain": "wood", "tier": 0, "intervalMs": 5000 },
  "bonusChance": 0.1
}
```

**Core logic (`state.js`):**
1. `canMerge(state, fromPos, toPos)` → both cells occupied, same chain, same tier, destination not max tier
2. `merge(state, fromPos, toPos)` → remove both items, place tier+1 item at `toPos`; with `bonusChance` probability, place tier+2 instead (bonus merge); increment mergeCount
3. `moveItem(state, fromPos, toPos)` → move item to empty cell (for grid organization)
4. `spawnItem(state, chain, tier)` → place item in random empty cell; fail if grid full
5. `checkTaskCompletion(state)` → scan grid for items matching task requirements; mark task complete; remove item from grid
6. `checkWin(state)` → all tasks completed

**Rendering (`renderer.js`):**
- Grid: soft pastel tiles with rounded corners
- Items: simple geometric icons that scale with tier (tier 0 = tiny dot, tier 5 = large complex shape); color-coded by chain
- Merge animation: both items shrink → center → burst into new higher-tier item with sparkle
- Bonus merge: gold sparkle instead of white; "+1" text floats up
- Task panel: sidebar showing task list with progress icons
- **Phaser migration:** Replace Canvas grid/item drawing with Phaser Graphics. Replace manual merge animation with Phaser tween chains (shrink → spawn with overshoot ease). Replace sparkle particles with Phaser ParticleEmitter.

**Input:**
- Drag item from cell to cell → if same item at destination, merge; if empty, move
- Cannot drag to occupied cell with different item (cell highlights red as feedback)
- **Phaser migration:** Replace raw drag handler with Phaser `setDraggable()` on item game objects.

**Level generation (`generator.js`):**
1. Define tasks requiring specific tier items
2. Seed grid with low-tier items that can reach required tiers through merge chains
3. Verify: enough source items exist that merging all of them can produce the required tiers
4. Formula: to produce one tier-T item requires 2^T tier-0 items (without bonuses)

**Automated playtesting:**

*Solver (`tests/solvers/merge-solver.js`):*
- Input: level JSON
- Algorithm: greedy merge-all strategy:
  1. Scan grid for all mergeable pairs
  2. Merge the pair with the highest tier (prioritize advancing the chain)
  3. If no merges available and spawns exist, wait for spawn (simulate time advance)
  4. Repeat until all tasks complete or stuck (grid full, no merges, no spawns)
- This is not an optimal solver — merge games don't require optimal play, just reachable completion
- Also verify: a perfect-play solver (merge only what tasks need) can complete within reasonable item budget

*Unit tests:*
- `canMerge` rejects different chains, different tiers, max-tier items
- `merge` produces tier+1 item
- Bonus merge produces tier+2 when forced via seeded RNG
- `checkTaskCompletion` detects matching items and removes them
- Grid overflow: `spawnItem` fails gracefully when grid is full

*Integration tests:*
- For every level: run solver → assert all tasks complete
- Verify: required item counts are achievable from initial grid + expected spawn count
- Verify: no level requires more than 200 merges to complete (playability bound)

*E2E tests:*
- Load level → verify grid renders with correct initial items
- Drag two matching items together → verify merge animation, new item appears
- Complete all tasks → verify level-complete overlay

---

#### 2.3 Satisfying / ASMR

**State model (Pressure Washing subtype — primary implementation):**
```
{
  surface: {
    width: 300,
    height: 400,
    dirtMap: Uint8Array,     // 300×400 grid; 255 = dirty, 0 = clean
    cleanThreshold: 0.95     // 95% clean → level complete
  },
  nozzle: { x: 0, y: 0, radius: 15, active: false },
  cleanPercent: 0.0,
  status: "playing" | "complete"
}
```

**Level format (JSON):**
```json
{
  "id": "asmr-001",
  "type": "pressure-wash",
  "surfaceWidth": 300,
  "surfaceHeight": 400,
  "dirtPattern": "full",
  "dirtDensity": 1.0,
  "nozzleRadius": 15,
  "cleanThreshold": 0.95,
  "surfaceColor": "#e8dcc8",
  "dirtColor": "#4a3728",
  "revealGradient": true
}
```

**Core logic (`state.js`):**
1. `initDirtMap(width, height, pattern, density)` → creates Uint8Array; patterns include "full" (everything dirty), "splatter" (random patches), "stripes"
2. `spray(state, x, y)` → set all pixels within `nozzleRadius` of `(x, y)` to 0 (clean); returns new state with updated cleanPercent
3. `calculateCleanPercent(dirtMap)` → count zero-valued pixels / total pixels
4. `checkComplete(state)` → `cleanPercent >= cleanThreshold`
5. No fail state. The game cannot be lost.

**State serialization:** The `dirtMap` is a 120KB `Uint8Array` that cannot be `JSON.stringify()`'d directly. For state URLs (Phase 6.1) and pause/resume, serialize as the spray history instead: store `sprayLog: [{ x, y }]` — the ordered list of spray center coordinates. To restore state, replay the spray log against a fresh dirt map. Spray logs are typically 200-500 entries (< 5KB), well within URL and localStorage budgets. The `dirtMap` itself is never persisted — it's a derived cache, always reconstructable from the spray log.

**Additional subtypes (implemented as variants):**
- **Bubble Pop:** grid of bubbles; tap to pop; all popped → complete
- **Soap Cutting:** drag blade across soap block; each slice reveals clean cross-section; full slice count → complete

**Rendering (`renderer.js`):**
- Two-layer Canvas: bottom layer = clean surface color; top layer = dirt overlay (drawn as opaque pixels)
- Spraying erases dirt layer pixels → clean surface is "revealed" underneath
- Particle effects: water droplets spray outward from nozzle position
- Sound: synthesized water-spray sound (white noise through bandpass filter) plays while spraying
- **Phaser migration:** Replace two-layer Canvas with Phaser RenderTexture (use `renderTexture.erase()` for spray). Replace manual particle arrays with Phaser ParticleEmitter. Add Phaser Bloom FX for completion glow.

**Input:**
- Touch/mouse down → nozzle active; continuous drag → continuous spray
- Touch/mouse up → nozzle inactive
- **Phaser migration:** Replace raw pointer events with Phaser `input.on('pointermove')` tracking.

**Level generation:**
Dirt patterns are procedural (random splatter, gradient, full coverage). No solver needed since there is no failure state.

**Automated playtesting:**

*Solver:* Systematic scan — simulate spraying in a grid pattern (left-to-right, top-to-bottom, stride = nozzleRadius) → confirm cleanPercent reaches threshold.

*Unit tests:*
- `spray` clears pixels within radius
- `calculateCleanPercent` returns correct ratio
- `checkComplete` triggers at threshold
- Dirt patterns generate expected density

*Integration tests:*
- For every level: run systematic scan solver → assert complete
- Verify: nozzle radius is large enough that systematic scan completes within 5,000 spray operations (playability bound — prevents impossibly slow games)

*E2E tests:*
- Load game → verify dirt surface renders
- Drag across surface → verify clean trail appears
- Systematic drag → verify completion overlay

---

### Phase 3: 3D Runner Games (Three.js)

Games that require 3D perspective, forward motion, and lane-based or arena-based interaction. These games use Three.js for rendering and are **not affected by the Phaser migration** — Phaser is a 2D game framework and cannot replace Three.js's 3D scene graph, materials, lighting, and InstancedMesh. 3D games continue using `shared/input.js` and `shared/audio.js` directly.

---

#### 3.1 Crowd Runner

**State model:**
```
{
  crowdSize: 10,
  position: 0,                    // distance along course (z-axis)
  laneOffset: 0,                  // x position, -1 to 1
  courseLength: 500,
  gates: [
    { z: 50, left: { op: "+", value: 10 }, right: { op: "×", value: 3 } },
    { z: 120, left: { op: "−", value: 5 }, right: { op: "+", value: 20 } },
    ...
  ],
  boss: { z: 500, size: 80 },
  speed: 2,
  status: "running" | "won" | "lost"
}
```

**Level format (JSON):**
```json
{
  "id": "cr-001",
  "startingCrowd": 10,
  "courseLength": 500,
  "speed": 2,
  "gates": [
    { "z": 50, "left": { "op": "+", "value": 10 }, "right": { "op": "×", "value": 3 } },
    { "z": 120, "left": { "op": "−", "value": 5 }, "right": { "op": "+", "value": 20 } },
    { "z": 200, "left": { "op": "÷", "value": 2 }, "right": { "op": "×", "value": 2 } },
    { "z": 300, "left": { "op": "+", "value": 15 }, "right": { "op": "−", "value": 8 } }
  ],
  "boss": { "size": 80 },
  "difficulty": "easy"
}
```

**Core logic (`state.js`):**
1. `advance(state, dt)` → increment position by speed×dt; check for gate crossing
2. `crossGate(state, gate, side)` → apply operation to crowdSize:
   - `+` → add
   - `−` → subtract (floor at 1)
   - `×` → multiply
   - `÷` → divide and floor (floor at 1)
3. `hitBoss(state)` → compare crowdSize to boss.size; crowdSize > boss.size → `"won"`; else → `"lost"`
4. `steer(state, direction)` → adjust laneOffset; -1 = left, 0 = center, 1 = right
5. Gate side determination: laneOffset < 0 → left gate; laneOffset ≥ 0 → right gate

**Rendering (Three.js):**
- Course: flat textured plane stretching into distance; side walls
- Crowd: instanced mesh (simple sphere or capsule geometry) — instance count = crowdSize; arranged in a cluster formation that scales with count
- Gates: two colored rectangular arches side-by-side; text meshes showing operation (e.g., "×3"); green = beneficial, red = harmful
- Boss: large instanced sphere cluster at course end; size proportional to boss.size
- Camera: chase cam behind and above the crowd
- Crowd-vs-boss collision: winning → boss explodes into particles; losing → crowd scatters

**Input:**
- Swipe left/right or drag → steer crowd between lanes
- Auto-runner: crowd moves forward automatically

**Level generation (`generator.js`):**
1. Place gates at regular z-intervals
2. For each gate, generate one "good" option (positive operation) and one "bad" option (negative or weaker)
3. Calculate optimal path crowd size → must exceed boss.size
4. Calculate worst path crowd size → must reach 0 or near-0 (to ensure bad choices feel bad)
5. Set boss size to ~80% of optimal path crowd size (forgives 1–2 mistakes)

**Automated playtesting:**

*Solver (`tests/solvers/crowd-runner-solver.js`):*
- Input: level JSON
- Algorithm: evaluate all 2^N gate combinations (N = gate count, typically ≤ 10 → 1024 max):
  - For each combination (left/right per gate), compute final crowd size
  - Record optimal path (max crowd), worst path (min crowd), and all paths that beat the boss
- Assert: at least one path beats the boss
- Assert: optimal path exceeds boss by ≥ 20% (margin for imprecise steering)
- Assert: at least one path loses (game must have challenge)

*Unit tests:*
- `crossGate` applies each operation correctly
- `crossGate` floors at 1 (crowd cannot go to 0 or negative from subtraction/division)
- `hitBoss` correctly compares crowd to boss size
- Gate side determination from laneOffset

*Integration tests:*
- For every level: solver's optimal path beats boss
- For every level: at least one path loses
- Generated levels: 50 per difficulty → all solvable → boss size within specified margin

*E2E tests:*
- Load game → verify crowd renders with correct starting count
- Steer through good gates → verify crowd count increases (displayed as on-screen number)
- Complete course → verify win/loss result matches expected path

---

#### 3.2 Bridge Race

**State model:**
```
{
  player: { color: "blue", blocks: 0, x: 0, z: 0, bridgesCompleted: 0 },
  opponents: [
    { color: "red", blocks: 0, x: 5, z: 0, bridgesCompleted: 0, ai: "greedy" },
    { color: "green", blocks: 0, x: -5, z: 0, bridgesCompleted: 0, ai: "random" }
  ],
  blockPiles: [
    { x: 3, z: 20, color: "blue", count: 5 },
    { x: -3, z: 20, color: "red", count: 5 },
    ...
  ],
  bridges: [
    { z: 50, width: 3, cells: [null, null, null], required: 3 },  // each cell → color or null
    { z: 120, width: 4, cells: [null, null, null, null], required: 4 },
  ],
  finishZ: 200,
  status: "racing" | "won" | "lost"
}
```

**Core logic (`state.js`):**
1. `collectBlock(state, entityId, pileIdx)` → if entity's color matches pile color and pile.count > 0, increment entity's blocks, decrement pile
2. `placeBlock(state, entityId, bridgeIdx, cellIdx)` → place entity's color in bridge cell; decrement entity's blocks; if cell already has a different color, overwrite (sabotage — the overwritten player loses that cell)
3. `isBridgeComplete(bridge, color)` → all cells are the given color
4. `crossBridge(state, entityId, bridgeIdx)` → if bridge is complete for entity's color, increment bridgesCompleted, move entity past bridge z
5. `checkWin(state)` → entity at finishZ with all bridges completed → that entity wins
6. `aiTick(state, opponentId)` → simple AI:
   - "greedy": always go to nearest uncollected matching pile, then to nearest incomplete bridge
   - "random": 70% greedy behavior, 30% random wandering (makes AI beatable)

**Rendering (Three.js):**
- Arena: flat ground plane; block piles as colored cube stacks; bridge gaps as dark voids
- Player + opponents: colored capsule meshes; block count shown as stacked cubes carried on back
- Bridges: row of cube slots in the gap; filled slots show the placed color; empty slots show transparent gray
- Camera: top-down or slight angle behind player
- Win: player character does a jump animation; confetti particle system

**Input:**
- Joystick (virtual on-screen) or drag to move player in XZ plane
- Block collection and bridge placement are automatic (proximity-triggered)

**Level generation (`generator.js`):**
1. Place N bridges at increasing Z positions; each requires M blocks
2. Scatter block piles of each color in the playfield between bridges
3. Ensure enough blocks of each color exist to complete all bridges (with ~20% surplus for sabotage recovery)
4. Set AI difficulty: easy = "random", medium = "greedy" with 1s reaction delay, hard = "greedy" instant

**Automated playtesting:**

*Solver (`tests/solvers/bridge-race-solver.js`):*
- Input: level JSON
- Algorithm: simulate player using greedy strategy (collect all matching blocks, go to nearest bridge, fill all cells) with no AI competition
  - Verify: player can collect enough blocks and fill all bridges
  - Then simulate with AI active → verify game terminates (no infinite loop)
- Does not need to prove player always wins (competitive game) — only that victory is achievable with perfect play against each AI difficulty

*Unit tests:*
- `collectBlock` only works for matching colors
- `placeBlock` overwrites opponent's cells (sabotage mechanic)
- `isBridgeComplete` checks all cells match
- AI greedy strategy converges to bridge completion

*Integration tests:*
- For every level: greedy player completes all bridges with AI disabled
- For every level: game terminates within 10,000 ticks with AI enabled
- Block supply: total matching blocks per color ≥ total bridge cells + 20% margin

*E2E tests:*
- Load game → verify player and opponents render
- Move player over matching block pile → verify blocks collected (counter increments)
- Move player to bridge → verify blocks placed visually

---

#### 3.3 Giant Runner

**State model:**
```
{
  player: { x: 0, z: 0, scale: 1.0, color: "blue" },
  courseLength: 400,
  collectibles: [
    { x: -1, z: 30, color: "blue", value: 0.1 },    // matching → +scale
    { x: 1, z: 30, color: "red", value: -0.05 },     // wrong → −scale
    ...
  ],
  obstacles: [
    { x: 0, z: 80, width: 1.5 },   // static obstacle; player must steer around
  ],
  boss: { z: 400, scale: 5.0 },
  speed: 3,
  status: "running" | "boss_fight" | "won" | "lost"
}
```

**Core logic (`state.js`):**
1. `advance(state, dt)` → increment z by speed×dt
2. `collect(state, collectibleIdx)` → if color matches player, add value to scale; if wrong color, subtract (floor at 0.1)
3. `hitObstacle(state, obstacleIdx)` → reduce scale by 0.2 (floor at 0.1)
4. `startBoss(state)` → transition to boss_fight when z ≥ boss.z
5. `resolveBoss(state)` → player.scale > boss.scale → `"won"`; else → `"lost"`
6. `steer(state, xDelta)` → adjust x position within lane bounds

**Rendering (Three.js):**
- Course: ground plane with lane markers stretching forward
- Player: capsule mesh whose scale property is `player.scale` — visually grows/shrinks in real time
- Collectibles: small colored orbs floating along the course; matching color = player's color; wrong color = red tint
- Boss: large capsule mesh at course end; scale = boss.scale
- Growth: smooth lerp animation when player scale changes
- Boss fight: player and boss collide → if player wins, boss shrinks and shatters; if player loses, player bounces back

**Input:**
- Swipe/drag left-right to steer
- Auto-runner forward motion

**Level generation (`generator.js`):**
1. Place matching-color collectibles along the course (enough to reach boss scale + margin)
2. Intersperse wrong-color collectibles and obstacles
3. Calculate best-case scale (collect all matching, avoid all wrong) → must exceed boss by ≥ 30%
4. Calculate average-case scale (collect 70% matching, hit 20% wrong) → must exceed boss (game should be winnable without perfect play)

**Automated playtesting:**

*Solver:*
- Evaluate all collectibles along the path
- Optimal path: collect all matching, avoid all wrong → compute final scale → assert > boss
- Average path: random 70/30 sampling over 100 runs → assert majority beat boss

*Unit tests:*
- `collect` with matching color increases scale
- `collect` with wrong color decreases scale, floors at 0.1
- `resolveBoss` correctly compares scales
- Scale never drops below 0.1

*Integration tests:*
- For every level: optimal path beats boss
- For every level: 100 random runs with 70% collection rate → ≥ 80% win rate

*E2E tests:*
- Load game → verify player renders at starting scale
- Steer through matching collectibles → verify visual growth
- Reach boss → verify outcome matches expected

---

#### 3.4 Jelly Shift

**State model:**
```
{
  blob: {
    z: 0,
    width: 1.0,       // current shape: 1.0 = square, <1 = tall, >1 = wide
    height: 1.0,       // inverse of width (area preserved)
    targetWidth: 1.0
  },
  walls: [
    { z: 30, hole: { shape: "tall", width: 0.5, height: 2.0 } },
    { z: 70, hole: { shape: "wide", width: 2.0, height: 0.5 } },
    { z: 110, hole: { shape: "plus", widthH: 0.5, heightH: 2.0, widthV: 2.0, heightV: 0.5 } },
    ...
  ],
  speed: 2,
  score: 0,
  status: "running" | "dead"
}
```

**Core logic (`state.js`):**
1. `advance(state, dt)` → increment z by speed×dt; increase speed slightly over time (escalation)
2. `reshape(state, widthDelta)` → adjust blob width; height = 1/width (preserve area); clamp to [0.3, 3.0]
3. `checkWallCollision(state, wallIdx)` → when blob.z reaches wall.z:
   - For simple shapes ("tall", "wide"): check blob.width ≤ hole.width AND blob.height ≤ hole.height
   - For compound shapes ("plus"): check blob fits within the union of horizontal and vertical rectangles
   - Pass → increment score, continue
   - Fail → status = `"dead"`
4. `fitsHole(blobWidth, blobHeight, hole)` → pure geometric check; returns boolean + margin (how close to the edge)

**Rendering (Three.js):**
- Corridor: simple tunnel geometry stretching forward; side walls for depth perception
- Blob: soft-body mesh (sphere geometry with vertex displacement driven by width/height) — translucent jelly material with subsurface scattering approximation (translucent MeshPhysicalMaterial)
- Walls: solid gray planes with colored hole cutouts (rendered as stencil masks or separate geometry)
- Pass animation: blob squishes slightly as it passes through; particle burst behind wall
- Fail animation: blob splats against wall; flattens and jiggles; screen shakes

**Input:**
- Drag/swipe vertically to reshape: drag up = tall & narrow, drag down = wide & flat
- Continuous control: blob reshapes in real-time as finger moves

**Level generation (`generator.js`):**
1. Place walls at increasing z-intervals (interval decreases slightly over time for escalation)
2. For each wall, generate a hole shape; alternate between tall, wide, and compound shapes
3. Verify each hole is achievable within the blob's deformation range [0.3, 3.0]
4. Ensure consecutive walls don't require instantaneous impossible transitions (minimum time between walls ≥ time to reshape from one extreme to another)

**Automated playtesting:**

*Solver (`tests/solvers/jelly-shift-solver.js`):*
- Input: level JSON
- Algorithm: for each wall, compute required blob width to fit the hole:
  - Simple shapes: width ≤ hole.width AND 1/width ≤ hole.height → solve for valid width range
  - Verify valid width range exists and overlaps with blob's [0.3, 3.0] range
  - Verify transition between consecutive walls is achievable given reshape speed and wall spacing/game speed

*Unit tests:*
- `fitsHole` returns true for matching shapes, false for mismatches
- `reshape` clamps within bounds
- `reshape` preserves area (width × height ≈ 1.0)
- Speed escalation increases over time

*Integration tests:*
- For every level: solver confirms all walls are passable
- For every level: verify consecutive wall transitions are achievable (reshape time budget check)

*E2E tests:*
- Load game → verify blob renders in corridor
- Reshape blob to match approaching wall → verify pass
- Leave blob in wrong shape → verify splat animation on collision

---

#### 3.5 Makeover Run

**State model:**
```
{
  character: {
    x: 0, z: 0,
    appearance: {
      hair: 0,       // 0 = messy (default), 1–3 = progressively styled
      outfit: 0,     // 0 = torn (default), 1–3 = progressively upgraded
      makeup: 0,     // 0 = none, 1–3 = progressively applied
      accessories: 0 // 0 = none, 1–3 = progressively added
    },
    score: 0,
    maxScore: 12     // 3 per category × 4 categories
  },
  courseLength: 300,
  stations: [
    { z: 30, x: -1, type: "hair", upgrade: 1, positive: true },
    { z: 30, x: 1, type: "mud", downgrade: "outfit", amount: 1, positive: false },
    { z: 70, x: -1, type: "outfit", upgrade: 2, positive: true },
    { z: 70, x: 1, type: "makeup", upgrade: 1, positive: true },
    ...
  ],
  speed: 2,
  status: "running" | "judging" | "complete"
}
```

**Core logic (`state.js`):**
1. `advance(state, dt)` → increment z by speed×dt
2. `hitStation(state, stationIdx)` → apply upgrade or downgrade:
   - Positive: set category to `max(current, upgrade)` (stations only upgrade, never downgrade a better state)
   - Negative: reduce category by `amount` (floor at 0)
   - Recalculate score as sum of all appearance values
3. `startJudging(state)` → when z ≥ courseLength; transition to scoring overlay
4. `judge(state)` → calculate rating from score/maxScore: < 33% = 1 star, 33–66% = 2 stars, 67–100% = 3 stars
5. `steer(state, xDelta)` → adjust x within lane bounds

**Rendering (Three.js):**
- Course: runway/corridor with side walls
- Character: articulated mesh with swappable parts (hair mesh, outfit mesh, accessory meshes) that change in real-time as stations are hit
- Stations: archway gates with icons (scissors for hair, dress for outfit, lipstick for makeup, mud puddle for negative)
- Positive stations: gold/sparkle aura; negative stations: dark/mud aura
- Transformation: instant mesh swap with brief particle burst
- End judging: character poses; score panel with star rating; crowd cheering SFX for 3 stars

**Input:**
- Swipe/drag left-right to steer
- Auto-runner forward motion

**Level generation (`generator.js`):**
1. Place pairs of stations at each z-interval: one positive, one negative (or two positives of different types)
2. Ensure maximum possible score (collecting all positive, avoiding all negative) = 3 stars
3. Ensure minimum possible score (hitting all negatives) ≤ 1 star
4. Typical play (60% positive hits) should yield 2 stars

**Automated playtesting:**

*Solver:*
- Optimal path: steer to every positive station, avoid every negative → compute final score → assert 3 stars
- Worst path: hit every negative, miss every positive → compute final score → assert ≤ 1 star
- Average path: random steering → assert 2-star range

*Unit tests:*
- `hitStation` positive upgrade applies correctly
- `hitStation` negative downgrade applies, floors at 0
- `judge` returns correct star rating for boundary scores
- Appearance values never exceed 3 or go below 0

*Integration tests:*
- For every level: optimal path → 3 stars
- For every level: worst path → ≤ 1 star
- Station placement: no two stations at same z and same x (collision check)

*E2E tests:*
- Load game → verify character renders in "before" state
- Steer through positive station → verify visual transformation
- Complete course → verify judging overlay with correct star count

---

### Phase 4: Integration, Polish, and Cross-Game Testing

**4.1 Hub Page Integration:**
- Hub at `mobile-gaming.pages.dev/` lists all 12 games as cards with name, thumbnail, and link
- Each game lives at its own subpath: `mobile-gaming.pages.dev/water-sort/`, etc.
- Each game is fully standalone — playable directly at its URL without the hub
- Consistent back-to-hub link in every game's UI
- Touch-optimized: all targets ≥ 44×44px; no hover-dependent interactions

**4.2 Cross-Game Test Suite:**
- E2E: launch each game from hub → verify it loads without errors → play at least one level via solver → verify win → return to hub
- Performance: each game renders ≥ 30fps on a mid-range device (simulated via Playwright throttling)
- Memory: no game leaks >10MB over 5 minutes of play (heap snapshot before/after)

**4.3 Level Validation Pipeline:**
- Runs in the Argo Workflow build step before deployment
- For every JSON file in `levels/`:
  1. Validate against game-specific JSON Schema
  2. Run game-specific solver → assert solvable
  3. For puzzle games: verify optimal solution length matches declared difficulty
  4. For runner games: verify win is achievable and loss is possible
- If any validation fails, the workflow exits non-zero and deployment does not proceed

**4.4 Visual Regression:**
- Playwright screenshot tests at key moments: initial state, mid-game, win state, lose state
- Baseline screenshots committed to repo; CI diffs against baseline on each PR

---

## Deployment

### Architecture

```
push to jedarden/mobile-gaming main
  → GitHub webhook POST to webhooks-build.ardenone.com/mobile-gaming
    → Argo Events EventSource receives webhook
      → website-build-sensor matches push-to-main filter
        → submits website-build Workflow to argo-workflows namespace
          → Workflow: clone repo → npm ci → npm run build → wrangler pages deploy
            → Cloudflare Pages project "mobile-gaming"
              → served at mobile-gaming.pages.dev
```

### Vite Build Output

Vite multi-page build produces a flat static site:

```
dist/
├── index.html                    # hub page
├── water-sort/index.html         # each game is a subpath
├── pull-the-pin/index.html
├── parking-escape/index.html
├── brain-teaser/index.html
├── save-the-character/index.html
├── merge/index.html
├── satisfying/index.html
├── crowd-runner/index.html
├── giant-runner/index.html
├── bridge-race/index.html
├── jelly-shift/index.html
├── makeover-run/index.html
└── assets/                       # shared JS/CSS chunks (hashed filenames)
```

### Argo Events CI Configuration

Three manifests in `ardenone-cluster/cluster-configuration/apexalgo-iad/argo-events/` are modified:

**1. EventSource** (`github-eventsource.yml`) — add `mobile-gaming` webhook:
```yaml
mobile-gaming:
  repositories:
    - owner: jedarden
      names:
        - mobile-gaming
  webhook:
    endpoint: /mobile-gaming
    port: "12000"
    method: POST
    url: https://webhooks-build.ardenone.com
  events:
    - push
  apiToken:
    name: github-webhook-secret
    key: token
  webhookSecret:
    name: github-webhook-secret
    key: webhook-secret
  insecure: false
  active: true
  contentType: json
```

**2. Sensor** (`website-build-sensor.yml`) — add dependency + trigger:
```yaml
# New dependency
- name: mobile-gaming-push
  eventSourceName: github-webhooks
  eventName: mobile-gaming
  filters:
    data:
      - path: headers.X-Github-Event
        type: string
        value:
          - push
      - path: body.ref
        type: string
        value:
          - refs/heads/main

# New trigger
- template:
    name: mobile-gaming-deploy
    conditions: mobile-gaming-push
    argoWorkflow:
      operation: submit
      source:
        resource:
          apiVersion: argoproj.io/v1alpha1
          kind: Workflow
          metadata:
            generateName: website-mobile-gaming-
            namespace: argo-workflows
          spec:
            workflowTemplateRef:
              name: website-build
            arguments:
              parameters:
                - name: repo
                  value: jedarden/mobile-gaming
                - name: cf-project
                  value: mobile-gaming
                - name: build-command
                  value: "npm ci && npm test && npm run test:levels && npm run build"
```

**Test tiers in CI:**
- `npm test` (Vitest): unit tests + solver integration tests — pure Node, no browser needed. Runs in the Argo Workflow `node:20` container.
- `npm run test:levels` (validate-levels.js): schema validation + solver verification for all level JSON — pure Node.
- `npm run test:e2e` (Playwright): **not included in the CI build command.** Playwright requires headless Chromium which is not installed in the `node:20` container. E2E tests run locally during development (`npm run test:e2e`) and are treated as a pre-push quality gate, not a deploy gate. This is a deliberate trade-off: adding `playwright install && npm run test:e2e` to the CI command would add ~800MB of browser binaries and 2+ minutes to every deploy for tests that primarily verify rendering, not logic. The solver-based tests already prove every level is playable; E2E tests verify the rendering matches expectations, which changes less frequently.


                - name: output-dir
                  value: dist
```

The build command runs tests and level validation **before** the build. If any unit test, solver validation, or level schema check fails, the workflow exits non-zero and no deployment occurs. This gates every deploy on full test + solver coverage.

**3. WorkflowTemplate** (`website-build-workflowtemplate.yml`) — no changes needed. The existing template already supports parameterized repo, build command, and output directory.

### Static Files for Cloudflare Pages

**`public/_redirects`:**
```
/* /index.html 404
```

All game subpaths (`/water-sort/`, `/pull-the-pin/`, etc.) resolve correctly because Vite outputs `game/index.html` files. The `_redirects` catches truly invalid paths and serves the hub's 404 page.

**`public/_headers`:**
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: vibrate=(self), fullscreen=(self)
```

No CSP header needed — no user-generated content is rendered as HTML, and all scripts are same-origin bundles with hashed filenames.

### Cloudflare Pages Setup (One-Time)

1. The Cloudflare Pages project `mobile-gaming` already exists at `mobile-gaming.pages.dev`
2. First deploy via the Argo Workflow will push to the existing project
3. No custom domain configuration needed — `mobile-gaming.pages.dev` is the production URL

### GitHub Webhook Setup (One-Time)

The EventSource controller auto-registers the webhook on the `jedarden/mobile-gaming` GitHub repo using the `github-webhook-secret` token. No manual webhook configuration is needed — Argo Events manages the webhook lifecycle.

---

## Automated Playtest Summary

| Game | Solver Algorithm | Proves | Max Complexity |
|---|---|---|---|
| Pull the Pin | BFS over pin-removal permutations | Solution exists; physics is deterministic | O(N!) with pruning; N ≤ 8 |
| Water Sort | BFS over pour states | Solution exists within move limit | O(S) where S ≤ 500K states |
| Brain Teaser | Direct solution replay | Correct answer wins; decoys don't | O(1) per puzzle |
| Parking Escape | BFS over vehicle positions (Rush Hour solver) | Shortest solution exists; matches difficulty | O(S) where S ≤ 50K states |
| Save the Character | Direct correct-choice replay | Correct choice wins; wrong choices lose | O(1) per scenario |
| Merge Games | Greedy merge-all simulation | All tasks reachable through merging | O(M) merges; M ≤ 200 |
| Satisfying / ASMR | Systematic grid scan | 100% coverage achievable | O(W×H / R) spray operations |
| Crowd Runner | Exhaustive gate combination evaluation | At least one path beats boss | O(2^N); N ≤ 10 |
| Bridge Race | Greedy collection + AI simulation | Player can win; game terminates | O(T) ticks; T ≤ 10K |
| Giant Runner | Optimal + Monte Carlo path evaluation | Optimal beats boss; 80% average win rate | O(C × 100 runs); C = collectibles |
| Jelly Shift | Geometric feasibility per wall | All walls passable; transitions achievable | O(W) walls |
| Makeover Run | Optimal/worst path scoring | 3-star achievable; 1-star possible; 2-star average | O(S) stations |

---

## Implementation Order

The phases above define logical groupings, but within each phase, games are implemented in priority order:

| Priority | Game | Rationale |
|---|---|---|
| 1 | Water Sort | Simplest state model; BFS solver is well-understood; highest ad authenticity. First Phaser migration target — validates tween/particle pipeline with simple rendering. |
| 2 | Parking Escape | Rush Hour solver is a known algorithm; pure-logic game with no physics. Tests Phaser drag input and snap-to-grid. |
| 3 | Pull the Pin | Introduces 2D physics; solver is more complex; the genre's most iconic mechanic. Tests Phaser Matter.js integration. |
| 4 | Brain Teaser | Data-driven levels; trivial solver; tests the element/interaction system |
| 5 | Save the Character | Trivial mechanic; tests animation and narrative pipeline |
| 6 | Merge Games | More complex state model; introduces spawn timers and variable reward |
| 7 | Satisfying / ASMR | Pixel-level dirt map; introduces Web Audio synthesis; no fail state simplifies testing. Tests Phaser RenderTexture. |
| 8 | Crowd Runner | First Three.js game; simplest 3D — instanced meshes, linear course (not affected by Phaser migration) |
| 9 | Giant Runner | Similar to Crowd Runner but with scale manipulation |
| 10 | Makeover Run | Similar runner structure but with swappable character meshes |
| 11 | Bridge Race | Most complex 3D — arena movement, AI, sabotage mechanic |
| 12 | Jelly Shift | Most complex rendering — soft-body deformation, compound hole geometry |

---

## Content Pipeline

### Level Corpus Strategy

Two-tier level system. Tier 1 ships in the repo; Tier 2 is generated at test time.

**Tier 1 — Committed levels (`levels/<game>/*.json`):**

| Game | Source | Count | Notes |
|---|---|---|---|
| Water Sort | Generator → solver-rank → hand-pick best | 30 (10 easy, 10 medium, 10 hard) | Generate 200, rank by solver move count, pick levels with interesting intermediate states |
| Parking Escape | Generator → solver-rank → hand-pick | 30 | Same pipeline; rank by optimal move count |
| Pull the Pin | Generator → solver-rank → hand-pick | 20 | Physics makes generation less reliable; more manual curation |
| Brain Teaser | Hand-authored with LLM assistance | 25 | Claude generates scenario JSON given the schema + 5 examples as few-shot; human reviews for lateral-thinking quality and humor |
| Save the Character | Hand-authored with LLM assistance | 20 | Claude generates scenario + choices + outcome descriptions; human reviews for tone, humor, no inappropriate content |
| Merge Games | Generator | 15 | Task complexity drives difficulty; fewer levels needed since sessions are longer |
| Satisfying/ASMR | Generator | 10 | Dirt patterns are procedural; variety comes from pattern type, not level count |
| Crowd Runner | Generator → verify | 20 | Gate sequences generated, boss sized to optimal path |
| Giant Runner | Generator → verify | 20 | Collectible layouts generated, boss sized to average path |
| Jelly Shift | Generator → verify | 15 | Wall sequences generated with transition feasibility check |
| Makeover Run | Generator → verify | 15 | Station layouts generated |
| Bridge Race | Generator → verify | 15 | Arena layouts generated with block supply verification |

**Total: ~235 hand-curated levels across all games.**

**Tier 2 — CI-generated levels (not committed):**
- `scripts/validate-levels.js` generates 100 additional levels per game at each difficulty tier using the game's `generator.js`
- Each generated level is solver-verified
- These test the generator's reliability, not the game's content — they are never shipped to users
- CI fails if any generated level is unsolvable

### LLM-Assisted Authoring Workflow (Brain Teaser, Save the Character)

1. Provide Claude with: JSON schema, 5 example levels, design constraints ("solution must require lateral thinking, not domain knowledge", "failure animations should be slapstick, never cruel")
2. Claude generates a batch of 10 candidate levels as JSON
3. Human reviews each candidate: rate puzzle quality, edit text, adjust difficulty score
4. Accepted levels are saved to `levels/<game>/` and committed
5. CI validates all level JSON against the schema and runs the trivial solver (correct answer → solved, decoys → not solved)

### Asset Pipeline

All visual assets are procedural — zero bitmap files in the repo.

**2D games (Canvas 2D):**
- All graphics drawn with Canvas path operations: `beginPath()`, `arc()`, `moveTo()`, `lineTo()`, `fill()`, `stroke()`
- A `shared/shapes.js` module exports reusable drawing functions: `drawRoundedRect(ctx, x, y, w, h, r)`, `drawCircleWithHighlight(ctx, x, y, r, color)`, `drawArrow(ctx, from, to)`, `drawTube(ctx, x, y, w, h, segments)`, etc.
- Each game's `renderer.js` composes these primitives into game-specific visuals
- Colors always reference `shared/colors.js` palette entries — never hardcoded hex values
- **Phaser migration:** `shared/shapes.js` is rewritten to use Phaser Graphics API (`graphics.fillRoundedRect()`, `graphics.fillCircle()`, etc.) which maps closely to Canvas path operations but benefits from WebGL batching. Phaser post-processing FX (Glow, Bloom, Shine, Shadow) add visual polish with zero custom shader code. `shared/colors.js` palette is reusable as-is.

**3D games (Three.js):**
- All meshes use Three.js built-in geometries: `CapsuleGeometry`, `BoxGeometry`, `SphereGeometry`, `PlaneGeometry`, `CylinderGeometry`
- Materials: `MeshStandardMaterial` for solid objects, `MeshPhysicalMaterial` with transmission for Jelly Shift's translucent blob
- No external model files (.glb, .obj) — everything is constructed programmatically
- Instanced rendering (`InstancedMesh`) for crowds, collectibles, and block piles

**Sound:**
- All SFX generated via Web Audio API oscillators and noise generators
- `shared/audio.js` defines sound presets as parameter objects: `{ type: 'sine', frequency: 440, duration: 0.1, envelope: 'pluck' }`
- Per-game sounds: `pop` (bubble pop, ball settle), `whoosh` (pour, swipe), `crunch` (collision, fail), `sparkle` (win, merge), `thud` (wall hit)
- No audio file dependencies — entire sound design is < 2KB of JS
- **Phaser migration:** `shared/audio.js` is renderer-agnostic and reusable as-is. 2D games can optionally trigger sounds via Phaser's `this.sound.play()` which wraps Web Audio, but the existing synthesis code works unchanged.

**Icons and favicons:**
- Single SVG favicon (`public/favicon.svg`) — a simple game controller silhouette
- PWA icons generated at build time: `scripts/generate-icons.js` renders the SVG to 192px and 512px PNG using `sharp` (dev dependency, runs in CI only)
- Per-game OG image: a 1200×630 Canvas-rendered thumbnail of the game's initial state, generated by Playwright during the screenshot test pass and committed to `public/og/`

---

## Phase Dependency Graph

```
Phase 0 (Scaffolding)
  ↓
Phase 1 (2D Puzzles) ──────────────────────┐
  ↓                                         │
Phase 2 (2D Interactive) ──────┐            │
  ↓                            │            │
Phase 3 (3D Runners) ─────────┤            │
  ↓                            ↓            ↓
Phase 4 (Integration) ← hub works incrementally (ships with each new game); cross-game test suite runs after all 12 complete
  ↓
Phase 5 (UX Polish) ← continuous, starts per-game after each game passes tests
  ↓
Phase 6 (Power Features):
  6.1 State URLs ← requires Phase 0 storage
  6.2 Hints ← requires game solvers (Phases 1-3)
  6.3 Daily Challenge ← requires generators + solvers (Phases 1-3) + 6.1
  6.4 Quick Play ← requires Phase 0 storage + ≥3 games complete
  6.5 Video Recording ← requires Phase 5 polish (games must look good)
  6.6 Replays ← requires 6.1 (state URLs for sharing)
  6.7 Fail Speedrun ← requires base games complete
  6.8 Swipe Nav ← requires ≥2 games complete
  6.9 Adaptive Difficulty ← requires Phase 0 storage + generators
  ↓
Phase 7 (Platform Features):
  7.1 Sync ← requires Phase 0 storage schema
  7.2 Ad Compositor ← requires 6.5 (video recording) — LOW PRIORITY
  7.3 Endless Mode ← requires generators + solvers + 6.9 (adaptive difficulty)
```

**Critical path:** Phase 0 → Phase 1 (Water Sort first — also serves as Phaser proof-of-concept) → Phase 2 → Phase 3 → Phase 4 → Phase 6.1 + 6.2

Features on the critical path should be implemented first. Features not on the critical path (6.5 video recording, 7.2 ad compositor, 5.x polish) can be developed in parallel once Phase 0 is complete.

---

## Phaser Migration Strategy

The 2D games (Phases 1-2) are migrating from raw Canvas 2D to Phaser 3, a browser game framework providing WebGL rendering, built-in tweens, particles, physics, and input handling. See `docs/research/phaser-evaluation.md` for the full evaluation. 3D games (Phase 3) are not affected — they continue using Three.js.

### What to keep (no changes)

| Layer | Files | Why |
|-------|-------|-----|
| Game logic | `state.js` (all games) | Truly pure — no DOM, no Canvas, no rendering imports |
| Levels | `levels.json`, `levels/*.json` | Pure data, renderer-agnostic |
| Generators | `generator.js` (all games) | Pure algorithms calling state.js and RNG |
| Solvers + tests | `tests/solvers/`, `tests/unit/`, `tests/integration/` | Test pure state logic, no rendering deps |
| Shared logic | `colors.js`, `rng.js`, `storage.js`, `daily.js`, `score.js`, `adaptive.js`, `history.js`, `hints.js`, `hint-worker.js`, `analytics.js`, `accessibility.js`, `haptics.js`, `endless.js`, `fail-speedrun.js`, `quick-play.js`, `recorder.js`, `replay.js`, `share.js`, `state-url.js`, `swipe-nav.js`, `sync.js`, `meta.js`, `video-overlay.js`, `ad-compositor.js` | Renderer-agnostic utilities |
| Audio | `audio.js` | Web Audio oscillator synthesis — no rendering coupling |
| Input normalization | `input.js` (shared) | Coordinate normalization is renderer-agnostic |
| Screen shake math | `screen-shake.js` | Pure offset calculation — apply to Phaser camera instead of Canvas translate |

### What to rewrite (Canvas 2D → Phaser)

| Layer | Files | Change |
|-------|-------|--------|
| Renderers | `renderer.js` (6 2D games, ~500-900 lines each) | Replace Canvas 2D draw calls (`ctx.fillStyle`, `ctx.arc()`, `ctx.createLinearGradient()`) with Phaser game objects (Graphics, Tweens, ParticleEmitter). **Extract reusable layout math and hit-testing functions first** (e.g., `getTubePosition()`, `hitTestVehicle()`, `canvasToGrid()`, `wobble()`) — these are pure math and carry over unchanged. |
| Game lifecycle | `game.js` (6 2D games) | Replace manual `requestAnimationFrame` loop with Phaser Scene lifecycle. Replace Promise-based animation callbacks (`renderer.animatePour()`) with Phaser Tween events. Keep state machine logic (level loading, move dispatch, undo, win check). |
| Drawing primitives | `shared/shapes.js` | Replace Canvas path functions with Phaser Graphics API equivalents |
| Canvas setup | `shared/canvas.js` | Replaced by Phaser's game loop and Scale Manager for 2D games; retained for 3D games |
| Viewport scaling | `shared/viewport.js` | Replaced by Phaser Scale Manager (`Phaser.Scale.FIT`) for 2D games; retained for 3D games |
| Particles | `shared/particles.js` | Replace Canvas rendering with Phaser ParticleEmitter; particle physics config (velocity, gravity, fade) is reusable |

### What to adapt (~30% of each file changes)

| Layer | Files | Change |
|-------|-------|--------|
| Per-game input | `input.js` (6 2D games) | Wire hit-testing functions to Phaser pointer events instead of raw DOM events. Hit-test logic itself is unchanged. |
| Lifecycle | `shared/lifecycle.js` | Add Phaser Scene pause/resume path alongside existing RAF freeze path |
| Settings / level-nav / retry | `shared/settings.js`, `shared/level-nav.js`, `shared/retry.js` | These manage DOM overlays — mostly unchanged, but any Canvas-specific positioning needs updating |

### Migration order

Water Sort is the first migration target because it has the simplest rendering (tubes, colored rectangles, pour tween) while exercising Phaser's core APIs (Graphics, Tweens, ParticleEmitter, input zones). If the Water Sort migration produces acceptable bundle size and mobile performance, proceed with the remaining 2D games in implementation order.

---

## Phase 5: UX Polish

UX polish is a continuous phase that begins after each game's base mechanics are complete and playtest-verified. It is not a one-time pass — each game receives iterative refinement as player-facing rough edges are identified. Polish work is deployed incrementally alongside new game development.

### 5.1 Per-Game Polish (Applied After Each Game Passes Playtests)

**Feedback and Juice:**
- Haptic feedback on supported devices (Vibration API) for key events: pin pull, ball settling, merge, wall collision, boss defeat
- Screen shake on failures (configurable intensity; 50ms for minor, 150ms for major)
- Camera zoom-in on critical moments (boss fight, final pour, last pin)
- Particle systems at success moments: confetti on win, sparkle on merge, water splash on pour
- Sound design pass: distinct SFX per action type; volume ducking during rapid-fire events; mute toggle persistent across sessions

**Animations and Transitions:**
- Ease-in/ease-out on all state changes (no instant snaps)
- Level-complete overlay: score/stars slide in, buttons fade in with stagger delay
- Level transition: brief fade-to-white or iris wipe between levels
- Tutorial hint animations on first play: pulsing glow on the first interactive element, finger-drag ghost showing expected input

**Visual Clarity:**
- Color-blind mode: pattern overlays on colored elements (stripes, dots, crosshatch) in addition to color; toggle in settings, persisted to localStorage
- High-contrast outlines on interactive elements during touch proximity
- Selected-state indicators: glow ring on selected tube (Water Sort), highlight border on selected vehicle (Parking Escape)
- Score and move counter readable at all times: semi-transparent dark backdrop behind text overlaying gameplay

### 5.2 Hub Page Polish

- Game cards: thumbnail screenshot (auto-generated from Playwright), game name, one-line description, difficulty badge
- Category filtering: Puzzle, Runner, Relaxation
- "Recently played" section using localStorage history
- Responsive grid: 1-column on small phones, 2 on large phones, 3 on tablets
- Loading skeleton: card placeholders while game JS bundles load

### 5.3 Mobile-First Interaction Polish

- Touch targets: minimum 48×48px (exceeding the 44px minimum from Phase 4)
- Drag dead-zone: 8px before drag registers (prevents accidental drags from taps)
- Swipe velocity detection: fast swipe = full lane change, slow swipe = proportional steering
- Pinch-to-zoom disabled on game canvas (prevents accidental browser zoom)
- Viewport meta: `user-scalable=no, viewport-fit=cover` for full-screen feel
- Safe area insets: respect `env(safe-area-inset-*)` for notch/home-bar devices
- Orientation lock hint: show "rotate device" overlay if game requires landscape and device is portrait (or vice versa)

### 5.4 Performance Polish

- Asset lazy loading: Three.js and Cannon-es only loaded for 3D games, not bundled into 2D game entry points
- Texture atlas for sprite-based games (Pull the Pin, Brain Teaser, Save the Character): single draw call per frame
- Object pooling for particle systems and instanced meshes (Crowd Runner, Giant Runner) to avoid GC pauses
- `requestAnimationFrame` with delta-time clamping: skip frames gracefully on slow devices rather than running game logic at half speed
- Bundle size budget: each game's JS bundle ≤ 150KB gzipped (2D games), ≤ 400KB gzipped (3D games)
- **Phaser migration:** 2D bundle size budget increases to ≤ 200KB gzipped (accounting for Phaser framework after Compressor stripping). Phaser handles WebGL draw call batching automatically, replacing manual texture atlas management. Phaser's game loop handles delta-time clamping internally. Only loaded for 2D games — no cross-contamination with Three.js entry points.

### 5.5 Progressive Enhancement

- Offline support: Service Worker caches each game's assets after first load; games playable without network
- Add-to-homescreen: Web App Manifest at `/manifest.json` with `start_url: /`, `display: fullscreen`, `theme_color` matching the hub's primary color. Icons: `public/icons/icon-192.png` and `public/icons/icon-512.png` (generated at build time from `public/favicon.svg` by `scripts/generate-icons.js` using `sharp`). Each game subpath also has a `<link rel="manifest">` pointing to the hub's manifest — installing any game adds the full hub to the homescreen.
- localStorage persistence: level progress, high scores, settings (color-blind mode, sound toggle, last-played level) survive browser close
- `prefers-reduced-motion` media query: disable screen shake, particle effects, and non-essential animations when user has reduced-motion enabled
- `prefers-color-scheme: dark`: dark background variant for hub and game chrome (gameplay colors unchanged)

### 5.6 Polish Verification

Polish items are validated through E2E tests and manual review:

| Check | Method |
|---|---|
| Haptic fires on supported events | Playwright: mock `navigator.vibrate`, assert called at correct moments |
| Screen shake does not displace gameplay elements | Screenshot diff: pre-shake and post-shake game state identical (only camera offset changes) |
| Color-blind mode renders pattern overlays | Screenshot comparison: color-blind-on vs default, verify non-identical pixels on colored elements |
| Touch dead-zone prevents accidental drags | Playwright: simulate 4px move → assert no drag event; simulate 10px move → assert drag event |
| Bundle size within budget | CI check: `stat -c %s dist/assets/*.js` after gzip → fail if over limit |
| Service Worker caches assets | Playwright: load game → go offline → reload → assert game still renders |
| `prefers-reduced-motion` disables animations | Playwright: emulate reduced-motion → assert no particle elements in DOM/canvas |

---

## Phase 6: Power Features

Features that transform the game collection from a set of standalone toys into a shareable, social, self-adjusting platform. Each feature exploits architectural decisions already made (pure-function state, deterministic physics, seeded PRNG, solver infrastructure) rather than introducing new foundational complexity.

---

### 6.1 Shareable Puzzle State URLs

Encode the full game state into the URL hash. Every game's `state.js` is a pure serializable object — `JSON.stringify` → `btoa` → append to URL as `#s=...`. Any game, any moment, any half-solved puzzle becomes a link.

**What this enables:**
- "Can you finish this?" challenge links — send a friend a half-solved Water Sort
- Bookmark mid-puzzle → resume later by reopening the URL
- Bug reports contain the full state — click the URL, see the bug
- Embedding a specific puzzle state in a blog post or social media

**Implementation:**

```
src/shared/state-url.js
```

- `encodeState(gameId, state)` → URL hash string
  - `JSON.stringify(state)` → `pako.deflateRaw()` (zlib compression, ~60-80% size reduction) → `btoa()` → URL-safe base64
  - Prefix with game ID and version byte for forward compatibility: `#s=ws.1.<base64>`
  - For states that exceed URL length limits (~2000 chars), fall back to a truncated "level + moves" encoding: store only the level ID and the move history, which is always compact
- `decodeState(hash)` → `{ gameId, state }`
  - Parse prefix → `atob()` → `pako.inflateRaw()` → `JSON.parse()`
  - Validate decoded state against game-specific schema before applying
- On game load: check `window.location.hash` → if valid state URL, hydrate directly instead of loading a fresh level
- On every state change: debounced `replaceState()` updates the hash (no history spam — uses `replaceState`, not `pushState`)

**State size estimates (compressed base64):**

| Game | Typical State Size | Compressed URL Length |
|---|---|---|
| Water Sort (8 tubes) | ~200 bytes JSON | ~80 chars |
| Parking Escape (10 vehicles) | ~400 bytes JSON | ~150 chars |
| Pull the Pin (6 pins, 4 balls) | ~500 bytes JSON | ~180 chars |
| Crowd Runner (full course) | ~800 bytes JSON | ~300 chars |

All well within URL length limits.

**Share flow:**
1. Player taps "Share" button → state URL copied to clipboard
2. Toast: "Link copied — paste anywhere to share this puzzle"
3. On the receiving end: click link → game loads directly into that exact state

---

### 6.2 Solver-Powered Progressive Hints

The solvers built for automated playtesting (`tests/solvers/`) run against `state.js` pure functions. Expose them as an in-game hint system.

**UX flow:**
1. Player taps lightbulb icon (visible after 30 seconds of no progress or 2 failed attempts)
2. Solver runs against the current state → returns the first move of the optimal solution
3. The hinted element animates: pulsing glow on the pin to pull, highlighted tube to pour from/to, arrow on the vehicle to slide
4. Tap lightbulb again → next move revealed
5. Each hint is "free" (no currency, no limit) — the goal is retention, not monetization

**Implementation:**

```
src/shared/hints.js
```

- Import the game-specific solver from `tests/solvers/<game>-solver.js`
  - Solvers are pure functions: `solve(state) → moveSequence | null`
  - They already run in Node for tests; running in browser is identical since they have no Node dependencies
- `getHint(gameId, currentState)`:
  1. Run solver against current state (not initial state — player may have made partial progress or suboptimal moves)
  2. Return `moveSequence[0]` — just the next move
  3. Cache the full solution; subsequent hint requests return `moveSequence[1]`, `[2]`, etc. without re-running the solver
  4. If state changes (player makes a move that isn't the hinted move), invalidate cache, re-solve from new state
- For games without solvers (Satisfying/ASMR, Makeover Run): hint shows a pulsing indicator on the most impactful area to interact with (highest dirt density region, closest positive station)

**Performance:**
- Water Sort BFS: < 100ms for typical levels (< 50K states explored)
- Parking Escape BFS: < 200ms for hard levels (< 50K states)
- Pull the Pin permutation search: < 500ms for N ≤ 8 pins
- Crowd Runner gate evaluation: < 1ms (2^10 = 1024 combinations)
- If any solver exceeds 1 second, run in a Web Worker to avoid blocking the UI

**Web Worker fallback (`src/shared/hint-worker.js`):**
- Solver runs in a dedicated Worker
- Main thread sends `{ gameId, state }` via `postMessage`
- Worker returns `{ moves }` when complete
- UI shows a brief "thinking..." spinner if solver takes > 200ms

---

### 6.3 Daily Seeded Challenge

One procedurally generated level per game per day. Everyone worldwide plays the same puzzle. No server, no database, no accounts.

**Implementation:**

```
src/shared/daily.js
```

- `getDailySeed(gameId)` → `hash(gameId + "2026-03-16")` → integer seed
  - Uses the existing `createRng(seed)` from `shared/rng.js`
  - Date is the user's local date (not UTC — let time zones create slight stagger, which generates social buzz: "Today's was hard!" "Mine was easy — different timezone!")
- `generateDailyLevel(gameId)`:
  1. Create RNG from daily seed
  2. Call the game's `generator.js` with that RNG
  3. Run the solver to verify solvability (should always pass since generators already guarantee this, but belt-and-suspenders)
  4. Cache generated level in localStorage keyed by `daily-<gameId>-<date>` to avoid regenerating
- **Fallback for non-generator games (Brain Teaser, Save the Character):** These have no `generator.js`. Instead, the daily seed selects from the existing hand-crafted level pool: `levelIndex = seed % levels.length`. The same level recurs every `levels.length` days, which is fine — 25 Brain Teaser puzzles means a 25-day cycle before repetition, and players won't remember specific puzzles after weeks.
- Daily challenge appears as a special card at the top of the hub page and as a banner within each game

**Results sharing (client-side share card generation):**

```
src/shared/daily-share.js
```

- On daily challenge completion, generate a share card using Canvas 2D:
  - Game icon + name
  - "Daily Challenge — March 16, 2026"
  - Stats: moves used, time taken, hints used (0 = no hints badge)
  - Spoiler-free: does NOT show the solution or the puzzle — just the performance
  - Grid of colored/gray squares (Wordle-style) encoding move quality: green = optimal, yellow = suboptimal, gray = hint-assisted
- `canvas.toBlob()` → share via Web Share API or download as PNG
- Text-based fallback for platforms without image sharing:
  ```
  Water Sort Daily — Mar 16
  🟩🟩🟨🟩🟩🟩 14 moves
  mobile-gaming.pages.dev/water-sort/?daily=2026-03-16
  ```

---

### 6.4 Zero-Friction Quick Play

One tap → playing. No game selection, no level selection, no menus.

**Implementation:**

```
src/shared/quick-play.js
```

- `pickGame()` algorithm:
  1. Read localStorage play history: `{ gameId, lastPlayed, levelsCompleted, avgSolveTime, retryRate }`
  2. Score each game: `score = recencyPenalty + varietyBonus + difficultyMatch`
     - `recencyPenalty`: games played in the last hour score lower (encourage variety)
     - `varietyBonus`: games never played score highest (encourage exploration)
     - `difficultyMatch`: games where the player's retry rate is 10-30% score highest (in the flow zone — not too easy, not too hard)
  3. Select the highest-scoring game
  4. Within that game, pick the next unsolved level at the player's current difficulty tier
- **Hub integration:** large "Quick Play" button at the top of the hub, above the game grid
- **Instant load:** Quick Play preloads the top-2 candidate games' JS bundles on hub page load (`<link rel="modulepreload">`) so the transition is effectively instant
- **Fallback:** if no play history exists (first visit), Quick Play starts with Water Sort level 1 (simplest game, highest retention)

---

### 6.5 Gameplay Video Recording and Social Sharing

Record gameplay as a video and share directly to short-form video platforms.

**Recording engine:**

```
src/shared/recorder.js
```

**Approach: Canvas capture → WebM → MP4 conversion**

1. **Frame capture:** Use `canvas.captureStream(30)` (30fps) to create a `MediaStream` from the game's Canvas/WebGL element
   - For Canvas 2D games: direct `captureStream()` on the game canvas. **Phaser migration:** `captureStream()` on Phaser's canvas (`game.canvas`)
   - For Three.js games: `captureStream()` on the WebGL renderer's canvas (`renderer.domElement`)
   - Composite a UI overlay canvas (score, move counter, game name watermark) on top using a secondary `<canvas>` drawn into the stream via `MediaStream` mixing

2. **Audio capture:** Merge game audio into the stream
   - Create a `MediaStreamAudioDestinationNode` from the Web Audio context
   - Connect the game's audio graph output to both the speakers and the destination node
   - Combine audio track with video track: `new MediaStream([...videoStream.getTracks(), ...audioDestination.stream.getTracks()])`

3. **Encoding:** `MediaRecorder` API with `mimeType: 'video/webm;codecs=vp9'`
   - Record into chunks (`ondataavailable` every 1 second)
   - On stop: assemble chunks into a single `Blob`

4. **MP4 conversion (for platform compatibility):**
   - Most social platforms require MP4/H.264, not WebM
   - Use `mp4-muxer` (lightweight WASM-free MP4 muxer, ~15KB) to remux the WebM into MP4 container client-side
   - If browser supports `VideoEncoder` API (Chrome 94+, Edge 94+, Safari 16.4+): encode directly to H.264 in MP4, skip WebM entirely
   - Fallback for unsupported browsers: offer WebM download with note "Convert to MP4 for TikTok/Instagram"

5. **Format optimization for short-form video:**
   - Aspect ratio: 9:16 vertical (1080×1920) for TikTok/Reels/Shorts, or 1:1 (1080×1080) square as fallback
   - Game canvas is rendered into the center of a 9:16 frame; top/bottom padding shows game name, challenge info, and QR code linking back to the game
   - Duration cap: 60 seconds max recording; auto-stop with fade-out
   - Auto-trim: if the player completes the level, recording ends 2 seconds after the win animation

**Recording UX:**

- **Passive recording (always-on):** The last 30 seconds of gameplay are always buffered in a circular buffer (30fps × 30s = 900 frames). When the player wins or does something share-worthy, the video is already captured — no need to have pressed "record" beforehand
  - Implementation: `MediaRecorder` runs continuously; oldest chunks beyond 30s are discarded
  - Memory budget: ~15MB for 30s of 720p WebM (acceptable on modern devices)
- **On level complete:** "Share your solve?" prompt with video preview thumbnail
- **On manual trigger:** record button in game chrome starts/stops explicit recording

**Share card overlay (burned into video):**

```
src/shared/video-overlay.js
```

- Intro frame (1.5s): game name, "Daily Challenge — Mar 16" (if daily), difficulty badge
- Gameplay: recorded frames with subtle watermark in corner (`mobile-gaming.pages.dev`)
- Outro frame (2s): stats (moves, time, hints), QR code linking to the exact puzzle state URL (from 6.1), call-to-action "Can you beat this?"

**Platform-specific sharing:**

```
src/shared/share.js
```

- **Web Share API (primary path):**
  ```js
  navigator.share({
    title: 'Water Sort Daily — 14 moves',
    text: 'Can you beat my solve?',
    url: stateUrl,
    files: [new File([mp4Blob], 'solve.mp4', { type: 'video/mp4' })]
  })
  ```
  - On iOS Safari and Android Chrome, this opens the native share sheet which includes TikTok, Instagram, Snapchat, YouTube, and all installed apps
  - The `files` parameter with a video file triggers the "share as video" path on platforms that support it

- **Platform deep-link fallbacks (when Web Share API is unavailable or user wants a specific platform):**

  | Platform | Method | Notes |
  |---|---|---|
  | **TikTok** | Download MP4 + open `tiktok://` deep link | TikTok doesn't support direct video upload from web; user saves video then uploads from TikTok app. Show instruction overlay: "Video saved — open TikTok and upload" |
  | **Instagram Reels** | Download MP4 + open `instagram://library` | Same pattern as TikTok; Instagram's share API is app-only. Instruction: "Video saved — open Instagram → New Reel → select from gallery" |
  | **YouTube Shorts** | Download MP4 + open `https://youtube.com/upload` | YouTube accepts browser uploads; can pre-fill title and description via URL params |
  | **Snapchat** | Snapchat Creative Kit JS SDK (`snap-kit.js`) | Supports direct sticker/video share from web via `snapkit.creativekit.share()` |
  | **X/Twitter** | `https://twitter.com/intent/tweet?text=...&url=...` | Text + state URL link; video must be uploaded natively (Twitter doesn't accept video via intent) |
  | **Facebook/Messenger** | `https://www.facebook.com/sharer/sharer.php?u=...` | Link share with OG meta tags; video preview via OG video tag |
  | **WhatsApp** | `https://wa.me/?text=...` | Text + state URL; user can attach downloaded video manually |
  | **Copy Link** | Clipboard API | Always available as fallback; copies state URL |

- **Platform picker UI:** Grid of platform icons (TikTok, Instagram, YouTube, Snapchat, X, Facebook, WhatsApp, Copy Link). Icons shown based on device detection:
  - Mobile: all platforms shown (apps likely installed)
  - Desktop: YouTube, X, Facebook, Copy Link (app-only platforms hidden)

**Fail Speedrun video generation (6.8 specific):**

Fail Speedrun mode (see 6.8 below) auto-generates a video with special treatment:
- Dramatic slow-motion on the fail moment (2x slow-mo for 1 second around the fail frame)
- "FAIL" text stamp with comic font at the moment of failure
- Timer prominently displayed throughout: "FAIL TIME: 1.3s"
- Outro: leaderboard position if applicable, "Beat my fail?" call-to-action
- This directly recreates the "fail ad" format that the research documents — the shared video IS a fake game ad, created by the player

**Deterministic replay video (from 6.7):**

When sharing a replay (input sequence), the receiver can either:
1. Play it back interactively (scrub through moves)
2. Auto-render it as a video: replay the input sequence at 1.5x speed with the recorder capturing frames → produce an MP4 of the full solve

This means a replay URL can be "rendered" into a video on the receiving device without the sender having recorded anything — the deterministic replay IS the video source.

---

### 6.6 Deterministic Replay Sharing

Since physics and RNG are deterministic by design, storing only the player's input sequence reproduces the exact game. A replay is a few hundred bytes — far smaller than a state snapshot.

**Implementation:**

```
src/shared/replay.js
```

- **Recording inputs:**
  - Every game's `input.js` already normalizes inputs into `{ type, x, y, dx, dy, timestamp }` events
  - `startRecording(levelId, seed)` → creates a `ReplayBuffer` that captures every input event
  - Events are stored as deltas: `[dt, type, x, y]` where `dt` is milliseconds since last event
  - Typical replay: 50-200 events for a puzzle game, 500-1000 for a runner game

- **Encoding:**
  - `encodeReplay(replay)` → compact binary format:
    - Header: `gameId` (1 byte) + `levelId` (4 bytes) + `seed` (4 bytes) + `version` (1 byte)
    - Events: varint-encoded deltas (1-3 bytes per field × 4 fields per event)
    - Total: 20-80 bytes for puzzle games, 200-400 bytes for runner games
  - Base64-encode → URL-safe string
  - Embed in URL: `#r=<base64>` (separate prefix from state URLs `#s=`)
  - Also encodable as a short alphanumeric "replay code": `WS-7K3M-XNPL` (game prefix + base36 encoded binary)

- **Playback:**
  - `decodeReplay(encoded)` → `{ gameId, levelId, seed, events }`
  - Initialize game with `levelId` and `seed` (deterministic level generation reproduces the exact level)
  - Feed events into the game engine with timing: `setTimeout` each event at its `dt` offset
  - Playback speed control: 0.5×, 1×, 1.5×, 2× (adjust `dt` values proportionally)
  - Scrubber: since the game is deterministic, seeking to any point means replaying events up to that timestamp (fast-forward in logic, render only the target frame)

- **Replay viewer UI:**
  - Play/pause button
  - Speed selector
  - Timeline scrubber bar
  - "Play this level yourself" button → loads the same level fresh (clears replay mode)

---

### 6.7 Fail Speedrun Mode

Race to trigger the fail state as fast as possible. This meta-game mirrors the fake-ad phenomenon: the ads deliberately show the wrong answer because failure is more engaging than success.

**Implementation:**

```
src/shared/fail-speedrun.js
```

- **Activation:** toggle in game settings or swipe-up gesture on the level-complete screen → "Try Fail Speedrun?"
- **Modified rules per game:**

  | Game | Fail Speedrun Objective |
  |---|---|
  | Pull the Pin | First ball into wrong cup — fastest pin pull |
  | Water Sort | Pour wrong color into a tube — fastest wrong pour |
  | Parking Escape | N/A (no fail state) — instead: fewest moves to return to initial state (undo speedrun) |
  | Brain Teaser | Tap the most obvious wrong answer — fastest wrong tap |
  | Save the Character | Pick the worst choice — fastest tap |
  | Merge Games | Fill the grid completely (gridlock) — fastest overflow |
  | Crowd Runner | Reduce crowd to minimum before boss — lowest arrival count |
  | Giant Runner | Arrive at boss as small as possible — lowest scale |
  | Bridge Race | N/A — instead: let all opponents finish first (last place speedrun) |
  | Jelly Shift | Splat on the first wall — fastest splat |
  | Makeover Run | Hit every negative station — lowest score |
  | Satisfying/ASMR | N/A (no fail state) — excluded from fail speedrun |

- **Timer:** millisecond-precision timer starts on first input, stops on fail trigger
- **Leaderboard:** localStorage per-level fastest fail times; displayed as a personal best
- **Share integration:** Fail Speedrun completion triggers the video share flow (6.5) with fail-specific overlays (slow-motion fail moment, "FAIL" stamp, comic font timer)
- **"Ad Recreation" badge:** Completing a Fail Speedrun in under 3 seconds on Pull the Pin or Save the Character earns a special badge: "You just made a fake ad" — linking back to the research doc explaining why fail ads cut CPI by 55%

---

### 6.8 Swipe Navigation Between Games

Instead of returning to the hub to pick a new game, swipe left/right to switch games directly — like swiping between stories.

**Implementation:**

```
src/shared/swipe-nav.js
```

- **Game ordering:** games are arranged in a horizontal ring; the order matches the hub's display order (customizable via drag-reorder on the hub, persisted to localStorage)
- **Gesture detection:**
  - Horizontal swipe from edge (within 40px of screen edge) OR two-finger horizontal swipe anywhere → triggers game switch
  - This avoids conflicting with in-game horizontal swipe (steering in runners, dragging in puzzles) by requiring edge-initiation or two fingers
  - Swipe threshold: 80px horizontal displacement + velocity > 0.5px/ms
- **Transition animation:**
  - Current game canvas slides out in swipe direction
  - Next game's initial state slides in from the opposite side
  - During transition: both canvases visible simultaneously (current shrinks slightly, next grows)
  - Duration: 300ms ease-out
- **Preloading:**
  - Adjacent games (left and right neighbors in the ring) have their JS bundles preloaded via `<link rel="modulepreload">`
  - On swipe start (before threshold is met), begin initializing the adjacent game's state in the background
  - If swipe is cancelled (user swipes back), discard the pre-initialized state
- **State preservation:**
  - When swiping away from a game, its current state is saved to localStorage
  - When swiping back, the game resumes from saved state (not from level start)
  - Visual indicator: small dots at the top of the screen showing position in the game ring (like iOS page dots), with a filled dot for games with saved progress
- **Game ring indicator:**
  - Thin strip at top of screen: 12 small icons representing each game
  - Current game's icon is highlighted
  - Swiping scrolls the strip smoothly
  - Tap any icon → jump directly to that game (equivalent to hub navigation but without leaving the current context)

---

### 6.9 Frustration-Aware Adaptive Difficulty

Automatically adjust difficulty based on play signals. No settings menu, no "easy/medium/hard" — the game silently calibrates.

**Implementation:**

```
src/shared/adaptive.js
```

- **Signal collection (per game session, stored in localStorage):**

  | Signal | How Collected | What It Indicates |
  |---|---|---|
  | `retryCount` | Number of restarts on current level | Frustration (high) or exploration (low, with fast retries) |
  | `hesitationTime` | Time between level load and first input | Confusion (>10s) or planning (5-10s) or confidence (<5s) |
  | `undoRate` | Undos per move (puzzle games) | Uncertainty |
  | `rapidTapBursts` | Clusters of >3 taps within 500ms | Frustration or panic |
  | `solveTime` | Time to complete level | Skill calibration |
  | `hintUsage` | Hints requested per level | Difficulty mismatch |
  | `sessionLength` | Time since session start | Fatigue (long sessions → easier levels) |

- **Difficulty adjustment algorithm:**
  ```
  difficultyScore = weighted_average(
    retryCount     × -0.3,   // more retries → lower difficulty
    hesitationTime × -0.1,   // more hesitation → lower difficulty
    undoRate       × -0.2,   // more undos → lower difficulty
    rapidTapBursts × -0.2,   // more frustration taps → lower difficulty
    solveTime      × -0.1,   // slower solves → lower difficulty
    hintUsage      × -0.3,   // more hints → lower difficulty
    sessionLength  × -0.05   // longer sessions → slightly lower (fatigue)
  )
  ```
  - Score is maintained as an exponential moving average (α = 0.3) so recent performance weighs more than historical
  - Score maps to a difficulty tier: `tier = clamp(baseTier + round(difficultyScore), minTier, maxTier)`

- **What changes per difficulty tier:**

  | Game | Easier | Harder |
  |---|---|---|
  | Water Sort | Fewer colors, more empty tubes | More colors, fewer buffers |
  | Pull the Pin | Fewer pins, simpler routing | More pins, crossing channels |
  | Parking Escape | Fewer vehicles, lower optimal moves | More vehicles, higher optimal moves |
  | Brain Teaser | More obvious hints in the puzzle visual | More misdirection layers |
  | Crowd Runner | Better gate ratios, weaker boss | Worse gates, stronger boss |
  | Giant Runner | More matching collectibles, smaller boss | Fewer collectibles, larger boss |
  | Jelly Shift | Slower wall approach, simpler shapes | Faster walls, compound shapes |
  | Makeover Run | More positive stations, fewer negatives | More negatives, tighter spacing |
  | Bridge Race | Slower AI, more blocks | Faster AI, fewer blocks |

- **Silent operation:** The player never sees difficulty numbers or tier labels. The game just feels right. If a player suddenly improves (watched a strategy video, had a eureka moment), the system responds within 2-3 levels, not 20.

- **Anti-gaming:** Difficulty adjustments are invisible and have no impact on scoring or share cards. Daily challenges are exempt from adaptive difficulty — everyone plays the same level regardless of skill.

- **Override:** Settings page includes a hidden developer toggle (triple-tap the version number) that reveals the current difficulty tier and allows manual override — useful for testing and demonstration.

---

## Phase 7: Platform Features

Features that extend the collection into a creator platform, a social object, and an infinitely replayable system.

---

### 7.1 Cross-Device Progress Sync via Paste-a-Code

No accounts, no server, no database. Export all progress as a compact alphanumeric code; import on another device by pasting.

**What syncs:**
- Per-game: levels completed, best scores, best times, difficulty tier
- Global: settings (color-blind mode, sound, dark mode), daily challenge history, Quick Play profile, psychology journal entries unlocked

**Implementation:**

```
src/shared/sync.js
```

- `exportProgress()`:
  1. Collect all relevant localStorage keys into a single JSON object
  2. Strip ephemeral data (current in-progress state, session timers)
  3. `JSON.stringify()` → `pako.deflateRaw()` → base62 encode
  4. Prefix with version byte for forward compatibility
  5. Chunk into 5-character groups for readability: `SYNC-X7K3M-PLNV-8QR2-JW6T`

- `importProgress(code)`:
  1. Strip dashes and whitespace
  2. Base62 decode → `pako.inflateRaw()` → `JSON.parse()`
  3. Validate schema version; migrate if older format
  4. Merge into localStorage (imported data wins on conflict, except: keep the higher score if both devices have a score for the same level)
  5. Reload game state from updated localStorage

- **Code size estimate:** Typical progress (50 levels across 6 games, settings, journal) ≈ 2KB JSON → ~800 bytes compressed → ~1100 chars base62 → fits in a text message or written on paper as 22 groups of 5

- **Share flow:**
  1. Settings → "Sync Progress" → "Export" → code displayed + copied to clipboard
  2. On new device: Settings → "Sync Progress" → "Import" → paste code → "Progress restored"

- **Messaging integration:**
  - "Send to myself" button uses the same platform-picker from Phase 6.5's share system
  - Web Share API with `text` parameter (no files) for the simplest path:
    ```js
    navigator.share({
      title: 'My game progress',
      text: `Import this code in Settings → Sync:\n\n${syncCode}\n\nmobile-gaming.pages.dev`
    })
    ```
  - This opens the native share sheet — user picks iMessage, WhatsApp, Telegram, Signal, email, Slack, or any messaging app installed on their device
  - Platform-specific deep-link fallbacks for when Web Share API is unavailable:

    | Platform | Method |
    |---|---|
    | **SMS** | `sms:?body=...` URI scheme (works on iOS and Android) |
    | **WhatsApp** | `https://wa.me/?text=...` |
    | **Telegram** | `https://t.me/share/url?text=...` |
    | **Email** | `mailto:?subject=Game Progress&body=...` |
    | **Copy** | Clipboard API (always available) |

  - The message includes the sync code + a link to the site + brief instructions, so the recipient (even if it's the same person on another device) knows exactly what to do

---

### 7.2 "Design Your Own Ad" Compositor

*Priority: low — implement after base games are delightful to play. This is a fun bonus feature that layers on top of the recording infrastructure from Phase 6.5.*

A template-driven tool that turns gameplay recordings into fake mobile game ads. The player picks a template, the tool applies timing edits, text overlays, and the signature ad format, and exports a 15-second vertical video.

**Templates:**

| Template | Pattern | Auto-Applied Elements |
|---|---|---|
| **Fail Ad** | Show 2 wrong moves, cut before resolution | "NO!" text on fails, dramatic zoom, abrupt cut to black with "Download Now" |
| **Challenge Ad** | "Only 1% can solve this!" | Challenge banner at top, IQ percentage overlay, timer, skeptical emoji reactions |
| **Satisfying Ad** | Loop the most satisfying 3 seconds | Slow-motion, zoom on completion moment, seamless loop point, ASMR-style soft audio |
| **Drama Ad** | Show the choice, pause, wrong answer | Dramatic pause (1.5s freeze), wrong choice with red X, sad trombone SFX, "Would YOU survive?" |
| **Speedrun Ad** | Fast-forward through a solve | 4x speed with timer visible, abrupt stop at completion, "Can you beat 4.2s?" |

**Implementation:**

```
src/shared/ad-compositor.js
```

- **Input:** A gameplay recording buffer from Phase 6.5's passive 30-second recorder
- **Template definition format (JSON):**
  ```json
  {
    "name": "Fail Ad",
    "duration": 15,
    "segments": [
      { "source": "gameplay", "start": -8, "end": -5, "speed": 1, "label": "wrong-move-1" },
      { "source": "gameplay", "start": -4, "end": -2, "speed": 1, "label": "wrong-move-2" },
      { "source": "black", "duration": 0.5 },
      { "source": "outro", "duration": 2 }
    ],
    "overlays": [
      { "type": "text", "content": "NO!", "trigger": "wrong-move-1:end", "style": "comic-bold-red", "duration": 0.8 },
      { "type": "text", "content": "TRY AGAIN!", "trigger": "wrong-move-2:end", "style": "comic-bold-red", "duration": 0.8 },
      { "type": "text", "content": "Can YOU solve it?", "trigger": "outro:start", "style": "challenge-white", "duration": 2 },
      { "type": "qr", "trigger": "outro:start", "url": "{{stateUrl}}", "position": "bottom-center" }
    ]
  }
  ```
- **Compositor renders the template** by seeking through the recorded buffer, applying speed changes, drawing text overlays onto a compositing canvas, and encoding to MP4 via the same pipeline from Phase 6.5
- **UX flow:**
  1. Complete (or fail) a level → "Create an Ad?" button appears alongside "Share"
  2. Template picker: 5 templates shown as preview thumbnails (static mockups)
  3. Tap a template → 3-second render → preview plays in-app
  4. "Edit" → tweak the text overlays (change "Only 1% can solve this!" to custom text)
  5. "Export" → MP4 saved / shared via platform picker
- **Thematic payoff:** The project documents fake game ads. Now users create their own. The shared video IS a fake ad — with a QR code linking back to the actual playable game. Viral loop: see ad → scan QR → play game → make your own ad → share.

---

### 7.3 Endless Procedural Mode

After the hand-crafted levels are exhausted, the game generates infinite levels at the player's current difficulty tier. Play until you quit. Score: levels completed in the session.

**Implementation:**

```
src/shared/endless.js
```

- **Activation:** After completing the final hand-crafted level, the game offers "Keep going? Endless mode generates new puzzles forever." Also accessible from the level select screen as a dedicated "Endless" button.

- **Level pipeline (per generated level):**
  1. Read current difficulty tier from adaptive difficulty system (Phase 6.9)
  2. Map tier to generator parameters:
     | Tier | Water Sort | Parking Escape | Pull the Pin |
     |---|---|---|---|
     | 1 | 4 colors, 2 buffers | 4 vehicles, 4-move optimal | 3 pins, 2 colors |
     | 5 | 6 colors, 1 buffer | 8 vehicles, 12-move optimal | 6 pins, 4 colors |
     | 10 | 8 colors, 1 buffer | 12 vehicles, 25-move optimal | 8 pins, 5 colors |
  3. Call `generator.js` with a session-sequential seed: `createRng(sessionSeed + levelIndex)` — ensures the sequence is reproducible for replay sharing
  4. Run solver to verify solvability and compute difficulty metrics
  5. If solver fails or difficulty is outside target range: increment seed, regenerate (max 5 attempts, then relax constraints)
  6. Cache the generated level in memory (not localStorage — endless levels are ephemeral)

- **Applicable games and their generator readiness:**

  | Game | Generator Exists (from Phases 1-3) | Endless-Ready |
  |---|---|---|
  | Water Sort | Yes — shuffle-from-solved | Yes |
  | Parking Escape | Yes — iterative blocker placement | Yes |
  | Pull the Pin | Yes — channel routing + pin placement | Yes |
  | Merge Games | Yes — task + seed grid | Yes |
  | Crowd Runner | Yes — gate placement + boss sizing | Yes |
  | Giant Runner | Yes — collectible + obstacle placement | Yes |
  | Jelly Shift | Yes — wall shape + spacing | Yes |
  | Makeover Run | Yes — station placement | Yes |
  | Bridge Race | Yes — block + bridge placement | Yes |
  | Brain Teaser | No — hand-crafted only | No (excluded) |
  | Save the Character | No — hand-crafted only | No (excluded) |
  | Satisfying/ASMR | Procedural dirt patterns | Yes (infinite by nature) |

- **Scoring:**
  - Levels completed in the session = primary score
  - Bonus: streak multiplier for consecutive solves without hints (×1.0, ×1.2, ×1.5, ×2.0 — resets on hint use)
  - Session score displayed prominently; personal best stored in localStorage
  - "Endless run" shareable: session score + level count + game type as a share card

- **Difficulty ratchet:**
  - Every 5 levels, difficulty tier increments by 1 (independent of adaptive difficulty)
  - This creates a natural difficulty curve within the endless session — early levels are approachable, later levels are punishing
  - If the player fails (puzzle games: gives up after 3 retries; runners: loses), the session ends with final score
  - "Continue?" option: restart the current level but the streak multiplier resets to ×1.0

---

## Observability

### Client-Side Analytics (`shared/analytics.js`)

Lightweight, privacy-respecting event logging. No server, no PII, no cookies, no third-party scripts. All data stays in localStorage.

**Events recorded:**

| Event | Data | Purpose |
|---|---|---|
| `game_start` | gameId, levelId, timestamp, source (hub/quickplay/daily/deeplink) | Know which games are played and how players arrive |
| `level_complete` | gameId, levelId, moves, time, hintsUsed, optimalMoves, retries | Measure difficulty calibration and player skill |
| `level_abandon` | gameId, levelId, movesAtAbandon, timeAtAbandon, reason (quit/skip/crash) | Identify where players churn |
| `session_start` | timestamp, referrer, capabilities (from `capabilities.js`) | Understand device mix and entry points |
| `session_end` | timestamp, gamesPlayed, levelsCompleted, totalTime | Measure session depth |
| `feature_use` | feature (hint/undo/share/replay/daily/endless/failSpeedrun) | Track feature adoption |

**Storage:** Events append to `mg:global:analytics` as a JSON array, capped at 500 entries with LRU eviction. Total budget: ~200KB.

**Local dashboard:** In developer mode (triple-tap version number), a "Stats" tab shows:
- Games played per day (bar chart, last 14 days)
- Level completion rate per game (horizontal bars)
- Average solve time trend per game
- Most/least played games
- Feature adoption counters

All charts rendered with Canvas 2D — no charting library.

**Optional external analytics:** A single-line integration with Cloudflare Web Analytics (privacy-first, no cookies, GDPR-compliant, free tier). Disabled by default; enabled by adding the `<script>` tag to `src/hub/index.html`. Provides aggregate page views and web vitals without any PII collection.

### OG Meta Tags (`shared/meta.js`)

Each game's `index.html` includes static OG tags for rich social previews when URLs are shared:

```html
<meta property="og:title" content="Water Sort Puzzle — mobile-gaming">
<meta property="og:description" content="Sort the colored liquids. Can you solve it?">
<meta property="og:image" content="/og/water-sort.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://mobile-gaming.pages.dev/water-sort/">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

OG images (`public/og/<game>.png`) are 1200×630 PNGs generated by the Playwright screenshot test pass — a headless browser renders each game's initial state into a branded frame and saves it. Generated images are committed to the repo so they're available at deploy time without requiring Playwright in the build step.
