/**
 * Bridge Race - Unit Tests
 *
 * Tests pure state functions: collectBlock, placeBlock, isBridgeComplete,
 * crossBridge, moveEntity, checkWin, findNearestPile, findNextBridge,
 * findBridgeCell, aiTick, performProximityActions, calculateStars.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  collectBlock,
  placeBlock,
  isBridgeComplete,
  crossBridge,
  hasEntityWon,
  checkWin,
  moveEntity,
  findNearestPile,
  findNextBridge,
  findBridgeCell,
  aiTick,
  performProximityActions,
  isGameOver,
  calculateStars,
  COLLECT_RADIUS,
  PLACE_RADIUS,
  ENTITY_SPEED
} from '../../src/games/bridge-race/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLevel(overrides = {}) {
  return {
    arenaWidth: 24,
    finishZ: 100,
    playerColor: 'blue',
    opponents: [
      { color: 'red',   x: 6,  ai: 'greedy' },
      { color: 'green', x: -6, ai: 'random' }
    ],
    bridges: [
      { z: 30, required: 3 },
      { z: 70, required: 3 }
    ],
    blockPiles: [
      { x: -5, z: 10, color: 'blue',  count: 5 },
      { x: 5,  z: 10, color: 'red',   count: 5 },
      { x: 0,  z: 40, color: 'blue',  count: 5 },
      { x: 0,  z: 40, color: 'green', count: 5 }
    ],
    ...overrides
  };
}

// ── Exported constants ─────────────────────────────────────────────────────

describe('exported constants', () => {
  it('COLLECT_RADIUS is 2.0', () => {
    expect(COLLECT_RADIUS).toBe(2.0);
  });
  it('PLACE_RADIUS is 3.0', () => {
    expect(PLACE_RADIUS).toBe(3.0);
  });
  it('ENTITY_SPEED is 5', () => {
    expect(ENTITY_SPEED).toBe(5);
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('sets player color from level', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.color).toBe('blue');
  });

  it('initializes player blocks to 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.blocks).toBe(0);
  });

  it('initializes player position to 0,0', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.x).toBe(0);
    expect(state.player.z).toBe(0);
  });

  it('initializes bridgesCompleted to 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.bridgesCompleted).toBe(0);
  });

  it('sets status to "racing"', () => {
    const state = createInitialState(makeLevel());
    expect(state.status).toBe('racing');
  });

  it('creates bridges with null cells', () => {
    const state = createInitialState(makeLevel());
    expect(state.bridges.length).toBe(2);
    expect(state.bridges[0].cells).toEqual([null, null, null]);
  });

  it('creates opponents array', () => {
    const state = createInitialState(makeLevel());
    expect(state.opponents.length).toBe(2);
    expect(state.opponents[0].color).toBe('red');
    expect(state.opponents[1].color).toBe('green');
  });

  it('sets finishZ from level', () => {
    const state = createInitialState(makeLevel({ finishZ: 150 }));
    expect(state.finishZ).toBe(150);
  });

  it('sets totalBridges from bridges array length', () => {
    const state = createInitialState(makeLevel());
    expect(state.totalBridges).toBe(2);
  });

  it('sets time to 0', () => {
    const state = createInitialState(makeLevel());
    expect(state.time).toBe(0);
  });
});

// ── collectBlock ──────────────────────────────────────────────────────────

describe('collectBlock', () => {
  it('collects block when colors match', () => {
    const state = createInitialState(makeLevel());
    const next  = collectBlock(state, 'player', 0); // pile 0 is blue
    expect(next.player.blocks).toBe(1);
    expect(next.blockPiles[0].count).toBe(4);
  });

  it('does not collect when colors do not match', () => {
    const state = createInitialState(makeLevel());
    const next  = collectBlock(state, 'player', 1); // pile 1 is red, player is blue
    expect(next.player.blocks).toBe(0);
    expect(next.blockPiles[1].count).toBe(5);
  });

  it('does not collect when pile count is 0', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, blockPiles: state.blockPiles.map((p, i) => i === 0 ? { ...p, count: 0 } : p) };
    const next = collectBlock(state, 'player', 0);
    expect(next.player.blocks).toBe(0);
  });

  it('does not collect when pile count is negative (<= 0 guard)', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, blockPiles: state.blockPiles.map((p, i) => i === 0 ? { ...p, count: -1 } : p) };
    const next = collectBlock(state, 'player', 0);
    expect(next).toBe(state);
    expect(next.player.blocks).toBe(0);
  });

  it('works for opponent entities', () => {
    const state = createInitialState(makeLevel());
    const next  = collectBlock(state, 0, 1); // opponent 0 is red, pile 1 is red
    expect(next.opponents[0].blocks).toBe(1);
    expect(next.blockPiles[1].count).toBe(4);
  });

  it('returns state unchanged for invalid pile index', () => {
    const state = createInitialState(makeLevel());
    const next  = collectBlock(state, 'player', 99);
    expect(next).toBe(state);
  });

  it('returns state unchanged for invalid entityId', () => {
    const state = createInitialState(makeLevel());
    const next  = collectBlock(state, 'nonexistent', 0);
    expect(next).toBe(state);
  });

  it('decrements pile count by 1 per call', () => {
    let state = createInitialState(makeLevel());
    state = collectBlock(state, 'player', 0);
    state = collectBlock(state, 'player', 0);
    expect(state.blockPiles[0].count).toBe(3);
    expect(state.player.blocks).toBe(2);
  });
});

// ── placeBlock ─────────────────────────────────────────────────────────────

describe('placeBlock', () => {
  it('places block in empty cell', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: 1 } };
    const next = placeBlock(state, 'player', 0, 0);
    expect(next.bridges[0].cells[0]).toBe('blue');
    expect(next.player.blocks).toBe(0);
  });

  it('overwrites opponent cell (sabotage mechanic)', () => {
    let state = createInitialState(makeLevel());
    // First let red opponent place a block
    state = { ...state,
      opponents: state.opponents.map((o, i) => i === 0 ? { ...o, blocks: 1 } : o)
    };
    state = placeBlock(state, 0, 0, 0); // opponent 0 places in cell 0
    expect(state.bridges[0].cells[0]).toBe('red');

    // Now player overwrites it
    state = { ...state, player: { ...state.player, blocks: 1 } };
    const next = placeBlock(state, 'player', 0, 0);
    expect(next.bridges[0].cells[0]).toBe('blue');
  });

  it('returns state unchanged if entity has no blocks', () => {
    const state = createInitialState(makeLevel());
    expect(state.player.blocks).toBe(0);
    const next = placeBlock(state, 'player', 0, 0);
    expect(next).toBe(state);
  });

  it('decrements entity.blocks after placing', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: 3 } };
    const next = placeBlock(state, 'player', 0, 0);
    expect(next.player.blocks).toBe(2);
  });

  it('returns state unchanged for invalid bridge index', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: 1 } };
    const next = placeBlock(state, 'player', 99, 0);
    expect(next).toBe(state);
  });

  it('returns state unchanged for invalid cell index', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: 1 } };
    const next = placeBlock(state, 'player', 0, 99);
    expect(next).toBe(state);
  });

  it('returns state unchanged for negative cell index (< 0 branch)', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: 1 } };
    const next = placeBlock(state, 'player', 0, -1);
    expect(next).toBe(state);
  });

  it('returns state unchanged when entity has negative blocks (<= 0 covers negatives)', () => {
    // entity.blocks <= 0 guard: -1 <= 0 is true → returns state unchanged
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, blocks: -1 } };
    const next = placeBlock(state, 'player', 0, 0);
    expect(next).toBe(state);
  });

  it('works for opponent entities', () => {
    let state = createInitialState(makeLevel());
    state = { ...state,
      opponents: state.opponents.map((o, i) => i === 0 ? { ...o, blocks: 2 } : o)
    };
    const next = placeBlock(state, 0, 0, 1);
    expect(next.bridges[0].cells[1]).toBe('red');
    expect(next.opponents[0].blocks).toBe(1);
  });
});

// ── isBridgeComplete ──────────────────────────────────────────────────────

describe('isBridgeComplete', () => {
  it('returns false for all-null cells', () => {
    const bridge = { cells: [null, null, null] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(false);
  });

  it('returns false for partially filled cells', () => {
    const bridge = { cells: ['blue', null, 'blue'] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(false);
  });

  it('returns true when all cells match the color', () => {
    const bridge = { cells: ['blue', 'blue', 'blue'] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(true);
  });

  it('returns false when cells have mixed colors', () => {
    const bridge = { cells: ['blue', 'red', 'blue'] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(false);
  });

  it('returns false when cells match a different color', () => {
    const bridge = { cells: ['red', 'red', 'red'] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(false);
  });

  it('returns false for empty cells array', () => {
    const bridge = { cells: [] };
    expect(isBridgeComplete(bridge, 'blue')).toBe(false);
  });
});

// ── crossBridge ───────────────────────────────────────────────────────────

describe('crossBridge', () => {
  function makeStateWithBridge(bridgeColor) {
    let state = createInitialState(makeLevel());
    // Fill bridge 0 with given color
    const cells = Array(3).fill(bridgeColor);
    state = { ...state, bridges: state.bridges.map((b, i) => i === 0 ? { ...b, cells } : b) };
    return state;
  }

  it('increments bridgesCompleted when bridge is complete', () => {
    const state = makeStateWithBridge('blue');
    const next  = crossBridge(state, 'player', 0);
    expect(next.player.bridgesCompleted).toBe(1);
  });

  it('advances entity z to bridge.z + 1', () => {
    const state = makeStateWithBridge('blue');
    const next  = crossBridge(state, 'player', 0);
    expect(next.player.z).toBe(state.bridges[0].z + 1);
  });

  it('does not cross if bridge is not complete', () => {
    const state = createInitialState(makeLevel());
    const next  = crossBridge(state, 'player', 0);
    expect(next.player.bridgesCompleted).toBe(0);
    expect(next).toBe(state);
  });

  it('enforces bridge order - cannot skip to bridge 1 without crossing bridge 0', () => {
    let state = createInitialState(makeLevel());
    // Fill bridge 1 with blue but leave bridge 0 empty
    const cells = Array(3).fill('blue');
    state = { ...state, bridges: state.bridges.map((b, i) => i === 1 ? { ...b, cells } : b) };
    const next = crossBridge(state, 'player', 1);
    // bridgesCompleted is 0, bridgeIdx is 1 → blocked
    expect(next.player.bridgesCompleted).toBe(0);
  });

  it('works for opponents', () => {
    let state = createInitialState(makeLevel());
    const cells = Array(3).fill('red');
    state = { ...state, bridges: state.bridges.map((b, i) => i === 0 ? { ...b, cells } : b) };
    const next = crossBridge(state, 0, 0);
    expect(next.opponents[0].bridgesCompleted).toBe(1);
  });

  it('returns state unchanged for invalid bridge index', () => {
    const state = createInitialState(makeLevel());
    const next  = crossBridge(state, 'player', 99);
    expect(next).toBe(state);
  });
});

// ── hasEntityWon ──────────────────────────────────────────────────────────

describe('hasEntityWon', () => {
  it('returns false when entity has not crossed all bridges', () => {
    const state = createInitialState(makeLevel());
    expect(hasEntityWon(state, 'player')).toBe(false);
  });

  it('returns false when entity is past finishZ but has not crossed all bridges', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, z: 200, bridgesCompleted: 1 } };
    expect(hasEntityWon(state, 'player')).toBe(false);
  });

  it('returns true when entity is past finishZ and crossed all bridges', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, z: 200, bridgesCompleted: 2 } };
    expect(hasEntityWon(state, 'player')).toBe(true);
  });

  it('returns true when entity.z equals finishZ exactly (>= boundary)', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, z: 100, bridgesCompleted: 2 } };
    expect(hasEntityWon(state, 'player')).toBe(true);
  });

  it('returns false for invalid entityId (if(!entity) guard branch)', () => {
    const state = createInitialState(makeLevel());
    expect(hasEntityWon(state, 99)).toBe(false);
  });

  it('returns false when all bridges crossed but z < finishZ (first && operand short-circuits)', () => {
    // bridgesCompleted >= totalBridges (TRUE) but z < finishZ (FALSE) → && returns false
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, z: 50, bridgesCompleted: 2 } };
    expect(hasEntityWon(state, 'player')).toBe(false);
  });
});

// ── checkWin ──────────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns "won" if player has won', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, z: 200, bridgesCompleted: 2 } };
    const next = checkWin(state);
    expect(next.status).toBe('won');
  });

  it('returns "lost" if opponent 0 has won', () => {
    let state = createInitialState(makeLevel());
    state = { ...state,
      opponents: state.opponents.map((o, i) =>
        i === 0 ? { ...o, z: 200, bridgesCompleted: 2 } : o
      )
    };
    const next = checkWin(state);
    expect(next.status).toBe('lost');
  });

  it('returns "lost" if opponent 1 has won', () => {
    let state = createInitialState(makeLevel());
    state = { ...state,
      opponents: state.opponents.map((o, i) =>
        i === 1 ? { ...o, z: 200, bridgesCompleted: 2 } : o
      )
    };
    const next = checkWin(state);
    expect(next.status).toBe('lost');
  });

  it('returns state unchanged if nobody has won', () => {
    const state = createInitialState(makeLevel());
    const next  = checkWin(state);
    expect(next).toBe(state);
  });

  it('player winning takes priority over checking opponents', () => {
    let state = createInitialState(makeLevel());
    // Both player and opponent 0 have won conditions
    state = {
      ...state,
      player: { ...state.player, z: 200, bridgesCompleted: 2 },
      opponents: state.opponents.map((o, i) =>
        i === 0 ? { ...o, z: 200, bridgesCompleted: 2 } : o
      )
    };
    const next = checkWin(state);
    expect(next.status).toBe('won');
  });

  it('returns state unchanged if already game over', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, status: 'won' };
    const next = checkWin(state);
    expect(next).toBe(state);
  });
});

// ── moveEntity ─────────────────────────────────────────────────────────────

describe('moveEntity', () => {
  it('moves entity by dx, dz', () => {
    const state = createInitialState(makeLevel());
    const next  = moveEntity(state, 'player', 2, 5);
    expect(next.player.x).toBe(2);
    expect(next.player.z).toBe(5);
  });

  it('clamps x to arena bounds (positive)', () => {
    const state = createInitialState(makeLevel());
    const next  = moveEntity(state, 'player', 100, 0);
    expect(next.player.x).toBe(12); // arenaWidth/2 = 12
  });

  it('clamps x to arena bounds (negative)', () => {
    const state = createInitialState(makeLevel());
    const next  = moveEntity(state, 'player', -100, 0);
    expect(next.player.x).toBe(-12);
  });

  it('blocks z at incomplete bridge', () => {
    const state = createInitialState(makeLevel());
    // Bridge 0 is at z=30, incomplete
    const next = moveEntity(state, 'player', 0, 50);
    expect(next.player.z).toBe(30); // blocked at bridge.z
  });

  it('allows advancing past bridge if it is complete', () => {
    let state = createInitialState(makeLevel());
    // Complete bridge 0 with blue
    const cells = Array(3).fill('blue');
    state = { ...state,
      bridges: state.bridges.map((b, i) => i === 0 ? { ...b, cells } : b),
      player: { ...state.player, bridgesCompleted: 1 }
    };
    const next = moveEntity(state, 'player', 0, 50);
    expect(next.player.z).toBe(50); // not blocked by bridge 0 any more
  });

  it('allows free movement when all bridges are completed (loop start >= length, never executes)', () => {
    let state = createInitialState(makeLevel());
    // bridgesCompleted === 2 === bridges.length → loop body never runs
    state = { ...state, player: { ...state.player, bridgesCompleted: 2, z: 80 } };
    const next = moveEntity(state, 'player', 0, 30);
    expect(next.player.z).toBe(110); // no incomplete bridge → free to advance past finishZ
  });

  it('blocks at first incomplete bridge only', () => {
    let state = createInitialState(makeLevel());
    // Complete bridge 0 with blue, bridge 1 still incomplete
    const cells = Array(3).fill('blue');
    state = { ...state,
      bridges: state.bridges.map((b, i) => i === 0 ? { ...b, cells } : b),
      player: { ...state.player, bridgesCompleted: 1, z: 31 }
    };
    const next = moveEntity(state, 'player', 0, 100);
    expect(next.player.z).toBe(70); // blocked at bridge 1 z=70
  });

  it('works for opponents', () => {
    const state = createInitialState(makeLevel());
    const next  = moveEntity(state, 0, 1, 3);
    expect(next.opponents[0].x).toBe(7); // 6 + 1
    expect(next.opponents[0].z).toBe(3);
  });

  it('allows backward movement past incomplete bridge (guard only blocks forward)', () => {
    let state = createInitialState(makeLevel());
    // Position player past the bridge (bridge at z=30, player at z=40)
    state = { ...state, player: { ...state.player, z: 40 } };
    // Move backward by 20 — passes through bridge zone without blocking
    const next = moveEntity(state, 'player', 0, -20);
    expect(next.player.z).toBe(20); // not blocked — backward movement is always allowed
  });

  it('returns same state for unknown entityId (if(!entity) guard)', () => {
    const state = createInitialState(makeLevel());
    expect(moveEntity(state, 'ghost-entity', 5, 10)).toBe(state);
  });
});

// ── findNearestPile ────────────────────────────────────────────────────────

describe('findNearestPile', () => {
  it('returns nearest pile with matching color', () => {
    const state = createInitialState(makeLevel());
    // Player is at (0,0), blue piles at (-5,10) and (0,40)
    const idx = findNearestPile(state, 'player');
    expect(idx).toBe(0); // (-5,10) is closer
  });

  it('returns -1 if no matching piles available', () => {
    let state = createInitialState(makeLevel());
    // Deplete all blue piles
    state = { ...state, blockPiles: state.blockPiles.map(p =>
      p.color === 'blue' ? { ...p, count: 0 } : p
    )};
    expect(findNearestPile(state, 'player')).toBe(-1);
  });

  it('ignores piles of wrong color', () => {
    const state = createInitialState(makeLevel());
    // Opponent 0 (red) should find pile index 1 (red)
    const idx = findNearestPile(state, 0);
    expect(idx).toBe(1);
  });

  it('returns -1 for entity with no matching color piles', () => {
    const level = makeLevel({
      blockPiles: [
        { x: 0, z: 10, color: 'blue', count: 5 }
      ]
    });
    const state = createInitialState(level);
    // Opponent 0 is red, no red piles
    expect(findNearestPile(state, 0)).toBe(-1);
  });
});

// ── findNextBridge ─────────────────────────────────────────────────────────

describe('findNextBridge', () => {
  it('returns 0 for first incomplete bridge when player starts fresh', () => {
    const state = createInitialState(makeLevel());
    expect(findNextBridge(state, 'player')).toBe(0);
  });

  it('returns 1 after player has crossed bridge 0', () => {
    let state = createInitialState(makeLevel());
    state = { ...state, player: { ...state.player, bridgesCompleted: 1 } };
    expect(findNextBridge(state, 'player')).toBe(1);
  });

  it('returns -1 when all bridges are complete for entity color', () => {
    let state = createInitialState(makeLevel());
    state = { ...state,
      player: { ...state.player, bridgesCompleted: 2 },
      bridges: state.bridges.map(b => ({ ...b, cells: Array(3).fill('blue') }))
    };
    expect(findNextBridge(state, 'player')).toBe(-1);
  });

  it('skips bridges already completed', () => {
    let state = createInitialState(makeLevel());
    // Bridge 0 complete for blue, player bridgesCompleted=1
    const cells = Array(3).fill('blue');
    state = { ...state,
      bridges: state.bridges.map((b, i) => i === 0 ? { ...b, cells } : b),
      player: { ...state.player, bridgesCompleted: 1 }
    };
    expect(findNextBridge(state, 'player')).toBe(1);
  });
});

// ── findBridgeCell ─────────────────────────────────────────────────────────

describe('findBridgeCell', () => {
  it('returns 0 for all-null bridge', () => {
    const bridge = { cells: [null, null, null] };
    expect(findBridgeCell(bridge, 'blue')).toBe(0);
  });

  it('returns first non-matching cell', () => {
    const bridge = { cells: ['blue', null, null] };
    expect(findBridgeCell(bridge, 'blue')).toBe(1);
  });

  it('returns -1 when bridge is fully complete for color', () => {
    const bridge = { cells: ['blue', 'blue', 'blue'] };
    expect(findBridgeCell(bridge, 'blue')).toBe(-1);
  });

  it('finds first cell that differs, including opponent color', () => {
    const bridge = { cells: ['blue', 'red', 'blue'] };
    // Index 1 is 'red', not 'blue' → findBridgeCell returns 1
    expect(findBridgeCell(bridge, 'blue')).toBe(1);

    // For 'red' color filling: first non-red is index 0
    expect(findBridgeCell(bridge, 'red')).toBe(0);
  });
});

// ── aiTick ────────────────────────────────────────────────────────────────

describe('aiTick', () => {
  const mockRng = {
    next: () => 0.1  // always < 0.7, so "random" ai behaves greedily
  };

  it('greedy AI moves toward pile when it has no blocks', () => {
    const state = createInitialState(makeLevel());
    const { dx, dz } = aiTick(state, 0, 1 / 60, mockRng);
    // Opponent 0 (red) is at (6, 0), pile is at (5, 10)
    // Should move toward pile direction
    expect(typeof dx).toBe('number');
    expect(typeof dz).toBe('number');
  });

  it('greedy AI moves forward when no blocks and no piles', () => {
    const level = makeLevel({
      blockPiles: [] // no piles at all
    });
    const state = createInitialState(level);
    const { dx, dz } = aiTick(state, 0, 1 / 60, mockRng);
    expect(dz).toBeGreaterThan(0); // moves forward
  });

  it('greedy AI moves toward bridge when it has blocks', () => {
    let state = createInitialState(makeLevel());
    state = { ...state,
      opponents: state.opponents.map((o, i) => i === 0 ? { ...o, blocks: 3 } : o)
    };
    const { dx, dz } = aiTick(state, 0, 1 / 60, mockRng);
    // Should move toward bridge (positive z direction since bridge is at z=30)
    expect(dz).toBeGreaterThan(0);
  });

  it('random AI with high roll (>= 0.7) produces random wander', () => {
    const highRoll = { next: () => 0.9 }; // always wanders
    const state = createInitialState(makeLevel());
    const { dx, dz } = aiTick(state, 1, 1 / 60, highRoll); // opponent 1 is 'random' ai
    expect(typeof dx).toBe('number');
    expect(typeof dz).toBe('number');
  });

  it('random AI with low roll (< 0.7) falls through to greedyMove — (if roll < 0.7) true arm', () => {
    // Opponent 1 is 'random' ai; mockRng returns 0.1 < 0.7 → greedyMove() is called
    // (distinct from 'greedy' ai which never reaches the roll check at all)
    const lowRoll = { next: () => 0.1 };
    const state = createInitialState(makeLevel());
    const { dx, dz } = aiTick(state, 1, 1 / 60, lowRoll); // opponent 1 is 'random' ai
    // greedyMove() with no blocks → moves toward nearest pile → dz > 0
    expect(typeof dx).toBe('number');
    expect(dz).toBeGreaterThan(0);
  });

  it('returns {dx:0, dz:0} for invalid opponent index', () => {
    const state = createInitialState(makeLevel());
    const result = aiTick(state, 99, 1 / 60, mockRng);
    expect(result).toEqual({ dx: 0, dz: 0 });
  });

  it('returns {dx:0, dz:speed} when opponent is already at target (dist < 0.001)', () => {
    // Position red opponent (idx 0) exactly on the red pile at (5, 10)
    // dist = 0 < 0.001 → early return {dx:0, dz:speed}
    const level = makeLevel({
      opponents: [{ color: 'red', x: 5, ai: 'greedy' }],
      blockPiles: [{ x: 5, z: 0, color: 'red', count: 5 }], // pile at same z as opponent start
    });
    const state = createInitialState(level);
    // opponent starts at z=0 (createInitialState sets z=0), pile is at z=0 → dist=0
    const dt = 1 / 60;
    const { dx, dz } = aiTick(state, 0, dt, mockRng);
    expect(dx).toBe(0);
    expect(dz).toBeCloseTo(ENTITY_SPEED * dt, 5); // speed = ENTITY_SPEED * dt
  });

  it('greedy move is bounded by speed * dt', () => {
    const state = createInitialState(makeLevel());
    const dt = 1 / 60;
    const { dx, dz } = aiTick(state, 0, dt, mockRng);
    const mag = Math.sqrt(dx * dx + dz * dz);
    expect(mag).toBeLessThanOrEqual(ENTITY_SPEED * dt + 0.001);
  });

  it('greedy AI moves forward when it has blocks but all bridges are already complete', () => {
    // Make all bridges complete with red (opponent 0 color) so findNextBridge → -1
    let state = createInitialState(makeLevel());
    state = {
      ...state,
      opponents: state.opponents.map((o, i) => i === 0 ? { ...o, blocks: 3 } : o),
      bridges: state.bridges.map(b => ({ ...b, cells: Array(b.cells.length).fill('red') })),
    };
    const dt = 1 / 60;
    const { dx, dz } = aiTick(state, 0, dt, mockRng);
    expect(dx).toBe(0);
    expect(dz).toBeCloseTo(ENTITY_SPEED * dt, 5);
  });
});

// ── performProximityActions ───────────────────────────────────────────────

describe('performProximityActions', () => {
  it('auto-collects from nearby pile of matching color', () => {
    let state = createInitialState(makeLevel({
      blockPiles: [{ x: 0, z: 1, color: 'blue', count: 3 }]
    }));
    // Player is at (0,0), pile at (0,1): distance = 1 < COLLECT_RADIUS=2
    const next = performProximityActions(state, 'player');
    expect(next.player.blocks).toBeGreaterThan(0);
  });

  it('does not collect from pile that is too far', () => {
    let state = createInitialState(makeLevel({
      blockPiles: [{ x: 0, z: 10, color: 'blue', count: 3 }]
    }));
    // Player is at (0,0), pile at (0,10): distance = 10 > COLLECT_RADIUS=2
    const next = performProximityActions(state, 'player');
    expect(next.player.blocks).toBe(0);
  });

  it('auto-places on nearby bridge', () => {
    let state = createInitialState(makeLevel({
      blockPiles: [{ x: 0, z: 0, color: 'blue', count: 3 }],
      bridges: [{ z: 2, required: 2 }]
    }));
    // First collect a block
    state = { ...state, player: { ...state.player, blocks: 1, z: 0 } };
    // Move player near bridge z=2
    state = { ...state, player: { ...state.player, z: 2 } };
    const next = performProximityActions(state, 'player');
    const filled = next.bridges[0].cells.filter(c => c === 'blue').length;
    expect(filled).toBeGreaterThan(0);
  });

  it('auto-crosses bridge when complete', () => {
    let state = createInitialState(makeLevel({
      bridges: [{ z: 2, required: 2 }]
    }));
    // Fill bridge 0 with blue
    const cells = ['blue', 'blue'];
    state = { ...state,
      bridges: [{ id: 0, z: 2, required: 2, cells }],
      player: { ...state.player, z: 2 }
    };
    const next = performProximityActions(state, 'player');
    expect(next.player.bridgesCompleted).toBe(1);
  });

  it('stops auto-placing on subsequent bridges when blocks run out after first placement', () => {
    // Two bridges within PLACE_RADIUS=3, player has exactly 1 block
    let state = createInitialState(makeLevel({
      blockPiles: [],
      bridges: [{ z: 1, required: 2 }, { z: 2, required: 2 }],
    }));
    state = { ...state, player: { ...state.player, blocks: 1, z: 0 } };
    const next = performProximityActions(state, 'player');
    // Bridge 0 gets the 1 block placed
    const b0filled = next.bridges[0].cells.filter(c => c === 'blue').length;
    expect(b0filled).toBe(1);
    // Bridge 1 is untouched — the break fired before reaching it
    const b1filled = next.bridges[1].cells.filter(c => c === 'blue').length;
    expect(b1filled).toBe(0);
    expect(next.player.blocks).toBe(0);
  });

  it('returns state unchanged for invalid entityId (if(!entity) guard branch)', () => {
    const state = createInitialState(makeLevel());
    const result = performProximityActions(state, 99);
    expect(result).toBe(state);
  });

  it('auto-cross loop skips entirely when bridgesCompleted === bridges.length (loop body never runs)', () => {
    // Set up a state where the player has already crossed all bridges
    const level = makeLevel({ bridges: [{ z: 2, required: 2 }] });
    let state = createInitialState(level);
    // Force player to have already crossed the only bridge
    state = { ...state, player: { ...state.player, bridgesCompleted: 1, z: 2 } };
    // Also fill the bridge so isBridgeComplete would return true if reached
    state = { ...state, bridges: [{ ...state.bridges[0], cells: ['blue', 'blue'] }] };
    const next = performProximityActions(state, 'player');
    // bridgesCompleted stays at 1 — the auto-cross loop body never ran
    expect(next.player.bridgesCompleted).toBe(1);
  });

  it('auto-cross else break fires when next bridge is not complete (else break branch)', () => {
    // Bridge exists but has 0 blue cells → isBridgeComplete returns false → else break
    const level = makeLevel({ bridges: [{ z: 2, required: 2 }] });
    let state = createInitialState(level);
    // bridgesCompleted = 0, bridge cells all null (not complete)
    state = { ...state, player: { ...state.player, bridgesCompleted: 0, z: 2 } };
    // Ensure bridge cells are empty (not blue)
    state = { ...state, bridges: [{ ...state.bridges[0], cells: [null, null] }] };
    const next = performProximityActions(state, 'player');
    // else break fired → bridgesCompleted stays at 0
    expect(next.player.bridgesCompleted).toBe(0);
  });
});

// ── isGameOver ─────────────────────────────────────────────────────────────

describe('isGameOver', () => {
  it('returns false when status is racing', () => {
    const state = createInitialState(makeLevel());
    expect(isGameOver(state)).toBe(false);
  });

  it('returns true when status is won', () => {
    const state = { ...createInitialState(makeLevel()), status: 'won' };
    expect(isGameOver(state)).toBe(true);
  });

  it('returns true when status is lost', () => {
    const state = { ...createInitialState(makeLevel()), status: 'lost' };
    expect(isGameOver(state)).toBe(true);
  });
});

// ── calculateStars ─────────────────────────────────────────────────────────

// Minimal state for calculateStars — only the fields the function reads.
function makeStarState(filledCount, remainingBlue) {
  return {
    player: { color: 'blue' },
    bridges: [{ cells: Array(filledCount).fill('blue') }],
    blockPiles: [{ color: 'blue', count: remainingBlue }]
  };
}

describe('calculateStars', () => {
  it('returns a number 1-3', () => {
    const state = createInitialState(makeLevel());
    const stars = calculateStars(state);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(3);
  });

  it('returns 1 star when no cells filled', () => {
    const state = createInitialState(makeLevel());
    expect(calculateStars(state)).toBe(1);
  });

  it('returns 3 stars when efficiency ratio >= 0.8', () => {
    // filledCells=8, remainingBlue=2 → ratio = 8/10 = 0.8
    expect(calculateStars(makeStarState(8, 2))).toBe(3);
  });

  it('returns 3 stars when all available blocks are used (ratio = 1.0)', () => {
    // filledCells=10, remainingBlue=0 → but totalBlueBlocks=0 guard fires → returns 1
    // Instead test ratio approaching 1: filledCells=9, remaining=1 → 9/10 = 0.9
    expect(calculateStars(makeStarState(9, 1))).toBe(3);
  });

  it('returns 2 stars when efficiency ratio is exactly 0.5', () => {
    // filledCells=5, remainingBlue=5 → ratio = 5/10 = 0.5
    expect(calculateStars(makeStarState(5, 5))).toBe(2);
  });

  it('returns 2 stars when efficiency ratio is between 0.5 and 0.8', () => {
    // filledCells=6, remainingBlue=6 → ratio = 6/12 = 0.5 (boundary)
    // filledCells=7, remainingBlue=6 → ratio = 7/13 ≈ 0.538
    expect(calculateStars(makeStarState(7, 6))).toBe(2);
  });

  it('returns 1 star when efficiency ratio < 0.5', () => {
    // filledCells=2, remainingBlue=8 → ratio = 2/10 = 0.2
    expect(calculateStars(makeStarState(2, 8))).toBe(1);
  });

  it('returns 1 star when no blue blocks remain in piles (zero-denominator guard)', () => {
    // totalBlueBlocks=0 → early return of 1 regardless of filled cells
    expect(calculateStars(makeStarState(0, 0))).toBe(1);
  });
});

// ── createInitialState — OR fallback defaults ──────────────────────────────

describe('createInitialState — OR fallback defaults', () => {
  it('defaults opponents to [] when level has no opponents field (|| [] branch)', () => {
    const state = createInitialState(makeLevel({ opponents: undefined }));
    expect(state.opponents).toEqual([]);
  });

  it('defaults opponent ai to "random" when ai field is absent (|| "random" branch)', () => {
    const state = createInitialState(makeLevel({ opponents: [{ color: 'red', x: 0 }] }));
    expect(state.opponents[0].ai).toBe('random');
  });

  it('defaults playerColor to "blue" when not provided (|| "blue" branch)', () => {
    const state = createInitialState(makeLevel({ playerColor: undefined }));
    expect(state.player.color).toBe('blue');
  });

  it('defaults arenaWidth to 24 when not provided (|| 24 branch)', () => {
    const state = createInitialState(makeLevel({ arenaWidth: undefined }));
    expect(state.arenaWidth).toBe(24);
  });
});

// ── aiTick — rng fallback ──────────────────────────────────────────────────

describe('aiTick — rng fallback', () => {
  it('uses Math.random when rng is undefined (rng falsy branch in ternary)', () => {
    const state = createInitialState(makeLevel());
    const result = aiTick(state, 0, 1 / 60, undefined);
    expect(typeof result.dx).toBe('number');
    expect(typeof result.dz).toBe('number');
    expect(Number.isNaN(result.dx)).toBe(false);
    expect(Number.isNaN(result.dz)).toBe(false);
  });

  it('uses Math.random when rng is null (rng falsy branch)', () => {
    const state = createInitialState(makeLevel());
    expect(() => aiTick(state, 0, 1 / 60, null)).not.toThrow();
  });
});

// ── aiTick — Math.abs forward bias ───────────────────────────────────────────

describe('aiTick — random wander dz is always non-negative (Math.abs forward bias)', () => {
  it('dz >= 0 for wander when angle is in 3rd/4th quadrant (sine is negative without Math.abs)', () => {
    // rng returns 0.9 for the first call (roll >= 0.7 → wanders)
    // then returns 0.9 for the angle → angle = 0.9 * 2π ≈ 5.655 rad → sin(5.655) ≈ -0.587
    // Math.abs clamps dz to positive
    const rng = { next: () => 0.9 };
    const state = createInitialState(makeLevel());
    const { dz } = aiTick(state, 1, 1 / 60, rng); // opponent 1 is 'random' ai type
    expect(dz).toBeGreaterThanOrEqual(0);
  });
});
