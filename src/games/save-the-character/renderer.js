/**
 * Save the Character - Canvas Renderer (polished)
 *
 * Visual improvements:
 * - Parchment/sketch background with hand-drawn feel
 * - Character with animated expressions (fear, relief, distress)
 * - Sketchy wobble strokes for character and scene elements
 * - Tactile buttons with press-down scale, bounce, color flash
 * - Win sparkle / lose shake particle burst
 * - Warm color palette for saved state, muted for danger state
 */

import { isChoosing, isAnimating, isWon, isLost, getScenarioTitle, getThreat, getChoices } from './state.js';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const CHOICE_BUTTON_HEIGHT = 60;
const CHOICE_MARGIN = 12;

const SKETCH_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";

const COLORS = {
  parchment:    '#fdf6e3',
  parchmentDark:'#f5ead0',
  pencil:       '#3a2e22',
  pencilLight:  '#7a6a55',
  correct:      '#22c55e',
  incorrect:    '#ef4444',
  buttonBase:   '#fff8ea',
  buttonBorder: '#c8a96b',
  accent:       '#6366f1',
  character:    '#e07b39',
  threat:       '#d94f3b',
  sky:          '#b8d4f0',
  ground:       '#8fba6e'
};

function wobble(seed, amp = 1.5) {
  return (Math.sin(seed * 127.1 + 311.7) * amp);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1;
  let reducedMotion = false;
  let animationProgress = 0;
  let hoveredChoice = null;

  // Button press state: { index, startTime }
  let pressedChoice = null;

  // Particles for win/lose
  const particles = [];
  let rafId = null;
  let lastState = null;

  function now() { return performance.now(); }

  // ── Animation loop ──────────────────────────────────────────────────────────
  function startLoop() {
    if (rafId) return;
    function tick() {
      updateParticles();
      if (lastState) renderFrame(lastState);
      if (particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.vx *= 0.94;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function spawnWinBurst() {
    if (reducedMotion) return;
    const cx = width / 2;
    const cy = height * 0.4;
    const colors = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FFE66D', '#FF8C69'];
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx + (Math.random() - 0.5) * 60 * scale,
        y: cy + (Math.random() - 0.5) * 40 * scale,
        vx: Math.cos(angle) * speed * scale,
        vy: Math.sin(angle) * speed * scale - 2 * scale,
        life: 0.8 + Math.random() * 0.4,
        decay: 0.022 + Math.random() * 0.01,
        r: (2 + Math.random() * 3) * scale,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    startLoop();
  }

  function spawnLoseBurst() {
    if (reducedMotion) return;
    const cx = width / 2;
    const cy = height * 0.4;
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed * scale,
        vy: Math.sin(angle) * speed * scale,
        life: 0.6 + Math.random() * 0.3,
        decay: 0.03,
        r: (2 + Math.random() * 2) * scale,
        color: '#ef4444'
      });
    }
    startLoop();
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    scale = Math.min(
      containerRect.width / CANVAS_WIDTH,
      containerRect.height / CANVAS_HEIGHT,
      1
    );

    width = CANVAS_WIDTH * scale;
    height = CANVAS_HEIGHT * scale;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
  }

  // ── Background ─────────────────────────────────────────────────────────────
  function drawBackground(state) {
    const isGood = isWon(state);
    const isBad = isLost(state);

    // Sky: warm/cool based on outcome
    const skyTop = isGood ? '#ffe4b5' : isBad ? '#4a2020' : '#c8dff0';
    const skyBot = isGood ? '#fff9e6' : isBad ? '#2a1010' : '#e8f0fa';
    const bg = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    bg.addColorStop(0, skyTop);
    bg.addColorStop(1, skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Ground strip
    ctx.fillStyle = isGood ? '#7ac46a' : isBad ? '#4a3020' : COLORS.ground;
    ctx.fillRect(0, height * 0.62, width, height * 0.38);

    // Ground line (sketchy)
    sketchLine(0, height * 0.62, width, height * 0.62, 1.5 * scale, COLORS.pencilLight);

    // Parchment overlay at bottom for UI area
    const paperGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
    paperGrad.addColorStop(0, 'rgba(253,246,227,0)');
    paperGrad.addColorStop(0.3, 'rgba(253,246,227,0.92)');
    paperGrad.addColorStop(1, COLORS.parchment);
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);
  }

  // ── Sketchy line helper ────────────────────────────────────────────────────
  function sketchLine(x1, y1, x2, y2, lineWidth, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Slightly wobbly midpoint
    const mx = (x1 + x2) / 2 + wobble((x1 + y1) * 0.01) * scale;
    const my = (y1 + y2) / 2 + wobble((x2 + y2) * 0.01) * scale;
    ctx.moveTo(x1 + wobble(x1 * 0.1) * 0.5, y1 + wobble(y1 * 0.1) * 0.5);
    ctx.quadraticCurveTo(mx, my, x2 + wobble(x2 * 0.07) * 0.5, y2 + wobble(y2 * 0.07) * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // ── Character ──────────────────────────────────────────────────────────────
  function drawCharacter(state) {
    const cx = width * 0.38;
    const groundY = height * 0.60;
    const s = scale;

    const expression = isWon(state) ? 'happy'
      : isLost(state) ? 'shocked'
      : (isAnimating(state) && state.selectedChoice && !state.selectedChoice.correct) ? 'scared'
      : 'worried';

    ctx.save();
    ctx.strokeStyle = COLORS.character;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';

    // Legs
    sketchLine(cx, groundY - 5 * s, cx - 14 * s, groundY + 5 * s, 2.5 * s, COLORS.character);
    sketchLine(cx, groundY - 5 * s, cx + 14 * s, groundY + 5 * s, 2.5 * s, COLORS.character);

    // Body
    sketchLine(cx, groundY - 35 * s, cx, groundY - 5 * s, 3 * s, COLORS.character);

    // Arms based on expression
    if (expression === 'happy') {
      // Arms up in celebration
      sketchLine(cx, groundY - 28 * s, cx - 22 * s, groundY - 48 * s, 2.5 * s, COLORS.character);
      sketchLine(cx, groundY - 28 * s, cx + 22 * s, groundY - 48 * s, 2.5 * s, COLORS.character);
    } else if (expression === 'shocked') {
      // Arms straight out in shock
      sketchLine(cx, groundY - 28 * s, cx - 26 * s, groundY - 20 * s, 2.5 * s, COLORS.character);
      sketchLine(cx, groundY - 28 * s, cx + 26 * s, groundY - 20 * s, 2.5 * s, COLORS.character);
    } else {
      // Arms raised in worry/fear
      sketchLine(cx, groundY - 28 * s, cx - 20 * s, groundY - 42 * s, 2.5 * s, COLORS.character);
      sketchLine(cx, groundY - 28 * s, cx + 18 * s, groundY - 46 * s, 2.5 * s, COLORS.character);
    }

    // Head
    ctx.beginPath();
    ctx.arc(cx, groundY - 50 * s, 15 * s, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.character;
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    // Face fill
    ctx.fillStyle = '#f9d094';
    ctx.fill();

    // Expression elements
    drawFace(ctx, cx, groundY - 50 * s, s, expression);

    ctx.restore();
  }

  function drawFace(ctx, cx, cy, s, expression) {
    ctx.save();
    ctx.fillStyle = COLORS.pencil;

    // Eyes
    if (expression === 'happy') {
      // Happy arcs
      ctx.strokeStyle = COLORS.pencil;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(cx - 5 * s, cy - 2 * s, 3.5 * s, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 5 * s, cy - 2 * s, 3.5 * s, Math.PI, 0);
      ctx.stroke();
    } else if (expression === 'shocked') {
      // Wide O eyes
      ctx.beginPath();
      ctx.arc(cx - 5 * s, cy - 1 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5 * s, cy - 1 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Small worried dots
      ctx.beginPath();
      ctx.arc(cx - 5 * s, cy - 1 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5 * s, cy - 1 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = COLORS.pencil;
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    if (expression === 'happy') {
      ctx.beginPath();
      ctx.arc(cx, cy + 4 * s, 5 * s, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else if (expression === 'shocked') {
      ctx.beginPath();
      ctx.arc(cx, cy + 5 * s, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Worried frown
      ctx.beginPath();
      ctx.arc(cx, cy + 9 * s, 5 * s, Math.PI + 0.2, -0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Threat visualization ───────────────────────────────────────────────────
  function drawThreatVisual(state) {
    if (isWon(state)) return;

    const threatX = width * 0.70;
    const groundY = height * 0.60;
    const s = scale;

    // Pulsing danger triangle (sketch style)
    const pulse = isLost(state) ? 0 : 0.5 + Math.sin(now() * 0.005) * 0.5;
    const triSize = (30 + pulse * 6) * s;

    ctx.save();
    ctx.strokeStyle = COLORS.threat;
    ctx.fillStyle = `rgba(217,79,59,${0.15 + pulse * 0.1})`;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Sketchy triangle
    const tx = threatX, ty = groundY - 55 * s;
    ctx.beginPath();
    ctx.moveTo(tx + wobble(1) * s, ty - triSize * 0.6);
    ctx.lineTo(tx + triSize * 0.65 + wobble(2) * s, ty + triSize * 0.4);
    ctx.lineTo(tx - triSize * 0.65 + wobble(3) * s, ty + triSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Exclamation mark
    ctx.fillStyle = COLORS.threat;
    ctx.font = `bold ${18 * s}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', tx, ty + 2 * s);

    ctx.restore();
  }

  // ── Title and text ─────────────────────────────────────────────────────────
  function drawTitle(title, y) {
    ctx.save();
    ctx.fillStyle = COLORS.pencil;
    ctx.font = `bold ${22 * scale}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, width / 2, y);
    ctx.restore();
  }

  function drawThreatText(threat, y) {
    ctx.save();
    ctx.fillStyle = COLORS.threat;
    ctx.font = `${13 * scale}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxWidth = width - 40 * scale;
    const words = threat.split(' ');
    let line = '';
    let lineY = y;

    words.forEach(word => {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), width / 2, lineY);
        line = word + ' ';
        lineY += 18 * scale;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line.trim(), width / 2, lineY);
    ctx.restore();
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  function getButtonPressScale(index) {
    if (!pressedChoice || pressedChoice.index !== index) return 1;
    const elapsed = (now() - pressedChoice.startTime) / 200;
    if (elapsed >= 1) return 1;
    // Quick dip to 0.92 then bounce back
    const t = elapsed < 0.5 ? elapsed * 2 : 2 - elapsed * 2;
    return 1 - 0.08 * Math.sin(t * Math.PI);
  }

  function drawChoices(state, startY) {
    const choices = getChoices(state);
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;

    choices.forEach((choice, i) => {
      const buttonY = startY + i * buttonSpacing;
      const isHovered = hoveredChoice === i;
      const pressScale = getButtonPressScale(i);
      drawChoiceButton(choice.label, buttonWidth, buttonY, isHovered, false, null, pressScale);
    });
  }

  function drawChoiceButton(label, buttonWidth, y, isHovered, isSelected, correct, pressScale = 1) {
    const buttonHeight = CHOICE_BUTTON_HEIGHT * scale;
    const buttonX = (width - buttonWidth) / 2;
    const radius = 10 * scale;
    const cx = buttonX + buttonWidth / 2;
    const cy = y + buttonHeight / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pressScale, pressScale);
    ctx.translate(-cx, -cy);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = isHovered ? 8 : 4;
    ctx.shadowOffsetY = isHovered ? 3 : 1;

    // Fill
    let fillColor = COLORS.buttonBase;
    if (isSelected && correct === true) fillColor = '#d4f7d4';
    else if (isSelected && correct === false) fillColor = '#fdd4d4';
    else if (isHovered) fillColor = '#fff3d0';

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(buttonX, y, buttonWidth, buttonHeight, radius);
    ctx.fill();

    // Border (sketchy style — slightly thick)
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = isSelected
      ? (correct ? COLORS.correct : COLORS.incorrect)
      : isHovered ? '#b8a060' : COLORS.buttonBorder;
    ctx.lineWidth = (isSelected || isHovered) ? 2.5 * scale : 1.5 * scale;
    ctx.stroke();

    // Label
    ctx.fillStyle = COLORS.pencil;
    ctx.font = `${15 * scale}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);

    ctx.restore();
  }

  function drawAnimatingChoice(state, startY) {
    const choices = getChoices(state);
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;

    choices.forEach((choice, i) => {
      const buttonY = startY + i * buttonSpacing;
      const isSelected = state.selectedChoice && state.selectedChoice.id === choice.id;
      const revealed = animationProgress > 0.3;
      drawChoiceButton(
        choice.label, buttonWidth, buttonY, false,
        isSelected && revealed, isSelected ? choice.correct : null
      );
    });
  }

  // ── Win/Lose results ────────────────────────────────────────────────────────
  function drawWinResult(state, startY) {
    ctx.save();
    ctx.fillStyle = '#22a84a';
    ctx.font = `bold ${28 * scale}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,200,80,0.3)';
    ctx.shadowBlur = 12;
    ctx.fillText('✓ SAVED!', width / 2, startY + 30 * scale);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.pencilLight;
    ctx.font = `${15 * scale}px ${SKETCH_FONT}`;
    ctx.fillText('The character survived!', width / 2, startY + 66 * scale);
    ctx.restore();
  }

  function drawLoseResult(state, startY) {
    ctx.save();
    ctx.fillStyle = COLORS.incorrect;
    ctx.font = `bold ${26 * scale}px ${SKETCH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✗ GAME OVER', width / 2, startY + 30 * scale);
    ctx.fillStyle = COLORS.pencilLight;
    ctx.font = `${14 * scale}px ${SKETCH_FONT}`;
    ctx.fillText('Wrong choice! Try again.', width / 2, startY + 66 * scale);
    ctx.restore();
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function renderFrame(state) {
    drawBackground(state);

    const baseY = 30 * scale;
    drawTitle(getScenarioTitle(state), baseY);
    drawThreatText(getThreat(state), baseY + 55 * scale);

    drawCharacter(state);
    drawThreatVisual(state);

    const choiceStartY = height - 260 * scale;

    if (isChoosing(state)) {
      drawChoices(state, choiceStartY);
    } else if (isAnimating(state)) {
      drawAnimatingChoice(state, choiceStartY);
    } else if (isWon(state)) {
      drawWinResult(state, choiceStartY);
    } else if (isLost(state)) {
      drawLoseResult(state, choiceStartY);
    }

    drawParticles();
  }

  function render(state) {
    lastState = state;
    renderFrame(state);
  }

  function clear() {
    ctx.fillStyle = COLORS.parchment;
    ctx.fillRect(0, 0, width, height);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function setAnimationProgress(progress) {
    animationProgress = progress;
  }

  function setHoveredChoice(index) {
    hoveredChoice = index;
  }

  function setPressedChoice(index) {
    pressedChoice = index !== null ? { index, startTime: now() } : null;
  }

  function triggerWinEffect() {
    spawnWinBurst();
  }

  function triggerLoseEffect() {
    spawnLoseBurst();
  }

  function getChoiceAtPosition(canvasX, canvasY, state) {
    if (!isChoosing(state)) return null;

    const choices = getChoices(state);
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;
    const startY = height - 260 * scale;

    for (let i = 0; i < choices.length; i++) {
      const buttonY = startY + i * buttonSpacing;
      const buttonX = (width - buttonWidth) / 2;
      const buttonHeight = CHOICE_BUTTON_HEIGHT * scale;

      if (
        canvasX >= buttonX &&
        canvasX <= buttonX + buttonWidth &&
        canvasY >= buttonY &&
        canvasY <= buttonY + buttonHeight
      ) {
        return i;
      }
    }
    return null;
  }

  function setReducedMotion(value) {
    reducedMotion = value;
  }

  return {
    resize,
    render,
    clear,
    setAnimationProgress,
    setHoveredChoice,
    setPressedChoice,
    getChoiceAtPosition,
    setReducedMotion,
    triggerWinEffect,
    triggerLoseEffect,
    get width() { return width; },
    get height() { return height; },
    get scale() { return scale; }
  };
}

export default { createRenderer };
