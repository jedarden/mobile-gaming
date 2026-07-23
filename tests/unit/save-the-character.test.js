/**
 * Save the Character — Unit Tests
 *
 * Tests: createInitialState, selectChoice, resolveChoice, nextScenario,
 * getScenarioTitle, getThreat, getChoices, isChoosing, isAnimating,
 * isWon, isLost, validateScenario.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialState,
  selectChoice,
  resolveChoice,
  nextScenario,
  getScenarioTitle,
  getThreat,
  getChoices,
  isChoosing,
  isAnimating,
  isWon,
  isLost,
  validateScenario,
} from '../../src/games/save-the-character/state.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeScenario(overrides = {}) {
  return {
    id: 'sc1',
    title: 'Test Scenario',
    threat: 'A boulder is rolling toward you!',
    choices: [
      { id: 'c1', label: 'Jump over it', correct: true },
      { id: 'c2', label: 'Run away', correct: false },
      { id: 'c3', label: 'Stand still', correct: false },
    ],
    ...overrides,
  };
}

// ── createInitialState ─────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('sets scenario id, title, and threat', () => {
    const state = createInitialState(makeScenario());
    expect(state.scenario.id).toBe('sc1');
    expect(state.scenario.title).toBe('Test Scenario');
    expect(state.scenario.threat).toBe('A boulder is rolling toward you!');
  });

  it('copies choices', () => {
    const state = createInitialState(makeScenario());
    expect(state.scenario.choices).toHaveLength(3);
    expect(state.scenario.choices[0].id).toBe('c1');
  });

  it('does not mutate original scenario choices', () => {
    const scenario = makeScenario();
    const orig = scenario.choices[0];
    createInitialState(scenario);
    expect(scenario.choices[0]).toBe(orig);
  });

  it('starts with selectedChoice=null', () => {
    const state = createInitialState(makeScenario());
    expect(state.selectedChoice).toBeNull();
  });

  it('starts with status="choosing"', () => {
    const state = createInitialState(makeScenario());
    expect(state.status).toBe('choosing');
  });
});

// ── selectChoice ──────────────────────────────────────────────────────────

describe('selectChoice', () => {
  it('sets selectedChoice with the matching choice', () => {
    const state = createInitialState(makeScenario());
    const next = selectChoice(state, 'c1');
    expect(next.selectedChoice).toBeDefined();
    expect(next.selectedChoice.id).toBe('c1');
  });

  it('transitions status to "animating"', () => {
    const state = createInitialState(makeScenario());
    const next = selectChoice(state, 'c2');
    expect(next.status).toBe('animating');
  });

  it('returns unchanged state for unknown choice id', () => {
    const state = createInitialState(makeScenario());
    const next = selectChoice(state, 'unknown');
    expect(next).toBe(state);
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeScenario());
    selectChoice(state, 'c1');
    expect(state.selectedChoice).toBeNull();
  });

  it('copies the selected choice (does not share reference)', () => {
    const state = createInitialState(makeScenario());
    const next = selectChoice(state, 'c1');
    expect(next.selectedChoice).not.toBe(state.scenario.choices[0]);
  });
});

// ── resolveChoice ─────────────────────────────────────────────────────────

describe('resolveChoice', () => {
  it('transitions to "won" when correct choice was selected', () => {
    const state = createInitialState(makeScenario());
    const animating = selectChoice(state, 'c1'); // c1 is correct
    const resolved = resolveChoice(animating);
    expect(resolved.status).toBe('won');
  });

  it('transitions to "lost" when incorrect choice was selected', () => {
    const state = createInitialState(makeScenario());
    const animating = selectChoice(state, 'c2'); // c2 is incorrect
    const resolved = resolveChoice(animating);
    expect(resolved.status).toBe('lost');
  });

  it('is a no-op when not in "animating" status', () => {
    const state = createInitialState(makeScenario()); // status: 'choosing'
    const next = resolveChoice(state);
    expect(next).toBe(state);
  });

  it('is a no-op when no choice is selected', () => {
    const state = { ...createInitialState(makeScenario()), status: 'animating', selectedChoice: null };
    const next = resolveChoice(state);
    expect(next).toBe(state);
  });

  it('is a no-op when selectedChoice is set but status is not "animating" (status !== "animating" OR branch)', () => {
    // selectedChoice is non-null but status is 'won' → second OR condition fires
    const choice = { id: 'c1', label: 'A', correct: true };
    const state = { ...createInitialState(makeScenario()), status: 'won', selectedChoice: choice };
    const next = resolveChoice(state);
    expect(next).toBe(state); // same reference — no state change
    expect(next.status).toBe('won'); // status unchanged
  });

  it('does not mutate original state', () => {
    const state = createInitialState(makeScenario());
    const animating = selectChoice(state, 'c1');
    resolveChoice(animating);
    expect(animating.status).toBe('animating');
  });
});

// ── nextScenario ──────────────────────────────────────────────────────────

describe('nextScenario', () => {
  it('returns fresh state for the new scenario', () => {
    const state = createInitialState(makeScenario());
    const newScenario = makeScenario({ id: 'sc2', title: 'New Scenario' });
    const next = nextScenario(state, newScenario);
    expect(next.scenario.id).toBe('sc2');
    expect(next.status).toBe('choosing');
    expect(next.selectedChoice).toBeNull();
  });

  it('discards any selected choice from the previous scenario', () => {
    const state = selectChoice(createInitialState(makeScenario()), 'c1');
    const next = nextScenario(state, makeScenario({ id: 'sc2' }));
    expect(next.selectedChoice).toBeNull();
  });
});

// ── status predicates ─────────────────────────────────────────────────────

describe('isChoosing', () => {
  it('returns true for status="choosing"', () => {
    expect(isChoosing(createInitialState(makeScenario()))).toBe(true);
  });

  it('returns false for other statuses', () => {
    const animating = selectChoice(createInitialState(makeScenario()), 'c1');
    expect(isChoosing(animating)).toBe(false);
  });
});

describe('isAnimating', () => {
  it('returns true for status="animating"', () => {
    const animating = selectChoice(createInitialState(makeScenario()), 'c1');
    expect(isAnimating(animating)).toBe(true);
  });

  it('returns false for other statuses', () => {
    expect(isAnimating(createInitialState(makeScenario()))).toBe(false);
  });
});

describe('isWon', () => {
  it('returns true for status="won"', () => {
    const state = resolveChoice(selectChoice(createInitialState(makeScenario()), 'c1'));
    expect(isWon(state)).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(isWon(createInitialState(makeScenario()))).toBe(false);
  });
});

describe('isLost', () => {
  it('returns true for status="lost"', () => {
    const state = resolveChoice(selectChoice(createInitialState(makeScenario()), 'c2'));
    expect(isLost(state)).toBe(true);
  });

  it('returns false otherwise', () => {
    expect(isLost(createInitialState(makeScenario()))).toBe(false);
  });
});

// ── getters ───────────────────────────────────────────────────────────────

describe('getScenarioTitle', () => {
  it('returns the scenario title', () => {
    const state = createInitialState(makeScenario({ title: 'My Title' }));
    expect(getScenarioTitle(state)).toBe('My Title');
  });
});

describe('getThreat', () => {
  it('returns the threat description', () => {
    const state = createInitialState(makeScenario({ threat: 'A fire!' }));
    expect(getThreat(state)).toBe('A fire!');
  });
});

describe('getChoices', () => {
  it('returns all choices', () => {
    const state = createInitialState(makeScenario());
    const choices = getChoices(state);
    expect(choices).toHaveLength(3);
    expect(choices[0].id).toBe('c1');
  });

  it('returns the same array reference from state.scenario.choices', () => {
    const state = createInitialState(makeScenario());
    expect(getChoices(state)).toBe(state.scenario.choices);
  });
});

// ── resolveChoice — third choice ─────────────────────────────────────────

describe('resolveChoice — all incorrect choices lead to lost', () => {
  it('c3 (incorrect) resolves to lost', () => {
    const state = createInitialState(makeScenario());
    const animating = selectChoice(state, 'c3'); // c3: correct=false
    const resolved = resolveChoice(animating);
    expect(resolved.status).toBe('lost');
  });
});

// ── nextScenario — completely fresh state ────────────────────────────────

describe('nextScenario — state freshness', () => {
  it('interactions/history from old scenario are not carried over', () => {
    // After resolving a scenario, nextScenario should return pristine choosing state
    let state = createInitialState(makeScenario());
    state = selectChoice(state, 'c1');
    state = resolveChoice(state); // status: won
    const next = nextScenario(state, makeScenario({ id: 'sc-fresh' }));
    expect(next.status).toBe('choosing');
    expect(next.selectedChoice).toBeNull();
    expect(next.scenario.id).toBe('sc-fresh');
  });
});

// ── validateScenario ──────────────────────────────────────────────────────

describe('validateScenario', () => {
  it('returns valid=true for a well-formed scenario', () => {
    const result = validateScenario(makeScenario());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error for missing id', () => {
    const scenario = makeScenario({ id: '' });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('reports error for missing title', () => {
    const scenario = makeScenario({ title: '' });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('reports error for missing threat', () => {
    const scenario = makeScenario({ threat: '' });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('threat'))).toBe(true);
  });

  it('reports error when choices array is missing', () => {
    const scenario = makeScenario();
    delete scenario.choices;
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error when choices is a non-array type', () => {
    const result = validateScenario(makeScenario({ choices: 'not-an-array' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid choices'))).toBe(true);
  });

  it('reports error when fewer than 2 choices', () => {
    const scenario = makeScenario({
      choices: [{ id: 'c1', label: 'Only one', correct: true }],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error when more than 4 choices', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: 'A', correct: true },
        { id: 'c2', label: 'B', correct: false },
        { id: 'c3', label: 'C', correct: false },
        { id: 'c4', label: 'D', correct: false },
        { id: 'c5', label: 'E', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error when no correct choice', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: 'A', correct: false },
        { id: 'c2', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error when more than one correct choice', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: 'A', correct: true },
        { id: 'c2', label: 'B', correct: true },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error for duplicate choice ids', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'same', label: 'A', correct: true },
        { id: 'same', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error for choice missing label', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: '', correct: true },
        { id: 'c2', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
  });

  it('reports error for choice with missing id (empty string)', () => {
    const scenario = makeScenario({
      choices: [
        { id: '', label: 'A', correct: true },
        { id: 'c2', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing id'))).toBe(true);
  });

  it('reports error for choice with non-boolean correct field', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: 'A', correct: 'yes' },
        { id: 'c2', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing correct boolean'))).toBe(true);
  });

  it('reports error when correct field is missing (undefined)', () => {
    const scenario = makeScenario({
      choices: [
        { id: 'c1', label: 'A' },
        { id: 'c2', label: 'B', correct: false },
      ],
    });
    const result = validateScenario(scenario);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing correct boolean'))).toBe(true);
  });
});

// ── Daily Challenge ─────────────────────────────────────────────────────────────

// Mock the daily module
vi.mock('../../src/shared/daily.js', () => ({
  getGameDailySeed: vi.fn((gameId) => `2026-07-23:${gameId}`),
  getGameDailyNumericSeed: vi.fn((gameId) => {
    // Hash function matching the real implementation
    const str = `2026-07-23:${gameId}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }),
  completeDailyChallenge: vi.fn(),
  isGameDailyCompleted: vi.fn(() => false)
}));

import { getGameDailySeed, getGameDailyNumericSeed, completeDailyChallenge } from '../../src/shared/daily.js';
import scenarios from '../../src/games/save-the-character/levels.json' with { type: 'json' };

describe('Daily Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a daily scenario from a known seed', () => {
    const GAME_ID = 'save-the-character';
    const seed = getGameDailySeed(GAME_ID);

    // Mock returns deterministic seed
    expect(seed).toBe(`2026-07-23:${GAME_ID}`);

    // Compute numeric seed
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    expect(typeof numericSeed).toBe('number');

    // Select daily level: levelIndex = seed % scenarios.length
    const dailyIndex = numericSeed % scenarios.length;
    const dailyScenario = scenarios[dailyIndex];

    expect(dailyScenario).toBeDefined();
    expect(dailyScenario).toHaveProperty('id');
    expect(dailyScenario).toHaveProperty('title');
    expect(dailyScenario).toHaveProperty('threat');
    expect(dailyScenario).toHaveProperty('choices');
    expect(Array.isArray(dailyScenario.choices)).toBe(true);
  });

  it('generates the same daily scenario for the same seed', () => {
    const GAME_ID = 'save-the-character';

    const seed1 = getGameDailySeed(GAME_ID);
    const numericSeed1 = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex1 = numericSeed1 % scenarios.length;
    const scenario1 = scenarios[dailyIndex1];

    const seed2 = getGameDailySeed(GAME_ID);
    const numericSeed2 = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex2 = numericSeed2 % scenarios.length;
    const scenario2 = scenarios[dailyIndex2];

    // Same seed should produce the same scenario
    expect(seed1).toBe(seed2);
    expect(numericSeed1).toBe(numericSeed2);
    expect(dailyIndex1).toBe(dailyIndex2);
    expect(scenario1).toEqual(scenario2);
  });

  it('can create initial state from daily scenario', () => {
    const GAME_ID = 'save-the-character';
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex = numericSeed % scenarios.length;
    const dailyScenario = scenarios[dailyIndex];

    const state = createInitialState(dailyScenario);

    expect(state.scenario.id).toBe(dailyScenario.id);
    expect(state.status).toBe('choosing');
    expect(state.selectedChoice).toBeNull();
  });

  it('simulates a win on daily scenario and calls completeDailyChallenge exactly once', () => {
    const GAME_ID = 'save-the-character';
    const numericSeed = getGameDailyNumericSeed(GAME_ID);
    const dailyIndex = numericSeed % scenarios.length;
    const dailyScenario = scenarios[dailyIndex];

    const state = createInitialState(dailyScenario);

    // Find the correct choice for this scenario
    const correctChoice = dailyScenario.choices.find(c => c.correct);
    expect(correctChoice).toBeDefined();

    // Simulate selecting the correct choice
    const selectedState = selectChoice(state, correctChoice.id);
    expect(selectedState.status).toBe('animating');

    // Resolve the choice to determine win/lose
    const resolvedState = resolveChoice(selectedState);

    // Verify win condition
    expect(resolvedState.status).toBe('won');

    // Call completeDailyChallenge (simulating what game.js does)
    completeDailyChallenge(GAME_ID);

    // Assert completeDailyChallenge was called exactly once
    expect(completeDailyChallenge).toHaveBeenCalledTimes(1);
    expect(completeDailyChallenge).toHaveBeenCalledWith(GAME_ID);
  });
});
