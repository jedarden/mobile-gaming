/**
 * Brain Teaser Input — Unit Tests
 *
 * Tests createInput and createSequenceInput by capturing the tap/drag
 * handlers registered with shared/input.js and invoking them directly.
 * Covers: getElementAtPosition null guards, clickable/draggable guards,
 * drag state machine branches, self-drop prevention, sequence completion.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock shared/input.js ──────────────────────────────────────────────────────

let capturedTapHandler = null;
let capturedDragHandler = null;

vi.mock('../../src/shared/input.js', () => ({
  onTap: vi.fn((canvas, handler) => {
    capturedTapHandler = handler;
    return vi.fn(); // cleanup fn
  }),
  onDrag: vi.fn((canvas, handler) => {
    capturedDragHandler = handler;
    return vi.fn(); // cleanup fn
  }),
  disableTouchActions: vi.fn(),
}));

import { createInput, createSequenceInput } from '../../src/games/brain-teaser/input.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCanvas = () => ({ addEventListener: vi.fn() });

const makeRenderer = (returnElement = null) => ({
  getElementAt: vi.fn(() => returnElement),
  scale: 1,
});

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
    capturedTapHandler = null;
    capturedDragHandler = null;
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

  // ── getElementAtPosition guards ───────────────────────────────────────────

  it('handleTap returns early when getState() returns null — (!state || !state.puzzle) left arm', () => {
    getState.mockReturnValue(null);
    renderer = makeRenderer(makeElement());
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).not.toHaveBeenCalled();
  });

  it('handleTap returns early when state has no puzzle — (!state || !state.puzzle) right arm', () => {
    getState.mockReturnValue({ currentSequence: [] }); // no puzzle property
    renderer = makeRenderer(makeElement());
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).not.toHaveBeenCalled();
  });

  // ── handleTap branches ─────────────────────────────────────────────────────

  it('handleTap returns early when no element at position — (if !element) guard', () => {
    renderer = makeRenderer(null); // no element
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).not.toHaveBeenCalled();
  });

  it('handleTap returns early when element.clickable=false and not draggable — interactivity guard', () => {
    renderer = makeRenderer(makeElement({ clickable: false, draggable: false }));
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).not.toHaveBeenCalled();
  });

  it('handleTap calls onTapAction when element is clickable', () => {
    const el = makeElement({ clickable: true });
    renderer = makeRenderer(el);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).toHaveBeenCalledWith(el, { action: 'tap', targetId: 'el-1' });
  });

  it('handleTap calls onTapAction when element is not clickable but is draggable', () => {
    // clickable===false but draggable===true → passes the guard
    const el = makeElement({ clickable: false, draggable: true });
    renderer = makeRenderer(el);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onTapAction).toHaveBeenCalled();
  });

  // ── handleDragStart branches ───────────────────────────────────────────────

  it('onDrag callback: drag start — (isDragging=true, no draggedElement) fires handleDragStart', () => {
    const el = makeElement({ draggable: true });
    renderer = makeRenderer(el);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // no draggedElement yet
    expect(onDragStart).toHaveBeenCalledWith(el);
  });

  it('handleDragStart returns early when element is not draggable — (!element.draggable) guard', () => {
    const el = makeElement({ draggable: false });
    renderer = makeRenderer(el);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('handleDragStart returns early when no element at position — (!element) guard', () => {
    renderer = makeRenderer(null);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  // ── handleDragMove branches ────────────────────────────────────────────────

  it('onDrag callback: drag move — (isDragging=true, draggedElement set) fires handleDragMove', () => {
    const el = makeElement({ draggable: true });
    renderer = makeRenderer(el);
    setup();
    // Start drag first to set draggedElement
    capturedDragHandler({ isDragging: true, x: 5, y: 5 });
    // Then move
    capturedDragHandler({ isDragging: true, x: 15, y: 15, dx: 10, dy: 10 });
    expect(onDragMove).toHaveBeenCalledWith(el, 10, 10);
  });

  it('handleDragMove returns early when isDragging=false — (!isDragging) guard', () => {
    const el = makeElement({ draggable: true });
    renderer = makeRenderer(el);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // start
    capturedDragHandler({ isDragging: false, x: 15, y: 15, dx: 10, dy: 10 }); // NOT isDragging
    expect(onDragMove).not.toHaveBeenCalled();
  });

  // ── handleDragEnd branches ─────────────────────────────────────────────────

  it('onDrag callback: drag end — (!isDragging, dragStartPos set) fires handleDragEnd', () => {
    const source = makeElement({ id: 'src', draggable: true });
    const target = makeElement({ id: 'tgt' });
    // First call: renderer returns source for drag start
    renderer.getElementAt.mockReturnValueOnce(source).mockReturnValueOnce(target);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // start → sets draggedElement + dragStartPos
    capturedDragHandler({ isDragging: false, x: 50, y: 50 }); // end
    expect(onDragEnd).toHaveBeenCalledWith(source, target);
  });

  it('handleDragEnd: onDragEnd not called when source === target — (targetElement.id !== sourceElement.id) false', () => {
    const el = makeElement({ id: 'same', draggable: true });
    renderer = makeRenderer(el); // always returns same element
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // start
    capturedDragHandler({ isDragging: false, x: 5, y: 5 }); // end at same position
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('handleDragEnd: onDragEnd not called when targetElement is null — (targetElement) false', () => {
    const source = makeElement({ id: 'src', draggable: true });
    renderer.getElementAt.mockReturnValueOnce(source).mockReturnValueOnce(null);
    setup();
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // start
    capturedDragHandler({ isDragging: false, x: 50, y: 50 }); // end over empty area
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('handleDragEnd returns early when no draggedElement — (!draggedElement) guard', () => {
    renderer = makeRenderer(null);
    setup();
    // End drag without starting one — dragStartPos is null too
    capturedDragHandler({ isDragging: false, x: 50, y: 50 });
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  // ── null/undefined callback guards (false arms of if(onXxx) checks) ────────

  it('handleTap: no throw when onTapAction is null (if(onTapAction) false branch)', () => {
    const el = makeElement({ clickable: true });
    renderer = makeRenderer(el);
    setup({ onTapAction: null });
    expect(() => capturedTapHandler({ x: 10, y: 10 })).not.toThrow();
  });

  it('handleDragStart: no throw when onDragStart is null (if(onDragStart) false branch)', () => {
    const el = makeElement({ draggable: true });
    renderer = makeRenderer(el);
    setup({ onDragStart: null });
    expect(() => capturedDragHandler({ isDragging: true, x: 5, y: 5 })).not.toThrow();
  });

  it('handleDragMove: no throw when onDragMove is null (if(onDragMove) false branch)', () => {
    const el = makeElement({ draggable: true });
    renderer.getElementAt.mockReturnValueOnce(el);
    setup({ onDragMove: null });
    capturedDragHandler({ isDragging: true, x: 5, y: 5 }); // start sets draggedElement
    expect(() => capturedDragHandler({ isDragging: true, dx: 10, dy: 5 })).not.toThrow();
  });

  it('handleDragEnd: no throw when onDragEnd is null but target differs from source (if(onDragEnd && ...) false)', () => {
    const source = makeElement({ id: 'src', draggable: true });
    const target = makeElement({ id: 'tgt' });
    renderer.getElementAt.mockReturnValueOnce(source).mockReturnValueOnce(target);
    setup({ onDragEnd: null });
    capturedDragHandler({ isDragging: true, x: 5, y: 5 });  // start
    expect(() => capturedDragHandler({ isDragging: false, x: 50, y: 50 })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSequenceInput
// ─────────────────────────────────────────────────────────────────────────────

describe('createSequenceInput', () => {
  let canvas, renderer, getState, onSequenceStep, onSequenceComplete;

  beforeEach(() => {
    capturedTapHandler = null;
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

  it('handleTap returns early when state is null — (!state) guard', () => {
    getState.mockReturnValue(null);
    renderer = makeRenderer(makeElement());
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceStep).not.toHaveBeenCalled();
  });

  it('handleTap returns early when no element — (!element) guard', () => {
    renderer = makeRenderer(null);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceStep).not.toHaveBeenCalled();
  });

  it('handleTap returns early when element.clickable===false — (element.clickable === false) guard', () => {
    renderer = makeRenderer(makeElement({ clickable: false }));
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceStep).not.toHaveBeenCalled();
  });

  it('handleTap calls onSequenceStep with element and accumulated sequence', () => {
    const el = makeElement({ id: 'btn1' });
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: [],
    }));
    renderer = makeRenderer(el);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceStep).toHaveBeenCalledWith(el, ['btn1']);
  });

  it('handleTap calls onSequenceComplete when sequence length matches solution — completion check', () => {
    const el = makeElement({ id: 'btn2' });
    // currentSequence already has ['btn1'], solution has 2 steps → adding btn2 completes it
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: ['btn1'],
    }));
    renderer = makeRenderer(el);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceComplete).toHaveBeenCalledWith(['btn1', 'btn2']);
  });

  it('handleTap does NOT call onSequenceComplete when sequence is not yet complete', () => {
    const el = makeElement({ id: 'btn1' });
    getState.mockReturnValue(makeState({
      puzzle: { elements: [], solution: { steps: ['btn1', 'btn2'] } },
      currentSequence: [],
    }));
    renderer = makeRenderer(el);
    setup();
    capturedTapHandler({ x: 10, y: 10 });
    expect(onSequenceComplete).not.toHaveBeenCalled();
  });
});
