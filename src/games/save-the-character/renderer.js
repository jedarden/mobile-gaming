/**
 * Save the Character - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3:
 * - Character with animated expressions (fear, relief, distress)
 * - Sketchy wobble strokes for character and scene elements
 * - Tactile buttons with press-down scale, bounce, color flash
 * - Win sparkle / lose shake particle burst
 * - Warm color palette for saved state, muted for danger state
 */

import Phaser from 'phaser';
import { isChoosing, isAnimating, isWon, isLost, getScenarioTitle, getThreat, getChoices } from './state.js';

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
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

// Pure layout functions (exported for input.js hit-testing)
export function calculateLayout(width, height, scale) {
  return {
    buttonWidth: width - 40 * scale,
    buttonHeight: CHOICE_BUTTON_HEIGHT * scale,
    buttonSpacing: CHOICE_BUTTON_HEIGHT * scale + CHOICE_MARGIN * scale,
    choiceStartY: height - 260 * scale,
    groundY: height * 0.60,
    characterX: width * 0.38,
    threatX: width * 0.70
  };
}

export function getChoiceAtPosition(canvasX, canvasY, state, width, height, scale) {
  if (!isChoosing(state)) return null;

  const choices = getChoices(state);
  const layout = calculateLayout(width, height, scale);
  const buttonX = (width - layout.buttonWidth) / 2;

  for (let i = 0; i < choices.length; i++) {
    const buttonY = layout.choiceStartY + i * layout.buttonSpacing;

    if (
      canvasX >= buttonX &&
      canvasX <= buttonX + layout.buttonWidth &&
      canvasY >= buttonY &&
      canvasY <= buttonY + layout.buttonHeight
    ) {
      return i;
    }
  }
  return null;
}

function wobble(seed, amp = 1.5) {
  return (Math.sin(seed * 127.1 + 311.7) * amp);
}

/**
 * Save the Character Phaser Scene
 */
class SaveTheCharacterScene extends Phaser.Scene {
  constructor() {
    super('SaveTheCharacterScene');
  }

  init(data) {
    this.state = data.state;
    this.callbacks = data.callbacks || {};
    this.animationProgress = 0;
    this.hoveredChoice = null;
    this.pressedChoice = null;
    this.reducedMotion = data.reducedMotion || false;
  }

  create() {
    // Scale dimensions
    this.scaleWidth = this.scale.width;
    this.scaleHeight = this.scale.height;
    this.gameScale = Math.min(this.scaleWidth / CANVAS_WIDTH, this.scaleHeight / CANVAS_HEIGHT, 1);

    // Graphics layers
    this.backgroundGraphics = this.add.graphics();
    this.characterGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();

    // Container for choice buttons (for easy interaction)
    this.choiceContainer = this.add.container(0, 0);

    // Text objects
    this.titleText = this.add.text(this.scaleWidth / 2, 30 * this.gameScale, '', {
      fontFamily: SKETCH_FONT,
      fontSize: `${22 * this.gameScale}px`,
      fontStyle: 'bold',
      color: COLORS.pencil
    }).setOrigin(0.5, 0);

    this.threatText = this.add.text(this.scaleWidth / 2, 55 * this.gameScale + 30 * this.gameScale, '', {
      fontFamily: SKETCH_FONT,
      fontSize: `${13 * this.gameScale}px`,
      color: COLORS.threat,
      wordWrap: { width: this.scaleWidth - 40 * this.gameScale },
      align: 'center'
    }).setOrigin(0.5, 0);

    this.resultText = this.add.text(this.scaleWidth / 2, this.scaleHeight - 260 * this.gameScale + 30 * this.gameScale, '', {
      fontFamily: SKETCH_FONT,
      fontSize: `${28 * this.gameScale}px`,
      fontStyle: 'bold',
      color: COLORS.correct
    }).setOrigin(0.5, 0.5);

    // Particle emitter for effects
    this.createParticleEmitter();

    // Input handling
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);

    // Animation state
    this.threatPulseTime = 0;

    // Initial render
    this.renderState();
  }

  createParticleEmitter() {
    // Create particle texture dynamically
    const particleKey = 'particle';
    if (!this.textures.exists(particleKey)) {
      const graphics = this.make.graphics({ add: false });
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture(particleKey, 8, 8);
      graphics.destroy();
    }

    // Win particles (confetti)
    this.winEmitter = this.add.particles(0, 0, particleKey, {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0.1 },
      lifespan: 1500,
      gravityY: 150,
      quantity: 0,
      emitting: false,
      tint: [0xFFD700, 0xFF69B4, 0x00FFFF, 0xADFF2F, 0xFFE66D, 0xFF8C69]
    });

    // Lose particles (red burst)
    this.loseEmitter = this.add.particles(0, 0, particleKey, {
      speed: { min: 80, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 },
      lifespan: 1000,
      gravityY: 50,
      quantity: 0,
      emitting: false,
      tint: 0xef4444
    });
  }

  update(time, delta) {
    this.threatPulseTime = time;

    // Handle animation progress
    if (isAnimating(this.state) && this.animationStartTime) {
      const elapsed = time - this.animationStartTime;
      this.animationProgress = Math.min(elapsed / 800, 1);
      this.renderState();

      if (this.animationProgress >= 1 && this.callbacks.onAnimationComplete) {
        this.callbacks.onAnimationComplete();
      }
    }

    // Always update visuals during choosing (threat pulse)
    if (isChoosing(this.state)) {
      this.renderState();
    }
  }

  setState(state) {
    this.state = state;
    this.animationProgress = 0;
    this.animationStartTime = null;
    this.hoveredChoice = null;
    this.pressedChoice = null;
    this.renderState();
  }

  setAnimationProgress(progress) {
    this.animationProgress = progress;
    this.renderState();
  }

  setHoveredChoice(index) {
    this.hoveredChoice = index;
    this.renderState();
  }

  setPressedChoice(index) {
    this.pressedChoice = index;
    if (index !== null) {
      // Animate press
      this.time.delayedCall(200, () => {
        this.pressedChoice = null;
        this.renderState();
      });
    }
    this.renderState();
  }

  triggerWinEffect() {
    if (this.reducedMotion) return;
    this.winEmitter.setPosition(this.scaleWidth / 2, this.scaleHeight * 0.4);
    this.winEmitter.explode(50);
  }

  triggerLoseEffect() {
    if (this.reducedMotion) return;
    this.loseEmitter.setPosition(this.scaleWidth / 2, this.scaleHeight * 0.4);
    this.loseEmitter.explode(25);

    // Shake effect
    this.cameras.main.shake(200, 0.01);
  }

  startAnimation() {
    this.animationStartTime = this.time.now;
  }

  handlePointerDown(pointer) {
    if (!this.state || !isChoosing(this.state)) return;

    const choiceIndex = getChoiceAtPosition(
      pointer.x, pointer.y, this.state,
      this.scaleWidth, this.scaleHeight, this.gameScale
    );

    if (choiceIndex !== null && this.callbacks.onChoiceSelect) {
      this.setPressedChoice(choiceIndex);
      this.callbacks.onChoiceSelect(choiceIndex);
    }
  }

  handlePointerMove(pointer) {
    if (!this.state || !isChoosing(this.state)) return;

    const choiceIndex = getChoiceAtPosition(
      pointer.x, pointer.y, this.state,
      this.scaleWidth, this.scaleHeight, this.gameScale
    );

    if (choiceIndex !== this.hoveredChoice) {
      this.hoveredChoice = choiceIndex;
      if (this.callbacks.onChoiceHover) {
        this.callbacks.onChoiceHover(choiceIndex);
      }
      this.renderState();
    }
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  renderState() {
    if (!this.state) return;

    this.drawBackground();
    this.drawCharacter();
    this.drawThreatVisual();
    this.drawTexts();
    this.drawChoices();
  }

  drawBackground() {
    const g = this.backgroundGraphics;
    g.clear();

    const isGood = isWon(this.state);
    const isBad = isLost(this.state);

    // Sky gradient (Phaser doesn't have built-in gradient, so we draw rectangles)
    const skyTop = Phaser.Display.Color.HexStringToColor(isGood ? '#ffe4b5' : isBad ? '#4a2020' : '#c8dff0');
    const skyBot = Phaser.Display.Color.HexStringToColor(isGood ? '#fff9e6' : isBad ? '#2a1010' : '#e8f0fa');

    const skyHeight = this.scaleHeight * 0.65;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(skyTop, skyBot, steps, i);
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      g.fillRect(0, (skyHeight / steps) * i, this.scaleWidth, skyHeight / steps + 1);
    }

    // Ground
    const groundColor = isGood ? 0x7ac46a : isBad ? 0x4a3020 : Phaser.Display.Color.HexStringToColor(COLORS.ground).color;
    g.fillStyle(groundColor);
    g.fillRect(0, this.scaleHeight * 0.62, this.scaleWidth, this.scaleHeight * 0.38);

    // Ground line (sketchy)
    this.drawSketchLine(0, this.scaleHeight * 0.62, this.scaleWidth, this.scaleHeight * 0.62, 1.5 * this.gameScale, COLORS.pencilLight);

    // Parchment overlay at bottom
    for (let i = 0; i < steps; i++) {
      const y = this.scaleHeight * 0.55 + (this.scaleHeight * 0.45 / steps) * i;
      const alpha = i / steps;
      const alphaHex = Math.floor(alpha * 0.92 * 255).toString(16).padStart(2, '0');
      const color = Phaser.Display.Color.HexStringToColor(COLORS.parchment + alphaHex);
      g.fillStyle(color.color, alpha * 0.92);
      g.fillRect(0, y, this.scaleWidth, this.scaleHeight * 0.45 / steps + 1);
    }
  }

  drawSketchLine(x1, y1, x2, y2, lineWidth, color) {
    const g = this.backgroundGraphics;
    g.lineStyle(lineWidth, Phaser.Display.Color.HexStringToColor(color).color);

    const mx = (x1 + x2) / 2 + wobble((x1 + y1) * 0.01) * this.gameScale;
    const my = (y1 + y2) / 2 + wobble((x2 + y2) * 0.01) * this.gameScale;

    g.beginPath();
    g.moveTo(x1 + wobble(x1 * 0.1) * 0.5, y1 + wobble(y1 * 0.1) * 0.5);
    g.lineTo(mx, my);
    g.lineTo(x2 + wobble(x2 * 0.07) * 0.5, y2 + wobble(y2 * 0.07) * 0.5);
    g.strokePath();
  }

  drawCharacter() {
    const g = this.characterGraphics;
    g.clear();

    const s = this.gameScale;
    const layout = calculateLayout(this.scaleWidth, this.scaleHeight, s);
    const cx = layout.characterX;
    const groundY = layout.groundY;

    const expression = isWon(this.state) ? 'happy'
      : isLost(this.state) ? 'shocked'
      : (isAnimating(this.state) && this.state.selectedChoice && !this.state.selectedChoice.correct) ? 'scared'
      : 'worried';

    const color = Phaser.Display.Color.HexStringToColor(COLORS.character).color;
    g.lineStyle(3 * s, color);
    g.fillStyle(0xf9d094);

    // Legs
    this.drawCharacterLine(g, cx, groundY - 5 * s, cx - 14 * s, groundY + 5 * s, 2.5 * s, color);
    this.drawCharacterLine(g, cx, groundY - 5 * s, cx + 14 * s, groundY + 5 * s, 2.5 * s, color);

    // Body
    this.drawCharacterLine(g, cx, groundY - 35 * s, cx, groundY - 5 * s, 3 * s, color);

    // Arms based on expression
    if (expression === 'happy') {
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx - 22 * s, groundY - 48 * s, 2.5 * s, color);
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx + 22 * s, groundY - 48 * s, 2.5 * s, color);
    } else if (expression === 'shocked') {
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx - 26 * s, groundY - 20 * s, 2.5 * s, color);
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx + 26 * s, groundY - 20 * s, 2.5 * s, color);
    } else {
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx - 20 * s, groundY - 42 * s, 2.5 * s, color);
      this.drawCharacterLine(g, cx, groundY - 28 * s, cx + 18 * s, groundY - 46 * s, 2.5 * s, color);
    }

    // Head
    g.lineStyle(2.5 * s, color);
    g.fillStyle(0xf9d094);
    g.fillCircle(cx, groundY - 50 * s, 15 * s);
    g.strokeCircle(cx, groundY - 50 * s, 15 * s);

    // Face
    this.drawFace(g, cx, groundY - 50 * s, s, expression);
  }

  drawCharacterLine(g, x1, y1, x2, y2, lineWidth, color) {
    g.lineStyle(lineWidth, color);
    g.beginPath();
    g.moveTo(x1 + wobble(x1 * 0.05) * this.gameScale * 0.3, y1 + wobble(y1 * 0.05) * this.gameScale * 0.3);
    g.lineTo(x2 + wobble(x2 * 0.05) * this.gameScale * 0.3, y2 + wobble(y2 * 0.05) * this.gameScale * 0.3);
    g.strokePath();
  }

  drawFace(g, cx, cy, s, expression) {
    const pencilColor = Phaser.Display.Color.HexStringToColor(COLORS.pencil).color;
    g.fillStyle(pencilColor);
    g.lineStyle(1.5 * s, pencilColor);

    // Eyes
    if (expression === 'happy') {
      // Happy arcs
      g.beginPath();
      g.arc(cx - 5 * s, cy - 2 * s, 3.5 * s, Math.PI, 0);
      g.strokePath();
      g.beginPath();
      g.arc(cx + 5 * s, cy - 2 * s, 3.5 * s, Math.PI, 0);
      g.strokePath();
    } else if (expression === 'shocked') {
      // Wide O eyes
      g.fillCircle(cx - 5 * s, cy - 1 * s, 3.5 * s);
      g.fillCircle(cx + 5 * s, cy - 1 * s, 3.5 * s);
    } else {
      // Small worried dots
      g.fillCircle(cx - 5 * s, cy - 1 * s, 2.5 * s);
      g.fillCircle(cx + 5 * s, cy - 1 * s, 2.5 * s);
    }

    // Mouth
    if (expression === 'happy') {
      g.beginPath();
      g.arc(cx, cy + 4 * s, 5 * s, 0.1, Math.PI - 0.1);
      g.strokePath();
    } else if (expression === 'shocked') {
      g.beginPath();
      g.arc(cx, cy + 5 * s, 4 * s, 0, Math.PI * 2);
      g.strokePath();
    } else {
      // Worried frown
      g.beginPath();
      g.arc(cx, cy + 9 * s, 5 * s, Math.PI + 0.2, -0.2);
      g.strokePath();
    }
  }

  drawThreatVisual() {
    if (isWon(this.state)) return;

    const g = this.backgroundGraphics;
    const s = this.gameScale;
    const layout = calculateLayout(this.scaleWidth, this.scaleHeight, s);
    const threatX = layout.threatX;
    const groundY = layout.groundY;

    const pulse = isLost(this.state) ? 0 : 0.5 + Math.sin(this.threatPulseTime * 0.005) * 0.5;
    const triSize = (30 + pulse * 6) * s;

    const threatColor = Phaser.Display.Color.HexStringToColor(COLORS.threat).color;
    g.lineStyle(2.5 * s, threatColor);
    g.fillStyle(threatColor, 0.15 + pulse * 0.1);

    const tx = threatX;
    const ty = groundY - 55 * s;

    // Sketchy triangle
    g.beginPath();
    g.moveTo(tx + wobble(1) * s, ty - triSize * 0.6);
    g.lineTo(tx + triSize * 0.65 + wobble(2) * s, ty + triSize * 0.4);
    g.lineTo(tx - triSize * 0.65 + wobble(3) * s, ty + triSize * 0.4);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Exclamation mark
    if (!this.threatTextObj) {
      this.threatTextObj = this.add.text(tx, ty + 2 * s, '!', {
        fontFamily: SKETCH_FONT,
        fontSize: `${18 * s}px`,
        fontStyle: 'bold',
        color: COLORS.threat
      }).setOrigin(0.5, 0.5);
    } else {
      this.threatTextObj.setPosition(tx, ty + 2 * s);
    }
  }

  drawTexts() {
    // Title
    this.titleText.setText(getScenarioTitle(this.state));

    // Threat text
    this.threatText.setText(getThreat(this.state));

    // Result text
    const layout = calculateLayout(this.scaleWidth, this.scaleHeight, this.gameScale);
    if (isWon(this.state)) {
      this.resultText
        .setText('✓ SAVED!')
        .setColor(COLORS.correct)
        .setPosition(this.scaleWidth / 2, layout.choiceStartY + 30 * this.gameScale)
        .setVisible(true);

      if (!this.resultSubtext) {
        this.resultSubtext = this.add.text(this.scaleWidth / 2, layout.choiceStartY + 66 * this.gameScale, '', {
          fontFamily: SKETCH_FONT,
          fontSize: `${15 * this.gameScale}px`,
          color: COLORS.pencilLight
        }).setOrigin(0.5, 0);
      }
      this.resultSubtext.setText('The character survived!').setPosition(this.scaleWidth / 2, layout.choiceStartY + 66 * this.gameScale).setVisible(true);
    } else if (isLost(this.state)) {
      this.resultText
        .setText('✗ GAME OVER')
        .setColor(COLORS.incorrect)
        .setPosition(this.scaleWidth / 2, layout.choiceStartY + 30 * this.gameScale)
        .setVisible(true);

      if (!this.resultSubtext) {
        this.resultSubtext = this.add.text(this.scaleWidth / 2, layout.choiceStartY + 66 * this.gameScale, '', {
          fontFamily: SKETCH_FONT,
          fontSize: `${14 * this.gameScale}px`,
          color: COLORS.pencilLight
        }).setOrigin(0.5, 0);
      }
      this.resultSubtext.setText('Wrong choice! Try again.').setPosition(this.scaleWidth / 2, layout.choiceStartY + 66 * this.gameScale).setVisible(true);
    } else {
      this.resultText.setVisible(false);
      if (this.resultSubtext) this.resultSubtext.setVisible(false);
    }
  }

  drawChoices() {
    const g = this.uiGraphics;
    g.clear();

    const choices = getChoices(this.state);
    const layout = calculateLayout(this.scaleWidth, this.scaleHeight, this.gameScale);
    const s = this.gameScale;

    choices.forEach((choice, i) => {
      const buttonY = layout.choiceStartY + i * layout.buttonSpacing;
      const buttonX = (this.scaleWidth - layout.buttonWidth) / 2;

      const isHovered = this.hoveredChoice === i;
      const isPressed = this.pressedChoice === i;

      let isSelected = false;
      let isCorrect = null;

      if (isAnimating(this.state) && this.state.selectedChoice) {
        isSelected = this.state.selectedChoice.id === choice.id;
        if (this.animationProgress > 0.3 && isSelected) {
          isCorrect = choice.correct;
        }
      }

      this.drawChoiceButton(
        g, choice.label,
        buttonX, buttonY, layout.buttonWidth, layout.buttonHeight,
        isHovered, isPressed, isSelected, isCorrect
      );
    });
  }

  drawChoiceButton(g, label, x, y, width, height, isHovered, isPressed, isSelected, isCorrect) {
    const s = this.gameScale;
    const radius = 10 * s;

    // Press scale effect
    let scaleX = 1, scaleY = 1;
    if (isPressed) {
      scaleX = scaleY = 0.92;
    }

    g.save();

    if (scaleX !== 1 || scaleY !== 1) {
      g.translateCanvas(x + width / 2, y + height / 2);
      g.scaleCanvas(scaleX, scaleY);
      g.translateCanvas(-(x + width / 2), -(y + height / 2));
    }

    // Shadow (simulated with offset fill)
    g.fillStyle(0x000000, 0.12);
    this.fillRoundedRect(g, x + (isHovered ? 2 : 1), y + (isHovered ? 3 : 1), width, height, radius);

    // Fill color
    let fillColor = Phaser.Display.Color.HexStringToColor(COLORS.buttonBase).color;
    if (isSelected && isCorrect === true) fillColor = 0xd4f7d4;
    else if (isSelected && isCorrect === false) fillColor = 0xfdd4d4;
    else if (isHovered) fillColor = 0xfff3d0;

    g.fillStyle(fillColor);
    this.fillRoundedRect(g, x, y, width, height, radius);

    // Border
    let borderColor = Phaser.Display.Color.HexStringToColor(COLORS.buttonBorder).color;
    let borderWidth = 1.5 * s;

    if (isSelected) {
      borderColor = isCorrect ? Phaser.Display.Color.HexStringToColor(COLORS.correct).color : Phaser.Display.Color.HexStringToColor(COLORS.incorrect).color;
      borderWidth = 2.5 * s;
    } else if (isHovered) {
      borderColor = 0xb8a060;
      borderWidth = 2.5 * s;
    }

    g.lineStyle(borderWidth, borderColor);
    this.strokeRoundedRect(g, x, y, width, height, radius);

    g.restore();

    // Label text (use Phaser text objects for better rendering)
    const labelKey = `choice_${label}_${x}_${y}`;
    let labelObj = this.choiceContainer.getByName(labelKey);

    if (!labelObj) {
      labelObj = this.add.text(x + width / 2, y + height / 2, label, {
        fontFamily: SKETCH_FONT,
        fontSize: `${15 * s}px`,
        color: COLORS.pencil
      }).setOrigin(0.5, 0.5).setName(labelKey);
      this.choiceContainer.add(labelObj);
    } else {
      labelObj.setText(label).setPosition(x + width / 2, y + height / 2);
    }
  }

  fillRoundedRect(g, x, y, width, height, radius) {
    g.beginPath();
    g.moveTo(x + radius, y);
    g.lineTo(x + width - radius, y);
    g.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
    g.lineTo(x + width, y + height - radius);
    g.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
    g.lineTo(x + radius, y + height);
    g.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
    g.lineTo(x, y + radius);
    g.arc(x + radius, y + radius, radius, Math.PI, -Math.PI / 2);
    g.closePath();
    g.fillPath();
  }

  strokeRoundedRect(g, x, y, width, height, radius) {
    g.beginPath();
    g.moveTo(x + radius, y);
    g.lineTo(x + width - radius, y);
    g.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
    g.lineTo(x + width, y + height - radius);
    g.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
    g.lineTo(x + radius, y + height);
    g.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
    g.lineTo(x, y + radius);
    g.arc(x + radius, y + radius, radius, Math.PI, -Math.PI / 2);
    g.closePath();
    g.strokePath();
  }
}

// Store game instance for lifecycle management
let phaserGame = null;
let currentScene = null;

/**
 * Create renderer instance
 */
export function createRenderer(canvas) {
  let container = canvas.parentElement;

  // The canvas element is not used directly by Phaser - we use the container
  return {
    resize() {
      // Phaser handles resize automatically via Scale Manager
    },

    render(state) {
      if (currentScene) {
        currentScene.setState(state);
      }
    },

    clear() {
      if (currentScene) {
        currentScene.backgroundGraphics.clear();
        currentScene.characterGraphics.clear();
        currentScene.uiGraphics.clear();
      }
    },

    setAnimationProgress(progress) {
      if (currentScene) {
        currentScene.setAnimationProgress(progress);
      }
    },

    setHoveredChoice(index) {
      if (currentScene) {
        currentScene.setHoveredChoice(index);
      }
    },

    setPressedChoice(index) {
      if (currentScene) {
        currentScene.setPressedChoice(index);
      }
    },

    getChoiceAtPosition,

    setReducedMotion(value) {
      if (currentScene) {
        currentScene.reducedMotion = value;
      }
    },

    triggerWinEffect() {
      if (currentScene) {
        currentScene.triggerWinEffect();
      }
    },

    triggerLoseEffect() {
      if (currentScene) {
        currentScene.triggerLoseEffect();
      }
    },

    get width() { return phaserGame ? phaserGame.scale.width : CANVAS_WIDTH; },
    get height() { return phaserGame ? phaserGame.scale.height : CANVAS_HEIGHT; },
    get scale() { return currentScene ? currentScene.gameScale : 1; },

    // Initialize Phaser game
    init(state, callbacks) {
      if (!phaserGame) {
        phaserGame = new Phaser.Game({
          type: Phaser.AUTO,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            parent: container
          },
          scene: SaveTheCharacterScene,
          backgroundColor: COLORS.parchment,
          transparent: true
        });
      }

      // Get reference to scene after it's created
      currentScene = phaserGame.scene.getScene('SaveTheCharacterScene');
      if (currentScene) {
        currentScene.setState(state);
        currentScene.setCallbacks(callbacks);
      }
    },

    startAnimation() {
      if (currentScene) {
        currentScene.startAnimation();
      }
    },

    setCallbacks(callbacks) {
      if (currentScene) {
        currentScene.setCallbacks(callbacks);
      }
    },

    destroy() {
      if (phaserGame) {
        phaserGame.destroy(true);
        phaserGame = null;
        currentScene = null;
      }
    }
  };
}

export default { createRenderer, getChoiceAtPosition, calculateLayout };
