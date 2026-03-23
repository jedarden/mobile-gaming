/**
 * Ad Compositor — Unit Tests
 *
 * Tests for template validation, timeline building, overlay triggering,
 * source-time mapping, and composition API.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  TEMPLATES,
  buildTimeline,
  getTotalDuration,
  getActiveEntry,
  compositionToSourceTime,
  getActiveOverlays,
  overlayProgress,
  validateTemplate,
  createComposition,
  renderFrame,
  exportMp4,
} from '../../src/shared/ad-compositor.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSource(duration = 10000) {
  return {
    getDuration: () => duration,
    getFrameAt: vi.fn((ms) => ({ type: 'mock-frame', ms })),
    stateUrl: 'https://example.com/?state=test',
  };
}

function mockCtx(w = 1080, h = 1920) {
  return {
    canvas: { width: w, height: h },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  };
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

describe('TEMPLATES', () => {
  const EXPECTED_IDS = ['fail-ad', 'challenge-ad', 'satisfying-ad', 'drama-ad', 'speedrun-ad'];

  it('defines exactly 5 templates', () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(5);
  });

  it('has all expected template IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(TEMPLATES, `${id} should exist`).toHaveProperty(id);
    }
  });

  it('all templates pass validateTemplate()', () => {
    for (const [id, tmpl] of Object.entries(TEMPLATES)) {
      const result = validateTemplate(tmpl);
      expect(result.valid, `${id} errors: ${result.errors.join(', ')}`).toBe(true);
    }
  });

  it('each template has at least one segment', () => {
    for (const [id, tmpl] of Object.entries(TEMPLATES)) {
      expect(tmpl.segments.length, id).toBeGreaterThan(0);
    }
  });

  it('each template has at least one overlay', () => {
    for (const [id, tmpl] of Object.entries(TEMPLATES)) {
      expect(tmpl.overlays.length, id).toBeGreaterThan(0);
    }
  });

  it('fail-ad contains a NO! text overlay', () => {
    const tmpl = TEMPLATES['fail-ad'];
    const hasNo = tmpl.overlays.some(o => o.type === 'text' && o.content.includes('NO'));
    expect(hasNo).toBe(true);
  });

  it('challenge-ad contains IQ / 1% text', () => {
    const tmpl = TEMPLATES['challenge-ad'];
    const hasChallenge = tmpl.overlays.some(o => o.type === 'text' && o.content.toLowerCase().includes('1%'));
    expect(hasChallenge).toBe(true);
  });

  it('speedrun-ad has a gameplay segment with speedMultiplier ≥ 2', () => {
    const tmpl = TEMPLATES['speedrun-ad'];
    const fast = tmpl.segments.some(s => s.type === 'gameplay' && (s.speedMultiplier ?? 1) >= 2);
    expect(fast).toBe(true);
  });

  it('satisfying-ad has slow-motion (speedMultiplier < 1)', () => {
    const tmpl = TEMPLATES['satisfying-ad'];
    const slow = tmpl.segments.some(s => s.type === 'gameplay' && (s.speedMultiplier ?? 1) < 1);
    expect(slow).toBe(true);
  });
});

// ─── validateTemplate ─────────────────────────────────────────────────────────

describe('validateTemplate', () => {
  it('returns valid for a well-formed template', () => {
    const result = validateTemplate({
      id: 'test',
      name: 'Test',
      segments: [{ type: 'gameplay', duration: 2000 }],
      overlays: [{ type: 'text', content: 'hi', trigger: 0, duration: 500 }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null input', () => {
    const r = validateTemplate(null);
    expect(r.valid).toBe(false);
  });

  it('rejects missing id', () => {
    const r = validateTemplate({
      name: 'X',
      segments: [{ type: 'gameplay', duration: 1000 }],
      overlays: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/id/i);
  });

  it('rejects empty segments array', () => {
    const r = validateTemplate({ id: 'x', name: 'X', segments: [], overlays: [] });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/segment/i);
  });

  it('rejects invalid segment type', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'transition', duration: 1000 }],
      overlays: [],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects non-positive segment duration', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'black', duration: 0 }],
      overlays: [],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid overlay type', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'black', duration: 1000 }],
      overlays: [{ type: 'video', content: 'x', trigger: 0, duration: 500 }],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects missing overlay trigger', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'black', duration: 1000 }],
      overlays: [{ type: 'text', content: 'x', duration: 500 }],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects non-object primitive (number)', () => {
    const r = validateTemplate(123);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Template must be an object');
  });

  it('rejects speedMultiplier of 0 (non-positive)', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'gameplay', duration: 2000, speedMultiplier: 0 }],
      overlays: [],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/speedMultiplier/i);
  });

  it('rejects overlays that is not an array (!Array.isArray branch)', () => {
    const r = validateTemplate({
      id: 'x', name: 'X',
      segments: [{ type: 'black', duration: 1000 }],
      overlays: null, // not an array
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/overlays must be an array/i);
  });
});

// ─── buildTimeline ────────────────────────────────────────────────────────────

describe('buildTimeline', () => {
  const tmpl = {
    id: 'test', name: 'Test',
    segments: [
      { type: 'gameplay', duration: 2000, speedMultiplier: 1.0, startOffset: 0 },
      { type: 'black',    duration: 500 },
      { type: 'outro',    duration: 1500 },
    ],
    overlays: [],
  };

  it('returns one entry per segment', () => {
    const tl = buildTimeline(tmpl);
    expect(tl).toHaveLength(3);
  });

  it('first segment starts at 0', () => {
    const tl = buildTimeline(tmpl);
    expect(tl[0].startMs).toBe(0);
  });

  it('segments are contiguous (endMs = next startMs)', () => {
    const tl = buildTimeline(tmpl);
    expect(tl[0].endMs).toBe(tl[1].startMs);
    expect(tl[1].endMs).toBe(tl[2].startMs);
  });

  it('last endMs equals total duration', () => {
    const tl = buildTimeline(tmpl);
    const lastEntry = tl[tl.length - 1];
    expect(lastEntry.endMs).toBe(getTotalDuration(tmpl));
  });
});

describe('getTotalDuration', () => {
  it('sums all segment durations', () => {
    const tmpl = {
      id: 't', name: 'T',
      segments: [
        { type: 'gameplay', duration: 2000 },
        { type: 'black',    duration: 500 },
        { type: 'outro',    duration: 1500 },
      ],
      overlays: [],
    };
    expect(getTotalDuration(tmpl)).toBe(4000);
  });

  it('handles a single segment', () => {
    const tmpl = { id: 't', name: 'T', segments: [{ type: 'black', duration: 1000 }], overlays: [] };
    expect(getTotalDuration(tmpl)).toBe(1000);
  });
});

describe('getActiveEntry', () => {
  const tmpl = {
    id: 'test', name: 'Test',
    segments: [
      { type: 'gameplay', duration: 2000 },
      { type: 'black',    duration: 500 },
    ],
    overlays: [],
  };
  const tl = buildTimeline(tmpl);

  it('returns first entry at t=0', () => {
    expect(getActiveEntry(tl, 0).segment.type).toBe('gameplay');
  });

  it('returns first entry at t=1999', () => {
    expect(getActiveEntry(tl, 1999).segment.type).toBe('gameplay');
  });

  it('returns second entry at t=2000', () => {
    expect(getActiveEntry(tl, 2000).segment.type).toBe('black');
  });

  it('clamps to last entry for t >= totalDuration', () => {
    const entry = getActiveEntry(tl, 99999);
    expect(entry.segment.type).toBe('black');
  });

  it('returns null for empty timeline (?? null fallback)', () => {
    expect(getActiveEntry([], 0)).toBeNull();
  });
});

// ─── compositionToSourceTime ──────────────────────────────────────────────────

describe('compositionToSourceTime', () => {
  it('returns -1 for non-gameplay segments', () => {
    const tl = buildTimeline({
      id: 't', name: 'T',
      segments: [{ type: 'black', duration: 1000 }],
      overlays: [],
    });
    expect(compositionToSourceTime(tl[0], 500)).toBe(-1);
  });

  it('at speed 1.0 maps t=0 → sourceStart', () => {
    const tl = buildTimeline({
      id: 't', name: 'T',
      segments: [{ type: 'gameplay', duration: 2000, speedMultiplier: 1.0, startOffset: 1000 }],
      overlays: [],
    });
    expect(compositionToSourceTime(tl[0], 0)).toBe(1000);
  });

  it('at speed 1.0 advances linearly', () => {
    const tl = buildTimeline({
      id: 't', name: 'T',
      segments: [{ type: 'gameplay', duration: 2000, speedMultiplier: 1.0, startOffset: 0 }],
      overlays: [],
    });
    expect(compositionToSourceTime(tl[0], 1000)).toBe(1000);
  });

  it('at speed 4.0 advances 4× faster', () => {
    const tl = buildTimeline({
      id: 't', name: 'T',
      segments: [{ type: 'gameplay', duration: 2500, speedMultiplier: 4.0, startOffset: 0 }],
      overlays: [],
    });
    // 1s of composition time = 4s of source time
    expect(compositionToSourceTime(tl[0], 1000)).toBe(4000);
  });

  it('at speed 0.5 advances half as fast (slow-motion)', () => {
    const tl = buildTimeline({
      id: 't', name: 'T',
      segments: [{ type: 'gameplay', duration: 3000, speedMultiplier: 0.5, startOffset: 0 }],
      overlays: [],
    });
    expect(compositionToSourceTime(tl[0], 2000)).toBe(1000);
  });
});

// ─── getActiveOverlays ────────────────────────────────────────────────────────

describe('getActiveOverlays', () => {
  const tmpl = {
    id: 't', name: 'T',
    segments: [{ type: 'black', duration: 5000 }],
    overlays: [
      { type: 'text',  content: 'A', trigger: 1000, duration: 500 },
      { type: 'text',  content: 'B', trigger: 2000, duration: 1000 },
      { type: 'emoji', content: '🎉', trigger: 1200, duration: 300 },
    ],
  };

  it('returns empty array before any overlay triggers', () => {
    expect(getActiveOverlays(tmpl, 0)).toHaveLength(0);
  });

  it('returns overlay A at its trigger time', () => {
    const active = getActiveOverlays(tmpl, 1000);
    expect(active.some(o => o.content === 'A')).toBe(true);
  });

  it('returns multiple overlays when they overlap', () => {
    // At t=1200, A (1000-1500) and emoji (1200-1500) are both active
    const active = getActiveOverlays(tmpl, 1200);
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  it('overlay is not active after its duration', () => {
    // A ends at 1500
    const active = getActiveOverlays(tmpl, 1500);
    expect(active.some(o => o.content === 'A')).toBe(false);
  });

  it('returns overlay B during its window', () => {
    const active = getActiveOverlays(tmpl, 2500);
    expect(active.some(o => o.content === 'B')).toBe(true);
  });

  it('returns empty array for template with no overlays (filter on empty array)', () => {
    const emptyOverlays = { id: 't', name: 'T', segments: [], overlays: [] };
    expect(getActiveOverlays(emptyOverlays, 1000)).toHaveLength(0);
  });
});

// ─── overlayProgress ─────────────────────────────────────────────────────────

describe('overlayProgress', () => {
  const overlay = { type: 'text', content: 'X', trigger: 1000, duration: 500 };

  it('returns 0 at trigger time', () => {
    expect(overlayProgress(overlay, 1000)).toBe(0);
  });

  it('returns 0.5 at midpoint', () => {
    expect(overlayProgress(overlay, 1250)).toBe(0.5);
  });

  it('returns 1 at end of duration', () => {
    expect(overlayProgress(overlay, 1500)).toBe(1);
  });

  it('clamps to 1 beyond end', () => {
    expect(overlayProgress(overlay, 9999)).toBe(1);
  });

  it('clamps to 0 before trigger', () => {
    expect(overlayProgress(overlay, 0)).toBe(0);
  });
});

// ─── createComposition ───────────────────────────────────────────────────────

describe('createComposition', () => {
  it('creates composition from template id', () => {
    const comp = createComposition('fail-ad', makeSource());
    expect(comp.template.id).toBe('fail-ad');
    expect(comp.totalDuration).toBeGreaterThan(0);
  });

  it('creates composition from template object', () => {
    const tmpl = TEMPLATES['challenge-ad'];
    const comp = createComposition(tmpl, makeSource());
    expect(comp.template.id).toBe('challenge-ad');
  });

  it('throws for unknown template id', () => {
    expect(() => createComposition('nonexistent', makeSource())).toThrow();
  });

  it('throws when template object fails validation (if (!validation.valid) branch)', () => {
    // Passing an object directly bypasses the TEMPLATES lookup but still validates
    // empty segments → validateTemplate returns valid:false → throws 'Invalid template: ...'
    const badTemplate = { id: 'bad', name: 'Bad', segments: [], overlays: [] };
    expect(() => createComposition(badTemplate, makeSource())).toThrow(/invalid template/i);
  });

  it('totalDuration equals sum of segments', () => {
    const comp = createComposition('fail-ad', makeSource());
    expect(comp.totalDuration).toBe(getTotalDuration(TEMPLATES['fail-ad']));
  });

  it('getFrameInfo() returns an entry for time within totalDuration', () => {
    const comp = createComposition('fail-ad', makeSource());
    const { entry } = comp.getFrameInfo(0);
    expect(entry).not.toBeNull();
  });

  it('getOverlays() returns overlays at their trigger times', () => {
    const comp = createComposition('fail-ad', makeSource());
    const tmpl = TEMPLATES['fail-ad'];
    // find the earliest trigger
    const firstTrigger = Math.min(...tmpl.overlays.map(o => o.trigger));
    const active = comp.getOverlays(firstTrigger);
    expect(active.length).toBeGreaterThan(0);
  });

  it('calls getFrameAt with source time during gameplay segments', () => {
    const source = makeSource();
    const comp = createComposition('fail-ad', source);
    // first segment is gameplay at t=0
    comp.getFrameInfo(100);
    expect(source.getFrameAt).toHaveBeenCalled();
  });

  it('getFrameInfo() returns frame=null when getFrameAt returns null (?? null branch)', () => {
    // getFrameAt returns null → nullish coalescing ?? null fires → frame is null
    const source = { ...makeSource(), getFrameAt: vi.fn(() => null) };
    const comp = createComposition('fail-ad', source);
    const { frame } = comp.getFrameInfo(100);
    expect(frame).toBeNull();
  });

  it('getFrameInfo() returns frame=null when getFrameAt returns undefined (?? null branch)', () => {
    // getFrameAt returns undefined → ?? null fires → frame is null
    const source = { ...makeSource(), getFrameAt: vi.fn(() => undefined) };
    const comp = createComposition('fail-ad', source);
    const { frame } = comp.getFrameInfo(100);
    expect(frame).toBeNull();
  });

  it('getFrameInfo() returns frame=null and sourceTime=-1 during non-gameplay segment (sourceTime>=0 false arm)', () => {
    // fail-ad segment 1 (black) runs from 2000-2400ms
    // compositionToSourceTime returns -1 for non-gameplay → sourceTime < 0 → frame = null (false arm)
    const source = makeSource();
    const comp = createComposition('fail-ad', source);
    const { sourceTime, frame } = comp.getFrameInfo(2100); // within the black segment
    expect(sourceTime).toBe(-1);
    expect(frame).toBeNull();
    // getFrameAt must NOT be called when sourceTime < 0
    expect(source.getFrameAt).not.toHaveBeenCalled();
  });
});

// ─── renderFrame ─────────────────────────────────────────────────────────────

describe('renderFrame', () => {
  it('does not throw for a gameplay frame', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    expect(() => renderFrame(ctx, comp, 0)).not.toThrow();
  });

  it('does not throw for a black frame', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    // fail-ad: segment 1 (gameplay 2000ms), segment 2 (black 400ms)
    const blackStart = 2000;
    expect(() => renderFrame(ctx, comp, blackStart + 10)).not.toThrow();
  });

  it('does not throw for an outro frame', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    const outroStart = getTotalDuration(TEMPLATES['fail-ad']) - 2500;
    expect(() => renderFrame(ctx, comp, outroStart + 100)).not.toThrow();
  });

  it('calls ctx.clearRect on every frame', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    renderFrame(ctx, comp, 0);
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('is safe with null ctx', () => {
    const comp = createComposition('fail-ad', makeSource());
    expect(() => renderFrame(null, comp, 0)).not.toThrow();
  });

  it('renders overlay text when overlay is active', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    // trigger the first overlay
    const overlay = TEMPLATES['fail-ad'].overlays[0];
    renderFrame(ctx, comp, overlay.trigger + 10);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('applies textOverrides option', () => {
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    const overlay = TEMPLATES['fail-ad'].overlays[0];
    const original = overlay.content;

    renderFrame(ctx, comp, overlay.trigger + 10, {
      textOverrides: { [original]: 'CUSTOM TEXT' },
    });

    const calls = ctx.fillText.mock.calls;
    const hasCustom = calls.some(c => c[0] === 'CUSTOM TEXT');
    expect(hasCustom).toBe(true);
  });

  it('renders bounce animation overlay without error (no scale/alpha transform applied)', () => {
    // fail-ad overlays[1] uses animation: 'bounce' — neither zoom nor fade if-block fires
    const comp = createComposition('fail-ad', makeSource());
    const ctx = mockCtx();
    const bounceOverlay = TEMPLATES['fail-ad'].overlays[1]; // animation: 'bounce', trigger: 2600
    expect(() => renderFrame(ctx, comp, bounceOverlay.trigger + 10)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled(); // overlay rendered with scale=1, alpha=1
  });

  it('renders none animation overlay without error (no transform applied)', () => {
    // challenge-ad overlays[1] uses animation: 'none' — neither zoom nor fade if-block fires
    const comp = createComposition('challenge-ad', makeSource());
    const ctx = mockCtx();
    const noneOverlay = TEMPLATES['challenge-ad'].overlays[1]; // animation: 'none', trigger: 800
    expect(() => renderFrame(ctx, comp, noneOverlay.trigger + 10)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders fade animation overlay with alpha < 1 during fade-in (if(overlay.animation==="fade") true branch)', () => {
    // challenge-ad overlays[0] uses animation: 'fade', trigger: 0, duration: 800
    // At t=50ms: progress = 50/800 = 0.0625, alpha = min(1, 0.0625*4) = 0.25
    const comp = createComposition('challenge-ad', makeSource());
    const ctx = mockCtx();
    renderFrame(ctx, comp, 50); // overlay active; fade branch sets globalAlpha=0.25
    // ctx.restore() is a no-op mock so globalAlpha stays at the value set inside _renderOverlay
    expect(ctx.globalAlpha).toBeLessThan(1);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('renders slide animation overlay without error (no transform applied)', () => {
    // drama-ad overlays[1] uses animation: 'slide' — neither zoom nor fade if-block fires
    const comp = createComposition('drama-ad', makeSource());
    const ctx = mockCtx();
    const slideOverlay = TEMPLATES['drama-ad'].overlays[1]; // animation: 'slide', trigger: 3100
    expect(() => renderFrame(ctx, comp, slideOverlay.trigger + 10)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('falls back to putImageData when drawImage throws and frame has .data', () => {
    // Simulate an ImageData frame — drawImage rejects it but putImageData accepts it
    const imageDataFrame = { data: new Uint8ClampedArray(4) };
    const source = { ...makeSource(), getFrameAt: vi.fn(() => imageDataFrame) };
    const comp = createComposition('fail-ad', source);
    const ctx = mockCtx();
    ctx.drawImage = vi.fn(() => { throw new Error('drawImage not supported for ImageData'); });
    renderFrame(ctx, comp, 0); // t=0 is the gameplay segment in fail-ad
    expect(ctx.putImageData).toHaveBeenCalledWith(imageDataFrame, 0, 0);
  });

  it('does not call putImageData when drawImage throws but frame has no .data', () => {
    const opaqueFrame = { type: 'video-frame' }; // no .data property
    const source = { ...makeSource(), getFrameAt: vi.fn(() => opaqueFrame) };
    const comp = createComposition('fail-ad', source);
    const ctx = mockCtx();
    ctx.drawImage = vi.fn(() => { throw new Error('drawImage failed'); });
    renderFrame(ctx, comp, 0);
    expect(ctx.putImageData).not.toHaveBeenCalled();
  });

  it('renders overlay with unknown style using ?? fallback (OVERLAY_STYLES[style] ?? OVERLAY_STYLES.normal)', () => {
    // Build a minimal custom template with an overlay that has an unknown style
    const customTemplate = {
      id: 'test-unknown-style',
      name: 'Test Unknown Style',
      segments: [{ type: 'outro', duration: 500 }],
      overlays: [
        { type: 'text', content: 'Hello', trigger: 0, duration: 400, style: 'unknown-style', animation: 'none' }
      ],
    };
    const comp = createComposition(customTemplate, makeSource());
    const ctx = mockCtx();
    // t=10: overlay is active; OVERLAY_STYLES['unknown-style'] is undefined → ?? OVERLAY_STYLES.normal → undefined
    renderFrame(ctx, comp, 10);
    // fillText is still called even when style is undefined (mock ctx accepts any font value)
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

// ── renderFrame — ctx without canvas property (ctx.canvas?.width ?? CANVAS_W) ──

describe('renderFrame — ctx without canvas property (?? CANVAS_W/CANVAS_H fallback)', () => {
  it('uses CANVAS_W/CANVAS_H defaults when ctx has no canvas property (??  fallback branch)', () => {
    // ctx without .canvas → ctx.canvas is undefined → undefined?.width = undefined
    // → undefined ?? CANVAS_W = 1080; same for height
    const ctx = {
      canvas: undefined,
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    const comp = createComposition(TEMPLATES['fail-ad'], makeSource());
    // Should not throw and should call clearRect with default 1080x1920
    expect(() => renderFrame(ctx, comp, 0)).not.toThrow();
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1080, 1920);
  });
});

// ── exportMp4 ──────────────────────────────────────────────────────────────────
// exportMp4 was previously untested. Covers:
//  - if(!mimeType) reject path
//  - catch { return false } in MediaRecorder.isTypeSupported
//  - onerror with e.error.message (e.error?.message ?? e — true arm)
//  - onerror without e.error (e.error?.message ?? e — false arm, uses e itself)
//  - opts.fps ?? EXPORT_FPS default (fps not provided)
//  - happy path: resolves with Blob

describe('exportMp4', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when no codec is supported (if(!mimeType) reject branch)', async () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: vi.fn(() => false) });
    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn() };
    await expect(exportMp4({ totalDuration: 0 }, canvas))
      .rejects.toThrow('No supported MediaRecorder codec found');
  });

  it('catch { return false } when isTypeSupported throws — still no mimeType → reject', async () => {
    // All three mimeType probes throw; each catch returns false → no mimeType found
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: vi.fn(() => { throw new Error('not supported'); }),
    });
    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn() };
    await expect(exportMp4({ totalDuration: 0 }, canvas))
      .rejects.toThrow('No supported MediaRecorder codec found');
  });

  it('uses EXPORT_FPS=30 when opts.fps is not provided (opts.fps ?? EXPORT_FPS false arm)', async () => {
    let capturedFps;
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    vi.stubGlobal('requestAnimationFrame', vi.fn()); // don't auto-advance loop

    const canvas = {
      getContext: vi.fn(() => mockCtx()),
      captureStream: vi.fn((fps) => { capturedFps = fps; return {}; }),
    };
    // totalDuration=0 → loop exits immediately, captureStream(fps) called with default 30
    exportMp4({ totalDuration: 0 }, canvas); // no opts.fps
    expect(capturedFps).toBe(30);
  });

  it('onerror with e.error.message uses message (e.error?.message ?? e — true arm)', async () => {
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn(() => ({})) };

    // totalDuration=0 → renderNext immediately calls recorder.stop() and returns
    // without calling renderFrame, so composition needs no getFrameInfo
    const promise = exportMp4({ totalDuration: 0 }, canvas);
    mockRecorder.onerror({ error: { message: 'encoder failure' } });
    await expect(promise).rejects.toThrow('MediaRecorder error: encoder failure');
  });

  it('onerror without e.error falls back to e (e.error?.message ?? e — false arm)', async () => {
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn(() => ({})) };

    // totalDuration=0 avoids renderFrame call (loop exits immediately)
    const promise = exportMp4({ totalDuration: 0 }, canvas);
    // Fire onerror with no .error property — e.error?.message is undefined → ?? e → e used
    mockRecorder.onerror({ toString: () => '[raw event]' });
    await expect(promise).rejects.toThrow('MediaRecorder error:');
  });

  it('resolves with a Blob when recorder completes (happy path)', async () => {
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    // rAF that immediately invokes callback once
    vi.stubGlobal('requestAnimationFrame', vi.fn(cb => cb()));

    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn(() => ({})) };
    // totalDuration=0 → renderNext immediately calls recorder.stop() on first call
    const composition = { totalDuration: 0, getActiveEntry: vi.fn(() => null), getOverlays: vi.fn(() => []) };

    const promise = exportMp4(composition, canvas);
    // onstop was set by exportMp4; trigger it to resolve the promise
    mockRecorder.onstop();
    const blob = await promise;
    expect(blob).toBeInstanceOf(Blob);
  });

  it('executes frame loop body: calls renderFrame and increments t when totalDuration > 0 (loop true arm)', async () => {
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    // Synchronous rAF — each renderNext call that requests next frame fires immediately
    vi.stubGlobal('requestAnimationFrame', vi.fn(cb => cb()));

    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn(() => ({})) };
    // totalDuration=100ms, fps defaults to 30 → frameDuration≈33.3ms → ~3 renderFrame calls before stop
    const getFrameInfo = vi.fn(() => ({ entry: null, frame: null }));
    const getOverlays = vi.fn(() => []);
    const composition = { totalDuration: 100, getFrameInfo, getOverlays };

    const promise = exportMp4(composition, canvas);
    // stop() fires onstop synchronously → resolves promise
    mockRecorder.onstop();
    await promise;

    // getFrameInfo is called once per renderFrame call; must have been called at least once
    // (proving the loop body executed — t=0 < 100 → renderFrame → t+=33.3 → ... → stop)
    expect(getFrameInfo).toHaveBeenCalled();
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  });

  it('ondataavailable skips chunks with size=0 (if(e.data.size>0) false arm)', async () => {
    const mockRecorder = { start: vi.fn(), stop: vi.fn(), ondataavailable: null, onstop: null, onerror: null };
    const MockMR = vi.fn(() => mockRecorder);
    MockMR.isTypeSupported = vi.fn(() => true);
    vi.stubGlobal('MediaRecorder', MockMR);
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    const canvas = { getContext: vi.fn(() => mockCtx()), captureStream: vi.fn(() => ({})) };
    const promise = exportMp4({ totalDuration: 0 }, canvas);

    // Fire ondataavailable with size=0 — should NOT push to chunks
    mockRecorder.ondataavailable({ data: { size: 0 } });
    // Fire ondataavailable with size>0 — SHOULD push to chunks
    const realChunk = new Blob(['x']);
    mockRecorder.ondataavailable({ data: realChunk });
    // Trigger onstop — Blob is assembled from chunks (only the size>0 chunk)
    mockRecorder.onstop();

    const blob = await promise;
    // The resulting Blob comes from one chunk (the size>0 one), not zero chunks
    expect(blob.size).toBeGreaterThan(0);
  });
});
