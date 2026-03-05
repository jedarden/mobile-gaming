# Implementation Guide

## Architecture Overview

This is a **static game directory** hosted on Cloudflare Pages. Each game is self-contained but shares common systems for progression, storage, and PWA functionality.

```
mobile-gaming.pages.dev/
├── index.html                    # Directory landing page
├── profile/                      # Player profile & achievements
├── sw.js                         # Service worker (offline)
├── manifest.json                 # PWA manifest
├── shared/
│   ├── meta.js                   # XP, unlocks, achievements
│   ├── storage.js                # localStorage abstraction
│   ├── daily.js                  # Daily challenge seed
│   ├── audio.js                  # Sound manager
│   └── gif-export.js             # GIF generation
└── games/
    ├── water-sort/
    │   ├── index.html
    │   ├── game.js
    │   ├── renderer.js
    │   ├── levels.json
    │   └── generator.js          # Infinite mode
    ├── parking-escape/
    ├── bus-jam/
    └── pull-the-pin/
```

### Static-Only Constraints

All features must work without a backend server:
- ✅ localStorage / IndexedDB for persistence
- ✅ Client-side computation only
- ✅ Deterministic seeds for daily challenges
- ✅ Service workers for offline
- ✅ Web Share API for native sharing
- ✅ Canvas/WebGL for rendering
- ❌ No user accounts (local device only)
- ❌ No global leaderboards
- ❌ No real-time multiplayer
- ❌ No push notifications

---

## Platform Features (Directory Level)

### 1. Progressive Web App (PWA)

**Capability:** Install to home screen, work offline, feel native.

**manifest.json:**
```json
{
  "name": "Mobile Gaming",
  "short_name": "Games",
  "description": "Browser puzzle games that deliver what the ads promised",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f0f23",
  "theme_color": "#00d4ff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service Worker Strategy:**
- Cache-first for static assets (JS, CSS, images)
- Network-first for level data (allows updates)
- Offline fallback page for connectivity issues

```javascript
// sw.js - Workbox-style caching
const CACHE_NAME = 'mobile-gaming-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/shared/meta.js',
  '/games/water-sort/index.html',
  '/games/water-sort/game.js',
  // ... all game files
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

**Install Prompt:**
- Show custom "Add to Home Screen" banner after 3rd session
- Track `beforeinstallprompt` event
- Store dismissal in localStorage (don't annoy users)

---

### 2. Cross-Game Meta-Progression

**Capability:** Unified XP and unlocks across all games. Play any game, level up everywhere.

**Data Model:**
```javascript
// localStorage key: 'mobileGaming_profile'
{
  xp: 4250,
  level: 12,
  gamesPlayed: {
    'water-sort': { played: 45, stars: 87, bestStreak: 7 },
    'parking-escape': { played: 23, stars: 41, bestStreak: 4 },
    'bus-jam': { played: 12, stars: 18, bestStreak: 3 },
    'pull-the-pin': { played: 8, stars: 15, bestStreak: 2 }
  },
  achievements: ['first_win', 'streak_7', 'master_sorter', ...],
  unlockedCosmetics: ['theme_dark', 'tube_neon', 'car_gold'],
  settings: {
    soundEnabled: true,
    hapticEnabled: true,
    reducedMotion: false
  }
}
```

**XP Awards:**
| Action | XP |
|--------|-----|
| Complete level | 10 |
| 3-star completion | +15 bonus |
| Daily challenge | 25 |
| Streak day | 5 × streak_count |
| Achievement unlocked | 50-200 |

**Level Thresholds:**
```javascript
const XP_PER_LEVEL = [
  0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000,
  5000, 6500, 8000, 10000, 12500, 15000, 18000, 22000, 27000, 33000
  // ... continues
];
```

**Unlockables:**
| Level | Unlock |
|-------|--------|
| 2 | Dark theme |
| 5 | Neon tube skins |
| 8 | Metallic car skins |
| 10 | Confetti effects |
| 15 | Custom backgrounds |
| 20 | Animated themes |

**API (shared/meta.js):**
```javascript
export function addXP(amount, source) { ... }
export function getLevel() { ... }
export function unlockAchievement(id) { ... }
export function isUnlocked(cosmeticId) { ... }
export function getProfile() { ... }
export function resetProfile() { ... }  // For testing
```

---

### 3. Achievement System

**Achievement Categories:**

**Progress:**
- `first_win` - Complete your first level
- `centurion` - Complete 100 levels across all games
- `perfectionist` - Earn 50 three-star ratings
- `explorer` - Play all 4 games

**Streaks:**
- `streak_3` - 3-day streak
- `streak_7` - 7-day streak (weekly warrior)
- `streak_30` - 30-day streak (monthly master)

**Mastery (per game):**
- `water_sort_master` - 100 stars in Water Sort
- `parking_pro` - Complete all Parking Escape levels
- `bus_driver` - 50 perfect clears in Bus Jam
- `pin_wizard` - Solve 25 Pull the Pin levels without hints

**Challenge:**
- `speedster` - Solve any level in under 5 seconds
- `minimalist` - Solve a level in minimum possible moves
- `no_undo` - Complete 10 levels without using undo

**Achievement Display:**
- Toast notification on unlock (with XP bonus)
- Profile page shows all achievements (locked = silhouette)
- Hover/tap shows unlock criteria

---

### 4. Daily Challenge System

**Capability:** Same puzzle for everyone each day. Creates shared experience without needing a server.

**Seed Generation:**
```javascript
// shared/daily.js
export function getDailySeed() {
  const today = new Date().toISOString().slice(0, 10); // "2026-03-05"
  return hashString(today + 'mobile-gaming-salt');
}

export function getDailyLevel(game) {
  const seed = getDailySeed();
  const generator = getGenerator(game);
  return generator.generate(seed, { difficulty: 'medium' });
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

**Daily Challenge Flow:**
1. Player opens game → "Daily Challenge" button prominent
2. Same seed = same puzzle for all players worldwide
3. Track: completed, moves, time, stars earned
4. Store in localStorage: `daily_2026-03-05_water-sort: { moves: 12, time: 45, stars: 2 }`
5. Streak tracking: consecutive days with at least one daily completed

**UI Elements:**
- Calendar icon showing current streak
- "Today's Challenge" card on landing page
- Completion badge after solving
- "Come back tomorrow" message after completion

**Streak Rewards:**
| Streak | Bonus |
|--------|-------|
| 3 days | 2x XP for daily |
| 7 days | Unlock streak badge |
| 14 days | Unlock exclusive theme |
| 30 days | Unlock "Dedicated" title |

---

## Game-Level Features

### 5. Visual Undo Timeline

**Capability:** Scrub through your entire solution history. Jump to any point. Far superior to tap-undo.

**State History:**
```javascript
class GameHistory {
  constructor() {
    this.states = [];      // Array of game states
    this.currentIndex = -1;
  }

  push(state) {
    // Truncate any "future" states if we're not at the end
    this.states = this.states.slice(0, this.currentIndex + 1);
    this.states.push(structuredClone(state));
    this.currentIndex++;
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.states[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.states.length - 1) {
      this.currentIndex++;
      return this.states[this.currentIndex];
    }
    return null;
  }

  jumpTo(index) {
    if (index >= 0 && index < this.states.length) {
      this.currentIndex = index;
      return this.states[index];
    }
    return null;
  }

  getTimeline() {
    return this.states.map((state, i) => ({
      index: i,
      thumbnail: this.generateThumbnail(state),
      isCurrent: i === this.currentIndex
    }));
  }
}
```

**Timeline UI:**
```
┌─────────────────────────────────────────────────────────────┐
│  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]                    │
│   ○────○────○────●────○────○────○────○                      │
│              current ↑                                       │
│  ← drag to scrub →                                          │
└─────────────────────────────────────────────────────────────┘
```

**Thumbnail Generation:**
- Mini canvas render of game state (40x60px)
- Cached to avoid re-rendering
- Shows key visual elements (tube colors, car positions, etc.)

**Gestures:**
- Tap thumbnail → jump to that state
- Drag along timeline → smooth scrubbing
- Swipe left on game area → undo
- Swipe right on game area → redo
- Keyboard: Z = undo, Y = redo, number keys = jump

---

### 6. Share Solution as GIF

**Capability:** One-tap export of your solution as animated GIF for social sharing.

**Recording:**
```javascript
class SolutionRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.frames = [];
    this.isRecording = false;
  }

  startRecording() {
    this.frames = [];
    this.isRecording = true;
  }

  captureFrame() {
    if (!this.isRecording) return;
    this.frames.push({
      imageData: this.canvas.toDataURL('image/png'),
      timestamp: performance.now()
    });
  }

  stopRecording() {
    this.isRecording = false;
    return this.frames;
  }
}
```

**GIF Generation (using gif.js):**
```javascript
async function createSolutionGIF(frames, options = {}) {
  const {
    width = 400,
    height = 600,
    quality = 10,
    delay = 200  // ms between frames
  } = options;

  const gif = new GIF({
    workers: 2,
    quality,
    width,
    height,
    workerScript: '/shared/gif.worker.js'
  });

  for (const frame of frames) {
    const img = await loadImage(frame.imageData);
    gif.addFrame(img, { delay });
  }

  return new Promise((resolve, reject) => {
    gif.on('finished', blob => resolve(blob));
    gif.on('error', reject);
    gif.render();
  });
}
```

**Share Flow:**
1. Player completes level
2. "Share" button appears
3. Click → replay solution at 2x speed while recording
4. Generate GIF (show progress bar)
5. Preview GIF
6. Share via Web Share API or download

**Watermark:**
- Level name + move count in corner
- "mobile-gaming.pages.dev" subtle branding
- Optional: player's username if set

**Web Share API:**
```javascript
async function shareGIF(blob, levelName) {
  const file = new File([blob], `${levelName}.gif`, { type: 'image/gif' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: `I solved ${levelName}!`,
      text: `Check out my solution on Mobile Gaming`
    });
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${levelName}.gif`;
    a.click();
  }
}
```

---

### 7. Procedural Infinite Mode

**Capability:** Never run out of levels. Algorithm generates valid, solvable puzzles forever.

**Seeded Random Number Generator:**
```javascript
// Mulberry32 - fast, seedable PRNG
function createRNG(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

**Water Sort Generator:**
```javascript
function generateWaterSortLevel(seed, config = {}) {
  const rng = createRNG(seed);
  const { tubeCount = 6, colorsCount = 4, emptyTubes = 2 } = config;

  // Start with solved state
  const tubes = [];
  for (let i = 0; i < colorsCount; i++) {
    tubes.push(Array(4).fill(i));  // 4 segments of color i
  }
  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([]);
  }

  // Shuffle by performing random valid pours (reverse solving)
  const shuffleMoves = 50 + Math.floor(rng() * 50);
  for (let i = 0; i < shuffleMoves; i++) {
    const validMoves = getValidMoves(tubes);
    if (validMoves.length === 0) break;
    const move = validMoves[Math.floor(rng() * validMoves.length)];
    applyMove(tubes, move);
  }

  // Verify solvable (BFS with move limit)
  if (!isSolvable(tubes, 100)) {
    return generateWaterSortLevel(seed + 1, config);  // Retry with different seed
  }

  return { tubes, seed, difficulty: estimateDifficulty(tubes) };
}
```

**Parking Escape Generator:**
```javascript
function generateParkingLevel(seed, config = {}) {
  const rng = createRNG(seed);
  const { gridSize = 6, carCount = 8 } = config;

  // Place target car
  const targetRow = Math.floor(rng() * gridSize);
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

  const cars = [{
    id: 'target',
    x: 0,
    y: targetRow,
    length: 2,
    orientation: 'horizontal',
    color: 'red'
  }];

  // Place blocking cars
  for (let i = 0; i < carCount; i++) {
    const car = placeRandomCar(grid, rng, i);
    if (car) cars.push(car);
  }

  // Verify solvable
  if (!isSolvable(cars, gridSize)) {
    return generateParkingLevel(seed + 1, config);
  }

  return { cars, gridSize, seed, minMoves: findMinMoves(cars, gridSize) };
}
```

**Infinite Mode UI:**
- "Infinite Mode" toggle on game menu
- Shows current seed (shareable)
- Difficulty ramps up every 10 levels
- Track: highest level reached, best average solve time

**Seed Sharing:**
- Display seed as short code: `X7K9M` (base36 encoding)
- "Challenge a friend" → copy seed to clipboard
- Entering seed plays exact same sequence

---

### 8. Smart Adaptive Difficulty

**Capability:** Game learns your skill level and adjusts automatically. Never too hard, never too easy.

**Skill Metrics (per game):**
```javascript
// localStorage key: 'mobileGaming_skill_water-sort'
{
  recentSolves: [
    { level: 45, moves: 12, optimal: 8, time: 34, undos: 3 },
    { level: 46, moves: 15, optimal: 10, time: 52, undos: 7 },
    // ... last 20 solves
  ],
  abandonRate: 0.15,       // 15% of started levels abandoned
  averageEfficiency: 0.72, // moves / optimal moves
  averageSpeed: 1.2,       // relative to expected time
  skillScore: 65           // 0-100 composite score
}
```

**Skill Score Calculation:**
```javascript
function calculateSkillScore(metrics) {
  const weights = {
    efficiency: 0.4,      // How close to optimal
    speed: 0.2,           // How fast
    consistency: 0.2,     // Low variance in performance
    persistence: 0.2      // Low abandon rate
  };

  const efficiency = Math.min(1, metrics.averageEfficiency);
  const speed = Math.min(1, 1 / metrics.averageSpeed);
  const consistency = 1 - Math.min(1, metrics.variance / 10);
  const persistence = 1 - metrics.abandonRate;

  return Math.round(
    (efficiency * weights.efficiency +
     speed * weights.speed +
     consistency * weights.consistency +
     persistence * weights.persistence) * 100
  );
}
```

**Level Selection:**
```javascript
function selectNextLevel(skillScore, availableLevels) {
  // Target difficulty band based on skill
  const targetDifficulty = skillScore / 100;  // 0.0 - 1.0
  const bandwidth = 0.15;  // ±15% variance for variety

  const suitable = availableLevels.filter(level => {
    const diff = level.difficulty;
    return diff >= targetDifficulty - bandwidth &&
           diff <= targetDifficulty + bandwidth;
  });

  // Prefer unplayed levels
  const unplayed = suitable.filter(l => !l.played);
  if (unplayed.length > 0) {
    return randomChoice(unplayed);
  }

  // Fallback to any suitable
  return suitable.length > 0 ? randomChoice(suitable) : randomChoice(availableLevels);
}
```

**Difficulty Adjustment Triggers:**
| Signal | Adjustment |
|--------|------------|
| 3 consecutive fails | Decrease target difficulty 10% |
| 3 consecutive 3-stars | Increase target difficulty 10% |
| Abandon level | Note frustration, slightly decrease |
| Solve much faster than expected | Increase difficulty 5% |

**UI Indicators:**
- No explicit difficulty display (seamless)
- Optional: "Challenge Mode" toggle disables adaptation
- Settings: "Reset skill profile" option

---

## Game-Specific Implementations

### Water Sort

**Game State:**
```javascript
{
  tubes: [
    ["red", "blue", "red", "green"],
    ["blue", "green", "blue", "red"],
    ["green", "red", "green", "blue"],
    []
  ],
  selectedTube: null,
  moves: 0
}
```

**Mechanics:**
- Tap tube to select
- Tap another tube to pour
- Pour succeeds if: dest empty OR (dest has space AND top colors match)
- All consecutive same-color segments pour at once
- Win: all tubes single-color or empty

**Art Direction:**
```css
--liquid-red: #FF6B6B;
--liquid-blue: #4ECDC4;
--liquid-green: #95E879;
--liquid-yellow: #FFE66D;
--liquid-purple: #A66CFF;
--liquid-orange: #FF9F45;

--tube-glass: rgba(255, 255, 255, 0.15);
--tube-border: rgba(255, 255, 255, 0.3);
```

**Animations:**
| Action | Animation | Duration |
|--------|-----------|----------|
| Select tube | Scale 1.05, lift 8px, glow | 150ms |
| Pour | Tilt source, liquid arc, fill dest | 600ms |
| Invalid | Shake horizontal | 200ms |
| Complete tube | Sparkle burst | 400ms |
| Win | Confetti, all tubes sparkle | 1200ms |

**Level Data Format:**
```json
{
  "id": 1,
  "difficulty": 0.2,
  "optimal": 5,
  "tubes": [
    ["red", "blue", "red", "blue"],
    ["blue", "red", "blue", "red"],
    []
  ]
}
```

---

### Parking Escape

**Game State:**
```javascript
{
  gridSize: 6,
  cars: [
    { id: "target", x: 0, y: 2, length: 2, orientation: "horizontal", color: "red" },
    { id: "car1", x: 2, y: 0, length: 2, orientation: "vertical", color: "blue" },
    { id: "truck1", x: 0, y: 4, length: 3, orientation: "horizontal", color: "yellow" }
  ],
  exit: { x: 6, y: 2 },
  moves: 0
}
```

**Mechanics:**
- Drag cars along their axis
- Cars cannot overlap
- Target car (red) must reach exit
- Minimum moves = star rating

**Art Direction:**
```css
--car-red: #E63946;
--car-blue: #457B9D;
--car-green: #2A9D8F;
--car-yellow: #E9C46A;

--grid-bg: #264653;
--exit-glow: #00FF88;
```

**Vehicle Visuals (top-down):**
```
Car (2 cells):       Truck (3 cells):
╭─────────╮          ╭───┬─────────╮
│  ◯   ◯  │          │ ◯◯│  CARGO  │
╰─────────╯          ╰───┴─────────╯
```

**Animations:**
| Action | Animation | Duration |
|--------|-----------|----------|
| Drag | Smooth follow with shadow growth | Continuous |
| Snap | Overshoot ease | 200ms |
| Blocked | Flash colliding car | 150ms |
| Win | Target drives off, others fade | 1000ms |

---

### Bus Jam

**Game State:**
```javascript
{
  grid: { cols: 5, rows: 7 },
  buses: [
    { id: "bus1", x: 1, y: 3, color: "red", passengers: 0, capacity: 4 }
  ],
  stops: [
    { x: 0, y: 2, color: "red", waiting: 4 }
  ],
  exits: [{ x: 5, y: 3 }],
  moves: 0
}
```

**Mechanics:**
- Tap bus to select
- Tap road cell to set destination
- Bus moves along path (if unblocked)
- Bus at matching stop: passengers board
- Full bus can exit

**Art Direction:**
```css
--bus-red: #FF6B6B;
--bus-blue: #4DABF7;
--bus-green: #69DB7C;
--bus-yellow: #FFD93D;

--road: #4A4A5A;
--road-marking: #FFFFFF;
```

**Animations:**
| Action | Animation | Duration |
|--------|-----------|----------|
| Bus move | Smooth translation per cell | 400ms/cell |
| Passenger board | Jump arc into bus | 300ms each |
| Bus exit | Accelerate + honk | 600ms |
| Blocked | Red X flash | 200ms |

---

### Pull the Pin

**Game State:**
```javascript
{
  balls: [{ id: 1, x: 100, y: 50, radius: 15, color: "gold" }],
  pins: [{ id: "pin1", x: 150, y: 100, angle: 0, length: 60 }],
  hazards: [{ type: "lava", x: 50, y: 300, width: 100, height: 20 }],
  goal: { x: 150, y: 350, width: 80, height: 40 },
  walls: [/* collision geometry */]
}
```

**Physics (simplified, no Matter.js dependency):**
```javascript
class PhysicsEngine {
  constructor() {
    this.gravity = 0.5;
    this.friction = 0.99;
    this.bounce = 0.7;
  }

  update(ball, walls, dt) {
    // Apply gravity
    ball.vy += this.gravity * dt;

    // Apply friction
    ball.vx *= this.friction;
    ball.vy *= this.friction;

    // Move
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Collision with walls
    for (const wall of walls) {
      if (this.intersects(ball, wall)) {
        this.resolveCollision(ball, wall);
      }
    }
  }
}
```

**Art Direction:**
```css
--ball-gold: #FFD700;
--pin-metal: #A0A0A0;
--lava: linear-gradient(#FF4500, #FF6B00);
--goal: linear-gradient(#00C853, #00E676);
```

**Animations:**
| Action | Animation | Duration |
|--------|-----------|----------|
| Pin remove | Slide out + fade | 200ms |
| Ball bounce | Squash/stretch | Per impact |
| Lava splash | Particles + sizzle | 300ms |
| Goal collect | Sparkle burst | 400ms |

---

## Shared UI Components

### Game Shell

Every game page includes:
```html
<div class="game-shell">
  <header class="game-header">
    <button class="back-btn">←</button>
    <h1 class="game-title">Water Sort</h1>
    <div class="header-stats">
      <span class="moves">Moves: 0</span>
      <span class="xp-indicator">+10 XP</span>
    </div>
  </header>

  <main class="game-canvas-container">
    <canvas id="game-canvas"></canvas>
  </main>

  <footer class="game-controls">
    <div class="undo-timeline"><!-- Timeline scrubber --></div>
    <div class="action-buttons">
      <button class="undo-btn">↶</button>
      <button class="redo-btn">↷</button>
      <button class="restart-btn">↻</button>
      <button class="hint-btn">💡</button>
    </div>
  </footer>

  <div class="level-complete-modal" hidden>
    <div class="stars">⭐⭐⭐</div>
    <p class="stats">12 moves • 34 seconds</p>
    <p class="xp-earned">+25 XP</p>
    <button class="share-btn">Share GIF</button>
    <button class="next-btn">Next Level</button>
  </div>
</div>
```

### Responsive Layout

```css
/* Mobile portrait (default) */
.game-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* Dynamic viewport for mobile */
}

.game-canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.game-controls {
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

/* Landscape */
@media (orientation: landscape) {
  .game-shell {
    flex-direction: row;
  }
  .game-controls {
    flex-direction: column;
    width: 120px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .game-canvas-container {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 2.5s |
| Total bundle (per game) | < 150KB gzipped |
| Animation framerate | 60fps |
| Offline capability | 100% gameplay |

**Optimization Strategies:**
- Code splitting per game (lazy load)
- Preload critical assets
- Use CSS transforms (GPU accelerated)
- Debounce input handlers
- Object pooling for particles

---

## File Size Budget

```
shared/           ~30KB
├── meta.js         8KB
├── storage.js      3KB
├── daily.js        2KB
├── audio.js        5KB
├── gif-export.js  12KB

games/water-sort/ ~40KB
├── game.js        15KB
├── renderer.js    10KB
├── generator.js    8KB
├── levels.json     7KB

Total per game: ~70KB (before gzip)
Full site: ~300KB (all 4 games)
```

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [x] Project setup, Vite, CI/CD
- [ ] PWA manifest + service worker
- [ ] Shared storage/meta system
- [ ] Landing page with game cards

### Phase 2: First Game (Week 2)
- [ ] Water Sort core gameplay
- [ ] Visual undo timeline
- [ ] 20 handcrafted levels
- [ ] Basic animations

### Phase 3: Polish (Week 3)
- [ ] GIF export
- [ ] Daily challenge system
- [ ] Achievement system
- [ ] Sound effects

### Phase 4: More Games (Weeks 4-6)
- [ ] Parking Escape
- [ ] Bus Jam
- [ ] Pull the Pin
- [ ] Infinite mode generators

### Phase 5: Optimization (Week 7)
- [ ] Adaptive difficulty
- [ ] Performance tuning
- [ ] Accessibility audit
- [ ] Cross-browser testing

---

## Analytics (Privacy-Respecting)

Use simple, self-hosted analytics or privacy-focused services:

**Tracked Events (anonymous):**
- Page views
- Game starts
- Level completions
- Feature usage (GIF export, infinite mode)
- Error rates

**Not Tracked:**
- Personal information
- Solution data
- Device identifiers

**Implementation:**
```javascript
// Simple beacon, no cookies
function trackEvent(name, data = {}) {
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/event', JSON.stringify({
      event: name,
      timestamp: Date.now(),
      ...data
    }));
  }
}
```

Or use Plausible/Fathom (privacy-focused, GDPR compliant).

---

## Social Sharing & Brag Content

### Shareable Achievement Cards

**Capability:** Generate beautiful, branded images showing player achievements for social media bragging.

**Share Card Types:**

1. **Milestone Card** - "I just hit Level 25!"
2. **Streak Card** - "🔥 30-day streak!"
3. **Mastery Card** - "Water Sort Master - 100 stars"
4. **Daily Challenge Card** - "Solved today's puzzle in 8 moves"
5. **Stats Card** - "My 2026 Gaming Wrapped"

**Card Generation (Canvas-based):**
```javascript
async function generateShareCard(type, data) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;  // Instagram-friendly
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#0f0f23');
  gradient.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  // Decorative elements
  drawParticles(ctx);
  drawLogo(ctx, 50, 50);

  // Content based on type
  switch(type) {
    case 'streak':
      drawStreakCard(ctx, data);
      break;
    case 'milestone':
      drawMilestoneCard(ctx, data);
      break;
    case 'daily':
      drawDailyCard(ctx, data);
      break;
    // ...
  }

  // Branding footer
  ctx.font = '24px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('mobile-gaming.pages.dev', 540, 1040);

  return canvas.toDataURL('image/png');
}
```

**Share Card Visual Design:**
```
┌─────────────────────────────────┐
│  🎮 Mobile Gaming               │
│                                 │
│       🔥 30 DAY STREAK 🔥       │
│                                 │
│    ╭─────────────────────╮      │
│    │                     │      │
│    │    [Calendar Grid]  │      │
│    │    showing streak   │      │
│    │                     │      │
│    ╰─────────────────────╯      │
│                                 │
│      547 levels completed       │
│      12,450 XP earned           │
│                                 │
│  ─────────────────────────────  │
│  mobile-gaming.pages.dev        │
└─────────────────────────────────┘
```

**Brag Triggers (auto-prompt share):**
| Event | Card Type | Message |
|-------|-----------|---------|
| Reach level 10, 25, 50, 100 | Milestone | "I just hit Level X!" |
| 7, 14, 30, 100 day streak | Streak | "X days and counting!" |
| 100 stars in any game | Mastery | "I mastered [Game]!" |
| Daily challenge solved | Daily | "Beat today's challenge" |
| First time solving without undo | Challenge | "No undo needed!" |

**Share Flow:**
1. Achievement unlocked → modal with card preview
2. "Share" button prominent
3. Web Share API (mobile) or download (desktop)
4. Pre-filled text: "I just [achievement] on Mobile Gaming! 🎮"

**Profile Share:**
```javascript
// Generate comprehensive stats card
function generateProfileCard() {
  const profile = getProfile();
  return generateShareCard('profile', {
    level: profile.level,
    totalXP: profile.xp,
    gamesPlayed: Object.values(profile.gamesPlayed).reduce((a,b) => a + b.played, 0),
    totalStars: Object.values(profile.gamesPlayed).reduce((a,b) => a + b.stars, 0),
    longestStreak: profile.longestStreak,
    achievements: profile.achievements.length,
    favoriteGame: getFavoriteGame(profile)
  });
}
```

**Twitter/X Optimized:**
- 1200x675 landscape card for link previews
- 1080x1080 square for image posts
- Contrast meets accessibility standards

---

## Zen Mode

### Concept

A distraction-free, pressure-free experience focused on the meditative qualities of puzzle-solving.

**Philosophy:**
- No scores, no stars, no judgment
- No timers, no move counters
- No fail states (in applicable games)
- Calming visuals and audio
- Play for relaxation, not competition

### Supported Games

| Game | Zen Compatible | Notes |
|------|----------------|-------|
| Water Sort | ✅ Excellent | Perfect for zen - satisfying pours, no pressure |
| Parking Escape | ✅ Good | Relaxing sliding, no fail state |
| Bus Jam | ⚠️ Partial | Can work without timer |
| Pull the Pin | ❌ Limited | Physics creates inherent "fail" moments |

### Zen Mode Features

**Visual Changes:**
```css
.zen-mode {
  /* Softer color palette */
  --liquid-red: #D4A5A5;
  --liquid-blue: #A5C4D4;
  --liquid-green: #A5D4B8;
  
  /* Slower, gentler animations */
  --animation-duration: 1.5x;
  --animation-easing: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Minimal UI */
  .move-counter, .timer, .star-rating { display: none; }
  .undo-btn { opacity: 0.5; }  /* De-emphasized but available */
}
```

**Audio Ambiance:**
- Gentle background: soft piano, rain, nature sounds
- Sound effects: muted, softer versions
- Option: external audio passthrough (play your own music)

**Gameplay Adjustments:**

Water Sort (Zen):
- Unlimited undo (no penalty)
- No move counter
- No optimal solution comparison
- Completion message: "Beautiful" instead of stars
- Auto-continue to next puzzle (no celebration modal)

Parking Escape (Zen):
- No minimum moves goal
- Gentle hint available always
- No timer
- Completion: "Cleared" with soft chime

Bus Jam (Zen):
- No timer
- No efficiency scoring
- Passengers board slower (more satisfying)
- No "blocked" frustration indicators

**Infinite Zen:**
- Combine with Infinite Mode
- Endless, gently-paced puzzles
- Difficulty stays comfortable (no ramping)
- "Flow state" optimization

### Zen Mode Toggle

**Location:** Settings menu + per-game quick toggle

**UI:**
```html
<div class="zen-toggle">
  <label>
    <input type="checkbox" id="zen-mode">
    <span class="toggle-track">
      <span class="toggle-thumb">🧘</span>
    </span>
    <span class="label">Zen Mode</span>
  </label>
  <p class="description">No scores. No pressure. Just puzzles.</p>
</div>
```

**State Persistence:**
```javascript
// Settings stored separately from progress
localStorage.setItem('mobileGaming_settings', JSON.stringify({
  zenMode: true,
  zenAmbiance: 'rain',
  soundEnabled: true,
  // ...
}));
```

### Zen Session Summary

Instead of scores, show gentle summary:
```
┌─────────────────────────────────┐
│                                 │
│        Session Complete         │
│                                 │
│     🧘 15 puzzles enjoyed 🧘    │
│                                 │
│       Time: 23 minutes          │
│                                 │
│   "Take a deep breath. Well    │
│    done."                       │
│                                 │
│      [Continue] [Exit]          │
│                                 │
└─────────────────────────────────┘
```

### Ambient Audio Options

| Ambiance | Description |
|----------|-------------|
| Silent | No background, just soft SFX |
| Rain | Gentle rainfall |
| Piano | Soft piano loops |
| Nature | Forest birds, streams |
| Lo-fi | Chill beats |
| Ocean | Waves and seagulls |

**Implementation:**
```javascript
class AmbientAudio {
  constructor() {
    this.tracks = {
      rain: '/audio/ambient/rain.mp3',
      piano: '/audio/ambient/piano.mp3',
      // ...
    };
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = 0.3;
  }

  play(track) {
    this.audio.src = this.tracks[track];
    this.audio.play();
  }

  fadeOut(duration = 1000) {
    const step = this.audio.volume / (duration / 50);
    const fade = setInterval(() => {
      if (this.audio.volume > step) {
        this.audio.volume -= step;
      } else {
        this.audio.pause();
        this.audio.volume = 0.3;
        clearInterval(fade);
      }
    }, 50);
  }
}
```

### Zen Mode XP

Zen mode still earns XP (to not punish relaxation):
- Flat 5 XP per puzzle completed (no bonus for efficiency)
- No achievements tied to zen mode
- Separate "Zen puzzles enjoyed" stat on profile

---

## Game Pipeline: Discover, Build, Test, Deploy

### Overview

A systematic process for expanding the game library while maintaining quality and consistency.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  DISCOVER   │───▶│    BUILD    │───▶│    TEST     │───▶│   DEPLOY    │
│             │    │             │    │             │    │             │
│ Find games  │    │ Scaffold &  │    │ QA, perf,   │    │ PR, review, │
│ worth making│    │ implement   │    │ playtest    │    │ release     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

### Phase 1: Discovery

**Goal:** Identify game concepts worth building.

#### Source Channels

| Source | What to Look For |
|--------|------------------|
| App Store ads | "Fake gameplay" ads that look fun but the real game doesn't deliver |
| TikTok/Reels | Viral puzzle game clips with high engagement |
| Itch.io | Indie puzzle games with clever mechanics |
| Game jams | Novel mechanics from 48-hour jams |
| Player requests | Community suggestions in GitHub issues |

#### Evaluation Criteria

```javascript
// docs/game-evaluation-template.md
## Game Evaluation: [Game Name]

### Concept
**One-sentence pitch:** [e.g., "Sort colored liquids by pouring between tubes"]
**Core mechanic:** [What the player does repeatedly]
**Win condition:** [How a level ends successfully]
**Fail condition:** [If applicable - how can player lose?]

### Feasibility Checklist
- [ ] Works without backend (pure client-side logic)
- [ ] No real-time multiplayer required
- [ ] Physics can be simplified (no complex simulation)
- [ ] Level generation is deterministic (for daily challenges)
- [ ] Touch/mouse controls are intuitive
- [ ] Single-screen gameplay (no scrolling worlds)

### Appeal Assessment
| Criteria | Score (1-5) | Notes |
|----------|-------------|-------|
| Satisfying feedback | ? | Does completing actions feel good? |
| Visual clarity | ? | Can player immediately understand state? |
| Depth vs complexity | ? | Easy to learn, interesting to master? |
| Mobile-friendly | ? | Works in portrait, thumb-reachable? |
| Session length | ? | 1-5 minutes per level? |
| Shareability | ? | Would players show solutions to friends? |

### Unique Value
- Why build this instead of alternatives?
- What will our version do better?

### Technical Risks
- [ ] Risk 1: [description]
- [ ] Risk 2: [description]

### Verdict
**Proceed:** ✅ / ❌ / 🔄 (needs prototype)
```

#### Prototyping Gate

Before full implementation, create a 1-2 day throwaway prototype:
- Core mechanic only (no polish)
- 3 handcrafted levels
- Basic touch controls
- Answer: "Is this actually fun?"

---

### Phase 2: Build

#### Game Scaffold Generator

```bash
# scripts/new-game.sh
#!/bin/bash
GAME_NAME=$1
GAME_SLUG=$(echo "$GAME_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

mkdir -p "src/games/$GAME_SLUG"
cd "src/games/$GAME_SLUG"

# Generate boilerplate files
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>{{GAME_NAME}} - Mobile Gaming</title>
  <link rel="stylesheet" href="/shared/styles/game-shell.css">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="game-shell" data-game="{{GAME_SLUG}}">
    <header class="game-header">
      <a href="/" class="back-btn">←</a>
      <h1>{{GAME_NAME}}</h1>
      <div class="header-stats">
        <span class="moves">Moves: <span id="move-count">0</span></span>
      </div>
    </header>
    <main class="game-canvas-container">
      <canvas id="game-canvas"></canvas>
    </main>
    <footer class="game-controls">
      <div class="undo-timeline" id="timeline"></div>
      <div class="action-buttons">
        <button id="undo-btn" class="icon-btn" disabled>↶</button>
        <button id="redo-btn" class="icon-btn" disabled>↷</button>
        <button id="restart-btn" class="icon-btn">↻</button>
        <button id="hint-btn" class="icon-btn">💡</button>
      </div>
    </footer>
  </div>
  <script type="module" src="./main.js"></script>
</body>
</html>
EOF

cat > main.js << 'EOF'
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { addXP, unlockAchievement } from '/shared/meta.js';
import { GameHistory } from '/shared/history.js';
import levels from './levels.json';

const canvas = document.getElementById('game-canvas');
const game = new Game();
const renderer = new Renderer(canvas);
const input = new InputHandler(canvas);
const history = new GameHistory();

let currentLevel = 0;

function loadLevel(index) {
  const levelData = levels[index];
  game.load(levelData);
  history.clear();
  history.push(game.getState());
  render();
}

function render() {
  renderer.render(game.getState());
  updateUI();
}

function updateUI() {
  document.getElementById('move-count').textContent = game.moves;
  document.getElementById('undo-btn').disabled = !history.canUndo();
  document.getElementById('redo-btn').disabled = !history.canRedo();
}

function handleMove(action) {
  if (game.applyMove(action)) {
    history.push(game.getState());
    render();

    if (game.isComplete()) {
      onLevelComplete();
    }
  }
}

function onLevelComplete() {
  const stars = game.calculateStars();
  addXP(10 + (stars * 5));
  // Show completion modal
  showCompletionModal(stars, game.moves);
}

// Initialize
input.onAction = handleMove;
document.getElementById('undo-btn').onclick = () => {
  const state = history.undo();
  if (state) {
    game.setState(state);
    render();
  }
};
document.getElementById('redo-btn').onclick = () => {
  const state = history.redo();
  if (state) {
    game.setState(state);
    render();
  }
};
document.getElementById('restart-btn').onclick = () => loadLevel(currentLevel);

loadLevel(currentLevel);
EOF

cat > game.js << 'EOF'
export class Game {
  constructor() {
    this.state = null;
    this.moves = 0;
  }

  load(levelData) {
    // TODO: Initialize state from level data
    this.state = structuredClone(levelData);
    this.moves = 0;
  }

  getState() {
    return structuredClone(this.state);
  }

  setState(state) {
    this.state = structuredClone(state);
  }

  applyMove(action) {
    // TODO: Implement game logic
    // Return true if move was valid, false otherwise
    return false;
  }

  isComplete() {
    // TODO: Check win condition
    return false;
  }

  calculateStars() {
    // TODO: Based on moves vs optimal
    return 1;
  }
}
EOF

cat > renderer.js << 'EOF'
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.scale(dpr, dpr);
  }

  render(state) {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // TODO: Implement rendering
  }
}
EOF

cat > input.js << 'EOF'
export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.onAction = null;

    // Touch events
    canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });

    // Mouse fallback
    canvas.addEventListener('mousedown', (e) => this.handleStart(e));
    canvas.addEventListener('mousemove', (e) => this.handleMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleEnd(e));
  }

  getPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  handleStart(e) {
    e.preventDefault();
    // TODO: Implement input handling
  }

  handleMove(e) {
    e.preventDefault();
    // TODO: Implement drag handling
  }

  handleEnd(e) {
    e.preventDefault();
    // TODO: Implement release handling
  }
}
EOF

cat > styles.css << 'EOF'
/* Game-specific styles */
.game-shell[data-game="{{GAME_SLUG}}"] {
  --game-primary: #4ECDC4;
  --game-secondary: #FF6B6B;
}
EOF

cat > levels.json << 'EOF'
[
  {
    "id": 1,
    "difficulty": 0.1,
    "optimal": 3
  },
  {
    "id": 2,
    "difficulty": 0.2,
    "optimal": 5
  },
  {
    "id": 3,
    "difficulty": 0.3,
    "optimal": 8
  }
]
EOF

# Create generator if applicable
cat > generator.js << 'EOF'
import { createRNG } from '/shared/rng.js';

export function generateLevel(seed, config = {}) {
  const rng = createRNG(seed);

  // TODO: Implement procedural level generation
  // Must be deterministic based on seed
  // Must verify solvability before returning

  return {
    seed,
    difficulty: config.difficulty || 0.5
  };
}

export function isSolvable(state, maxMoves = 100) {
  // TODO: BFS/DFS solver to verify level is solvable
  return true;
}
EOF

echo "✅ Created game scaffold at src/games/$GAME_SLUG/"
echo ""
echo "Next steps:"
echo "  1. Define game state structure in game.js"
echo "  2. Implement applyMove() and isComplete()"
echo "  3. Implement rendering in renderer.js"
echo "  4. Set up input handling in input.js"
echo "  5. Create initial levels in levels.json"
echo "  6. Implement level generator in generator.js"
```

#### Directory Structure Per Game

```
src/games/<game-slug>/
├── index.html          # Game page (uses shell template)
├── main.js             # Entry point, wiring
├── game.js             # Core game logic (state, moves, win)
├── renderer.js         # Canvas rendering
├── input.js            # Touch/mouse handling
├── styles.css          # Game-specific styles
├── levels.json         # Handcrafted levels (first 50+)
├── generator.js        # Procedural generation (infinite mode)
├── solver.js           # Optional: for hint system
└── assets/             # Game-specific images, sounds
    ├── sprites/
    └── audio/
```

#### Code Patterns

**State Management:**
```javascript
// All game state is serializable JSON
// Use structuredClone for immutability
const newState = structuredClone(state);
modify(newState);
history.push(newState);
```

**Animation Queue:**
```javascript
class AnimationQueue {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
  }

  add(animation) {
    this.queue.push(animation);
    if (!this.isPlaying) this.play();
  }

  async play() {
    this.isPlaying = true;
    while (this.queue.length > 0) {
      const anim = this.queue.shift();
      await anim.run();
    }
    this.isPlaying = false;
  }
}
```

**Consistent Color Palette:**
```javascript
// shared/colors.js
export const PALETTE = {
  // Primary game colors (used across games for consistency)
  red:    { fill: '#FF6B6B', stroke: '#CC5555', glow: '#FF8888' },
  blue:   { fill: '#4ECDC4', stroke: '#3BA99D', glow: '#6EEEE6' },
  green:  { fill: '#95E879', stroke: '#77BA5D', glow: '#B0FF99' },
  yellow: { fill: '#FFE66D', stroke: '#CCB857', glow: '#FFF099' },
  purple: { fill: '#A66CFF', stroke: '#8555CC', glow: '#C099FF' },
  orange: { fill: '#FF9F45', stroke: '#CC7F37', glow: '#FFBB77' },

  // UI colors
  background: '#0f0f23',
  surface: '#1a1a3e',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.6)'
};
```

---

### Phase 3: Testing

#### Automated Test Suite

**Unit Tests (Vitest):**
```javascript
// games/water-sort/game.test.js
import { describe, it, expect } from 'vitest';
import { Game } from './game.js';

describe('Water Sort', () => {
  describe('applyMove', () => {
    it('allows pouring into empty tube', () => {
      const game = new Game();
      game.load({
        tubes: [['red', 'red'], []]
      });
      expect(game.applyMove({ from: 0, to: 1 })).toBe(true);
      expect(game.getState().tubes[1]).toEqual(['red', 'red']);
    });

    it('prevents pouring onto different color', () => {
      const game = new Game();
      game.load({
        tubes: [['red'], ['blue']]
      });
      expect(game.applyMove({ from: 0, to: 1 })).toBe(false);
    });

    it('detects completion correctly', () => {
      const game = new Game();
      game.load({
        tubes: [['red', 'red', 'red', 'red'], []]
      });
      expect(game.isComplete()).toBe(true);
    });
  });

  describe('generator', () => {
    it('produces deterministic output for same seed', () => {
      const level1 = generateLevel(12345);
      const level2 = generateLevel(12345);
      expect(level1).toEqual(level2);
    });

    it('produces solvable levels', () => {
      for (let seed = 0; seed < 100; seed++) {
        const level = generateLevel(seed);
        expect(isSolvable(level)).toBe(true);
      }
    });
  });
});
```

**Integration Tests (Playwright):**
```javascript
// e2e/water-sort.spec.js
import { test, expect } from '@playwright/test';

test.describe('Water Sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/games/water-sort/');
  });

  test('can complete level 1', async ({ page }) => {
    // Wait for game to load
    await page.waitForSelector('#game-canvas');

    // Perform known solution for level 1
    await page.click('#game-canvas', { position: { x: 100, y: 300 } });
    await page.click('#game-canvas', { position: { x: 200, y: 300 } });

    // Check completion modal appears
    await expect(page.locator('.level-complete-modal')).toBeVisible();
  });

  test('undo/redo works', async ({ page }) => {
    await page.waitForSelector('#game-canvas');
    const initialMoves = await page.locator('#move-count').textContent();

    // Make a move
    await page.click('#game-canvas', { position: { x: 100, y: 300 } });
    await page.click('#game-canvas', { position: { x: 200, y: 300 } });

    // Undo
    await page.click('#undo-btn');
    expect(await page.locator('#move-count').textContent()).toBe(initialMoves);
  });

  test('touch controls work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForSelector('#game-canvas');

    // Simulate touch
    await page.touchscreen.tap(100, 300);
    await page.touchscreen.tap(200, 300);

    // Verify move registered
    expect(await page.locator('#move-count').textContent()).not.toBe('0');
  });
});
```

**Performance Tests:**
```javascript
// perf/bundle-size.test.js
import { test, expect } from 'vitest';
import { statSync } from 'fs';
import { globSync } from 'glob';

const BUDGETS = {
  'shared': 30 * 1024,      // 30KB
  'per-game': 50 * 1024,    // 50KB
  'total': 300 * 1024       // 300KB
};

test('shared bundle under budget', () => {
  const files = globSync('dist/shared/**/*.js');
  const total = files.reduce((sum, f) => sum + statSync(f).size, 0);
  expect(total).toBeLessThan(BUDGETS.shared);
});

test('each game bundle under budget', () => {
  const games = ['water-sort', 'parking-escape', 'bus-jam', 'pull-the-pin'];
  for (const game of games) {
    const files = globSync(`dist/games/${game}/**/*.js`);
    const total = files.reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total).toBeLessThan(BUDGETS['per-game']);
  }
});
```

#### Manual QA Checklist

```markdown
# Game QA Checklist: [Game Name]

## Core Gameplay
- [ ] Can complete level 1 as intended
- [ ] Win condition detected correctly
- [ ] Fail condition works (if applicable)
- [ ] All valid moves succeed
- [ ] All invalid moves blocked with feedback
- [ ] Move counter increments correctly

## Controls
- [ ] Touch: tap to select works
- [ ] Touch: drag works (if applicable)
- [ ] Mouse: click to select works
- [ ] Mouse: drag works (if applicable)
- [ ] Keyboard: shortcuts documented and working
- [ ] No accidental zooming/scrolling on mobile

## History System
- [ ] Undo reverts to previous state
- [ ] Redo restores undone state
- [ ] Timeline scrubber jumps to correct state
- [ ] History cleared on level restart
- [ ] History cleared on new level

## Progression
- [ ] XP awarded on completion
- [ ] Stars calculated correctly (1/2/3)
- [ ] Achievement triggers work
- [ ] Level unlock logic works
- [ ] Daily challenge seed is consistent

## Visual Polish
- [ ] Animations play at 60fps
- [ ] No visual glitches during animations
- [ ] Selection state clearly visible
- [ ] Invalid move feedback visible
- [ ] Win celebration plays correctly
- [ ] All colors distinguishable (colorblind check)

## Audio
- [ ] Sound effects trigger correctly
- [ ] Volume respects settings
- [ ] No audio glitches or pops
- [ ] Zen mode uses softer audio

## Responsive Design
- [ ] Portrait mobile (375x667) - playable
- [ ] Landscape mobile (667x375) - playable
- [ ] Tablet portrait (768x1024) - playable
- [ ] Desktop (1920x1080) - centered, not stretched
- [ ] Safe area insets respected (iPhone notch)

## Performance
- [ ] Initial load < 2s on 4G
- [ ] No jank during gameplay
- [ ] Memory usage stable (no leaks)
- [ ] Works offline after first load

## Edge Cases
- [ ] Restart mid-level works
- [ ] Back button doesn't break state
- [ ] Closing/reopening browser restores state
- [ ] Very fast inputs handled correctly
- [ ] Extremely slow inputs work
```

#### Playtest Protocol

1. **Internal playtest** (developer)
   - Complete all levels
   - Intentionally try to break the game
   - Test edge cases

2. **Friend playtest** (3-5 people)
   - Watch without helping
   - Note confusion points
   - Ask: "Was that fun?"

3. **Public beta** (GitHub issue + social)
   - Create tracking issue
   - Collect bug reports
   - Measure completion rates

---

### Phase 4: Deploy

#### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Check bundle size
        run: npm run test:bundle-size
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=mobile-gaming --branch=${{ github.head_ref }}
      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🎮 Preview deployed: https://${{ github.head_ref }}.mobile-gaming.pages.dev'
            })

  deploy-production:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=mobile-gaming
```

#### Adding a New Game to the Directory

**PR Checklist:**
```markdown
## New Game: [Game Name]

### Required Files
- [ ] `src/games/<slug>/index.html`
- [ ] `src/games/<slug>/game.js`
- [ ] `src/games/<slug>/renderer.js`
- [ ] `src/games/<slug>/input.js`
- [ ] `src/games/<slug>/levels.json` (20+ levels)
- [ ] `src/games/<slug>/generator.js`
- [ ] `src/games/<slug>/styles.css`

### Directory Integration
- [ ] Added card to `src/index.html`
- [ ] Added to PWA cache list in `sw.js`
- [ ] Added to navigation menu
- [ ] Added achievements in `shared/achievements.js`

### Testing
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] QA checklist completed
- [ ] Bundle size under budget
- [ ] Playtest feedback addressed

### Documentation
- [ ] Added to this implementation.md (Game-Specific section)
- [ ] Level format documented
- [ ] Generator algorithm documented

### Preview
- [ ] Preview URL tested on mobile
- [ ] Preview URL tested on desktop
- [ ] GIF export works for this game
```

#### Release Process

1. **Feature branch** → `feat/game-<slug>`
2. **PR to main** with checklist above
3. **Preview deploy** on PR (automated)
4. **Review** by maintainer
5. **Merge** → production deploy (automated)
6. **Announce** on social media with GIF demo

#### Version Tagging

```bash
# After major game additions
git tag -a v1.1.0 -m "Add Bus Jam game"
git push origin v1.1.0
```

**Versioning scheme:**
- `1.0.0` → Initial launch (4 games)
- `1.1.0` → New game added
- `1.0.1` → Bug fixes, minor improvements
- `2.0.0` → Major platform changes

---

### Game Ideas Backlog

Track potential games in GitHub Issues with label `game-idea`:

```markdown
## Template: Game Idea Issue

**Title:** [GAME IDEA] <Game Name>

**One-liner:** <What the player does>

**Inspiration:** <Link to ad, video, or existing game>

**Why build it:**
- [ ] Fits static-site constraints
- [ ] Looks fun in prototype
- [ ] Visual appeal for sharing
- [ ] Different from existing games

**Status:**
- [ ] Idea proposed
- [ ] Prototype built
- [ ] Approved for full development
- [ ] Implementation started
- [ ] QA complete
- [ ] Deployed

**Assignee:** @username or unassigned
```

---

### Continuous Improvement

**Analytics to Track:**
- Which games get most plays
- Average session length per game
- Level abandonment rates
- GIF export usage
- Daily challenge completion rates

**Feedback Channels:**
- GitHub Issues for bugs
- GitHub Discussions for feature requests
- Twitter mentions for UX feedback

**Monthly Review:**
- Review analytics
- Prioritize next game from backlog
- Address top 5 bugs/friction points
- Update this document with learnings
