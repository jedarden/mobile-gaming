# Phaser Migration Progress

## Overview

Migrating 2D games from raw Canvas 2D rendering to Phaser 3 game framework.
3D games (Three.js) are not affected.

## Migration Order

1. ✅ **Water Sort** — Complete
2. ✅ **Brain Teaser** — Complete
3. ✅ **Save the Character** — Complete
4. ✅ **Parking Escape** — Complete
5. ✅ **Satisfying ASMR** — Complete
6. ✅ **Pull the Pin** — Complete
7. ✅ **Shared utilities cleanup** — Complete

---

## Completed Migrations

### Water Sort ✅

**Commit:** `34b6535`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `WaterSortScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Replaced manual animation loop with Phaser Tweens
  - Preserved all visual effects: glass refraction, pour animations, bubbles, splashes, scale-pop
  - Extracted layout utilities (`calculateLayout`, `getTubePosition`, `canvasToTubeIndex`) as pure functions

- `input.js`: Simplified to wire callbacks to Phaser scene
  - Input handling now done by Phaser scene's pointer events
  - Hit-testing uses exported `canvasToTubeIndex` function

- `game.js`: Minor initialization order update
  - Create initial state before renderer (needed for Phaser scene init)

- `tests/unit/water-sort-input.test.js`: Updated for new architecture
  - Tests now verify callback wiring through renderer

**Tests:** All 5589 tests pass

---

### Brain Teaser ✅

**Commit:** `dddc594`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `BrainTeaserScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Preserved notebook background with ruled lines and paper texture
  - Preserved all element type renderers: circle, rect, triangle, star, heart, diamond, cup, ball, box, key, door, button, arrow, text, image, hidden
  - Replaced manual animation loop with Phaser Tweens
  - Preserved visual effects: hint pulsing glow, shake animation with fail emoji, celebration confetti
  - Extracted hit-testing utilities (`hitTest`, `getElementAt`) as pure functions

- `input.js`: Simplified to wire callbacks to Phaser scene
  - Input handling now done by Phaser scene's pointer events
  - Hit-testing uses exported `getElementAt` function

- `game.js`: Minor initialization order update
  - Create initial state before renderer (needed for Phaser scene init)
  - Added `input.init()` call to wire callbacks

- `tests/unit/brain-teaser-input.test.js`: Updated for new architecture
  - Tests now mock `setCallbacks` method on renderer
  - Tests verify callback wiring through renderer

**Tests:** All 5578 tests pass

---

### Save the Character ✅

**Commit:** `234fee1`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `SaveTheCharacterScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Preserved sketch-style character with expressions (happy, shocked, scared, worried)
  - Preserved sketchy wobble strokes for hand-drawn feel
  - Preserved parchment/sketch background with dynamic sky colors based on outcome
  - Preserved tactile buttons with press-down scale, bounce, color flash
  - Preserved win sparkle / lose shake particle burst using Phaser ParticleEmitter
  - Extracted hit-testing utility (`getChoiceAtPosition`) as pure function
  - Extracted layout utility (`calculateLayout`) as pure function

- `input.js`: Simplified for Phaser pointer events
  - Input handling now done by Phaser scene's pointer events
  - Kept `getChoiceAt` helper for testing and compatibility

- `game.js`: Refactored for Phaser Scene lifecycle
  - Removed manual requestAnimationFrame loop
  - Use Phaser scene callbacks for animation completion
  - Keep state machine logic (level loading, choice selection, win/lose)
  - Initialize state before renderer for Phaser scene init

- `tests/unit/save-the-character-input.test.js`: Updated for new architecture
  - Mock renderer.js module to avoid Phaser import in Node.js
  - Test API compatibility and getChoiceAt helper

**Tests:** All 5573 tests pass

---

### Parking Escape ✅

**Commit:** `9c41630`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `ParkingEscapeScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Preserved asphalt texture with parking-space markings
  - Preserved 3D toy-car shading (top face highlight + right/bottom shadow)
  - Preserved selection lift with expanded drop-shadow
  - Replaced manual animation loop with Phaser Tweens
  - Preserved slide animation with ease-out-back bounce
  - Preserved exit particle burst when hero exits using Phaser Tweens
  - Preserved screen shake on blocked drag using camera shake
  - Extracted hit-testing utility (`hitTestVehicleAt`) as pure function
  - Extracted layout utility (`calculateLayout`) as pure function
  - Extracted snap computation (`computeSnapMoveFromDelta`) as pure function

- `input.js`: Simplified for Phaser pointer events
  - Input handling now done by Phaser scene's pointer events
  - Added setCallbacks integration for Phaser scene
  - Kept fallback canvas listeners for testing compatibility
  - Kept `getChoiceAt` helper for testing and compatibility

- `game.js`: Refactored for Phaser Scene lifecycle
  - Removed manual requestAnimationFrame loop
  - Initialize state before renderer for Phaser scene init
  - Call `input.init()` after renderer is ready

**Tests:** All 5573 tests pass

---

### Satisfying ASMR ✅

**Commit:** `ef4ad42`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `SatisfyingAsmrScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Preserved color reveal layer with multiple pattern types (full, splatter, stripes, checkerboard)
  - Preserved grain texture overlay for surface texture
  - Replaced manual particle arrays with Phaser Tweens
  - Preserved debris particle effects on spray using Phaser Tweens
  - Preserved completion sparkle burst using Phaser Tweens
  - Extracted layout utility (`calculateLayout`) as pure function
  - Extracted hit-testing utility (`pixelToGrid`) as pure function

- `game.js`: Refactored for Phaser Scene lifecycle
  - Removed manual input module (Phaser scene handles pointer events)
  - Use `renderer.setCallbacks` for spray input
  - Initialize state before renderer for Phaser scene init

- `input.js`: Simplified for testing compatibility
  - Kept fallback canvas listeners for testing environments
  - Input handling now done by Phaser scene's pointer events

**Tests:** All 5573 tests pass

---

### Pull the Pin ✅

**Commit:** `4d49993`

**Changes:**
- `renderer.js`: Replaced Canvas 2D with Phaser.Game and Phaser.Scene
  - Created `PullThePinScene` class extending Phaser.Scene
  - Converted Canvas 2D draw calls to Phaser Graphics objects
  - Preserved background gradient with dot grid for spatial reference
  - Preserved channel walls with shadow and highlight depth
  - Preserved cup scale-pop animation on ball capture using elastic easing
  - Preserved ball rendering with 3D shading (gradient, specular, edge gloss)
  - Preserved pin rendering with metallic gradient and pull handle
  - Preserved pin removal ripple animation using Phaser Tweens
  - Preserved confetti particle burst on level complete using Phaser Tweens
  - Preserved hint pin pulsing glow animation
  - Extracted hit-testing utility (`hitTestPin`, `getPinAtPosition`) as pure functions

- `input.js`: Simplified for Phaser pointer events
  - Input handling now done by Phaser scene's pointer events
  - Added `createInput` function for Phaser callback wiring
  - Kept `createInputHandler` for backward compatibility with tests

- `game.js`: Refactored for Phaser Scene lifecycle
  - Initialize renderer with state for Phaser scene init
  - Use `createInput` for Phaser callback wiring
  - Physics simulation remains in state.js (not using Matter.js - custom physics)
  - Call `input.init()` after renderer is ready

**Tests:** All 5573 tests pass

---

## In Progress

*None - all migrations complete*

---

## Shared Utilities Cleanup ✅

**Commit:** `2cefa6e`

**Changes:**
- Removed dead Canvas 2D utility files that were replaced by Phaser:
  - `src/shared/canvas.js` - Canvas creation and context utilities (now using Phaser.Game)
  - `src/shared/particles.js` - Canvas 2D particle system (now using Phaser Tweens/ParticleEmitter)
  - `src/shared/shapes.js` - Canvas 2D shape drawing functions (now using Phaser Graphics)
  - `src/shared/screen-shake.js` - Screen shake for Canvas 2D translate (now using Phaser camera)
- Removed corresponding test files
- Updated `tests/unit/ux-polish.test.js` to remove tests for deleted modules

**Tests:** All 5374 tests pass

---

---

## Verification (2026-03-28)

- All 5374 tests pass
- All 7 migration steps complete
- Project is fully migrated from Canvas 2D to Phaser 3

---

## Notes

- `state.js` is never modified - it remains pure state management
- `generator.js` and level JSON are never modified - they are pure data
- Layout/positioning math is extracted as pure functions for reusability
