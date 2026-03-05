/**
 * Parking Escape - State Management
 *
 * Manages game state including:
 * - Grid and cars
 * - Move validation and execution
 * - Win condition checking
 * - State cloning for undo/redo
 */

import { History } from '../../shared/history.js';

// Car colors
export const CAR_COLORS = {
  red: '#E63946',
  blue: '#457B9D',
  green: '#2A9D8F',
  yellow: '#E9C46A',
  purple: '#9B5DE5',
  orange: '#F4A261'
};

/**
 * Create initial game state from level data
 */
export function createInitialState(level) {
  return {
    gridSize: level.gridSize,
    cars: level.cars.map(c => ({ ...c })),
    exit: { ...level.exit },
    moves: 0,
    selectedCar: null,
    draggingCar: null,
    dragOffset: { x: 0, y: 0 },
    dragPosition: null,
    collisionPreview: null,
    won: false,
    animating: false
  };
}

/**
 * Get the grid cells occupied by a car
 */
export function getCarCells(car) {
  const cells = [];
  for (let i = 0; i < car.length; i++) {
    if (car.orientation === 'horizontal') {
      cells.push({ x: car.x + i, y: car.y });
    } else {
      cells.push({ x: car.x, y: car.y + i });
    }
  }
  return cells;
}

/**
 * Check if a cell is occupied by any car
 */
export function getCarAt(state, x, y, excludeCarId = null) {
  return state.cars.find(car => {
    if (car.id === excludeCarId) return false;
    const cells = getCarCells(car);
    return cells.some(cell => cell.x === x && cell.y === y);
  });
}

/**
 * Check if a car can move to a new position
 */
export function canMoveTo(state, car, newX, newY) {
  // Check bounds
  if (car.orientation === 'horizontal') {
    if (newX < 0 || newX + car.length > state.gridSize) return false;
    if (newY !== car.y) return false; // Must stay on same row
  } else {
    if (newY < 0 || newY + car.length > state.gridSize) return false;
    if (newX !== car.x) return false; // Must stay on same column
  }

  // Check collisions with other cars
  const tempCar = { ...car, x: newX, y: newY };
  const cells = getCarCells(tempCar);
  
  for (const cell of cells) {
    if (getCarAt(state, cell.x, cell.y, car.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Get valid move range for a car along its axis
 */
export function getValidMoveRange(state, car) {
  const range = { min: 0, max: 0 };
  
  if (car.orientation === 'horizontal') {
    // Find minimum position (leftmost)
    for (let x = car.x - 1; x >= 0; x--) {
      if (canMoveTo(state, car, x, car.y)) {
        range.min = car.x - x;
      } else {
        break;
      }
    }
    // Find maximum position (rightmost)
    for (let x = car.x + 1; x + car.length <= state.gridSize; x++) {
      if (canMoveTo(state, car, x, car.y)) {
        range.max = x - car.x;
      } else {
        break;
      }
    }
  } else {
    // Find minimum position (topmost)
    for (let y = car.y - 1; y >= 0; y--) {
      if (canMoveTo(state, car, car.x, y)) {
        range.min = car.y - y;
      } else {
        break;
      }
    }
    // Find maximum position (bottommost)
    for (let y = car.y + 1; y + car.length <= state.gridSize; y++) {
      if (canMoveTo(state, car, car.x, y)) {
        range.max = y - car.y;
      } else {
        break;
      }
    }
  }
  
  return range;
}

/**
 * Find collision cells when previewing a move
 */
export function findCollisions(state, car, newX, newY) {
  const collisions = [];
  const tempCar = { ...car, x: newX, y: newY };
  const cells = getCarCells(tempCar);
  
  for (const cell of cells) {
    const otherCar = getCarAt(state, cell.x, cell.y, car.id);
    if (otherCar) {
      collisions.push({ x: cell.x, y: cell.y, blockingCar: otherCar });
    }
    
    // Check bounds
    if (cell.x < 0 || cell.x >= state.gridSize || 
        cell.y < 0 || cell.y >= state.gridSize) {
      collisions.push({ x: cell.x, y: cell.y, type: 'bounds' });
    }
  }
  
  return collisions;
}

/**
 * Check if target car has reached the exit
 */
export function checkWin(state) {
  const targetCar = state.cars.find(c => c.id === 'target');
  if (!targetCar) return false;
  
  // Check if target car can exit
  if (targetCar.orientation !== 'horizontal') return false;
  
  // Exit is on the right edge
  return targetCar.x + targetCar.length >= state.gridSize;
}

/**
 * Move car to new position
 */
export function moveCar(state, carId, newX, newY) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return false;
  
  if (!canMoveTo(state, car, newX, newY)) return false;
  
  car.x = newX;
  car.y = newY;
  state.moves++;
  
  return true;
}

/**
 * Get hint - find a car that can be moved
 */
export function getHint(state) {
  const targetCar = state.cars.find(c => c.id === 'target');
  
  // First, check if target can move toward exit
  if (targetCar) {
    const range = getValidMoveRange(state, targetCar);
    if (range.max > 0) {
      return {
        car: targetCar,
        direction: 'right',
        message: 'Move the red car toward the exit!'
      };
    }
  }
  
  // Find any car that can move to unblock
  for (const car of state.cars) {
    const range = getValidMoveRange(state, car);
    if (range.min > 0 || range.max > 0) {
      return {
        car,
        direction: range.max > 0 ? 'forward' : 'backward',
        message: `Try moving the ${car.color} car.`
      };
    }
  }
  
  return null;
}

/**
 * Clone state for history
 */
export function cloneState(state) {
  return {
    gridSize: state.gridSize,
    cars: state.cars.map(c => ({ ...c })),
    exit: { ...state.exit },
    moves: state.moves,
    selectedCar: state.selectedCar,
    draggingCar: state.draggingCar,
    dragOffset: { ...state.dragOffset },
    dragPosition: state.dragPosition ? { ...state.dragPosition } : null,
    collisionPreview: state.collisionPreview ? [...state.collisionPreview] : null,
    won: state.won,
    animating: state.animating
  };
}

/**
 * Create history manager
 */
export function createHistory(maxDepth = 50) {
  return new History(maxDepth);
}

/**
 * Calculate stars based on moves
 */
export function calculateStars(moves, optimal) {
  const ratio = moves / optimal;
  if (ratio <= 1) return 3;
  if (ratio <= 1.5) return 2;
  return 1;
}

export default {
  CAR_COLORS,
  createInitialState,
  getCarCells,
  getCarAt,
  canMoveTo,
  getValidMoveRange,
  findCollisions,
  checkWin,
  moveCar,
  getHint,
  cloneState,
  createHistory,
  calculateStars
};
