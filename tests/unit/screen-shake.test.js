/**
 * Screen Shake — Unit Tests
 *
 * Tests createScreenShake(): trigger, update, isActive, reset,
 * decay math, and amplitude bounds.
 *
 * No DOM needed — all pure closure math.
 * prefers-reduced-motion: window is undefined in node env →
 * prefersReducedMotion() returns false → trigger() always works.
 */

import { describe, it, expect } from 'vitest';
import { createScreenShake } from '../../src/shared/screen-shake.js';

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('is not active when first created', () => {
    const shake = createScreenShake();
    expect(shake.isActive()).toBe(false);
  });

  it('returns {x:0, y:0} from update when not active', () => {
    const shake = createScreenShake();
    expect(shake.update(16)).toEqual({ x: 0, y: 0 });
  });

  it('exposes trigger, update, isActive, reset', () => {
    const shake = createScreenShake();
    expect(typeof shake.trigger).toBe('function');
    expect(typeof shake.update).toBe('function');
    expect(typeof shake.isActive).toBe('function');
    expect(typeof shake.reset).toBe('function');
  });
});

// ─── trigger ──────────────────────────────────────────────────────────────────

describe('trigger', () => {
  it('makes shake active', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 200);
    expect(shake.isActive()).toBe(true);
  });

  it('clamps intensity above 1 to 1', () => {
    // Offsets must stay within maxAmplitude regardless of over-large intensity
    const shake = createScreenShake({ maxAmplitude: 10 });
    shake.trigger(99, 100);
    for (let i = 0; i < 10; i++) {
      const { x, y } = shake.update(5);
      expect(Math.abs(x)).toBeLessThanOrEqual(10);
      expect(Math.abs(y)).toBeLessThanOrEqual(10);
    }
  });

  it('clamps intensity below 0 to 0 (no shake)', () => {
    const shake = createScreenShake({ maxAmplitude: 20 });
    shake.trigger(-5, 200);
    const { x, y } = shake.update(16);
    // amplitude = 0 * maxAmplitude * t = 0 → both offsets round to 0
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('extends remaining duration when re-triggered during active shake', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 100);
    shake.update(80); // consume 80 ms → 20 ms left
    shake.trigger(1.0, 200); // extend: remaining = max(20, 200) = 200
    shake.update(190);       // consume 190 ms → 10 ms left
    expect(shake.isActive()).toBe(true);
  });

  it('accepts default duration of 150 ms', () => {
    const shake = createScreenShake();
    shake.trigger(1.0);
    shake.update(100);
    expect(shake.isActive()).toBe(true);
    shake.update(60); // total 160 → past 150
    expect(shake.isActive()).toBe(false);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('update', () => {
  it('returns integer pixel offsets', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 200);
    const { x, y } = shake.update(16);
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });

  it('returns {x:0, y:0} after duration fully consumed in one step', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 50);
    shake.update(50); // exactly hits 0
    expect(shake.update(1)).toEqual({ x: 0, y: 0 });
  });

  it('returns {x:0, y:0} when update overshoots duration', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 50);
    shake.update(200); // way past duration
    expect(shake.update(1)).toEqual({ x: 0, y: 0 });
  });

  it('becomes inactive after total duration is consumed', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 100);
    shake.update(110);
    expect(shake.isActive()).toBe(false);
  });

  it('amplitude is higher early than late (linear decay)', () => {
    const shake = createScreenShake({ maxAmplitude: 50 });
    shake.trigger(1.0, 1000);

    let earlySum = 0;
    for (let i = 0; i < 5; i++) {
      const { x, y } = shake.update(10);
      earlySum += Math.abs(x) + Math.abs(y);
    }

    // Skip to near the end
    shake.update(900);

    let lateSum = 0;
    for (let i = 0; i < 5; i++) {
      const { x, y } = shake.update(10);
      lateSum += Math.abs(x) + Math.abs(y);
    }

    expect(earlySum).toBeGreaterThanOrEqual(lateSum);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('makes shake inactive immediately', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 500);
    shake.reset();
    expect(shake.isActive()).toBe(false);
  });

  it('returns {x:0, y:0} from update after reset', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 500);
    shake.reset();
    expect(shake.update(16)).toEqual({ x: 0, y: 0 });
  });

  it('can be triggered again after reset', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 200);
    shake.reset();
    shake.trigger(1.0, 200);
    expect(shake.isActive()).toBe(true);
  });
});

// ─── maxAmplitude option ──────────────────────────────────────────────────────

describe('maxAmplitude option', () => {
  it('defaults to 12 — offsets never exceed ±12', () => {
    const shake = createScreenShake();
    shake.trigger(1.0, 500);
    for (let i = 0; i < 30; i++) {
      const { x, y } = shake.update(10);
      expect(Math.abs(x)).toBeLessThanOrEqual(12);
      expect(Math.abs(y)).toBeLessThanOrEqual(12);
    }
  });

  it('respects custom maxAmplitude — offsets never exceed it', () => {
    const shake = createScreenShake({ maxAmplitude: 40 });
    shake.trigger(1.0, 500);
    for (let i = 0; i < 30; i++) {
      const { x, y } = shake.update(10);
      expect(Math.abs(x)).toBeLessThanOrEqual(40);
      expect(Math.abs(y)).toBeLessThanOrEqual(40);
    }
  });

  it('larger maxAmplitude can produce offsets beyond default 12', () => {
    const shake = createScreenShake({ maxAmplitude: 100 });
    shake.trigger(1.0, 1000);
    let maxSeen = 0;
    for (let i = 0; i < 60; i++) {
      const { x, y } = shake.update(10);
      maxSeen = Math.max(maxSeen, Math.abs(x), Math.abs(y));
    }
    expect(maxSeen).toBeGreaterThan(12);
  });
});
