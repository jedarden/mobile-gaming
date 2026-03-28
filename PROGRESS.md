# Phaser Migration Progress

## Overview

Migrating 2D games from raw Canvas 2D rendering to Phaser 3 game framework.
3D games (Three.js) are not affected.

## Migration Order

1. ✅ **Water Sort** — Complete
2. ✅ **Brain Teaser** — Complete
3. ⏳ **Save the Character** — Next
4. ⏳ **Parking Escape**
5. ⏳ **Satisfying ASMR**
6. ⏳ **Pull the Pin**
7. ⏳ **Shared utilities cleanup**

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

## In Progress

*None yet - next iteration will migrate Save the Character*

---

## Notes

- `state.js` is never modified - it remains pure state management
- `generator.js` and level JSON are never modified - they are pure data
- Layout/positioning math is extracted as pure functions for reusability
