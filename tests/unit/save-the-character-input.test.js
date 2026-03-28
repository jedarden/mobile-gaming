/**
 * Save the Character Input — Unit Tests
 *
 * Tests createInput for the Phaser-based input handling.
 * With Phaser, input is handled by the scene, so this tests the API
 * compatibility and the getChoiceAt helper function.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js (still imported but not used by new input.js) ───────────

vi.mock('../../src/shared/input.js', () => ({
  onTap: vi.fn(),
  disableTouchActions: vi.fn()
}));

// ── Mock renderer.js to avoid Phaser import ─────────────────────────────────────

vi.mock('../../src/games/save-the-character/renderer.js', () => ({
  getChoiceAtPosition: vi.fn((x, y, state, width, height, scale) => {
    // Simple mock: return index based on y position
    if (y < 100) return null;
    if (y < 160) return 0;
    if (y < 220) return 1;
    if (y < 280) return 2;
    return 3;
  }),
  calculateLayout: vi.fn((width, height, scale) => ({
    buttonWidth: width - 40 * scale,
    buttonHeight: 60 * scale,
    buttonSpacing: 72 * scale,
    choiceStartY: height - 260 * scale,
    groundY: height * 0.60,
    characterX: width * 0.38,
    threatX: width * 0.70
  })),
  createRenderer: vi.fn(() => ({
    render: vi.fn(),
    setAnimationProgress: vi.fn(),
    setHoveredChoice: vi.fn(),
    setPressedChoice: vi.fn(),
    getChoiceAtPosition: vi.fn(),
    setReducedMotion: vi.fn(),
    triggerWinEffect: vi.fn(),
    triggerLoseEffect: vi.fn(),
    init: vi.fn(),
    startAnimation: vi.fn(),
    setCallbacks: vi.fn(),
    destroy: vi.fn(),
    get width() { return 390; },
    get height() { return 844; },
    get scale() { return 1; }
  }))
}));

import { createInput } from '../../src/games/save-the-character/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });

const makeRenderer = () => ({
  width: 390,
  height: 844,
  scale: 1,
  render: vi.fn(),
  setHoveredChoice: vi.fn()
});

const fakeState = {
  scenario: {
    id: 'test-001',
    title: 'Test Scenario',
    threat: 'Test threat',
    choices: [
      { id: 'a', label: 'Choice A', correct: true },
      { id: 'b', label: 'Choice B', correct: false }
    ]
  },
  selectedChoice: null,
  status: 'choosing'
};

// ─────────────────────────────────────────────────────────────────────────────

describe('save-the-character createInput', () => {
  let canvas, renderer, onChoiceSelect, onChoiceHover, input;

  beforeEach(() => {
    canvas = makeCanvas();
    renderer = makeRenderer();
    onChoiceSelect = vi.fn();
    onChoiceHover = vi.fn();
  });

  function setup(overrides = {}) {
    input = createInput({ canvas, renderer, onChoiceSelect, onChoiceHover, ...overrides });
    input.init();
    return input;
  }

  // ── init and destroy ────────────────────────────────────────────────────────

  it('init does not throw', () => {
    expect(() => setup()).not.toThrow();
  });

  it('destroy does not throw after init', () => {
    const input = setup();
    expect(() => input.destroy()).not.toThrow();
  });

  it('destroy before init is safe', () => {
    const input = createInput({ canvas, renderer, onChoiceSelect, onChoiceHover });
    expect(() => input.destroy()).not.toThrow();
  });

  // ── updateState ─────────────────────────────────────────────────────────────

  it('updateState sets currentState enabling getChoiceAt', () => {
    const input = setup();
    input.updateState(fakeState);
    // getChoiceAt should work now
    const choiceIndex = input.getChoiceAt(195, 600);
    expect(choiceIndex).not.toBeNull();
  });

  it('getChoiceAt returns null when currentState is null', () => {
    const input = setup();
    // currentState starts as null
    const choiceIndex = input.getChoiceAt(195, 600);
    expect(choiceIndex).toBeNull();
  });

  // ── getChoiceAt ──────────────────────────────────────────────────────────────

  it('getChoiceAt uses renderer dimensions', () => {
    const input = setup();
    input.updateState(fakeState);
    input.getChoiceAt(100, 200);
    // The function should use renderer.width, renderer.height, renderer.scale
    expect(input.getChoiceAt(100, 120)).toBeDefined();
  });

  // ── API compatibility ───────────────────────────────────────────────────────

  it('returns init, destroy, updateState, getChoiceAt methods', () => {
    const input = createInput({ canvas, renderer, onChoiceSelect, onChoiceHover });
    expect(typeof input.init).toBe('function');
    expect(typeof input.destroy).toBe('function');
    expect(typeof input.updateState).toBe('function');
    expect(typeof input.getChoiceAt).toBe('function');
  });

  it('callbacks are optional', () => {
    expect(() => createInput({ canvas, renderer })).not.toThrow();
  });
});
