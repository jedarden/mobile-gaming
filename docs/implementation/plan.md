# Implementation Plan

## Objective

Build playable web-based versions of the 12 hyper-casual game types documented in `docs/research/`. Each game is deployed as its own standalone static site. A hub page links to all games but each game is fully self-contained — playable at its own URL with zero dependency on the hub or other games. Every game includes automated playtesting that proves levels are completable and core mechanics function correctly.

---

## Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| Runtime | Browser (HTML5) | Zero-install; works on mobile and desktop; matches hyper-casual distribution model |
| 2D rendering | Canvas 2D API | Sufficient for 8 of 12 games; no dependency overhead |
| 3D rendering | Three.js | Required for Crowd Runner, Giant Runner, Bridge Race, Jelly Shift, and Makeover Run |
| Physics (2D) | Custom per-game | Pull the Pin and Water Sort need deterministic gravity/flow; a generic engine adds unpredictability that breaks solvers |
| Physics (3D) | Cannon-es (Cannon.js ES fork) | Lightweight rigid-body + soft-body for Jelly Shift's blob deformation |
| Build | Vite | Fast HMR; native ES module support; trivial multi-page setup |
| Hosting | Cloudflare Pages | Static hosting at `mobile-gaming.pages.dev`; each game is a subpath (`/water-sort/`, `/pull-the-pin/`, etc.) |
| CI/CD | Argo Events + Argo Workflows | GitHub webhook → `webhooks-build.ardenone.com/mobile-gaming` → `website-build` WorkflowTemplate → `wrangler pages deploy` |
| Test runner | Vitest | Unit and integration tests for game logic and solvers |
| E2E testing | Playwright | Browser-based playtest automation; screenshot comparison for visual validation |
| Level format | JSON | Each game defines its own level schema; validated by JSON Schema |

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
│   │   ├── canvas.js       # Canvas 2D helper: setup, resize, DPR scaling
│   │   ├── three-setup.js  # Three.js scene/camera/renderer bootstrap
│   │   ├── input.js        # unified touch/mouse input (tap, drag, swipe)
│   │   ├── audio.js        # Web Audio API: SFX triggering, gain control
│   │   ├── colors.js       # shared 10-color accessible palette
│   │   ├── score.js        # shared scoring + level-complete overlay
│   │   └── rng.js          # seeded PRNG (Mulberry32) for deterministic level gen
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
├── renderer.js         # Canvas 2D or Three.js scene rendering
├── input.js            # game-specific input mapping (calls shared/input.js)
├── levels.json         # hand-crafted levels (or generated via gen script)
├── generator.js        # procedural level generation (if applicable)
└── styles.css          # game-specific CSS
```

The critical architectural rule: **`state.js` must never import rendering or DOM code.** All game logic lives in pure functions that accept a state object and an action, and return a new state. This makes the game logic directly testable by solvers without a browser.

---

## Implementation Phases

### Phase 0: Scaffolding

Build the shared infrastructure before any individual game.

**Deliverables:**
- Vite config with multi-page entry points (one per game + shell)
- Shared game shell: landing page listing all games, hash-based routing, back button
- `shared/canvas.js`: Canvas element creation, DPR-aware resize, requestAnimationFrame loop wrapper
- `shared/three-setup.js`: Scene + PerspectiveCamera + WebGLRenderer bootstrap, resize handler, RAF loop
- `shared/input.js`: Unified pointer events — normalizes `touchstart`/`mousedown`, `touchmove`/`mousemove`, `touchend`/`mouseup` into `{ type, x, y, dx, dy }` streams; exposes `onTap`, `onDrag`, `onSwipe` with configurable thresholds
- `shared/audio.js`: `playSound(name, volume)` using Web Audio API; sounds defined as short oscillator patterns (no audio file dependencies)
- `shared/colors.js`: 10-color palette designed for color-blind accessibility (derived from Okabe-Ito); each color has `hex`, `name`, `darkVariant`, `lightVariant`
- `shared/rng.js`: Mulberry32 seeded PRNG — `createRng(seed)` returns `{ next(), nextInt(min, max), shuffle(arr), pick(arr) }`
- Vitest config, Playwright config, test helper stubs
- JSON Schema files for level validation

**Automated test coverage for Phase 0:**
- Unit test: RNG produces identical sequences for identical seeds
- Unit test: input normalization returns consistent events for touch and mouse
- Unit test: color palette has 10 distinct colors, all pass WCAG AA contrast against white and black
- E2E test: shell loads, lists all 12 game links, each link navigates to the correct hash route

---

### Phase 1: 2D Puzzle Games (Canvas)

The four pure-puzzle games that use Canvas 2D rendering. These have the simplest rendering requirements and the richest solver opportunities.

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

**Input:**
- Tap on a pin → calls `removePin`; plays pull SFX
- After removal, physics simulation runs visually at 60fps until all balls settle

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

**Input:**
- Tap tube 1 → selected (highlighted); tap tube 2 → attempt pour
- Tap selected tube again → deselect
- Undo button in UI → calls `undo`

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

**Input:**
- Tap element → `{ action: "tap", targetId }`
- Drag element onto another → `{ action: "drag", sourceId, targetId }`
- Sequence: track ordered taps → `{ action: "sequence", steps: [targetId, ...] }`

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
- Vehicles: rounded rectangles; target vehicle is red, others are random palette colors
- Exit: gap in grid border with directional arrow
- Drag: vehicle slides along its axis following finger/mouse; snaps to grid on release
- Win: target car slides out through exit with acceleration animation; confetti particles

**Input:**
- Drag vehicle along its axis → calls `moveVehicle` on release (snap to nearest valid grid position)
- Tap undo button → calls `undo`

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

### Phase 2: 2D Interactive Games (Canvas)

Games with Canvas 2D rendering that are not pure puzzles — they involve choice, narrative, or feedback loops rather than spatial solving.

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

**Rendering:**
- Background: simple vector scenes (cliff, room, bridge, etc.) drawn with Canvas path operations
- Character: sprite-sheet-style frame animation; drawn from simple geometric shapes (circles, rectangles) not bitmap assets
- Choices: three large tap targets at bottom of screen with icons and labels
- Outcome animations: correct choice → character celebrates (bouncing, confetti); wrong choice → exaggerated slapstick failure (stretching, spinning, flying offscreen)

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

**Rendering:**
- Grid: soft pastel tiles with rounded corners
- Items: simple geometric icons that scale with tier (tier 0 = tiny dot, tier 5 = large complex shape); color-coded by chain
- Merge animation: both items shrink → center → burst into new higher-tier item with sparkle
- Bonus merge: gold sparkle instead of white; "+1" text floats up
- Task panel: sidebar showing task list with progress icons

**Input:**
- Drag item from cell to cell → if same item at destination, merge; if empty, move
- Cannot drag to occupied cell with different item (cell highlights red as feedback)

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

**Additional subtypes (implemented as variants):**
- **Bubble Pop:** grid of bubbles; tap to pop; all popped → complete
- **Soap Cutting:** drag blade across soap block; each slice reveals clean cross-section; full slice count → complete

**Rendering:**
- Two-layer Canvas: bottom layer = clean surface color; top layer = dirt overlay (drawn as opaque pixels)
- Spraying erases dirt layer pixels → clean surface is "revealed" underneath
- Particle effects: water droplets spray outward from nozzle position
- Sound: synthesized water-spray sound (white noise through bandpass filter) plays while spraying

**Input:**
- Touch/mouse down → nozzle active; continuous drag → continuous spray
- Touch/mouse up → nozzle inactive

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

Games that require 3D perspective, forward motion, and lane-based or arena-based interaction.

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
                  value: "npm ci && npm run build"
                - name: output-dir
                  value: dist
```

**3. WorkflowTemplate** (`website-build-workflowtemplate.yml`) — no changes needed. The existing template already supports parameterized repo, build command, and output directory.

### Cloudflare Pages Setup (One-Time)

1. Create Cloudflare Pages project `mobile-gaming` (first deploy creates it automatically via `wrangler pages deploy`)
2. Add custom domain `mobile-gaming.pages.dev` in Cloudflare Pages dashboard → Custom Domains
3. Cloudflare auto-provisions the DNS CNAME record since `jedarden.com` is already on Cloudflare

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
| 1 | Water Sort | Simplest state model; BFS solver is well-understood; highest ad authenticity |
| 2 | Parking Escape | Rush Hour solver is a known algorithm; pure-logic game with no physics |
| 3 | Pull the Pin | Introduces 2D physics; solver is more complex; the genre's most iconic mechanic |
| 4 | Brain Teaser | Data-driven levels; trivial solver; tests the element/interaction system |
| 5 | Save the Character | Trivial mechanic; tests animation and narrative pipeline |
| 6 | Merge Games | More complex state model; introduces spawn timers and variable reward |
| 7 | Satisfying / ASMR | Pixel-level dirt map; introduces Web Audio synthesis; no fail state simplifies testing |
| 8 | Crowd Runner | First Three.js game; simplest 3D — instanced meshes, linear course |
| 9 | Giant Runner | Similar to Crowd Runner but with scale manipulation |
| 10 | Makeover Run | Similar runner structure but with swappable character meshes |
| 11 | Bridge Race | Most complex 3D — arena movement, AI, sabotage mechanic |
| 12 | Jelly Shift | Most complex rendering — soft-body deformation, compound hole geometry |

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

### 5.5 Progressive Enhancement

- Offline support: Service Worker caches each game's assets after first load; games playable without network
- Add-to-homescreen: Web App Manifest with per-game `start_url`, appropriate icons, `display: fullscreen`
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
