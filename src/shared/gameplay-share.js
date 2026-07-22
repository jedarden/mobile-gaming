/**
 * Gameplay Share Wiring (Phase 6.5)
 *
 * Glue between the three previously-unwired feature modules:
 *   - shared/recorder.js      passive 30s circular-buffer video capture
 *   - shared/video-overlay.js burned-in watermark + "Solved!" outro card
 *   - shared/share.js         Web Share API + per-platform deep-link picker
 *
 * A game creates one SolveRecorder for the life of the page, calls start()
 * once the canvas is live, and calls shareSolve() from its level-complete
 * overlay's Share action. Everything is best-effort: if the browser lacks
 * MediaRecorder / canvas.captureStream the game keeps working and Share
 * simply falls back to text-only sharing.
 *
 * The recorder captures a 9:16 compositor canvas (not the raw game canvas)
 * so the watermark and outro stats card are genuinely burned into the clip.
 *
 * @module gameplay-share
 */

import * as recorder from './recorder.js';
import { createOverlayCanvas, renderFrame } from './video-overlay.js';
import { showShareOverlay, generateShareText } from './share.js';

const FPS = 30;
const OUTRO_MS = 2000; // matches video-overlay OUTRO_DURATION (60 frames @ 30fps)
const WATERMARK = 'mobile-gaming.pages.dev';

/**
 * Create a solve recorder bound to a game canvas.
 *
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.canvas   - Live game canvas (2D or WebGL).
 * @param {string}            opts.gameName - Human-readable game name.
 * @param {AudioContext}      [opts.audioContext] - Game audio context for sound capture.
 * @returns {{ start: Function, shareSolve: Function, stop: Function, isCapturing: Function, outputCanvas: HTMLCanvasElement }}
 */
export function createSolveRecorder({ canvas, gameName, audioContext = null }) {
  const { canvas: outCanvas, ctx: outCtx } = createOverlayCanvas();

  let rafId = null;
  let running = false;      // compositor loop active
  let capturing = false;    // recorder successfully started
  let phase = 'gameplay';   // 'gameplay' | 'outro'
  let outroOptions = null;
  let outroStart = 0;
  let lastDraw = 0;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    // Throttle the compositor to the capture frame rate.
    if (now - lastDraw < 1000 / FPS) return;
    lastDraw = now;

    if (phase === 'outro') {
      const progress = Math.min(1, (now - outroStart) / OUTRO_MS);
      renderFrame(outCtx, canvas, { phase: 'outro', options: outroOptions, progress }, WATERMARK);
    } else {
      renderFrame(outCtx, canvas, { phase: 'gameplay' }, WATERMARK);
    }
  }

  /**
   * Begin passive (always-on) capture. Safe to call more than once.
   */
  async function start() {
    if (capturing || running) return;
    running = true;
    rafId = requestAnimationFrame(loop);

    try {
      if (audioContext) recorder.initAudioCapture(audioContext);
      recorder.startCapture(outCanvas, { fps: FPS, passive: true, audioContext });
      // maxDuration 0 disables the auto-stop timer -> pure circular buffer.
      await recorder.startRecording({ maxDuration: 0 });
      capturing = true;
    } catch (err) {
      // Capture is an enhancement, never a hard dependency for gameplay.
      console.warn('[gameplay-share] video capture unavailable:', err?.message || err);
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      recorder.cleanup();
    }
  }

  /**
   * Finalize the clip and open the share picker.
   *
   * Stops the passive buffer, plays the burned-in outro card for OUTRO_MS,
   * converts the buffered WebM to MP4 and hands the blob to share.js. Falls
   * back to a text-only share if capture never started or finalizing fails.
   *
   * @param {Object} opts
   * @param {Object} opts.stats - { moves?, time?, score?, stars? }
   * @param {string} [opts.url] - Shareable URL (defaults to current location).
   */
  async function shareSolve({ stats = {}, url = window.location.href } = {}) {
    const text = generateShareText({
      gameName,
      moves: stats.moves,
      time: stats.time,
      stars: stats.stars,
    });

    let videoBlob = null;
    if (capturing) {
      try {
        // Burn the outro card in by letting the compositor render it while the
        // recorder is still buffering, then capture those trailing frames.
        outroOptions = { stats, qrUrl: url, gameName };
        outroStart = performance.now();
        phase = 'outro';
        await wait(OUTRO_MS + 200);

        const webm = await recorder.stopRecording();
        videoBlob = await recorder.convertToMP4(webm);
      } catch (err) {
        console.warn('[gameplay-share] finalize failed, sharing text only:', err?.message || err);
      } finally {
        teardown();
      }
    }

    await showShareOverlay({ title: gameName, text, url, videoBlob });
  }

  /**
   * Stop capture and release resources without sharing.
   */
  function stop() {
    if (running || capturing) teardown();
  }

  function teardown() {
    running = false;
    capturing = false;
    phase = 'gameplay';
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    recorder.cleanup();
  }

  function isCapturing() {
    return capturing;
  }

  return { start, shareSolve, stop, isCapturing, outputCanvas: outCanvas };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { createSolveRecorder };
