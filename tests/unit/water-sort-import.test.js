import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/games/water-sort/state.js';

describe('import test', () => {
  it('can import', () => {
    const state = createInitialState({
      tubes: [['red', 'blue'], []],
      maxSegments: 4
    });
    expect(state.tubes).toHaveLength(2);
  });
});
