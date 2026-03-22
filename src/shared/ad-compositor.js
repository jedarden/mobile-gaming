/**
 * Ad Compositor
 *
 * Template-driven tool to turn gameplay recordings into fake mobile-game ad
 * videos. Each template defines a sequence of segments (gameplay / black /
 * outro) and timed overlays (text, emoji, QR code, animation triggers).
 *
 * Architecture:
 *   1. Template  – static JSON definition (see TEMPLATES below)
 *   2. Timeline  – buildTimeline() maps template time → source recording time
 *   3. Composition – createComposition() binds a template to a recording source
 *   4. Render    – renderFrame(ctx, composition, timeMs) draws one frame
 *   5. Export    – exportMp4(composition, canvas) encodes to Blob via MediaRecorder
 *
 * Usage (production):
 *   import { TEMPLATES, createComposition, renderFrame, exportMp4 } from '../shared/ad-compositor.js';
 *
 *   const comp = createComposition('fail-ad', {
 *     getDuration: () => recorder.getDuration(),
 *     getFrameAt: (sourceMs) => recorder.getFrameAt(sourceMs),  // returns ImageBitmap/ImageData
 *     stateUrl: shareUrl,
 *   });
 *
 *   // Rendering loop (preview):
 *   for (let t = 0; t < comp.totalDuration; t += 1000 / 30) {
 *     renderFrame(ctx, comp, t);
 *   }
 *
 *   // Export:
 *   const blob = await exportMp4(comp, canvas);
 *
 * Usage (tests — inject mock recording):
 *   const comp = createComposition('fail-ad', {
 *     getDuration: () => 10000,
 *     getFrameAt: (ms) => null,
 *     stateUrl: 'https://example.com/?state=test',
 *   });
 */

// ─── Template definitions ─────────────────────────────────────────────────────

/**
 * @typedef {Object} Segment
 * @property {'gameplay'|'black'|'outro'} type
 * @property {number} duration            - Segment duration in ms
 * @property {number} [speedMultiplier]   - Playback speed (default 1.0)
 * @property {number} [startOffset]       - Source recording start offset ms (default 0)
 *
 * @typedef {Object} Overlay
 * @property {'text'|'emoji'|'qr'|'shape'} type
 * @property {string} content
 * @property {number} trigger             - Composition time (ms) when overlay appears
 * @property {number} duration            - How long the overlay is visible (ms)
 * @property {string} [style]             - Named style: 'dramatic'|'challenge'|'speedrun'|'normal'
 * @property {string} [animation]         - Entry animation: 'zoom'|'fade'|'slide'|'bounce'|'none'
 * @property {number} [x]                 - Normalized [0,1] horizontal anchor (default 0.5 = centre)
 * @property {number} [y]                 - Normalized [0,1] vertical anchor   (default 0.5 = centre)
 *
 * @typedef {Object} Template
 * @property {string}    id
 * @property {string}    name
 * @property {string}    description
 * @property {Segment[]} segments
 * @property {Overlay[]} overlays
 * @property {Object}    [audio]          - Optional audio cue hints
 */

/** @type {Record<string, Template>} */
export const TEMPLATES = {

  'fail-ad': {
    id: 'fail-ad',
    name: 'Fail Ad',
    description: 'Two wrong moves, dramatic cut, "NO!" text — classic gotcha bait',
    segments: [
      { type: 'gameplay',  duration: 2000, speedMultiplier: 1.0, startOffset: 0 },
      { type: 'black',     duration: 400 },
      { type: 'gameplay',  duration: 1000, speedMultiplier: 1.0, startOffset: 2000 },
      { type: 'outro',     duration: 2500 },
    ],
    overlays: [
      { type: 'text',  content: 'NO!',  trigger: 2400, duration: 600,  style: 'dramatic', animation: 'zoom',   x: 0.5, y: 0.3 },
      { type: 'emoji', content: '😱',   trigger: 2600, duration: 800,  style: 'normal',   animation: 'bounce', x: 0.7, y: 0.25 },
    ],
    audio: { cue: 'sad-trombone', triggerMs: 2400 },
  },

  'challenge-ad': {
    id: 'challenge-ad',
    name: 'Challenge Ad',
    description: '"Only 1% can solve this!" — IQ bait with a timer overlay',
    segments: [
      { type: 'black',    duration: 800 },
      { type: 'gameplay', duration: 5000, speedMultiplier: 1.0, startOffset: 0 },
      { type: 'outro',    duration: 2000 },
    ],
    overlays: [
      { type: 'text',  content: 'Only 1% can solve this!', trigger: 0,    duration: 800,  style: 'challenge', animation: 'fade',   x: 0.5, y: 0.15 },
      { type: 'text',  content: 'IQ: ???',                  trigger: 800,  duration: 5000, style: 'challenge', animation: 'none',   x: 0.5, y: 0.85 },
      { type: 'text',  content: '🧠 GENIUS',               trigger: 5600, duration: 1200, style: 'dramatic',  animation: 'zoom',   x: 0.5, y: 0.5  },
    ],
    audio: { cue: 'dramatic-sting', triggerMs: 5600 },
  },

  'satisfying-ad': {
    id: 'satisfying-ad',
    name: 'Satisfying Ad',
    description: 'Loop the most satisfying 3 seconds in slow-motion with ASMR aesthetic',
    segments: [
      { type: 'gameplay', duration: 3000, speedMultiplier: 0.5,  startOffset: 0 },
      { type: 'gameplay', duration: 3000, speedMultiplier: 0.5,  startOffset: 0 },  // loop
      { type: 'outro',    duration: 2000 },
    ],
    overlays: [
      { type: 'text',  content: '✨ So Satisfying…', trigger: 0,    duration: 5500, style: 'normal',  animation: 'fade', x: 0.5, y: 0.1 },
      { type: 'emoji', content: '😌',                trigger: 1000, duration: 4500, style: 'normal',  animation: 'none', x: 0.85, y: 0.8 },
    ],
    audio: { cue: 'asmr-ambient', triggerMs: 0 },
  },

  'drama-ad': {
    id: 'drama-ad',
    name: 'Drama Ad',
    description: 'Dramatic pause, wrong answer, red X, sad trombone',
    segments: [
      { type: 'gameplay', duration: 2500, speedMultiplier: 1.0, startOffset: 0 },
      { type: 'black',    duration: 600 },
      { type: 'gameplay', duration: 1500, speedMultiplier: 0.3, startOffset: 2500 },
      { type: 'outro',    duration: 2000 },
    ],
    overlays: [
      { type: 'shape', content: 'red-x',    trigger: 3100, duration: 1200, style: 'dramatic', animation: 'zoom',   x: 0.5, y: 0.45 },
      { type: 'text',  content: 'WRONG ❌', trigger: 3100, duration: 1500, style: 'dramatic', animation: 'slide',  x: 0.5, y: 0.7 },
    ],
    audio: { cue: 'sad-trombone', triggerMs: 3100 },
  },

  'speedrun-ad': {
    id: 'speedrun-ad',
    name: 'Speedrun Ad',
    description: '4× speed with timer overlay, abrupt stop — "Can you beat this?"',
    segments: [
      { type: 'gameplay', duration: 2500, speedMultiplier: 4.0, startOffset: 0 },
      { type: 'black',    duration: 300 },
      { type: 'outro',    duration: 2000 },
    ],
    overlays: [
      { type: 'text', content: '⚡ SPEEDRUN MODE', trigger: 0,    duration: 2500, style: 'speedrun', animation: 'fade',  x: 0.5, y: 0.08 },
      { type: 'text', content: '4× SPEED',         trigger: 0,    duration: 2500, style: 'speedrun', animation: 'none',  x: 0.85, y: 0.15 },
      { type: 'text', content: 'Can YOU beat this?',trigger: 2800, duration: 1700, style: 'challenge',animation: 'zoom',  x: 0.5, y: 0.5 },
    ],
    audio: { cue: 'speed-whoosh', triggerMs: 0 },
  },
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TimelineEntry
 * @property {Segment} segment
 * @property {number} startMs     - Composition time when this segment begins
 * @property {number} endMs       - Composition time when this segment ends
 * @property {number} sourceStart - Source recording start for this segment
 */

/**
 * Build a flat timeline from a template.
 * Each entry records the composition time window and the corresponding
 * source recording window (adjusted for speedMultiplier).
 *
 * @param {Template} template
 * @returns {TimelineEntry[]}
 */
export function buildTimeline(template) {
  const entries = [];
  let cursor = 0;

  for (const seg of template.segments) {
    const speed = seg.speedMultiplier ?? 1.0;
    const sourceDuration = seg.duration * speed;          // recording ms consumed
    const sourceStart = seg.startOffset ?? 0;

    entries.push({
      segment: seg,
      startMs: cursor,
      endMs: cursor + seg.duration,
      sourceStart,
      sourceDuration,
    });
    cursor += seg.duration;
  }

  return entries;
}

/**
 * Total composition duration in ms.
 * @param {Template} template
 * @returns {number}
 */
export function getTotalDuration(template) {
  return template.segments.reduce((sum, s) => sum + s.duration, 0);
}

/**
 * Find the active timeline entry at a given composition time.
 *
 * @param {TimelineEntry[]} timeline
 * @param {number} timeMs
 * @returns {TimelineEntry|null}
 */
export function getActiveEntry(timeline, timeMs) {
  for (const entry of timeline) {
    if (timeMs >= entry.startMs && timeMs < entry.endMs) return entry;
  }
  return timeline[timeline.length - 1] ?? null; // clamp to last
}

/**
 * For a composition time, return the corresponding source recording time.
 *
 * @param {TimelineEntry} entry - The active segment entry.
 * @param {number} timeMs       - Composition time within [entry.startMs, entry.endMs).
 * @returns {number} Source recording time in ms.
 */
export function compositionToSourceTime(entry, timeMs) {
  if (entry.segment.type !== 'gameplay') return -1;
  const localTime = timeMs - entry.startMs;
  const speed = entry.segment.speedMultiplier ?? 1.0;
  return entry.sourceStart + localTime * speed;
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

/**
 * Return all overlays from a template that are active at the given
 * composition time.
 *
 * @param {Template} template
 * @param {number} timeMs
 * @returns {Overlay[]}
 */
export function getActiveOverlays(template, timeMs) {
  return template.overlays.filter(
    o => timeMs >= o.trigger && timeMs < o.trigger + o.duration
  );
}

/**
 * Compute the normalized progress [0, 1] of an overlay at the given time.
 * Useful for animation easing.
 *
 * @param {Overlay} overlay
 * @param {number} timeMs
 * @returns {number}
 */
export function overlayProgress(overlay, timeMs) {
  const elapsed = timeMs - overlay.trigger;
  return Math.min(1, Math.max(0, elapsed / overlay.duration));
}

// ─── Template validation ──────────────────────────────────────────────────────

/**
 * Validate a template definition.
 *
 * @param {Object} tmpl
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTemplate(tmpl) {
  const errors = [];

  if (!tmpl || typeof tmpl !== 'object') {
    return { valid: false, errors: ['Template must be an object'] };
  }

  if (!tmpl.id || typeof tmpl.id !== 'string') errors.push('Missing id');
  if (!tmpl.name || typeof tmpl.name !== 'string') errors.push('Missing name');

  if (!Array.isArray(tmpl.segments) || tmpl.segments.length === 0) {
    errors.push('segments must be a non-empty array');
  } else {
    for (let i = 0; i < tmpl.segments.length; i++) {
      const s = tmpl.segments[i];
      if (!['gameplay', 'black', 'outro'].includes(s.type)) {
        errors.push(`segments[${i}].type must be gameplay|black|outro`);
      }
      if (typeof s.duration !== 'number' || s.duration <= 0) {
        errors.push(`segments[${i}].duration must be a positive number`);
      }
      if (s.speedMultiplier !== undefined && (typeof s.speedMultiplier !== 'number' || s.speedMultiplier <= 0)) {
        errors.push(`segments[${i}].speedMultiplier must be a positive number`);
      }
    }
  }

  if (!Array.isArray(tmpl.overlays)) {
    errors.push('overlays must be an array');
  } else {
    for (let i = 0; i < tmpl.overlays.length; i++) {
      const o = tmpl.overlays[i];
      if (!['text', 'emoji', 'qr', 'shape'].includes(o.type)) {
        errors.push(`overlays[${i}].type must be text|emoji|qr|shape`);
      }
      if (typeof o.trigger !== 'number') {
        errors.push(`overlays[${i}].trigger must be a number`);
      }
      if (typeof o.duration !== 'number' || o.duration <= 0) {
        errors.push(`overlays[${i}].duration must be a positive number`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Composition ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RecordingSource
 * @property {() => number} getDuration   - Total recording duration in ms.
 * @property {(sourceMs: number) => (ImageBitmap|ImageData|null)} getFrameAt
 *   - Retrieve a frame at the given source time. Returns null for non-gameplay
 *     segments or when no frame is available.
 * @property {string} [stateUrl]          - URL to embed in the QR outro overlay.
 */

/**
 * Bind a template to a recording source and produce a composition object.
 *
 * @param {string|Template} templateOrId - Template id or Template object.
 * @param {RecordingSource} source
 * @returns {Object} Composition
 */
export function createComposition(templateOrId, source) {
  const template = typeof templateOrId === 'string'
    ? TEMPLATES[templateOrId]
    : templateOrId;

  if (!template) {
    throw new Error(`Unknown template: ${templateOrId}`);
  }

  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
  }

  const timeline = buildTimeline(template);
  const totalDuration = getTotalDuration(template);

  return {
    template,
    timeline,
    totalDuration,
    source,

    /**
     * Return the active segment and source time at a given composition time.
     * @param {number} timeMs
     * @returns {{ entry: TimelineEntry, sourceTime: number, frame: ImageBitmap|ImageData|null }}
     */
    getFrameInfo(timeMs) {
      const entry = getActiveEntry(timeline, timeMs);
      if (!entry) return { entry: null, sourceTime: -1, frame: null };

      const sourceTime = compositionToSourceTime(entry, timeMs);
      const frame = sourceTime >= 0 ? (source.getFrameAt?.(sourceTime) ?? null) : null;

      return { entry, sourceTime, frame };
    },

    /**
     * Return overlays active at a given composition time.
     * @param {number} timeMs
     * @returns {Overlay[]}
     */
    getOverlays(timeMs) {
      return getActiveOverlays(template, timeMs);
    },
  };
}

// ─── Frame rendering ──────────────────────────────────────────────────────────

// Style definitions for overlay text
const OVERLAY_STYLES = {
  dramatic:  { font: 'bold 96px system-ui', color: '#FF3B30', shadow: '#000' },
  challenge: { font: 'bold 48px system-ui', color: '#FFD700', shadow: '#000' },
  speedrun:  { font: 'bold 52px "Courier New", monospace', color: '#00FF88', shadow: '#000' },
  normal:    { font: 'bold 56px system-ui', color: '#FFFFFF', shadow: '#000' },
};

const CANVAS_W = 1080;
const CANVAS_H = 1920;

/**
 * Render one composition frame onto a Canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} composition   - From createComposition()
 * @param {number} timeMs        - Current composition time
 * @param {Object} [opts]
 * @param {string} [opts.gameTitle]       - Displayed in outro
 * @param {Record<string, string>} [opts.textOverrides] - Per-overlay content overrides
 */
export function renderFrame(ctx, composition, timeMs, opts = {}) {
  if (!ctx) return;

  const { entry, frame } = composition.getFrameInfo(timeMs);
  const w = ctx.canvas?.width ?? CANVAS_W;
  const h = ctx.canvas?.height ?? CANVAS_H;

  // ── Background ────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  // ── Source frame ──────────────────────────────────────────────────────────
  if (frame && entry?.segment.type === 'gameplay') {
    try {
      ctx.drawImage(frame, 0, 0, w, h);
    } catch {
      // frame may be an ImageData — use putImageData if drawImage fails
      if (frame.data) ctx.putImageData(frame, 0, 0);
    }
  } else if (entry?.segment.type === 'outro') {
    _renderOutro(ctx, w, h, composition, opts);
  }
  // 'black' segments leave the dark background as-is.

  // ── Overlays ──────────────────────────────────────────────────────────────
  for (const overlay of composition.getOverlays(timeMs)) {
    const content = opts.textOverrides?.[overlay.content] ?? overlay.content;
    _renderOverlay(ctx, overlay, timeMs, content, w, h);
  }
}

function _renderOutro(ctx, w, h, composition, opts) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Game title
  const title = opts.gameTitle ?? 'Mobile Gaming';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, h * 0.4);

  ctx.font = '40px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Play Free →', w / 2, h * 0.5);
}

function _renderOverlay(ctx, overlay, timeMs, content, w, h) {
  const style = OVERLAY_STYLES[overlay.style] ?? OVERLAY_STYLES.normal;
  const px = (overlay.x ?? 0.5) * w;
  const py = (overlay.y ?? 0.5) * h;
  const progress = overlayProgress(overlay, timeMs);

  // Simple scale animation for 'zoom'
  let scale = 1;
  if (overlay.animation === 'zoom') {
    scale = 0.5 + progress * 0.5;
  }

  // Alpha for 'fade'
  let alpha = 1;
  if (overlay.animation === 'fade') {
    alpha = Math.min(1, progress * 4); // fade in over first 25%
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(px, py);
  ctx.scale(scale, scale);
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.shadowColor = style.shadow;
  ctx.shadowBlur = 8;

  ctx.fillStyle = style.color;
  ctx.fillText(content, 0, 0);
  ctx.restore();
}

// ─── MP4 export ───────────────────────────────────────────────────────────────

const EXPORT_FPS = 30;

/**
 * Render the full composition to an MP4 Blob via MediaRecorder.
 *
 * @param {Object} composition     - From createComposition()
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [opts]
 * @param {number} [opts.fps=30]
 * @returns {Promise<Blob>} MP4 Blob
 */
export async function exportMp4(composition, canvas, opts = {}) {
  const fps = opts.fps ?? EXPORT_FPS;
  const frameDuration = 1000 / fps;
  const ctx = canvas.getContext('2d');

  return new Promise((resolve, reject) => {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=h264',
      'video/webm',
    ];

    const mimeType = mimeTypes.find(m => {
      try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    });

    if (!mimeType) {
      reject(new Error('No supported MediaRecorder codec found'));
      return;
    }

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = e => reject(new Error(`MediaRecorder error: ${e.error?.message ?? e}`));

    recorder.start();

    let t = 0;
    function renderNext() {
      if (t >= composition.totalDuration) {
        recorder.stop();
        return;
      }
      renderFrame(ctx, composition, t, opts);
      t += frameDuration;
      requestAnimationFrame(renderNext);
    }

    renderNext();
  });
}
