/**
 * Bridge Race - State Management
 *
 * Pure functions for game state. No DOM or rendering imports.
 *
 * State model:
 * {
 *   player: { color, blocks, x, z, bridgesCompleted },
 *   opponents: [{ id, color, blocks, x, z, bridgesCompleted, ai }],
 *   blockPiles: [{ id, x, z, color, count }],
 *   bridges: [{ id, z, required, cells }],
 *   finishZ: number,
 *   arenaWidth: number,
 *   totalBridges: number,
 *   status: 'racing' | 'won' | 'lost',
 *   time: number
 * }
 */

export const COLLECT_RADIUS = 2.0;
export const PLACE_RADIUS   = 3.0;
export const ENTITY_SPEED   = 5;

// ── createInitialState ────────────────────────────────────────────────────

/**
 * Initialize state from level JSON.
 */
export function createInitialState(level) {
  const bridges = level.bridges.map((b, i) => ({
    id: i,
    z: b.z,
    required: b.required,
    cells: Array(b.required).fill(null)
  }));

  const blockPiles = level.blockPiles.map((p, i) => ({
    id: i,
    x: p.x,
    z: p.z,
    color: p.color,
    count: p.count
  }));

  const opponents = (level.opponents || []).map((o, i) => ({
    id: i,
    color: o.color,
    blocks: 0,
    x: o.x,
    z: 0,
    bridgesCompleted: 0,
    ai: o.ai || 'random'
  }));

  return {
    player: {
      color: level.playerColor || 'blue',
      blocks: 0,
      x: 0,
      z: 0,
      bridgesCompleted: 0
    },
    opponents,
    blockPiles,
    bridges,
    finishZ: level.finishZ,
    arenaWidth: level.arenaWidth || 24,
    totalBridges: level.bridges.length,
    status: 'racing',
    time: 0
  };
}

// ── Entity helpers ────────────────────────────────────────────────────────

function getEntity(state, entityId) {
  if (entityId === 'player') return state.player;
  return state.opponents[entityId];
}

function setEntity(state, entityId, updated) {
  if (entityId === 'player') {
    return { ...state, player: updated };
  }
  const opponents = state.opponents.map((o, i) => i === entityId ? updated : o);
  return { ...state, opponents };
}

// ── collectBlock ──────────────────────────────────────────────────────────

/**
 * Collect from pile pileIdx. Only works if entity.color === pile.color && pile.count > 0.
 * Increments entity.blocks, decrements pile.count.
 */
export function collectBlock(state, entityId, pileIdx) {
  const entity = getEntity(state, entityId);
  const pile = state.blockPiles[pileIdx];

  if (!entity || !pile) return state;
  if (entity.color !== pile.color) return state;
  if (pile.count <= 0) return state;

  const newPiles = state.blockPiles.map((p, i) =>
    i === pileIdx ? { ...p, count: p.count - 1 } : p
  );
  const newEntity = { ...entity, blocks: entity.blocks + 1 };

  return setEntity({ ...state, blockPiles: newPiles }, entityId, newEntity);
}

// ── placeBlock ────────────────────────────────────────────────────────────

/**
 * Place entity's block in bridge cell cellIdx. Overwrites any existing color.
 * Decrements entity.blocks. Returns state unchanged if entity has no blocks.
 */
export function placeBlock(state, entityId, bridgeIdx, cellIdx) {
  const entity = getEntity(state, entityId);
  if (!entity) return state;
  if (entity.blocks <= 0) return state;

  const bridge = state.bridges[bridgeIdx];
  if (!bridge) return state;
  if (cellIdx < 0 || cellIdx >= bridge.cells.length) return state;

  const newCells = bridge.cells.map((c, i) => i === cellIdx ? entity.color : c);
  const newBridges = state.bridges.map((b, i) =>
    i === bridgeIdx ? { ...b, cells: newCells } : b
  );
  const newEntity = { ...entity, blocks: entity.blocks - 1 };

  return setEntity({ ...state, bridges: newBridges }, entityId, newEntity);
}

// ── isBridgeComplete ──────────────────────────────────────────────────────

/**
 * Returns true if all bridge cells === color.
 */
export function isBridgeComplete(bridge, color) {
  return bridge.cells.length > 0 && bridge.cells.every(c => c === color);
}

// ── crossBridge ───────────────────────────────────────────────────────────

/**
 * If bridge is complete for entity's color AND it's the entity's next bridge,
 * increment entity.bridgesCompleted and advance entity.z to bridge.z + 1.
 */
export function crossBridge(state, entityId, bridgeIdx) {
  const entity = getEntity(state, entityId);
  if (!entity) return state;

  const bridge = state.bridges[bridgeIdx];
  if (!bridge) return state;

  // Bridges must be crossed in order
  if (entity.bridgesCompleted !== bridgeIdx) return state;

  if (!isBridgeComplete(bridge, entity.color)) return state;

  const newEntity = {
    ...entity,
    bridgesCompleted: entity.bridgesCompleted + 1,
    z: bridge.z + 1
  };

  return setEntity(state, entityId, newEntity);
}

// ── hasEntityWon ──────────────────────────────────────────────────────────

/**
 * Returns true if entity.z >= finishZ AND entity.bridgesCompleted >= totalBridges.
 */
export function hasEntityWon(state, entityId) {
  const entity = getEntity(state, entityId);
  if (!entity) return false;
  return entity.z >= state.finishZ && entity.bridgesCompleted >= state.totalBridges;
}

// ── checkWin ──────────────────────────────────────────────────────────────

/**
 * Returns updated state with status: player won → 'won', opponent won first → 'lost'.
 */
export function checkWin(state) {
  if (state.status !== 'racing') return state;

  if (hasEntityWon(state, 'player')) {
    return { ...state, status: 'won' };
  }

  for (let i = 0; i < state.opponents.length; i++) {
    if (hasEntityWon(state, i)) {
      return { ...state, status: 'lost' };
    }
  }

  return state;
}

// ── moveEntity ────────────────────────────────────────────────────────────

/**
 * Move entity with arena bounds clamping. Z is blocked by incomplete bridges
 * (entity cannot advance past bridge.z if bridge is not complete for their color).
 */
export function moveEntity(state, entityId, dx, dz) {
  const entity = getEntity(state, entityId);
  if (!entity) return state;

  const half = state.arenaWidth / 2;
  let newX = Math.max(-half, Math.min(half, entity.x + dx));
  let newZ = entity.z + dz;

  // Block by incomplete bridges (only check bridges entity hasn't crossed yet)
  for (let i = entity.bridgesCompleted; i < state.bridges.length; i++) {
    const bridge = state.bridges[i];
    if (!isBridgeComplete(bridge, entity.color)) {
      if (newZ > bridge.z) {
        newZ = bridge.z;
      }
      break; // only block at the first incomplete bridge
    }
  }

  const newEntity = { ...entity, x: newX, z: newZ };
  return setEntity(state, entityId, newEntity);
}

// ── findNearestPile ───────────────────────────────────────────────────────

/**
 * Returns pile index with matching color and count > 0, nearest to entity.
 * Returns -1 if none found.
 */
export function findNearestPile(state, entityId) {
  const entity = getEntity(state, entityId);
  if (!entity) return -1;

  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < state.blockPiles.length; i++) {
    const pile = state.blockPiles[i];
    if (pile.color !== entity.color) continue;
    if (pile.count <= 0) continue;

    const dx = pile.x - entity.x;
    const dz = pile.z - entity.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ── findNextBridge ────────────────────────────────────────────────────────

/**
 * Returns index of first bridge (starting from entity.bridgesCompleted)
 * that is not complete for entity's color. Returns -1 if all complete.
 */
export function findNextBridge(state, entityId) {
  const entity = getEntity(state, entityId);
  if (!entity) return -1;

  for (let i = entity.bridgesCompleted; i < state.bridges.length; i++) {
    if (!isBridgeComplete(state.bridges[i], entity.color)) {
      return i;
    }
  }

  return -1;
}

// ── findBridgeCell ────────────────────────────────────────────────────────

/**
 * Returns index of first cell that !== color. Returns -1 if all complete.
 */
export function findBridgeCell(bridge, color) {
  for (let i = 0; i < bridge.cells.length; i++) {
    if (bridge.cells[i] !== color) return i;
  }
  return -1;
}

// ── aiTick ────────────────────────────────────────────────────────────────

/**
 * Compute {dx, dz} for an AI opponent for one tick.
 * greedy: go to nearest pile (no blocks) or nearest bridge (has blocks).
 * random: 70% greedy, 30% random wander.
 */
export function aiTick(state, opponentIdx, dt, rng) {
  const opponent = state.opponents[opponentIdx];
  if (!opponent) return { dx: 0, dz: 0 };

  const speed = ENTITY_SPEED * dt;

  function greedyMove() {
    let targetX, targetZ;

    if (opponent.blocks === 0) {
      // Go to nearest matching pile
      const pileIdx = findNearestPile(state, opponentIdx);
      if (pileIdx === -1) {
        // No piles; move forward
        return { dx: 0, dz: speed };
      }
      const pile = state.blockPiles[pileIdx];
      targetX = pile.x;
      targetZ = pile.z;
    } else {
      // Go to next bridge
      const bridgeIdx = findNextBridge(state, opponentIdx);
      if (bridgeIdx === -1) {
        // All bridges done, go to finish
        return { dx: 0, dz: speed };
      }
      const bridge = state.bridges[bridgeIdx];
      targetX = opponent.x; // stay at current X, head to bridge Z
      targetZ = bridge.z;
    }

    const dx = targetX - opponent.x;
    const dz = targetZ - opponent.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.001) return { dx: 0, dz: speed };

    const scale = speed / dist;
    return { dx: dx * scale, dz: dz * scale };
  }

  if (opponent.ai === 'greedy') {
    return greedyMove();
  }

  // 'random': 70% greedy, 30% random wander
  const roll = rng ? rng.next() : Math.random();
  if (roll < 0.7) {
    return greedyMove();
  }

  // Random wander
  const angle = (rng ? rng.next() : Math.random()) * Math.PI * 2;
  return {
    dx: Math.cos(angle) * speed,
    dz: Math.abs(Math.sin(angle)) * speed  // bias forward
  };
}

// ── performProximityActions ───────────────────────────────────────────────

/**
 * Auto-collect from nearby piles (COLLECT_RADIUS), auto-place on nearby bridges
 * (PLACE_RADIUS), auto-cross completed bridges. Returns updated state.
 */
export function performProximityActions(state, entityId) {
  const entity = getEntity(state, entityId);
  if (!entity) return state;

  let s = state;

  // Auto-collect from nearby matching piles
  for (let i = 0; i < s.blockPiles.length; i++) {
    const pile = s.blockPiles[i];
    if (pile.color !== entity.color) continue;
    if (pile.count <= 0) continue;

    const ent = getEntity(s, entityId);
    const dx = pile.x - ent.x;
    const dz = pile.z - ent.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= COLLECT_RADIUS) {
      s = collectBlock(s, entityId, i);
    }
  }

  // Auto-place on nearby bridges
  for (let i = 0; i < s.bridges.length; i++) {
    const bridge = s.bridges[i];
    const ent = getEntity(s, entityId);
    if (ent.blocks <= 0) break;

    const dz = bridge.z - ent.z;
    const distZ = Math.abs(dz);
    const distX = Math.abs(ent.x); // bridges span full width, so just check z distance
    const dist = Math.sqrt(distX * distX + distZ * distZ);

    if (dist <= PLACE_RADIUS) {
      const cellIdx = findBridgeCell(bridge, ent.color);
      if (cellIdx !== -1) {
        s = placeBlock(s, entityId, i, cellIdx);
      }
    }
  }

  // Auto-cross completed bridges
  const finalEnt = getEntity(s, entityId);
  for (let i = finalEnt.bridgesCompleted; i < s.bridges.length; i++) {
    const bridge = s.bridges[i];
    if (isBridgeComplete(bridge, getEntity(s, entityId).color)) {
      s = crossBridge(s, entityId, i);
    } else {
      break;
    }
  }

  return s;
}

// ── isGameOver ────────────────────────────────────────────────────────────

export function isGameOver(state) {
  return state.status !== 'racing';
}

// ── calculateStars ────────────────────────────────────────────────────────

/**
 * Stars based on blocks collected / total available blue blocks.
 */
export function calculateStars(state) {
  const totalBlueBlocks = state.blockPiles
    .filter(p => p.color === state.player.color)
    .reduce((sum, p) => sum + p.count, 0);

  // How many blocks were used (all filled cells in bridges of player color)
  const filledCells = state.bridges
    .reduce((sum, b) => sum + b.cells.filter(c => c === state.player.color).length, 0);

  if (totalBlueBlocks === 0) return 1;
  const ratio = filledCells / (filledCells + totalBlueBlocks);

  // More cells used relative to remaining = more efficient
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export default {
  COLLECT_RADIUS,
  PLACE_RADIUS,
  ENTITY_SPEED,
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
  calculateStars
};
