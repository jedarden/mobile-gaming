/**
 * Water Sort - Canvas Renderer
 *
 * Renders the game board with:
 * - Tubes as rounded-bottom glass rectangles
 * - Colored liquid segments inside tubes
 * - Pour animation (400ms cubic-bezier)
 * - Gold glow on completed pure-color tubes
 * - Selection highlight
 */

import { LIQUID_COLORS, isTubeComplete } from './state.js';

// Visual constants
const TUBE_WIDTH = 52;
const TUBE_HEIGHT = 180;
const SEGMENT_HEIGHT = 40;
const TUBE_RADIUS = 10;
const TUBE_GAP = 12;
const TUBE_BORDER = 3;
const POUR_DURATION = 400;

/**
 * Create a renderer instance
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} Renderer API
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let tubeScale = 1;
  let reducedMotion = false;
  let animating = false;
  let animData = null;

  /**
   * Resize canvas to fit container with proper tube layout
   */
  function resize(state) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const tubeCount = state.tubes.length;

    // Calculate tube layout
    const tubesPerRow = Math.min(tubeCount, 7);
    const rows = Math.ceil(tubeCount / tubesPerRow);

    const padding = 16;
    const availWidth = containerRect.width - padding * 2;
    const availHeight = containerRect.height - padding * 2;

    // Scale tubes to fit
    const totalTubeWidth = tubesPerRow * TUBE_WIDTH + (tubesPerRow - 1) * TUBE_GAP;
    const totalTubeHeight = rows * (TUBE_HEIGHT + TUBE_GAP);

    const scaleX = availWidth / totalTubeWidth;
    const scaleY = availHeight / totalTubeHeight;
    tubeScale = Math.min(scaleX, scaleY, 1.2);

    width = totalTubeWidth * tubeScale + padding * 2;
    height = totalTubeHeight * tubeScale + padding * 2;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Get tube position on canvas
   */
  function getTubePosition(index, state) {
    const tubeCount = state.tubes.length;
    const tubesPerRow = Math.min(tubeCount, 7);
    const col = index % tubesPerRow;
    const row = Math.floor(index / tubesPerRow);
    const tubesInRow = Math.min(tubesPerRow, tubeCount - row * tubesPerRow);

    const totalRowWidth = tubesInRow * TUBE_WIDTH + (tubesInRow - 1) * TUBE_GAP;
    const startX = (width - totalRowWidth * tubeScale) / 2;

    return {
      x: startX + col * (TUBE_WIDTH + TUBE_GAP) * tubeScale,
      y: 16 + row * (TUBE_HEIGHT + TUBE_GAP) * tubeScale
    };
  }

  /**
   * Convert canvas coordinates to tube index
   */
  function canvasToTubeIndex(canvasX, canvasY, state) {
    for (let i = 0; i < state.tubes.length; i++) {
      const pos = getTubePosition(i, state);
      const tw = TUBE_WIDTH * tubeScale;
      const th = TUBE_HEIGHT * tubeScale;

      if (canvasX >= pos.x && canvasX <= pos.x + tw &&
          canvasY >= pos.y && canvasY <= pos.y + th) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Clear the canvas
   */
  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  /**
   * Draw a single tube
   */
  function drawTube(x, y, tube, state, tubeIdx, isSelected) {
    const s = tubeScale;
    const tw = TUBE_WIDTH * s;
    const th = TUBE_HEIGHT * s;
    const r = TUBE_RADIUS * s;
    const border = TUBE_BORDER * s;
    const segH = SEGMENT_HEIGHT * s;
    const innerW = tw - border * 2;
    const innerX = x + border;

    const complete = isTubeComplete(state, tubeIdx);

    // Gold glow for completed tubes
    if (complete) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowBlur = 16 * s;
    }

    // Selection highlight
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = 'rgba(99, 102, 241, 0.7)';
      ctx.shadowBlur = 14 * s;
    }

    // Tube background (glass)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, [r, r, r * 1.5, r * 1.5]);
    ctx.fill();

    // Tube border (glass effect)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = border;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, [r, r, r * 1.5, r * 1.5]);
    ctx.stroke();

    // Glass shine effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(x + border, y + border, innerW * 0.35, th - border * 2, r * 0.5);
    ctx.fill();

    if (complete) ctx.restore();
    if (isSelected) ctx.restore();

    // Draw liquid segments (bottom to top)
    const segments = tube.segments;
    const maxSegs = state.maxSegments;
    for (let i = 0; i < segments.length; i++) {
      const segIdx = segments.length - 1 - i; // draw from top visually
      const color = segments[segIdx];
      const liquidColor = LIQUID_COLORS[color] || '#888888';

      const liquidX = innerX + 2 * s;
      const liquidW = innerW - 4 * s;
      const liquidY = y + th - border - (i + 1) * segH;
      const liquidH = segH - 2 * s;

      // Liquid fill
      ctx.fillStyle = liquidColor;
      ctx.beginPath();
      ctx.roundRect(liquidX, liquidY, liquidW, liquidH, 4 * s);
      ctx.fill();

      // Liquid shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(liquidX + 2 * s, liquidY + 2 * s, liquidW * 0.3, liquidH - 4 * s, 3 * s);
      ctx.fill();

      // Segment separator line
      if (i > 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(liquidX, liquidY + liquidH);
        ctx.lineTo(liquidX + liquidW, liquidY + liquidH);
        ctx.stroke();
      }
    }

    // Gold ring on completed tube
    if (complete) {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.roundRect(x - 1 * s, y - 1 * s, tw + 2 * s, th + 2 * s, [r + 1 * s, r + 1 * s, r * 1.5 + 1 * s, r * 1.5 + 1 * s]);
      ctx.stroke();
    }
  }

  /**
   * Draw the full game state
   */
  function render(state) {
    clear();

    for (let i = 0; i < state.tubes.length; i++) {
      const pos = getTubePosition(i, state);
      const isSelected = state.selectedTube === i;

      // During animation, modify tube rendering
      if (animating && animData) {
        const { fromIdx, toIdx, count, progress } = animData;

        if (i === fromIdx) {
          // Draw source tube with fewer segments during animation
          const modifiedTube = {
            ...state.tubes[i],
            segments: state.tubes[i].segments.slice(0, -count)
          };
          drawTube(pos.x, pos.y, modifiedTube, state, i, false);
          continue;
        }

        if (i === toIdx) {
          // Draw destination tube with extra segments appearing
          const baseSegments = state.tubes[toIdx].segments;
          // The poured segments are already in the destination for the final state
          // During animation we show the pre-pour state
          const prePourSegments = baseSegments.slice(0, baseSegments.length - count);
          const modifiedTube = {
            ...state.tubes[i],
            segments: prePourSegments
          };
          drawTube(pos.x, pos.y, modifiedTube, state, i, false);
          continue;
        }
      }

      drawTube(pos.x, pos.y, state.tubes[i], state, i, isSelected);
    }

    // Draw animated liquid blob during pour
    if (animating && animData) {
      drawPourAnimation(state, animData);
    }
  }

  /**
   * Draw the liquid blob animation during a pour
   */
  function drawPourAnimation(state, anim) {
    const { fromIdx, toIdx, count, progress, color } = anim;
    const fromPos = getTubePosition(fromIdx, state);
    const toPos = getTubePosition(toIdx, state);
    const s = tubeScale;
    const segH = SEGMENT_HEIGHT * s;

    // Cubic-bezier easing
    const t = progress;
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Source tube top position
    const fromX = fromPos.x + TUBE_WIDTH * s / 2;
    const sourceTopY = fromPos.y + TUBE_HEIGHT * s - TUBE_BORDER * s -
      (state.tubes[fromIdx].segments.length) * segH;

    // Destination tube fill position
    const destSegs = state.tubes[toIdx].segments.length - count;
    const toX = toPos.x + TUBE_WIDTH * s / 2;
    const destY = toPos.y + TUBE_HEIGHT * s - TUBE_BORDER * s - (destSegs + count) * segH;

    // Interpolate blob position
    const blobX = fromX + (toX - fromX) * eased;
    const blobY = sourceTopY + (destY - sourceTopY) * eased - 20 * s * Math.sin(eased * Math.PI);

    // Draw blob
    const liquidColor = LIQUID_COLORS[color] || '#888888';
    const blobSize = (TUBE_WIDTH * 0.6) * s;

    ctx.fillStyle = liquidColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(blobX, blobY, blobSize / 2, blobSize / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Blob shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(blobX - blobSize * 0.1, blobY - blobSize * 0.08, blobSize * 0.2, blobSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /**
   * Animate a pour operation
   */
  function animatePour(fromIdx, toIdx, count, color, state) {
    if (reducedMotion) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      animating = true;
      animData = { fromIdx, toIdx, count, color, progress: 0 };

      const startTime = performance.now();

      function frame(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / POUR_DURATION, 1);

        animData.progress = progress;
        render(state);

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          animating = false;
          animData = null;
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  /**
   * Check if currently animating
   */
  function isAnimating() {
    return animating;
  }

  return {
    resize,
    render,
    clear,
    canvasToTubeIndex,
    animatePour,
    setReducedMotion,
    isAnimating,
    get tubeScale() { return tubeScale; }
  };
}

export default { createRenderer };
