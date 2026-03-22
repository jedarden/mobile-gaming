/**
 * Ad Compositor — Unit Tests
 *
 * Tests for template validation, timeline building, overlay triggering,
 * source-time mapping, and composition API.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';

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
});
