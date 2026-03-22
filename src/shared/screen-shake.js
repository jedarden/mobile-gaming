/**
 * Screen Shake
 *
 * Computes a per-frame pixel offset that games can apply to their canvas
 * translate / camera position to simulate camera shake.
 *
 * The shake decays linearly over its duration. Two orthogonal sinusoids
 * at coprime frequencies create an irregular Lissajous-style motion.
 *
 * prefers-reduced-motion: trigger() is a no-op when the user has opted
 * out of animations.
 *
 * Usage:
 *   import { createScreenShake } from '../shared/screen-shake.js';
 *   const shake = createScreenShake();
 *
 *   shake.trigger(0.8, 150);       // intensity 0-1, duration ms
 *   shake.trigger(0.3, 50);        // minor shake (weaker)
 *
 *   // In game render loop:
 *   const { x, y } = shake.update(dt);
 *   ctx.translate(x, y);
 *   // ... draw game ...
 *   ctx.translate(-x, -y);
 */

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Create a screen-shake controller.
 *
 * @param {Object} [opts]
 * @param {number} [opts.maxAmplitude=12] - Peak pixel displacement at intensity 1.0
 * @returns {{ trigger, update, isActive, reset }}
 */
export function createScreenShake({ maxAmplitude = 12 } = {}) {
  let intensity = 0;
  let remaining = 0;
  let totalDuration = 1;
  let elapsed = 0;

  /**
   * Start (or extend) a shake.
   *
   * @param {number} i - Intensity 0–1. Values are clamped.
   * @param {number} [durationMs=150] - Duration in ms.
   */
  function trigger(i, durationMs = 150) {
    if (prefersReducedMotion()) return;
    intensity = Math.min(1, Math.max(0, i));
    remaining = Math.max(remaining, durationMs);
    totalDuration = remaining;
    elapsed = 0;
  }

  /**
   * Advance the shake by dt milliseconds.
   *
   * @param {number} dt - Delta time in ms (typically 16–33).
   * @returns {{ x: number, y: number }} Integer pixel offsets.
   */
  function update(dt) {
    if (remaining <= 0) return { x: 0, y: 0 };

    remaining = Math.max(0, remaining - dt);
    elapsed += dt;

    // Linear decay from peak to zero as remaining → 0
    const t = remaining / totalDuration;
    const amp = intensity * maxAmplitude * t;

    // Two sinusoids at coprime frequencies → irregular non-repeating path
    const x = Math.sin(elapsed * 0.072) * amp;
    const y = Math.cos(elapsed * 0.095) * amp;

    return { x: Math.round(x), y: Math.round(y) };
  }

  /** @returns {boolean} Whether the shake is currently active. */
  function isActive() {
    return remaining > 0;
  }

  /** Cancel the shake immediately. */
  function reset() {
    intensity = 0;
    remaining = 0;
    totalDuration = 1;
    elapsed = 0;
  }

  return { trigger, update, isActive, reset };
}
