/**
 * Bridge Race - Solver Tests
 *
 * For every hand-crafted level:
 *   1. Greedy player can collect enough blocks and fill all bridges.
 *   2. Game terminates within 10,000 ticks when simulated with AI.
 *   3. Block supply: total blue pile counts >= sum of bridge.required * 1.2.
 *
 * Also validates generated levels from generateBatch().
 */

import { describe, it, expect } from 'vitest';
import { readFileSync }          from 'node:fs';
import { fileURLToPath }         from 'node:url';
import { join, dirname }         from 'node:path';

import {
  createInitialState,
  moveEntity,
  findNearestPile,
  findNextBridge,
  findBridgeCell,
  aiTick,
  performProximityActions,
  checkWin,
  isGameOver,
  ENTITY_SPEED,
  COLLECT_RADIUS,
  PLACE_RADIUS
} from '../../src/games/bridge-race/state.js';

import { generateBatch, validateLevel } from '../../src/games/bridge-race/generator.js';

// ── Load hand-crafted levels ───────────────────────────────────────────────

const __dir    = dirname(fileURLToPath(import.meta.url));
const levelsPath = join(__dir, '../../src/games/bridge-race/levels.json');
const LEVELS   = JSON.parse(readFileSync(levelsPath, 'utf8'));

const DT = 1 / 60;
const SPEED = ENTITY_SPEED;

// Deterministic mock rng for AI ticks
function makeRng(seed) {
  let s = seed;
  return {
    next() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    }
  };
}

// ── simulateGreedySolo ─────────────────────────────────────────────────────

/**
 * Simulate greedy solo player: no opponents, player greedily collects blocks
 * then fills bridges.
 *
 * Strategy: find next bridge, count cells needed, collect that many blocks
 * from nearest piles, then go fill the bridge, then cross, repeat.
 *
 * @param {Object} level
 * @returns {{ state, ticks }}
 */
function simulateGreedySolo(level) {
  let state = createInitialState(level);

  for (let tick = 0; tick < 10000; tick++) {
    if (state.player.bridgesCompleted >= state.totalBridges) break;

    const bridgeIdx = findNextBridge(state, 'player');

    let dx = 0, dz = 0;

    if (bridgeIdx === -1) {
      // All bridges complete, move to finish
      dz = SPEED * DT;
    } else {
      const bridge = state.bridges[bridgeIdx];
      // Count cells still needed for this bridge
      const cellsNeeded = bridge.cells.filter(c => c !== state.player.color).length;

      if (state.player.blocks < cellsNeeded && cellsNeeded > 0) {
        // Need more blocks - go to nearest pile
        const pileIdx = findNearestPile(state, 'player');
        if (pileIdx !== -1) {
          const pile = state.blockPiles[pileIdx];
          const ex = pile.x - state.player.x;
          const ez = pile.z - state.player.z;
          const dist = Math.sqrt(ex * ex + ez * ez);
          if (dist <= COLLECT_RADIUS) {
            // Already at pile, just stay and collect via proximity
            dx = 0; dz = 0;
          } else {
            const scale = SPEED * DT / dist;
            dx = ex * scale;
            dz = ez * scale;
          }
        } else {
          // No piles available, try to go to bridge anyway
          const ez = bridge.z - state.player.z;
          const dist = Math.abs(ez);
          if (dist > 0.001) {
            dz = Math.sign(ez) * Math.min(SPEED * DT, dist);
          }
        }
      } else {
        // Have blocks (or bridge is already full) - go to bridge
        const ez = bridge.z - state.player.z;
        const ex = -state.player.x; // move toward center x=0 for bridge placement
        const dist = Math.sqrt(ex * ex + ez * ez);
        if (dist <= PLACE_RADIUS) {
          dx = 0; dz = 0;
        } else if (dist > 0.001) {
          const scale = SPEED * DT / dist;
          dx = ex * scale;
          dz = ez * scale;
        }
      }
    }

    state = moveEntity(state, 'player', dx, dz);
    state = performProximityActions(state, 'player');
  }

  return { state, ticks: 10000 };
}

// ── greedyPlayerMove ─────────────────────────────────────────────────────

/**
 * Compute greedy player move delta given current state.
 */
function greedyPlayerMove(state) {
  const bridgeIdx = findNextBridge(state, 'player');

  if (bridgeIdx === -1) {
    // All bridges complete, move to finish
    return { dx: 0, dz: SPEED * DT };
  }

  const bridge = state.bridges[bridgeIdx];
  const cellsNeeded = bridge.cells.filter(c => c !== state.player.color).length;

  if (state.player.blocks < cellsNeeded && cellsNeeded > 0) {
    const pileIdx = findNearestPile(state, 'player');
    if (pileIdx !== -1) {
      const pile = state.blockPiles[pileIdx];
      const ex = pile.x - state.player.x;
      const ez = pile.z - state.player.z;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist <= COLLECT_RADIUS) return { dx: 0, dz: 0 };
      const scale = SPEED * DT / dist;
      return { dx: ex * scale, dz: ez * scale };
    }
    // No piles, go to bridge
  }

  // Go to bridge
  const ez = bridge.z - state.player.z;
  const ex = -state.player.x;
  const dist = Math.sqrt(ex * ex + ez * ez);
  if (dist <= PLACE_RADIUS) return { dx: 0, dz: 0 };
  if (dist < 0.001) return { dx: 0, dz: 0 };
  const scale = SPEED * DT / dist;
  return { dx: ex * scale, dz: ez * scale };
}

// ── simulateWithAI ────────────────────────────────────────────────────────

/**
 * Simulate full game with player (greedy) and AI opponents.
 *
 * @param {Object} level
 * @returns {{ state, ticks }}
 */
function simulateWithAI(level) {
  let state = createInitialState(level);
  const rng = makeRng(12345);
  let ticks = 0;

  while (!isGameOver(state) && ticks < 10000) {
    // Move player greedily
    const { dx, dz } = greedyPlayerMove(state);
    state = moveEntity(state, 'player', dx, dz);

    // Move opponents via aiTick
    for (let i = 0; i < state.opponents.length; i++) {
      const { dx: adx, dz: adz } = aiTick(state, i, DT, rng);
      state = moveEntity(state, i, adx, adz);
    }

    // Proximity actions for all
    state = performProximityActions(state, 'player');
    for (let i = 0; i < state.opponents.length; i++) {
      state = performProximityActions(state, i);
    }

    // Check finish condition: player with all bridges done advances to finish
    if (state.player.bridgesCompleted >= state.totalBridges && state.player.z < state.finishZ) {
      state = moveEntity(state, 'player', 0, SPEED * DT);
    }
    // Same for opponents
    for (let i = 0; i < state.opponents.length; i++) {
      if (state.opponents[i].bridgesCompleted >= state.totalBridges &&
          state.opponents[i].z < state.finishZ) {
        state = moveEntity(state, i, 0, SPEED * DT);
      }
    }

    state = checkWin(state);
    ticks++;
  }

  return { state, ticks };
}

// ── Hand-crafted level validation ─────────────────────────────────────────

describe('hand-crafted levels', () => {
  it('loads at least 9 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(9);
  });

  for (const level of LEVELS) {
    describe(`level ${level.id}`, () => {
      it('has at least 9 levels total', () => {
        expect(LEVELS.length).toBeGreaterThanOrEqual(9);
      });

      it('has bridges with increasing z, all < finishZ', () => {
        let lastZ = 0;
        for (const bridge of level.bridges) {
          expect(bridge.z).toBeGreaterThan(lastZ);
          expect(bridge.z).toBeLessThan(level.finishZ);
          lastZ = bridge.z;
        }
      });

      it('blue block supply >= sum of bridge.required * 1.2', () => {
        const totalCells = level.bridges.reduce((s, b) => s + b.required, 0);
        const blueBlocks = level.blockPiles
          .filter(p => p.color === (level.playerColor || 'blue'))
          .reduce((s, p) => s + p.count, 0);
        expect(blueBlocks).toBeGreaterThanOrEqual(totalCells * 1.2);
      });

      it('has at least one bridge', () => {
        expect(level.bridges.length).toBeGreaterThan(0);
      });

      it('has block piles', () => {
        expect(level.blockPiles.length).toBeGreaterThan(0);
      });

      it('greedy player can complete all bridges within 10000 ticks', () => {
        const { state } = simulateGreedySolo(level);
        expect(state.player.bridgesCompleted).toBeGreaterThanOrEqual(level.bridges.length);
      });

      it('game terminates within 10000 ticks with AI', () => {
        const { state, ticks } = simulateWithAI(level);
        // Either game is over OR player completed all bridges
        const terminated = isGameOver(state) || state.player.bridgesCompleted >= state.totalBridges;
        expect(terminated).toBe(true);
        expect(ticks).toBeLessThan(10000);
      });
    });
  }
});

// ── Block supply validation ────────────────────────────────────────────────

describe('block supply validation', () => {
  it('every level has 20% blue block surplus', () => {
    for (const level of LEVELS) {
      const totalCells = level.bridges.reduce((s, b) => s + b.required, 0);
      const blueBlocks = level.blockPiles
        .filter(p => p.color === (level.playerColor || 'blue'))
        .reduce((s, p) => s + p.count, 0);
      const ratio = blueBlocks / totalCells;
      expect(ratio).toBeGreaterThanOrEqual(1.2);
    }
  });
});

// ── Generated level validation ─────────────────────────────────────────────

describe('generated levels — easy difficulty', () => {
  const levels = generateBatch(1000, 'easy', 5);

  it('generates 5 valid easy levels', () => {
    expect(levels.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated easy level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

describe('generated levels — medium difficulty', () => {
  const levels = generateBatch(2000, 'medium', 5);

  it('generates 5 valid medium levels', () => {
    expect(levels.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated medium level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

describe('generated levels — hard difficulty', () => {
  const levels = generateBatch(3000, 'hard', 5);

  it('generates 5 valid hard levels', () => {
    expect(levels.length).toBe(5);
  });

  for (let i = 0; i < 5; i++) {
    it(`generated hard level ${i} is valid`, () => {
      const level = levels[i];
      if (!level) return;
      const { valid, reason } = validateLevel(level);
      expect(valid, reason).toBe(true);
    });
  }
});

// ── validateLevel ──────────────────────────────────────────────────────────

describe('validateLevel', () => {
  it('returns valid for a correctly structured level', () => {
    const level = {
      finishZ: 100,
      playerColor: 'blue',
      bridges: [
        { z: 30, required: 3 },
        { z: 60, required: 3 }
      ],
      blockPiles: [
        { x: 0, z: 10, color: 'blue', count: 8 }
      ]
    };
    const { valid } = validateLevel(level);
    expect(valid).toBe(true);
  });

  it('returns invalid when blue blocks < total cells * 1.2', () => {
    const level = {
      finishZ: 100,
      playerColor: 'blue',
      bridges: [
        { z: 30, required: 5 },
        { z: 60, required: 5 }
      ],
      blockPiles: [
        { x: 0, z: 10, color: 'blue', count: 5 } // need 12, have 5
      ]
    };
    const { valid } = validateLevel(level);
    expect(valid).toBe(false);
  });

  it('returns invalid when bridge z >= finishZ', () => {
    const level = {
      finishZ: 50,
      playerColor: 'blue',
      bridges: [
        { z: 60, required: 3 } // 60 >= 50
      ],
      blockPiles: [
        { x: 0, z: 10, color: 'blue', count: 10 }
      ]
    };
    const { valid } = validateLevel(level);
    expect(valid).toBe(false);
  });

  it('returns invalid when bridges have non-increasing z', () => {
    const level = {
      finishZ: 100,
      playerColor: 'blue',
      bridges: [
        { z: 60, required: 3 },
        { z: 30, required: 3 } // not increasing
      ],
      blockPiles: [
        { x: 0, z: 5, color: 'blue', count: 10 }
      ]
    };
    const { valid } = validateLevel(level);
    expect(valid).toBe(false);
  });

  it('returns invalid when no bridges defined', () => {
    const level = {
      finishZ: 100,
      playerColor: 'blue',
      bridges: [],
      blockPiles: [{ x: 0, z: 10, color: 'blue', count: 10 }]
    };
    const { valid } = validateLevel(level);
    expect(valid).toBe(false);
  });
});

// ── Solver properties ──────────────────────────────────────────────────────

describe('solver properties', () => {
  it('greedy solver completes all levels', () => {
    for (const level of LEVELS) {
      const { state } = simulateGreedySolo(level);
      expect(state.player.bridgesCompleted).toBeGreaterThanOrEqual(level.bridges.length);
    }
  });

  it('full simulation terminates for all levels', () => {
    for (const level of LEVELS) {
      const { ticks } = simulateWithAI(level);
      expect(ticks).toBeLessThan(10000);
    }
  });
});
