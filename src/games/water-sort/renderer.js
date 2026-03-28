/**
 * Water Sort - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Glass refraction: vertical sheen stripe on tube body
 * - Pour stream: connecting liquid trail during pour
 * - Anticipation ease: slight pull-back before pour starts
 * - Bubble particles rising inside tubes after a pour
 * - Splash ripples at landing position
 * - Scale-pop on tube completion (elastic out)
 */

import Phaser from 'phaser';
import { LIQUID_COLORS, isTubeComplete } from './state.js';
import { getPatternLabel } from '../../shared/color-blind.js';

// Visual constants
const TUBE_WIDTH = 52;
const TUBE_HEIGHT = 180;
const SEGMENT_HEIGHT = 40;
const TUBE_RADIUS = 10;
const TUBE_GAP = 12;
const TUBE_BORDER = 3;
const POUR_DURATION = 480;

/**
 * Layout utilities - pure functions for tube positioning
 */
export function calculateLayout(tubeCount, containerWidth, containerHeight) {
  const tubesPerRow = Math.min(tubeCount, 7);
  const rows = Math.ceil(tubeCount / tubesPerRow);
  const padding = 16;

  const availWidth = containerWidth - padding * 2;
  const availHeight = containerHeight - padding * 2;

  const totalTubeWidth = tubesPerRow * TUBE_WIDTH + (tubesPerRow - 1) * TUBE_GAP;
  const totalTubeHeight = rows * (TUBE_HEIGHT + TUBE_GAP);

  const scaleX = availWidth / totalTubeWidth;
  const scaleY = availHeight / totalTubeHeight;
  const tubeScale = Math.min(scaleX, scaleY, 1.2);

  const width = totalTubeWidth * tubeScale + padding * 2;
  const height = totalTubeHeight * tubeScale + padding * 2;

  return { tubeScale, width, height, tubesPerRow, rows, padding };
}

export function getTubePosition(index, tubeCount, tubeScale, totalWidth, tubesPerRow) {
  const col = index % tubesPerRow;
  const row = Math.floor(index / tubesPerRow);
  const tubesInRow = Math.min(tubesPerRow, tubeCount - row * tubesPerRow);

  const totalRowWidth = tubesInRow * TUBE_WIDTH + (tubesInRow - 1) * TUBE_GAP;
  const startX = (totalWidth - totalRowWidth * tubeScale) / 2;

  return {
    x: startX + col * (TUBE_WIDTH + TUBE_GAP) * tubeScale,
    y: 16 + row * (TUBE_HEIGHT + TUBE_GAP) * tubeScale
  };
}

/**
 * Convert canvas coordinates to tube index - pure hit-testing
 */
export function canvasToTubeIndex(canvasX, canvasY, tubeCount, tubeScale, totalWidth, tubesPerRow) {
  for (let i = 0; i < tubeCount; i++) {
    const pos = getTubePosition(i, tubeCount, tubeScale, totalWidth, tubesPerRow);
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
 * Water Sort Phaser Scene
 */
class WaterSortScene extends Phaser.Scene {
  constructor() {
    super('WaterSortScene');
    this.tubeGraphics = [];
    this.liquidContainers = [];
    this.bubbles = [];
    this.splashes = [];
    this.hintTubeIndex = null;
    this.reducedMotion = false;
    this.colorBlindMode = false;
    this.animating = false;
    this.animData = null;
    this.tubePopTweens = new Map();
    this.state = null;
    this.layout = null;
    this.pourGraphics = null;
    this.hintTween = null;
  }

  init(data) {
    this.state = data.state;
    this.onTubeTap = data.onTubeTap;
    this.reducedMotion = data.reducedMotion || false;
    this.colorBlindMode = data.colorBlindMode || false;
  }

  create() {
    this.updateLayout();
    this.createTubeObjects();
    this.setupInput();

    // Create graphics for pour animation
    this.pourGraphics = this.add.graphics();
  }

  updateLayout() {
    const { width, height } = this.scale;
    this.layout = calculateLayout(this.state.tubes.length, width, height);
  }

  createTubeObjects() {
    // Clear existing graphics
    this.tubeGraphics.forEach(g => g.destroy());
    this.liquidContainers.forEach(c => c.destroy());
    this.tubeGraphics = [];
    this.liquidContainers = [];

    for (let i = 0; i < this.state.tubes.length; i++) {
      const pos = getTubePosition(i, this.state.tubes.length, this.layout.tubeScale,
                                   this.layout.width, this.layout.tubesPerRow);

      // Create container for each tube
      const container = this.add.container(pos.x, pos.y);

      // Create tube graphics
      const graphics = this.add.graphics();
      container.add(graphics);
      this.tubeGraphics.push(graphics);
      this.liquidContainers.push(container);
    }

    this.renderTubes();
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.animating) return;

      const tubeIdx = canvasToTubeIndex(
        pointer.x, pointer.y,
        this.state.tubes.length,
        this.layout.tubeScale,
        this.layout.width,
        this.layout.tubesPerRow
      );

      if (tubeIdx >= 0 && this.onTubeTap) {
        this.onTubeTap(tubeIdx);
      }
    });
  }

  renderTubes() {
    for (let i = 0; i < this.state.tubes.length; i++) {
      this.drawTube(i);
    }
  }

  drawTube(tubeIdx) {
    const graphics = this.tubeGraphics[tubeIdx];
    const container = this.liquidContainers[tubeIdx];
    if (!graphics || !container) return;

    graphics.clear();

    const tube = this.state.tubes[tubeIdx];
    const s = this.layout.tubeScale;
    const tw = TUBE_WIDTH * s;
    const th = TUBE_HEIGHT * s;
    const r = TUBE_RADIUS * s;
    const border = TUBE_BORDER * s;
    const segH = SEGMENT_HEIGHT * s;

    const isSelected = this.state.selectedTube === tubeIdx;
    const complete = isTubeComplete(this.state, tubeIdx);

    // Reset container scale (for pop animation)
    container.setScale(1);

    // Tube background (glass)
    graphics.fillStyle(0xffffff, 0.08);
    this.drawRoundedRect(graphics, 0, 0, tw, th, r, r, r * 1.5, r * 1.5);
    graphics.fillPath();

    // Tube border (glass effect)
    graphics.lineStyle(border, 0xffffff, 0.25);
    this.drawRoundedRect(graphics, 0, 0, tw, th, r, r, r * 1.5, r * 1.5);
    graphics.strokePath();

    // Glass refraction sheen
    const innerW = tw - border * 2;
    graphics.fillStyle(0xffffff, 0.15);
    graphics.fillRoundedRect(border, border, innerW * 0.28, th - border * 2, r * 0.5);

    // Right edge gloss
    graphics.fillStyle(0xffffff, 0.07);
    graphics.fillRect(tw - border * 2, r, border, th - r * 2);

    // Selection or hint glow
    if (isSelected) {
      container.setAlpha(1);
      graphics.lineStyle(border + 2, 0x6366f1, 0.7);
      this.drawRoundedRect(graphics, -border, -border, tw + border * 2, th + border * 2, r, r, r * 1.5, r * 1.5);
      graphics.strokePath();
    }

    if (tubeIdx === this.hintTubeIndex) {
      // Pulsing hint glow handled by tween
    }

    // Draw liquid segments (bottom to top)
    const segments = tube.segments;
    const innerX = border + 2 * s;
    const liquidW = innerW - 4 * s;

    for (let i = 0; i < segments.length; i++) {
      const segIdx = segments.length - 1 - i;
      const color = segments[segIdx];
      const liquidColor = LIQUID_COLORS[color] || '#888888';
      const phaserColor = Phaser.Display.Color.HexStringToColor(liquidColor).color;

      const liquidY = th - border - (i + 1) * segH;
      const liquidH = segH - 2 * s;

      // Liquid fill
      graphics.fillStyle(phaserColor, 1);
      graphics.fillRoundedRect(innerX, liquidY, liquidW, liquidH, 4 * s);

      // Liquid shine
      graphics.fillStyle(0xffffff, 0.2);
      graphics.fillRoundedRect(innerX + 2 * s, liquidY + 2 * s, liquidW * 0.3, liquidH - 4 * s, 3 * s);

      // Color-blind pattern label
      if (this.colorBlindMode) {
        const label = getPatternLabel(color);
        if (label) {
          // Use text object instead of graphics text for better quality
          const labelKey = `label-${tubeIdx}-${i}`;
          const existingText = container.getByName(labelKey);
          if (existingText) {
            existingText.destroy();
          }

          const text = this.add.text(innerX + liquidW / 2, liquidY + liquidH / 2, label, {
            fontFamily: 'monospace',
            fontSize: `${Math.round(13 * s)}px`,
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center'
          });
          text.setOrigin(0.5);
          text.setName(labelKey);
          text.setAlpha(0.9);
          container.add(text);
        }
      }

      // Segment separator line
      if (i > 0) {
        graphics.lineStyle(1 * s, 0x000000, 0.15);
        graphics.beginPath();
        graphics.moveTo(innerX, liquidY + liquidH);
        graphics.lineTo(innerX + liquidW, liquidY + liquidH);
        graphics.strokePath();
      }
    }

    // Gold glow for completed tubes
    if (complete) {
      graphics.lineStyle(2 * s, 0xffd700, 0.5);
      this.drawRoundedRect(graphics, -1 * s, -1 * s, tw + 2 * s, th + 2 * s,
                           r + 1 * s, r + 1 * s, r * 1.5 + 1 * s, r * 1.5 + 1 * s);
      graphics.strokePath();
    }
  }

  drawRoundedRect(graphics, x, y, width, height, tl, tr, br, bl) {
    if (typeof tr === 'undefined') {
      // All corners same radius
      const r = tl;
      graphics.fillRoundedRect(x, y, width, height, r);
      return;
    }
    // Different corner radii - draw manually
    graphics.beginPath();
    graphics.moveTo(x + tl, y);
    graphics.lineTo(x + width - tr, y);
    graphics.arc(x + width - tr, y + tr, tr, -Math.PI / 2, 0, false);
    graphics.lineTo(x + width, y + height - br);
    graphics.arc(x + width - br, y + height - br, br, 0, Math.PI / 2, false);
    graphics.lineTo(x + bl, y + height);
    graphics.arc(x + bl, y + height - bl, bl, Math.PI / 2, Math.PI, false);
    graphics.lineTo(x, y + tl);
    graphics.arc(x + tl, y + tl, tl, Math.PI, -Math.PI / 2, false);
    graphics.closePath();
  }

  setState(newState) {
    this.state = newState;
    this.updateLayout();
    this.renderTubes();
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setColorBlindMode(value) {
    this.colorBlindMode = value;
    this.renderTubes();
  }

  setHintTube(index) {
    // Stop existing hint tween
    if (this.hintTween) {
      this.hintTween.stop();
      this.hintTween = null;
    }

    this.hintTubeIndex = index;

    if (index !== null && !this.reducedMotion) {
      // Create pulsing glow effect
      const container = this.liquidContainers[index];
      if (container) {
        this.hintTween = this.tweens.add({
          targets: container,
          alpha: { from: 1, to: 0.7 },
          duration: 300,
          yoyo: true,
          repeat: -1
        });
      }
    }
  }

  triggerTubePop(tubeIdx) {
    if (this.reducedMotion) return;

    const container = this.liquidContainers[tubeIdx];
    if (!container) return;

    // Elastic scale pop animation
    this.tweens.add({
      targets: container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 175,
      ease: 'Back.easeOut',
      yoyo: true,
      repeat: 0
    });
  }

  animatePour(fromIdx, toIdx, count, color, prePourState) {
    return new Promise(resolve => {
      if (this.reducedMotion) {
        resolve();
        return;
      }

      this.animating = true;
      this.animData = { fromIdx, toIdx, count, color, progress: 0 };

      const s = this.layout.tubeScale;
      const fromPos = getTubePosition(fromIdx, this.state.tubes.length, s,
                                       this.layout.width, this.layout.tubesPerRow);
      const toPos = getTubePosition(toIdx, this.state.tubes.length, s,
                                     this.layout.width, this.layout.tubesPerRow);
      const tw = TUBE_WIDTH * s;
      const th = TUBE_HEIGHT * s;
      const segH = SEGMENT_HEIGHT * s;
      const border = TUBE_BORDER * s;

      // Calculate start and end positions
      const fromX = fromPos.x + tw / 2;
      const sourceTopY = fromPos.y + th - border -
        (this.state.tubes[fromIdx].segments.length) * segH;

      const destSegs = this.state.tubes[toIdx].segments.length - count;
      const toX = toPos.x + tw / 2;
      const destY = toPos.y + th - border - (destSegs + count) * segH;

      // Create liquid blob sprite
      const liquidColor = LIQUID_COLORS[color] || '#888888';
      const phaserColor = Phaser.Display.Color.HexStringToColor(liquidColor).color;
      const blobSize = (TUBE_WIDTH * 0.6) * s;

      const blob = this.add.graphics();
      blob.fillStyle(phaserColor, 0.92);

      // Draw blob as ellipse
      blob.fillEllipse(0, 0, blobSize, blobSize * 0.8);
      blob.fillStyle(0xffffff, 0.28);
      blob.fillEllipse(-blobSize * 0.12, -blobSize * 0.1, blobSize * 0.22, blobSize * 0.13);

      blob.setPosition(fromX, sourceTopY);

      // Animate blob along arc path
      const arcHeight = 30 * s;

      this.tweens.add({
        targets: blob,
        x: toX,
        y: destY,
        duration: POUR_DURATION,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => {
          const progress = tween.progress;

          // Add arc offset
          const arcOffset = arcHeight * Math.sin(progress * Math.PI);
          blob.y = sourceTopY + (destY - sourceTopY) * progress - arcOffset;

          // Draw stream trail
          this.pourGraphics.clear();
          if (progress > 0.05 && progress < 0.85) {
            this.pourGraphics.lineStyle(blobSize * 0.35, phaserColor, 0.45);
            this.pourGraphics.beginPath();
            this.pourGraphics.moveTo(fromX, sourceTopY);

            const midX = fromX + (blob.x - fromX) * 0.3;
            const midY = sourceTopY - arcHeight * 0.5;
            this.pourGraphics.quadraticCurveTo(midX, midY, blob.x, blob.y);
            this.pourGraphics.strokePath();
          }

          // Redraw tubes to show segment changes during animation
          this.drawTube(fromIdx);
          this.drawTube(toIdx);
        },
        onComplete: () => {
          // Spawn splash
          this.spawnSplash(toX, destY, phaserColor, s);

          // Spawn bubbles in destination tube
          this.spawnBubbles(toIdx, s);

          blob.destroy();
          this.pourGraphics.clear();
          this.animating = false;
          this.animData = null;

          // Final render
          this.renderTubes();
          resolve();
        }
      });
    });
  }

  spawnSplash(x, y, color, s) {
    // Create expanding ring splash
    for (let i = 0; i < 2; i++) {
      const splash = this.add.graphics();
      splash.lineStyle(2 * s, color, 0.55);
      splash.strokeCircle(0, 0, 4 * s);
      splash.setPosition(x, y + i * 5 * s);

      this.tweens.add({
        targets: splash,
        scaleX: 1 + 4.5,
        scaleY: 1 + 4.5,
        alpha: 0,
        duration: 400,
        delay: i * 60,
        onComplete: () => splash.destroy()
      });
    }
  }

  spawnBubbles(tubeIdx, s) {
    const pos = getTubePosition(tubeIdx, this.state.tubes.length, s,
                                 this.layout.width, this.layout.tubesPerRow);
    const tw = TUBE_WIDTH * s;
    const th = TUBE_HEIGHT * s;

    for (let i = 0; i < 5; i++) {
      const bubble = this.add.graphics();
      bubble.fillStyle(0xffffff, 0.6);
      const r = (1 + Math.random() * 2) * s;
      bubble.fillCircle(0, 0, r);
      bubble.setPosition(
        pos.x + tw / 2 + (Math.random() - 0.5) * tw * 0.5,
        pos.y + th * 0.6 + Math.random() * th * 0.3
      );

      this.tweens.add({
        targets: bubble,
        y: bubble.y - 50 * s,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        ease: 'Sine.easeOut',
        onComplete: () => bubble.destroy()
      });
    }
  }

  resize(state) {
    this.state = state;
    this.updateLayout();
    this.createTubeObjects();
  }
}

/**
 * Create renderer instance - returns Phaser game and API
 */
export function createRenderer(canvas) {
  let game = null;
  let scene = null;
  let lastState = null;
  let reducedMotion = false;
  let colorBlindMode = false;
  let onTubeTapCallback = null;
  let gameReady = false;
  let sceneStarted = false;

  const gameConfig = {
    type: Phaser.AUTO,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 390,
      height: 844,
      parent: canvas.parentElement,
      canvas: canvas
    },
    backgroundColor: '#0f0f23',
    transparent: true
  };

  function maybeStartScene() {
    if (!gameReady || !lastState || sceneStarted) return;
    sceneStarted = true;
    game.scene.add('WaterSortScene', WaterSortScene, true, {
      state: lastState,
      onTubeTap: onTubeTapCallback,
      reducedMotion,
      colorBlindMode
    });
  }

  function init() {
    game = new Phaser.Game(gameConfig);
    game.events.once('ready', () => {
      gameReady = true;
      maybeStartScene();
    });
  }

  function getScene() {
    if (!scene) {
      scene = game.scene.getScene('WaterSortScene');
    }
    return scene;
  }

  function resize(state) {
    lastState = state;
    maybeStartScene();
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.resize(state);
    }
  }

  function render(state) {
    lastState = state;
    maybeStartScene();
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.setState(state);
    }
  }

  function clear() {
    // Phaser handles clearing
  }

  function canvasToTubeIndex(x, y, state) {
    const s = getScene();
    if (!s || !s.layout) return -1;
    return canvasToTubeIndex(
      x, y,
      state.tubes.length,
      s.layout.tubeScale,
      s.layout.width,
      s.layout.tubesPerRow
    );
  }

  function animatePour(fromIdx, toIdx, count, color, prePourState) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      return s.animatePour(fromIdx, toIdx, count, color, prePourState);
    }
    return Promise.resolve();
  }

  function triggerTubePop(tubeIdx) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.triggerTubePop(tubeIdx);
    }
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    const s = getScene();
    if (s) {
      s.setReducedMotion(value);
    }
  }

  function setColorBlindMode(value) {
    colorBlindMode = value;
    const s = getScene();
    if (s) {
      s.setColorBlindMode(value);
    }
  }

  function setHintTube(index) {
    const s = getScene();
    if (s) {
      s.setHintTube(index);
    }
  }

  function isAnimating() {
    const s = getScene();
    return s ? s.animating : false;
  }

  function setOnTubeTap(callback) {
    onTubeTapCallback = callback;
    const s = getScene();
    if (s) {
      s.onTubeTap = callback;
    }
  }

  // Initialize the game
  init();

  return {
    resize,
    render,
    clear,
    canvasToTubeIndex,
    animatePour,
    triggerTubePop,
    setReducedMotion,
    setColorBlindMode,
    setHintTube,
    isAnimating,
    setOnTubeTap,
    get tubeScale() {
      const s = getScene();
      return s && s.layout ? s.layout.tubeScale : 1;
    }
  };
}

export default { createRenderer, calculateLayout, getTubePosition, canvasToTubeIndex };
