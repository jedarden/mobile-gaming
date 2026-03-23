/**
 * Particle System — Unit Tests
 *
 * Tests PRESETS structure, createParticleSystem factory, and
 * spawn / update / clear / getActiveCount / isEmpty lifecycle.
 *
 * render() is excluded — it draws to a Canvas 2D context and has
 * no testable return value.
 *
 * prefers-reduced-motion: window is undefined in node env →
 * isReducedMotion() returns false → spawn() always fires.
 */

import { describe, it, expect, vi } from 'vitest';
import { PRESETS, createParticleSystem } from '../../src/shared/particles.js';

// ─── PRESETS ──────────────────────────────────────────────────────────────────

describe('PRESETS', () => {
  it('defines confetti, sparkle, and splash', () => {
    expect(PRESETS.confetti).toBeDefined();
    expect(PRESETS.sparkle).toBeDefined();
    expect(PRESETS.splash).toBeDefined();
  });

  it('each preset has all required fields', () => {
    const required = ['count', 'speed', 'spread', 'baseAngle', 'life', 'size', 'gravity', 'colors', 'shape'];
    for (const [name, preset] of Object.entries(PRESETS)) {
      for (const field of required) {
        expect(preset[field], `${name}.${field}`).toBeDefined();
      }
    }
  });

  it('confetti uses rect shape', () => {
    expect(PRESETS.confetti.shape).toBe('rect');
  });

  it('sparkle and splash use circle shape', () => {
    expect(PRESETS.sparkle.shape).toBe('circle');
    expect(PRESETS.splash.shape).toBe('circle');
  });

  it('sparkle spread covers all directions (2π)', () => {
    expect(PRESETS.sparkle.spread).toBeCloseTo(Math.PI * 2);
  });

  it('each preset has at least one color', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset.colors.length, name).toBeGreaterThan(0);
    }
  });

  it('speed is a [min, max] pair', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(Array.isArray(preset.speed), name).toBe(true);
      expect(preset.speed.length, name).toBe(2);
      expect(preset.speed[0], `${name} min speed`).toBeLessThanOrEqual(preset.speed[1]);
    }
  });

  it('life is a [min, max] pair', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(Array.isArray(preset.life), name).toBe(true);
      expect(preset.life[0], `${name} min life`).toBeLessThanOrEqual(preset.life[1]);
    }
  });

  it('count is a positive integer', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset.count, name).toBeGreaterThan(0);
    }
  });
});

// ─── createParticleSystem — factory ──────────────────────────────────────────

describe('createParticleSystem', () => {
  it('returns an object with the expected API', () => {
    const ps = createParticleSystem(null);
    expect(typeof ps.spawn).toBe('function');
    expect(typeof ps.update).toBe('function');
    expect(typeof ps.render).toBe('function');
    expect(typeof ps.clear).toBe('function');
    expect(typeof ps.getActiveCount).toBe('function');
    expect(typeof ps.isEmpty).toBe('function');
  });

  it('starts empty', () => {
    const ps = createParticleSystem(null);
    expect(ps.isEmpty()).toBe(true);
    expect(ps.getActiveCount()).toBe(0);
  });
});

// ─── spawn ────────────────────────────────────────────────────────────────────

describe('spawn', () => {
  it('activates preset.count particles for confetti', () => {
    const ps = createParticleSystem(null);
    ps.spawn('confetti', 100, 100);
    expect(ps.getActiveCount()).toBe(PRESETS.confetti.count);
  });

  it('activates preset.count particles for sparkle', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 50, 50);
    expect(ps.getActiveCount()).toBe(PRESETS.sparkle.count);
  });

  it('activates preset.count particles for splash', () => {
    const ps = createParticleSystem(null);
    ps.spawn('splash', 0, 0);
    expect(ps.getActiveCount()).toBe(PRESETS.splash.count);
  });

  it('isEmpty returns false after spawn', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0);
    expect(ps.isEmpty()).toBe(false);
  });

  it('respects countOverride', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 5);
    expect(ps.getActiveCount()).toBe(5);
  });

  it('ignores unknown preset names', () => {
    const ps = createParticleSystem(null);
    ps.spawn('unknown_type_xyz', 0, 0);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('ignores undefined type (no preset match)', () => {
    const ps = createParticleSystem(null);
    ps.spawn(undefined, 0, 0);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('ignores null type (no preset match)', () => {
    const ps = createParticleSystem(null);
    ps.spawn(null, 0, 0);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('multiple spawns accumulate active count', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 3);
    ps.spawn('sparkle', 0, 0, 4);
    expect(ps.getActiveCount()).toBe(7);
  });

  it('spawn with countOverride=0 adds no particles', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 0);
    expect(ps.getActiveCount()).toBe(0);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('update', () => {
  it('does not throw on empty system', () => {
    const ps = createParticleSystem(null);
    expect(() => ps.update(16)).not.toThrow();
    expect(ps.getActiveCount()).toBe(0);
  });

  it('decreases activeCount as particles expire', () => {
    // Mock Math.random to 0 so all particles get exactly the minimum life (350 ms).
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 4); // life = 350 ms (minimum)
    randSpy.mockRestore();
    ps.update(400);               // advance past min life → all 4 expire
    expect(ps.getActiveCount()).toBeLessThan(4);
  });

  it('empties all particles after enough time has passed', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 4); // max life = 650 ms
    ps.update(700);
    expect(ps.isEmpty()).toBe(true);
  });

  it('update is a no-op after system is already empty', () => {
    const ps = createParticleSystem(null);
    ps.update(1000);
    expect(ps.getActiveCount()).toBe(0);
  });

  it('particles from all three presets eventually expire', () => {
    const ps = createParticleSystem(null);
    ps.spawn('confetti', 0, 0, 2); // max life = 1400 ms
    ps.spawn('sparkle', 0, 0, 2); // max life = 650 ms
    ps.spawn('splash',  0, 0, 2); // max life = 550 ms
    ps.update(1500);
    expect(ps.isEmpty()).toBe(true);
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('deactivates all particles immediately', () => {
    const ps = createParticleSystem(null);
    ps.spawn('confetti', 0, 0, 20);
    ps.clear();
    expect(ps.getActiveCount()).toBe(0);
    expect(ps.isEmpty()).toBe(true);
  });

  it('is safe to call on an already-empty system', () => {
    const ps = createParticleSystem(null);
    expect(() => ps.clear()).not.toThrow();
  });

  it('particles can be spawned again after clear', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 5);
    ps.clear();
    ps.spawn('sparkle', 0, 0, 3);
    expect(ps.getActiveCount()).toBe(3);
  });
});

// ─── isReducedMotion branches ─────────────────────────────────────────────────
// The source checks `typeof window === 'undefined' || !window.matchMedia`.
// In node env, window is undefined → isReducedMotion returns false.
// Use vi.stubGlobal to inject a window object for branch coverage.

describe('spawn — reduced motion', () => {
  it('skips spawning when matchMedia reports prefers-reduced-motion (matches=true branch)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 5);
    expect(ps.getActiveCount()).toBe(0);
    vi.unstubAllGlobals();
  });

  it('spawns normally when matchMedia reports no reduced motion (matches=false branch)', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 3);
    expect(ps.getActiveCount()).toBe(3);
    vi.unstubAllGlobals();
  });

  it('spawns normally when window exists but matchMedia is falsy (!window.matchMedia branch)', () => {
    vi.stubGlobal('window', { matchMedia: null });
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 2);
    expect(ps.getActiveCount()).toBe(2);
    vi.unstubAllGlobals();
  });
});

// ─── pool exhaustion ──────────────────────────────────────────────────────────

describe('pool exhaustion', () => {
  it('never exceeds the pool size of 256', () => {
    const ps = createParticleSystem(null);
    ps.spawn('confetti', 0, 0, 300); // request more than pool size
    expect(ps.getActiveCount()).toBeLessThanOrEqual(256);
  });

  it('accepting a new spawn after clear restores capacity', () => {
    const ps = createParticleSystem(null);
    ps.spawn('confetti', 0, 0, 256); // fill pool
    ps.clear();
    ps.spawn('confetti', 0, 0, 100);
    expect(ps.getActiveCount()).toBe(100);
  });
});

// ─── render ───────────────────────────────────────────────────────────────────

describe('render', () => {
  it('is a no-op when ctx is null', () => {
    const ps = createParticleSystem(null);
    ps.spawn('sparkle', 0, 0, 3);
    expect(() => ps.render()).not.toThrow();
  });

  it('draws rect shape via fillRect for confetti particles (p.shape === "rect" branch)', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), rotate: vi.fn(),
      fillRect: vi.fn(), beginPath: vi.fn(),
      arc: vi.fn(), fill: vi.fn(),
      globalAlpha: 1, fillStyle: '',
    };
    const ps = createParticleSystem(ctx);
    ps.spawn('confetti', 50, 50, 1); // confetti uses shape='rect'
    // Advance time slightly so particle is active with positive life
    ps.update(0.01);
    ps.render();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled(); // rect path calls ctx.rotate
  });

  it('draws circle shape via arc for sparkle particles (else branch)', () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), rotate: vi.fn(),
      fillRect: vi.fn(), beginPath: vi.fn(),
      arc: vi.fn(), fill: vi.fn(),
      globalAlpha: 1, fillStyle: '',
    };
    const ps = createParticleSystem(ctx);
    ps.spawn('sparkle', 50, 50, 1); // sparkle uses shape='circle'
    ps.update(0.01);
    ps.render();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});
