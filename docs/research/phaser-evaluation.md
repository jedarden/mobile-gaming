# Phaser Framework Evaluation

## Overview

Phaser is an open-source HTML5 game framework (MIT license) built for desktop and mobile browsers. It provides a WebGL renderer with Canvas 2D fallback, two built-in physics engines, scene management, input handling, audio, tweens, particles, and a full asset loader. The current stable release is v3.90.0 (May 2025); Phaser 4 is in release candidate stage (RC7, March 2025) with new rendering features but is not yet production-stable.

This document evaluates whether Phaser is a viable replacement for the project's current rendering layer — raw Canvas 2D for six games and Three.js for seven games — and what the migration trade-offs would be.

## Current Architecture

The project renders 13 games using two approaches:

**Canvas 2D** (6 games): Water Sort, Parking Escape, Brain Teaser, Pull the Pin, Satisfying ASMR, Save the Character. Each game has a hand-rolled `renderer.js` that draws directly to a `<canvas>` element using the 2D context. Shared utilities in `src/shared/` provide canvas setup, DPR-aware resize, input normalization, particles, shapes, viewport scaling, and an RAF loop wrapper.

**Three.js** (7 games): Crowd Runner, Giant Runner, Bridge Race, Jelly Shift, Makeover Run, Bus Jam, Merge Games. These use `three-setup.js` for scene/camera/renderer bootstrapping, with cannon-es for physics in some games.

All games share a strict architectural rule: `state.js` must be pure — no rendering, no DOM. This enables direct solver testing, deterministic level verification, and automated playability proofs without a browser.

## What Phaser Provides

### Rendering
- WebGL renderer with automatic Canvas 2D fallback (`Phaser.AUTO`)
- Built-in post-processing FX: bloom, blur, glow, vignette, barrel distortion, color matrix, displacement, shine, wipe — all configurable per camera or per game object
- 2D normal-map lighting system (`Lights` layer)
- Blend modes, tinting, alpha, render-to-texture
- Custom GLSL shader pipeline support
- Draw call batching via multi-texture batching

### Physics
- **Arcade Physics** — lightweight AABB collisions, gravity, velocity, bounce, overlap detection. Suitable for runners, platformers, and simple puzzle interactions
- **Matter.js** — full rigid body physics with polygon shapes, constraints, springs, joints, friction, sleeping. Suitable for Pull the Pin gravity simulation, Water Sort liquid approximation

### Input
- Unified mouse, touch, keyboard, gamepad handling
- Multi-touch support (current project only handles single-pointer)
- Drag-and-drop, interactive zones, pixel-perfect hit testing
- Pointer lock, cursor management

### Scene Management
- First-class Scene system with parallel scenes, sleep/wake, restart
- Scene transitions with effects
- Scene-level lifecycle hooks (preload, create, update)

### Other
- Tween engine with chaining, timelines, easing functions
- GPU-accelerated particle emitters with emit zones, death zones, color/scale over lifetime
- Web Audio API with spatial audio, audio sprites, HTML5 Audio fallback
- Responsive Scale Manager with FIT, ENVELOP, EXPAND modes and orientation change handling
- Asset loader with queuing and caching (images, atlases, audio, video, JSON, etc.)
- Math utilities: vectors, interpolation, noise functions, Bezier/spline curves

## Mapping to Current Games

### Canvas 2D Games — Strong Fit

These six games would benefit most from a Phaser migration:

| Game | Current Approach | Phaser Advantage |
|---|---|---|
| **Water Sort** | Custom canvas pour animation, bubble particles, glass refraction | Phaser tweens replace manual animation math; particle emitter replaces custom particle system; WebGL blend modes improve glass effect |
| **Parking Escape** | Custom car shading, shadow rendering, bounce easing | Matter.js or Arcade Physics for collision; built-in camera shake; tween engine for bounce animations |
| **Brain Teaser** | Sketch wobble borders (3 offset strokes), confetti particles | Graphics object for vector drawing; particle emitter for confetti; text rendering with style options |
| **Pull the Pin** | Custom gravity simulation, pin removal physics | Matter.js provides real rigid body physics — constraints for pins, gravity for balls/liquid, collision detection for containers |
| **Satisfying ASMR** | Pressure wash / slime simulation | Shader pipeline for visual effects; Arcade Physics for simple interactions; post-FX for visual polish |
| **Save the Character** | 2D narrative choice interface | Scene system maps naturally to story branches; tween engine for transitions; input zones for choices |

For these games, Phaser replaces approximately 15 shared utility modules (`canvas.js`, `input.js`, `particles.js`, `shapes.js`, `viewport.js`, `audio.js`, `haptics.js`, `screen-shake.js`, `adaptive.js`, `capabilities.js`, etc.) with framework equivalents that are better tested and more feature-complete.

### Three.js Games — Poor Fit

Phaser is fundamentally a 2D framework. Its Mesh and Plane objects provide basic 2.5D projection but cannot replace Three.js's full 3D scene graph, materials, lighting, and InstancedMesh. The seven Three.js games (Crowd Runner, Giant Runner, Bridge Race, Jelly Shift, Makeover Run, Bus Jam, Merge Games) should remain on Three.js.

However, Phaser could still manage the **non-rendering concerns** for these games — input handling, audio, scene lifecycle, UI overlays — while Three.js handles the 3D canvas. This is a viable hybrid pattern but adds architectural complexity.

### Recommendation

A partial migration — Phaser for Canvas 2D games, Three.js retained for 3D games — is the pragmatic path. Attempting to force 3D games into Phaser would be a regression.

## Trade-offs

### Benefits

1. **Reduced custom code.** Phaser replaces ~15 hand-rolled shared modules (canvas setup, input normalization, particles, viewport scaling, audio, screen shake) with battle-tested framework equivalents. Less code to maintain.

2. **WebGL by default.** Current Canvas 2D games render in software. Phaser's WebGL renderer provides hardware acceleration with automatic Canvas fallback. This means better frame rates on mobile for particle-heavy scenes (Water Sort bubbles, Brain Teaser confetti, Parking Escape shadows).

3. **Post-processing for free.** Bloom, glow, vignette, blur, and other FX are built in. Currently, achieving these effects requires manual Canvas compositing or custom WebGL code.

4. **Real physics for Pull the Pin.** The current custom gravity simulation is intentionally simplified to preserve solver determinism. Matter.js (bundled with Phaser) provides proper rigid body physics with constraints, which maps directly to the pin-and-ball mechanic. Solver determinism can be maintained by fixing Matter.js's timestep.

5. **Multi-touch.** The current `input.js` only handles single-pointer. Phaser's input system handles multi-touch natively, enabling future interactions (e.g., two-finger pinch in Merge Games).

6. **Scale Manager.** Phaser's responsive scaling (FIT, ENVELOP, etc.) with orientation change handling is more robust than the current `viewport.js` implementation.

7. **Ecosystem and plugins.** RexRainbow's plugin collection adds UI controls, text input, state machines, and more. The framework has 10+ years of browser quirk workarounds baked in.

### Costs

1. **Bundle size.** Phaser adds ~310 KB gzipped (~1.14 MB minified) to each game entry point. The current Canvas 2D games ship with zero framework overhead — just the game code and shared utilities. This is the single largest trade-off.

   Mitigation: The Phaser Compressor (official tool) can strip unused subsystems, claiming up to 60% reduction. The `phaser-arcade-physics` build omits Matter.js for ~50 KB savings. For games that don't need physics (Brain Teaser, Save the Character), a custom build excluding both physics engines would help.

   Context: The project already ships Three.js (~150 KB gzipped) for 3D games, so a framework dependency is not unprecedented. But Canvas 2D games currently have a significant size advantage that would be lost.

2. **No effective tree-shaking.** Phaser 3 is monolithic — bundlers cannot eliminate unused features at build time due to internal coupling. The ESM build exposes named exports but the internal `require()` calls prevent dead code elimination. Phaser 4 does not appear to improve this.

3. **Two rendering stacks.** Adopting Phaser for Canvas 2D games while keeping Three.js for 3D games means maintaining two framework dependencies and two rendering paradigms. Developers must context-switch between Phaser patterns and Three.js patterns.

4. **State purity constraint.** The project enforces pure `state.js` files (no rendering, no DOM) for solver testability. Phaser's Scene system encourages co-locating game logic with rendering. The migration must resist this pull and maintain the existing separation — Phaser becomes a renderer only, driven by external state. This is feasible but goes against Phaser's grain.

5. **Migration effort.** Six games need their `renderer.js` rewritten to Phaser game objects. Shared utilities need refactoring to delegate to Phaser where applicable while remaining available for Three.js games. Tests that mock canvas or DOM interactions need updating. This is a multi-week effort.

6. **Phaser 3 vs 4 timing.** Phaser 4 (RC7 as of March 2025) adds significant rendering improvements (gradient objects, noise generators, new filter/tint system) but is not stable. Migrating to Phaser 3 now risks a second migration to Phaser 4 later. Waiting for Phaser 4 stability delays the benefits.

## Bundle Size Analysis

| Current | Size (gzipped) |
|---|---|
| Canvas 2D game (no framework) | ~15–30 KB per game |
| Three.js game | ~150 KB + ~15–30 KB game code |

| With Phaser | Size (gzipped) |
|---|---|
| Phaser game (full build) | ~310 KB + ~15–30 KB game code |
| Phaser game (Arcade-only build) | ~278 KB + game code |
| Phaser game (Compressor, no physics) | ~125–185 KB estimate + game code |
| Three.js game (unchanged) | ~150 KB + game code |

The worst case is a 10× increase for Canvas 2D games (from ~20 KB to ~320 KB). With Phaser Compressor stripping unused features, a 4–6× increase (~125–185 KB) is more realistic. For comparison, the Three.js games already ship at ~165–180 KB.

## Architecture Pattern

If adopted, Phaser should slot into the existing architecture as a **renderer only**:

```
state.js          (pure game logic — unchanged)
  ↓
game.js           (lifecycle orchestration — init/update/teardown)
  ↓
phaser-renderer.js  (Phaser Scene that reads state and renders)
  ↓
Phaser.Game       (WebGL/Canvas output)
```

The Phaser Scene's `update()` method should read from `state.js` and update game objects accordingly, rather than owning game logic. This preserves:
- Solver testing without a browser
- Deterministic level verification
- The existing `state.js` / `renderer.js` contract

Shared utilities that Phaser replaces (canvas, input, viewport, particles, audio, screen-shake) should be wrapped in a thin adapter so Three.js games can continue using them without Phaser as a dependency.

## Migration Path

**Phase 1 — Proof of concept.** Port one Canvas 2D game (recommended: Brain Teaser, as it has the simplest rendering) to Phaser. Validate that the state purity constraint holds, measure bundle size impact, and benchmark mobile performance against the current implementation.

**Phase 2 — Shared adapter layer.** Build a `src/shared/phaser-bridge.js` module that wraps shared utilities (input, audio, viewport) so both Phaser and Three.js games can use a common interface. This avoids duplicating utility code.

**Phase 3 — Canvas 2D migration.** Port the remaining five Canvas 2D games. Order by complexity: Save the Character, Satisfying ASMR, Water Sort, Parking Escape, Pull the Pin.

**Phase 4 — Evaluate Three.js hybrid.** Once the Canvas 2D migration is stable, evaluate whether Phaser should manage input/audio/UI for Three.js games while Three.js handles rendering. This is optional and should only proceed if the unified API meaningfully reduces code.

## Phaser 4 Considerations

Phaser 4 (RC7) introduces features that would benefit this project:

- **New filter system** — bloom, shine, image-based lighting, quantize/dither, vignette, wipe — more flexible than Phaser 3's FX pipeline
- **Gradient game objects** — direct support for the gradient effects currently hand-drawn in Canvas 2D
- **Noise generators** — simplex and cellular/Voronoi noise for procedural texture effects
- **Overhauled tint system** — six blend modes (multiply, fill, add, screen, overlay, hard light) vs Phaser 3's limited tint

However, RC7 is not stable and the release cadence (quarterly RCs since May 2025) suggests final release may still be months out. The recommended approach is to build against Phaser 3 with a clean renderer abstraction, then upgrade to Phaser 4 when it stabilizes.

## Community and Maintenance

- GitHub: ~39,250 stars, 7,120 forks
- npm: ~519K monthly downloads
- Actively maintained by Phaser Studio Inc (commercial entity)
- 10+ years of continuous development (since April 2013)
- Official templates for Vite, React, Vue, Angular, Next.js, Svelte
- Rich plugin ecosystem (RexRainbow collection, Facebook Instant Games, Discord Activities)
- Full TypeScript definitions included
- 700+ tutorials, 2,000+ code examples, free 500-page book

## Verdict

Phaser is a strong fit for the six Canvas 2D games. It replaces a significant amount of hand-rolled infrastructure with a mature, well-tested framework. The primary cost is bundle size (~310 KB gzipped worst case, ~125–185 KB with Compressor). The primary risk is architectural tension between Phaser's scene-centric design and the project's pure-state testing model — this is manageable with discipline.

The seven Three.js games should not migrate. Phaser cannot replace Three.js for 3D rendering.

A proof-of-concept with Brain Teaser is the recommended next step before committing to a broader migration.

## Sources

- [Phaser — HTML5 Game Framework](https://phaser.io)
- [Phaser 3 API Documentation](https://docs.phaser.io)
- [Phaser GitHub Repository](https://github.com/phaserjs/phaser)
- [Phaser 4 RC7 Release Notes](https://github.com/phaserjs/phaser/releases)
- [Phaser Compressor](https://phaser.io/compressor)
- [RexRainbow Phaser Plugins](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/)
