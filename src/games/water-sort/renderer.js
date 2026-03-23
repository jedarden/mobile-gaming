/**
 * Water Sort - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Glass refraction: vertical sheen stripe on tube body
 * - Pour stream: connecting liquid trail during pour
 * - Anticipation ease: slight pull-back before pour starts
 * - Bubble particles rising inside tubes after a pour
 * - Splash ripples at landing position
 * - Scale-pop on tube completion (elastic out)
 */

import { LIQUID_COLORS, isTubeComplete } from './state.js';

// Visual constants
const TUBE_WIDTH = 52;
const TUBE_HEIGHT = 180;
const SEGMENT_HEIGHT = 40;
const TUBE_RADIUS = 10;
const TUBE_GAP = 12;
const TUBE_BORDER = 3;
const POUR_DURATION = 480;  // slightly longer for more fluid feel

/**
 * Create a renderer instance
 *
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {Object} Renderer API
 */
// Easing with anticipation (slight pull-back before moving)
function easeAnticipate(t) {
  // Cubic with -s overshoot at start
  const s = 0.18;
  return (t * t * ((s + 1) * t - s));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let tubeScale = 1;
  let reducedMotion = false;
  let animating = false;
  let animData = null;

  // Tube completion pop state: tubeIdx → { startTime }
  const tubePops = new Map();
  // Bubble particles: { x, y, r, vy, alpha, tubeIdx }
  const bubbles = [];
  // Splash ripples: { x, y, startTime, color }
  const splashes = [];

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
   * Draw a single tube with scale-pop on completion
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

    // Scale pop when newly completed
    const pop = tubePops.get(tubeIdx);
    let popScale = 1;
    if (pop) {
      const elapsed = (performance.now() - pop.startTime) / 350;
      if (elapsed < 1) {
        popScale = 1 + 0.10 * Math.pow(2, -10 * elapsed) * Math.sin((elapsed - 0.05) * Math.PI / 0.2);
      } else {
        tubePops.delete(tubeIdx);
      }
    }

    ctx.save();
    if (popScale !== 1) {
      const cx = x + tw / 2;
      const cy = y + th / 2;
      ctx.translate(cx, cy);
      ctx.scale(popScale, popScale);
      ctx.translate(-cx, -cy);
    }

    // Gold glow for completed tubes
    if (complete) {
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowBlur = 16 * s;
    }

    // Selection highlight
    if (isSelected) {
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

    // Glass refraction sheen — vertical gradient stripe
    const sheen = ctx.createLinearGradient(x + border, y, x + border + innerW * 0.28, y);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.6, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.roundRect(x + border, y + border, innerW * 0.28, th - border * 2, r * 0.5);
    ctx.fill();

    // Right edge gloss
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + tw - border * 2, y + r, border, th - r * 2);

    // Draw liquid segments (bottom to top)
    const segments = tube.segments;
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
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowBlur = 16 * s;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.roundRect(x - 1 * s, y - 1 * s, tw + 2 * s, th + 2 * s, [r + 1 * s, r + 1 * s, r * 1.5 + 1 * s, r * 1.5 + 1 * s]);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /**
   * Update bubble particles
   */
  function updateBubbles() {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.vy;
      b.vy *= 0.995;
      b.alpha -= 0.018;
      if (b.alpha <= 0) { bubbles.splice(i, 1); }
    }
  }

  /**
   * Draw bubbles inside tube columns
   */
  function drawBubbles(state) {
    const s = tubeScale;
    for (const b of bubbles) {
      const pos = getTubePosition(b.tubeIdx, state);
      const tw = TUBE_WIDTH * s;
      // clip to tube area roughly
      ctx.save();
      ctx.globalAlpha = Math.min(b.alpha, 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(pos.x + tw / 2 + b.x, pos.y + b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Draw splash ripples at landing
   */
  function drawSplashes() {
    const t = performance.now();
    for (let i = splashes.length - 1; i >= 0; i--) {
      const sp = splashes[i];
      const elapsed = (t - sp.startTime) / 400;
      if (elapsed >= 1) { splashes.splice(i, 1); continue; }
      const r = 4 + elapsed * 18;
      const alpha = (1 - elapsed) * 0.55;
      ctx.save();
      ctx.strokeStyle = sp.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2 * tubeScale;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r * tubeScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw the full game state
   */
  function render(state) {
    updateBubbles();
    clear();

    for (let i = 0; i < state.tubes.length; i++) {
      const pos = getTubePosition(i, state);
      const isSelected = state.selectedTube === i;

      // During animation, modify tube rendering
      if (animating && animData) {
        const { fromIdx, toIdx, count } = animData;

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

    drawBubbles(state);
    drawSplashes();
  }

  /**
   * Draw the liquid blob + stream during a pour
   */
  function drawPourAnimation(state, anim) {
    const { fromIdx, toIdx, count, progress, color } = anim;
    const fromPos = getTubePosition(fromIdx, state);
    const toPos = getTubePosition(toIdx, state);
    const s = tubeScale;
    const segH = SEGMENT_HEIGHT * s;

    // Anticipation easing
    const t = progress;
    const eased = easeAnticipate(t);

    // Source tube top position
    const fromX = fromPos.x + TUBE_WIDTH * s / 2;
    const sourceTopY = fromPos.y + TUBE_HEIGHT * s - TUBE_BORDER * s -
      (state.tubes[fromIdx].segments.length) * segH;

    // Destination tube fill position
    const destSegs = state.tubes[toIdx].segments.length - count;
    const toX = toPos.x + TUBE_WIDTH * s / 2;
    const destY = toPos.y + TUBE_HEIGHT * s - TUBE_BORDER * s - (destSegs + count) * segH;

    // Arc — more pronounced (40 * sin gives a nice arc)
    const arcHeight = 30 * s * Math.sin(Math.max(0, eased) * Math.PI);
    const blobX = fromX + (toX - fromX) * Math.max(0, eased);
    const blobY = sourceTopY + (destY - sourceTopY) * Math.max(0, eased) - arcHeight;

    const liquidColor = LIQUID_COLORS[color] || '#888888';
    const blobSize = (TUBE_WIDTH * 0.6) * s;

    // Trailing stream (thin line from source to blob)
    if (progress > 0.05 && progress < 0.85) {
      ctx.save();
      ctx.strokeStyle = liquidColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = blobSize * 0.35;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fromX, sourceTopY);
      // Quadratic curve arcing toward blob
      ctx.quadraticCurveTo(
        fromX + (blobX - fromX) * 0.3,
        sourceTopY - arcHeight * 0.5,
        blobX, blobY
      );
      ctx.stroke();
      ctx.restore();
    }

    // Main blob
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = liquidColor;
    ctx.beginPath();
    // Slightly elongated in direction of travel
    const angle = Math.atan2(destY - sourceTopY, toX - fromX);
    ctx.ellipse(blobX, blobY, blobSize / 2, blobSize / 2.5, angle, 0, Math.PI * 2);
    ctx.fill();

    // Blob shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(blobX - blobSize * 0.12, blobY - blobSize * 0.1, blobSize * 0.22, blobSize * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /**
   * Animate a pour operation — includes bubbles and splash on landing
   */
  function animatePour(fromIdx, toIdx, count, color, state) {
    if (reducedMotion) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      animating = true;
      animData = { fromIdx, toIdx, count, color, progress: 0 };

      let splashSpawned = false;
      let bubblesSpawned = false;

      const startTime = performance.now();
      const s = tubeScale;

      function frame(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / POUR_DURATION, 1);
        animData.progress = progress;

        // Spawn splash at ~80% through animation
        if (progress >= 0.78 && !splashSpawned) {
          splashSpawned = true;
          const toPos = getTubePosition(toIdx, state);
          const segH = SEGMENT_HEIGHT * s;
          const destSegs = state.tubes[toIdx].segments.length - count;
          const sx = toPos.x + TUBE_WIDTH * s / 2;
          const sy = toPos.y + TUBE_HEIGHT * s - TUBE_BORDER * s - (destSegs + count) * segH;
          const liquidColor = LIQUID_COLORS[color] || '#888';
          splashes.push({ x: sx, y: sy, startTime: time, color: liquidColor });
          splashes.push({ x: sx, y: sy + 5 * s, startTime: time + 60, color: liquidColor });
        }

        // Spawn bubbles rising in destination tube after landing
        if (progress >= 0.85 && !bubblesSpawned) {
          bubblesSpawned = true;
          const th = TUBE_HEIGHT * s;
          const tw = TUBE_WIDTH * s;
          for (let i = 0; i < 5; i++) {
            bubbles.push({
              tubeIdx: toIdx,
              x: (Math.random() - 0.5) * (tw * 0.5),
              y: th * 0.6 + Math.random() * th * 0.3,
              r: (1 + Math.random() * 2) * s,
              vy: (0.6 + Math.random() * 0.8) * s,
              alpha: 0.6 + Math.random() * 0.3
            });
          }
        }

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
   * Trigger a tube completion pop (called from game.js after pour resolves)
   */
  function triggerTubePop(tubeIdx) {
    tubePops.set(tubeIdx, { startTime: performance.now() });
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
    triggerTubePop,
    setReducedMotion,
    isAnimating,
    get tubeScale() { return tubeScale; }
  };
}

export default { createRenderer };
