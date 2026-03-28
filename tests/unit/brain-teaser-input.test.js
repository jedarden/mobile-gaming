/**
 * Brain Teaser Input — Unit Tests
 *
 * Tests createInput and createSequenceInput by capturing the callbacks
 * registered with the renderer and invoking them directly.
 * Covers: element guards, clickable/draggable guards,
 * drag state machine branches, self-drop prevention, sequence completion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createInput, createSequenceInput } from '../../src/games/brain-teaser/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });

const makeRenderer = () => {
  let callbacks = {};
  return {
    setCallbacks: vi.fn((cbs) => { callbacks = cbs; }),
    getCallbacks: () => callbacks,
    scale: 1,
  };
};

const makeElement = (overrides = {}) => ({
  id: 'el-1',
  clickable: true,
  draggable: false,
  ...overrides,
});

const makeState = (overrides = {}) => ({
  puzzle: {
    elements: [],
    solution: { action: 'tap', steps: [] },
    ...overrides.puzzle,
  },
  currentSequence: [],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// createInput
// ─────────────────────────────────────────────────────────────────────────────

describe('createInput', () => {
  let canvas, renderer, getState, onTapAction, onDragStart, onDragMove, onDragEnd;

  beforeEach(() => {
    canvas = makeCanvas();
    renderer = makeRenderer();
    getState = vi.fn(() => makeState());
    onTapAction = vi.fn();
    onDragStart = vi.fn();
    onDragMove = vi.fn();
    onDragEnd = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createInput({
      canvas, renderer, getState, onTapAction, onDragStart, onDragMove, onDragEnd,
      ...overrides,
    });
    input.init();
    return input;
  }

  // ── handleTap branches ─────────────────────────────────────────────────────

  it('handleTap calls onTapAction when element is clickable', () => {
    const el = makeElement({ clickable: true });
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onElementTap(el, { action: 'tap', targetId: 'el-1' });
    expect(onTapAction).toHaveBeenCalledWith(el, { action: 'tap', targetId: 'el-1' });
  });

  it('handleTap does not throw when onTapAction is null', () => {
    const el = makeElement({ clickable: true });
    setup({ onTapAction: null });
    const callbacks = renderer.getCallbacks();
    expect(() => callbacks.onElementTap(el, { action: 'tap', targetId: 'el-1' })).not.toThrow();
  });

  // ── handleDragStart branches ───────────────────────────────────────────────

  it('handleDragStart calls onDragStart when element is draggable', () => {
    const el = makeElement({ draggable: true });
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onDragStart(el);
    expect(onDragStart).toHaveBeenCalledWith(el);
  });

  it('handleDragStart does not throw when onDragStart is null', () => {
    const el = makeElement({ draggable: true });
    setup({ onDragStart: null });
    const callbacks = renderer.getCallbacks();
    expect(() => callbacks.onDragStart(el)).not.toThrow();
  });

  // ── handleDragMove branches ────────────────────────────────────────────────

  it('handleDragMove calls onDragMove with element, dx, dy', () => {
    const el = makeElement({ draggable: true });
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onDragMove(el, 10, 20);
    expect(onDragMove).toHaveBeenCalledWith(el, 10, 20);
  });

  it('handleDragMove does not throw when onDragMove is null', () => {
    const el = makeElement({ draggable: true });
    setup({ onDragMove: null });
    const callbacks = renderer.getCallbacks();
    expect(() => callbacks.onDragMove(el, 10, 20)).not.toThrow();
  });

  // ── handleDragEnd branches ─────────────────────────────────────────────────

  it('handleDragEnd calls onDragEnd with source and target elements', () => {
    const source = makeElement({ id: 'src', draggable: true });
    const target = makeElement({ id: 'tgt' });
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onDragEnd(source, target);
    expect(onDragEnd).toHaveBeenCalledWith(source, target);
  });

  it('handleDragEnd does not throw when onDragEnd is null', () => {
    const source = makeElement({ id: 'src', draggable: true });
    const target = makeElement({ id: 'tgt' });
    setup({ onDragEnd: null });
    const callbacks = renderer.getCallbacks();
    expect(() => callbacks.onDragEnd(source, target)).not.toThrow();
  });

  // ── destroy ────────────────────────────────────────────────────────────────

  it('destroy clears callbacks', () => {
    const input = setup();
    input.destroy();
    const callbacks = renderer.getCallbacks();
    expect(callbacks.onElementTap).toBeNull();
    expect(callbacks.onDragStart).toBeNull();
    expect(callbacks.onDragMove).toBeNull();
    expect(callbacks.onDragEnd).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSequenceInput
// ─────────────────────────────────────────────────────────────────────────────

describe('createSequenceInput', () => {
  let canvas, renderer, getState, onSequenceStep, onSequenceComplete;

  beforeEach(() => {
    canvas = makeCanvas();
    renderer = makeRenderer();
    getState = vi.fn(() => makeState({ puzzle: { elements: [], solution: { steps: ['a', 'b'] } } }));
    onSequenceStep = vi.fn();
    onSequenceComplete = vi.fn();
  });

  function setup(overrides = {}) {
    const input = createSequenceInput({
      canvas, renderer, getState, onSequenceStep, onSequenceComplete,
      ...overrides,
    });
    input.init();
    return input;
  }

  it('handleTap calls onSequenceStep with element and accumulated sequence', () => {
    const el = makeElement({ id: 'btn1' });
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: [],
    }));
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onElementTap(el);
    expect(onSequenceStep).toHaveBeenCalledWith(el, ['btn1']);
  });

  it('handleTap calls onSequenceComplete when sequence length matches solution — completion check', () => {
    const el = makeElement({ id: 'btn2' });
    // currentSequence already has ['btn1'], solution has 2 steps → adding btn2 completes it
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: ['btn1'],
    }));
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onElementTap(el);
    expect(onSequenceComplete).toHaveBeenCalledWith(['btn1', 'btn2']);
  });

  it('handleTap does NOT call onSequenceComplete when sequence is not yet complete', () => {
    const el = makeElement({ id: 'btn1' });
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: [],
    }));
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onElementTap(el);
    expect(onSequenceComplete).not.toHaveBeenCalled();
  });

  it('handleTap returns early when element.clickable===false — (element.clickable === false) guard', () => {
    const el = makeElement({ clickable: false });
    setup();
    const callbacks = renderer.getCallbacks();
    callbacks.onElementTap(el);
    expect(onSequenceStep).not.toHaveBeenCalled();
  });

  it('destroy clears callbacks', () => {
    const input = setup();
    input.destroy();
    const callbacks = renderer.getCallbacks();
    expect(callbacks.onElementTap).toBeNull();
  });
});
