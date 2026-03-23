/**
 * Particle System
 *
 * Reusable Canvas 2D particle effects for game events.
 * Uses a fixed-size object pool to avoid GC pressure during gameplay.
 *
 * Particle types:
 *   confetti  – coloured rectangles that fan upward and fall (win screen)
 *   sparkle   – small circles that burst outward in all directions (merge/collect)
 *   splash    – teardrop-like circles that arc upward and fall (water pour)
 *
 * prefers-reduced-motion: spawn() is a no-op when the user has opted out
 * of animations. Games may still call update()/render() safely — the
 * pool will simply be empty.
 *
 * Usage:
 *   const ps = createParticleSystem(canvas.getContext('2d'), canvas.width, canvas.height);
 *   ps.spawn('confetti', centerX, topY);   // on level win
 *   ps.spawn('sparkle', x, y);             // on collect / merge
 *   ps.spawn('splash', x, y);              // on water pour
 *
 *   // In render loop (after clearing canvas):
 *   ps.update(dt);
 *   ps.render();
 */

// ─── Presets ──────────────────────────────────────────────────────────────────

/** @type {Record<string, Object>} */
export const PRESETS = {
  confetti: {
    count: 40,
    speed: [1.5, 4],
    spread: Math.PI * 0.7,        // fan upward ± 63°
    baseAngle: -Math.PI / 2,      // straight up
    life: [900, 1400],
    size: [4, 8],
    gravity: 0.12,
    colors: ['#FF5252', '#69F0AE', '#448AFF', '#FFD740', '#EA80FC', '#18FFFF'],
    shape: 'rect',
  },
  sparkle: {
    count: 14,
    speed: [1, 3],
    spread: Math.PI * 2,           // all directions
    baseAngle: 0,
    life: [350, 650],
    size: [2, 5],
    gravity: 0.04,
    colors: ['#FFD700', '#FFA500', '#FFFFFF', '#FFFDE7'],
    shape: 'circle',
  },
  splash: {
    count: 16,
    speed: [1, 3.5],
    spread: Math.PI,               // upper hemisphere
    baseAngle: -Math.PI / 2,
    life: [300, 550],
    size: [3, 6],
    gravity: 0.18,
    colors: ['#4FC3F7', '#29B6F6', '#03A9F4', '#B3E5FC'],
    shape: 'circle',
  },
};

// ─── Pool ─────────────────────────────────────────────────────────────────────

const POOL_SIZE = 256;

function createParticle() {
  return {
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0,
    maxLife: 1,
    size: 4,
    color: '#fff',
    rotation: 0,
    rotSpeed: 0,
    gravity: 0,
    shape: 'circle',
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a particle system bound to a Canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [width=0]   - Canvas width (used for future viewport culling)
 * @param {number} [height=0]  - Canvas height
 * @returns {Object} Particle system interface
 */
export function createParticleSystem(ctx, _width = 0, _height = 0) {
  const pool = Array.from({ length: POOL_SIZE }, createParticle);
  let activeCount = 0;

  function isReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function allocate() {
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null; // pool exhausted — skip this particle
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Spawn a burst of particles.
   *
   * @param {string} type - Preset name: 'confetti', 'sparkle', or 'splash'.
   * @param {number} x - Origin X in canvas pixels.
   * @param {number} y - Origin Y in canvas pixels.
   * @param {number} [countOverride] - Override the preset's count.
   */
  function spawn(type, x, y, countOverride) {
    if (isReducedMotion()) return;
    const preset = PRESETS[type];
    if (!preset) return;

    const count = countOverride ?? preset.count;
    const half = preset.spread / 2;

    for (let i = 0; i < count; i++) {
      const p = allocate();
      if (!p) break;

      const angle = preset.baseAngle + (Math.random() * preset.spread) - half;
      const speed = preset.speed[0] + Math.random() * (preset.speed[1] - preset.speed[0]);

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = preset.life[0] + Math.random() * (preset.life[1] - preset.life[0]);
      p.maxLife = p.life;
      p.size = preset.size[0] + Math.random() * (preset.size[1] - preset.size[0]);
      p.color = preset.colors[Math.floor(Math.random() * preset.colors.length)];
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.25;
      p.gravity = preset.gravity;
      p.shape = preset.shape;

      activeCount++;
    }
  }

  /**
   * Advance all active particles by dt milliseconds.
   *
   * @param {number} dt - Delta time in ms.
   */
  function update(dt) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        activeCount--;
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotSpeed;
    }
  }

  /**
   * Draw all active particles onto the canvas.
   * Call after ctx.clearRect() / your game's normal draw pass.
   */
  function render() {
    if (!ctx) return;

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;

      const alpha = p.life / p.maxLife;  // fade out as life depletes

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      if (p.shape === 'rect') {
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /** Deactivate all particles immediately. */
  function clear() {
    for (let i = 0; i < pool.length; i++) {
      pool[i].active = false;
    }
    activeCount = 0;
  }

  /** @returns {number} Number of currently active particles. */
  function getActiveCount() { return activeCount; }

  /** @returns {boolean} True when no particles are alive. */
  function isEmpty() { return activeCount === 0; }

  return { spawn, update, render, clear, getActiveCount, isEmpty };
}
