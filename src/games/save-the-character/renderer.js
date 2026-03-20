/**
 * Save the Character - Canvas Renderer
 *
 * Renders the game scene with:
 * - Character and threat visualization
 * - Choice buttons
 * - Win/lose animations
 * - Level progress
 */

import { isChoosing, isAnimating, isWon, isLost, getScenarioTitle, getThreat, getChoices } from './state.js';

// Visual constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const CHOICE_BUTTON_HEIGHT = 60;
const CHOICE_MARGIN = 12;

// Colors
const COLORS = {
  background: '#1a1a2e',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  correct: '#22c55e',
  incorrect: '#ef4444',
  button: '#2d2d44',
  buttonHover: '#3d3d54',
  buttonBorder: '#4a4a6a',
  accent: '#6366f1',
  character: '#fbbf24',
  threat: '#ef4444'
};

/**
 * Create a renderer instance
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1;
  let reducedMotion = false;
  let animationProgress = 0;
  let hoveredChoice = null;

  /**
   * Resize canvas to fit container
   */
  function resize() {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    // Calculate scale to fit
    scale = Math.min(
      containerRect.width / CANVAS_WIDTH,
      containerRect.height / CANVAS_HEIGHT,
      1
    );

    width = CANVAS_WIDTH * scale;
    height = CANVAS_HEIGHT * scale;

    // Set canvas size with device pixel ratio
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Clear the canvas
   */
  function clear() {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw the full game state
   */
  function render(state) {
    clear();

    const baseY = 60 * scale;

    // Draw scenario title
    drawTitle(getScenarioTitle(state), baseY);

    // Draw threat description
    drawThreat(getThreat(state), baseY + 80 * scale);

    // Draw character and threat visualization
    drawScene(state, baseY + 160 * scale);

    // Draw choices
    if (isChoosing(state)) {
      drawChoices(state, height - 280 * scale);
    } else if (isAnimating(state)) {
      drawAnimatingChoice(state, height - 280 * scale);
    } else if (isWon(state)) {
      drawWinResult(state, height - 280 * scale);
    } else if (isLost(state)) {
      drawLoseResult(state, height - 280 * scale);
    }
  }

  /**
   * Draw scenario title
   */
  function drawTitle(title, y) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${24 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, width / 2, y);
  }

  /**
   * Draw threat description
   */
  function drawThreat(threat, y) {
    ctx.fillStyle = COLORS.threat;
    ctx.font = `${14 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Word wrap
    const maxWidth = width - 40 * scale;
    const words = threat.split(' ');
    let line = '';
    let lineY = y;

    words.forEach(word => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), width / 2, lineY);
        line = word + ' ';
        lineY += 20 * scale;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line.trim(), width / 2, lineY);
  }

  /**
   * Draw the visual scene with character and threat
   */
  function drawScene(state, y) {
    const sceneHeight = 180 * scale;
    const centerX = width / 2;
    const centerY = y + sceneHeight / 2;

    // Draw simple character (stick figure)
    ctx.strokeStyle = COLORS.character;
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(centerX - 30 * scale, centerY - 20 * scale, 15 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(centerX - 30 * scale, centerY - 5 * scale);
    ctx.lineTo(centerX - 30 * scale, centerY + 40 * scale);
    ctx.stroke();

    // Arms (raised in distress)
    ctx.beginPath();
    ctx.moveTo(centerX - 30 * scale, centerY + 10 * scale);
    ctx.lineTo(centerX - 50 * scale, centerY - 10 * scale);
    ctx.moveTo(centerX - 30 * scale, centerY + 10 * scale);
    ctx.lineTo(centerX - 10 * scale, centerY - 15 * scale);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(centerX - 30 * scale, centerY + 40 * scale);
    ctx.lineTo(centerX - 45 * scale, centerY + 70 * scale);
    ctx.moveTo(centerX - 30 * scale, centerY + 40 * scale);
    ctx.lineTo(centerX - 15 * scale, centerY + 70 * scale);
    ctx.stroke();

    // Draw threat indicator (danger triangle)
    ctx.fillStyle = COLORS.threat;
    ctx.beginPath();
    ctx.moveTo(centerX + 40 * scale, centerY - 40 * scale);
    ctx.lineTo(centerX + 80 * scale, centerY + 30 * scale);
    ctx.lineTo(centerX, centerY + 30 * scale);
    ctx.closePath();
    ctx.fill();

    // Exclamation mark
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${30 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', centerX + 40 * scale, centerY - 5 * scale);
  }

  /**
   * Draw choice buttons
   */
  function drawChoices(state, startY) {
    const choices = getChoices(state);
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;

    choices.forEach((choice, i) => {
      const buttonY = startY + i * buttonSpacing;
      const isHovered = hoveredChoice === i;

      drawChoiceButton(choice.label, buttonWidth, buttonY, isHovered, i);
    });
  }

  /**
   * Draw a single choice button
   */
  function drawChoiceButton(label, buttonWidth, y, isHovered, index) {
    const buttonHeight = CHOICE_BUTTON_HEIGHT * scale;
    const buttonX = (width - buttonWidth) / 2;
    const radius = 12 * scale;

    // Button background
    ctx.fillStyle = isHovered ? COLORS.buttonHover : COLORS.button;
    ctx.beginPath();
    ctx.roundRect(buttonX, y, buttonWidth, buttonHeight, radius);
    ctx.fill();

    // Button border
    ctx.strokeStyle = COLORS.buttonBorder;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Button text
    ctx.fillStyle = COLORS.text;
    ctx.font = `${16 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, y + buttonHeight / 2);
  }

  /**
   * Draw animating choice (result reveal)
   */
  function drawAnimatingChoice(state, startY) {
    const choices = getChoices(state);
    const selectedChoice = state.selectedChoice;
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;

    choices.forEach((choice, i) => {
      const buttonY = startY + i * buttonSpacing;
      const isSelected = selectedChoice && selectedChoice.id === choice.id;

      // Determine color based on animation progress
      let bgColor = COLORS.button;
      let borderColor = COLORS.buttonBorder;

      if (isSelected && animationProgress > 0.3) {
        bgColor = choice.correct ? COLORS.correct : COLORS.incorrect;
        borderColor = bgColor;
      }

      const buttonHeight = CHOICE_BUTTON_HEIGHT * scale;
      const buttonX = (width - buttonWidth) / 2;
      const radius = 12 * scale;

      // Button background
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, radius);
      ctx.fill();

      // Button border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

      // Button text
      ctx.fillStyle = COLORS.text;
      ctx.font = `${16 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(choice.label, width / 2, buttonY + buttonHeight / 2);
    });
  }

  /**
   * Draw win result
   */
  function drawWinResult(state, startY) {
    ctx.fillStyle = COLORS.correct;
    ctx.font = `bold ${28 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SAVED!', width / 2, startY + 30 * scale);

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `${16 * scale}px sans-serif`;
    ctx.fillText('The character survived!', width / 2, startY + 70 * scale);
  }

  /**
   * Draw lose result
   */
  function drawLoseResult(state, startY) {
    ctx.fillStyle = COLORS.incorrect;
    ctx.font = `bold ${28 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', width / 2, startY + 30 * scale);

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `${16 * scale}px sans-serif`;
    ctx.fillText('Wrong choice! Try again.', width / 2, startY + 70 * scale);
  }

  /**
   * Set animation progress (0-1)
   */
  function setAnimationProgress(progress) {
    animationProgress = progress;
  }

  /**
   * Set hovered choice index
   */
  function setHoveredChoice(index) {
    hoveredChoice = index;
  }

  /**
   * Get choice at canvas position
   */
  function getChoiceAtPosition(canvasX, canvasY, state) {
    if (!isChoosing(state)) return null;

    const choices = getChoices(state);
    const buttonWidth = width - 40 * scale;
    const buttonSpacing = CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale;
    const startY = height - 280 * scale;

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

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  return {
    resize,
    render,
    clear,
    setAnimationProgress,
    setHoveredChoice,
    getChoiceAtPosition,
    setReducedMotion,
    get width() { return width; },
    get height() { return height; },
    get scale() { return scale; }
  };
}

export default { createRenderer };
