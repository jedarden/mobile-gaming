/**
 * Save the Character — Solver Tests
 *
 * Automated solver that reads every scenario from levels.json and verifies:
 *  1. Picking the correct choice results in status "won"
 *  2. Picking an incorrect choice results in status "lost"
 *  3. validateScenario passes for every scenario
 *  4. Every scenario has exactly one correct choice
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  selectChoice,
  resolveChoice,
  isWon,
  isLost,
  validateScenario,
} from '../../src/games/save-the-character/state.js';
import scenarios from '../../src/games/save-the-character/levels.json';

// ── Catalog checks ────────────────────────────────────────────────────────────

describe('Save the Character — level catalog', () => {
  it('has 20 scenarios', () => {
    expect(scenarios.length).toBe(20);
  });

  it('every scenario has a unique id', () => {
    const ids = scenarios.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every scenario passes validateScenario', () => {
    for (const scenario of scenarios) {
      const { valid, errors } = validateScenario(scenario);
      expect(valid, `${scenario.id}: ${errors.join(', ')}`).toBe(true);
    }
  });

  it('every scenario has exactly one correct choice', () => {
    for (const scenario of scenarios) {
      const correct = scenario.choices.filter(c => c.correct === true);
      expect(
        correct.length,
        `${scenario.id}: has ${correct.length} correct choices`
      ).toBe(1);
    }
  });
});

// ── Correct-choice solver ─────────────────────────────────────────────────────

describe('Save the Character — correct-choice solver', () => {
  it('picking the correct choice wins every scenario', () => {
    for (const scenario of scenarios) {
      const correctChoice = scenario.choices.find(c => c.correct === true);
      expect(correctChoice, `${scenario.id}: no correct choice found`).toBeDefined();

      const initial = createInitialState(scenario);
      const afterSelect = selectChoice(initial, correctChoice.id);
      const final = resolveChoice(afterSelect);

      expect(
        isWon(final),
        `${scenario.id}: expected "won" but got status "${final.status}"`
      ).toBe(true);
    }
  });
});

// ── Incorrect-choice solver ───────────────────────────────────────────────────

describe('Save the Character — incorrect-choice solver', () => {
  it('picking the first incorrect choice loses every scenario', () => {
    for (const scenario of scenarios) {
      const wrongChoice = scenario.choices.find(c => c.correct === false);
      if (!wrongChoice) continue; // all correct (shouldn't happen per validation)

      const initial = createInitialState(scenario);
      const afterSelect = selectChoice(initial, wrongChoice.id);
      const final = resolveChoice(afterSelect);

      expect(
        isLost(final),
        `${scenario.id}: expected "lost" but got status "${final.status}"`
      ).toBe(true);
    }
  });
});
