# Bus Jam

A color-matching puzzle game where you guide buses through a grid to pick up passengers and reach the exit.

## How to Play

1. **Select a bus** by tapping on it
2. **Tap a road cell** to move the selected bus along valid paths
3. **Board passengers** when a bus stops next to a matching-color stop
4. **Exit the map** once a bus is full by moving it to an exit point
5. **Win** by delivering all passengers and exiting all buses

## Mechanics

- Buses move one cell at a time along road cells
- Passengers board automatically when a bus is adjacent to a stop of the same color
- A bus can only exit when it has reached full capacity
- Fewer moves earns a higher star rating

## Files

| File | Purpose |
|------|---------|
| `main.js` | Entry point — bootstraps the game |
| `game.js` | Lifecycle: init, update loop, level progression |
| `state.js` | Pure-function game state (no rendering, no DOM) |
| `renderer.js` | Canvas 2D rendering |
| `input.js` | Game-specific input mapping (tap-to-select, tap-to-move, hover preview) |
| `generator.js` | Procedural level generation for daily challenges |
| `audio.js` | Synthesized sound effects via Web Audio API |
| `levels.json` | 30 handcrafted levels with progressive difficulty |
| `styles.css` | Game-specific CSS |

## Level Format

Levels are defined in `levels.json` as an array of objects. Each level specifies a grid size, bus positions/colors/capacities, stop positions/queues, exit points, and road cells. See `levels.json` for the full schema.
