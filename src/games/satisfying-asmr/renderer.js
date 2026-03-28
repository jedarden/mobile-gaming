/**
 * Satisfying ASMR - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Textured surface with subtle grain noise
 * - Hidden color-reveal layer exposed as dirt is cleaned
 * - Dirt has earthy texture variation
 * - Debris particles fly off on each erase stroke
 * - Completion sparkle burst when fully cleaned
 */

import Phaser from 'phaser';

const SURFACE_COLOR = '#f0e6d2';

// Color reveal patterns (pastel rainbow under the dirt)
const REVEAL_PALETTES = {
  full:         ['#FFD6E0', '#FFEAA7', '#A8EDEA', '#FEA3AA', '#B8F0B8'],
  splatter:     ['#C3B1E1', '#FFD700', '#87CEEB', '#FF8C69', '#90EE90'],
  stripes:      ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8DADC', '#FF9A9E'],
  checkerboard: ['#F8A5C2', '#6FC5D3', '#FCEA7C', '#B8E6B8', '#FFBFA0']
};

/**
 * Layout utilities - pure functions for grid positioning
 */
export function calculateLayout(gridWidth, gridHeight, containerWidth, containerHeight) {
  const availW = containerWidth - 8;
  const availH = containerHeight - 8;
  const csW = Math.floor(availW / gridWidth);
  const csH = Math.floor(availH / gridHeight);
  const cellSize = Math.max(4, Math.min(csW, csH));

  const canvasW = cellSize * gridWidth;
  const canvasH = cellSize * gridHeight;

  return {
    cellSize,
    canvasW,
    canvasH,
    offsetX: (containerWidth - canvasW) / 2,
    offsetY: (containerHeight - canvasH) / 2,
    gridWidth,
    gridHeight
  };
}

/**
 * Convert canvas pixel coordinates to grid cell coords - pure function
 */
export function pixelToGrid(px, py, layout) {
  return {
    gc: Math.floor((px - layout.offsetX) / layout.cellSize),
    gr: Math.floor((py - layout.offsetY) / layout.cellSize)
  };
}

/**
 * Satisfying ASMR Phaser Scene
 */
class SatisfyingAsmrScene extends Phaser.Scene {
  constructor() {
    super('SatisfyingAsmrScene');
    this.layout = null;
    this.state = null;
    this.reducedMotion = false;
    this.onSpray = null;

    // Graphics objects
    this.revealGraphics = null;
    this.grainGraphics = null;
    this.dirtRenderTexture = null;
    this.dirtGraphics = null;
    this.winOverlay = null;

    // Particle arrays for manual tweening
    this.debrisParticles = [];
    this.sparkleParticles = [];
  }

  init(data) {
    this.state = data.state;
    this.reducedMotion = data.reducedMotion || false;
    this.onSpray = data.onSpray;
  }

  create() {
    this.updateLayout();
    this.drawRevealLayer();
    this.drawGrainOverlay();
    this.buildDirtLayer();
    this.setupInput();
  }

  updateLayout() {
    const { width, height } = this.scale;
    this.layout = calculateLayout(
      this.state.width,
      this.state.height,
      width,
      height
    );
  }

  drawRevealLayer() {
    if (this.revealGraphics) {
      this.revealGraphics.destroy();
    }

    const { cellSize, canvasW, canvasH, offsetX, offsetY, gridWidth, gridHeight } = this.layout;
    const patternType = this.state.patternType || 'full';
    const palette = REVEAL_PALETTES[patternType] || REVEAL_PALETTES.full;

    this.revealGraphics = this.add.graphics();
    this.revealGraphics.setPosition(offsetX, offsetY);

    if (patternType === 'stripes') {
      const stripeW = Math.ceil(canvasW / palette.length);
      palette.forEach((col, i) => {
        this.revealGraphics.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1);
        this.revealGraphics.fillRect(i * stripeW, 0, stripeW, canvasH);
      });
    } else if (patternType === 'checkerboard') {
      for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
          this.revealGraphics.fillStyle(
            Phaser.Display.Color.HexStringToColor(palette[(r + c) % palette.length]).color,
            1
          );
          this.revealGraphics.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    } else {
      // Radial blob pattern (splatter / full) - draw base first
      this.revealGraphics.fillStyle(Phaser.Display.Color.HexStringToColor(SURFACE_COLOR).color, 1);
      this.revealGraphics.fillRect(0, 0, canvasW, canvasH);

      // Draw radial gradients using filled circles with alpha
      const cx = canvasW / 2;
      const cy = canvasH / 2;
      const blobCount = patternType === 'full' ? 3 : 7;

      for (let b = 0; b < blobCount; b++) {
        const bx = cx + (Math.sin(b * 1.3) * 0.4) * canvasW;
        const by = cy + (Math.cos(b * 0.9) * 0.4) * canvasH;
        const br = Math.min(canvasW, canvasH) / (patternType === 'full' ? 1.5 : 2.5);
        const color = Phaser.Display.Color.HexStringToColor(palette[b % palette.length]);

        // Draw multiple concentric circles to simulate gradient
        for (let ring = br; ring > 0; ring -= 2) {
          const alpha = Phaser.Math.Linear(0, 0.93, 1 - ring / br);
          this.revealGraphics.fillStyle(color.color, alpha);
          this.revealGraphics.fillCircle(bx, by, ring);
        }
      }
    }

    // Subtle sheen overlay
    this.revealGraphics.fillStyle(0xffffff, 0.12);
    this.revealGraphics.fillRect(0, 0, canvasW, canvasH * 0.3);
  }

  drawGrainOverlay() {
    if (this.grainGraphics) {
      this.grainGraphics.destroy();
    }

    const { canvasW, canvasH, offsetX, offsetY } = this.layout;

    this.grainGraphics = this.add.graphics();
    this.grainGraphics.setPosition(offsetX, offsetY);

    // Sparse grain dots
    for (let i = 0; i < canvasW * canvasH * 0.002; i++) {
      const x = Math.random() * canvasW;
      const y = Math.random() * canvasH;
      const alpha = Math.random() < 0.35 ? 0.07 : 0;
      if (alpha > 0) {
        const v = (Math.random() * 40) | 0;
        this.grainGraphics.fillStyle(Phaser.Display.Color.GetColor(v, v, v), alpha);
        this.grainGraphics.fillRect(x, y, 1, 1);
      }
    }
  }

  buildDirtLayer() {
    if (this.dirtGraphics) {
      this.dirtGraphics.destroy();
    }
    if (this.dirtRenderTexture) {
      this.dirtRenderTexture.destroy();
    }

    const { cellSize, canvasW, canvasH, offsetX, offsetY, gridWidth, gridHeight } = this.layout;

    // Create graphics for dirt
    this.dirtGraphics = this.add.graphics();
    this.dirtGraphics.setPosition(offsetX, offsetY);

    // Draw dirt cells
    for (let i = 0; i < this.state.cells.length; i++) {
      if (!this.state.cells[i]) continue;
      const c = i % this.state.width;
      const r = Math.floor(i / this.state.width);
      const x = c * cellSize;
      const y = r * cellSize;

      // Base dirt with subtle value variation (seeded by position)
      const seed = (c * 17 + r * 31) & 0xFF;
      const v = 40 + seed % 30;
      const br = 30 + seed % 15;
      const color = Phaser.Display.Color.GetColor(v + 50, v, br);
      this.dirtGraphics.fillStyle(color, 1);
      this.dirtGraphics.fillRect(x, y, cellSize, cellSize);
    }

    // Grain overlay on dirt
    this.addGrainToDirt();

    // Create render texture for erasing
    this.dirtRenderTexture = this.add.renderTexture(offsetX, offsetY, canvasW, canvasH);
    this.dirtRenderTexture.draw(this.dirtGraphics);
  }

  addGrainToDirt() {
    if (!this.dirtGraphics) return;

    const { canvasW, canvasH } = this.layout;

    // Add grain dots to dirt
    this.dirtGraphics.fillStyle(0x000000, 0.08);
    for (let i = 0; i < canvasW * canvasH * 0.01; i++) {
      const x = Math.random() * canvasW;
      const y = Math.random() * canvasH;
      this.dirtGraphics.fillRect(x, y, 1, 1);
    }
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.state.status !== 'playing') return;

      const px = pointer.x;
      const py = pointer.y;

      if (this.onSpray) {
        this.onSpray(px, py);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      if (this.state.status !== 'playing') return;

      const px = pointer.x;
      const py = pointer.y;

      if (this.onSpray) {
        this.onSpray(px, py);
      }
    });
  }

  setState(newState) {
    this.state = newState;
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  render(state) {
    this.state = state;

    // Win overlay
    if (state.status === 'won') {
      if (!this.winOverlay) {
        this.winOverlay = this.add.graphics();
        this.winOverlay.setDepth(1000);
      }
      this.winOverlay.clear();
      this.winOverlay.fillStyle(0xb4ffc8, 0.18);
      const { width, height } = this.scale;
      this.winOverlay.fillRect(0, 0, width, height);
    } else if (this.winOverlay) {
      this.winOverlay.clear();
    }
  }

  /**
   * Erase dirt cells — updates dirtRenderTexture in-place.
   */
  eraseArea(cells, cx, cy, radius, w) {
    if (!this.dirtRenderTexture || !this.dirtGraphics) return;

    const { cellSize, offsetX, offsetY, gridHeight } = this.layout;
    const r = Math.ceil(radius);

    // Redraw the dirt graphics without the erased cells
    this.dirtGraphics.clear();

    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const c = i % w;
      const row = Math.floor(i / w);
      const x = c * cellSize;
      const y = row * cellSize;

      // Base dirt with subtle value variation
      const seed = (c * 17 + row * 31) & 0xFF;
      const v = 40 + seed % 30;
      const br = 30 + seed % 15;
      const color = Phaser.Display.Color.GetColor(v + 50, v, br);
      this.dirtGraphics.fillStyle(color, 1);
      this.dirtGraphics.fillRect(x, y, cellSize, cellSize);
    }

    // Add grain overlay
    this.addGrainToDirt();

    // Clear and redraw render texture
    this.dirtRenderTexture.clear();
    this.dirtRenderTexture.draw(this.dirtGraphics);
  }

  /**
   * Spawn debris crumbs at the given pixel position
   */
  spawnDebris(px, py) {
    if (this.reducedMotion) return;

    const dirtColors = [0x6e4c32, 0x8b6045, 0x5a3e2b, 0x7a5235, 0x4a3020];
    const count = 4 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.5;
      const color = dirtColors[Math.floor(Math.random() * dirtColors.length)];
      const size = 3 + Math.random() * 4;

      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, size / 2);
      particle.setPosition(
        px + (Math.random() - 0.5) * this.layout.cellSize,
        py + (Math.random() - 0.5) * this.layout.cellSize
      );
      particle.setDepth(500);

      const targetX = particle.x + Math.cos(angle) * speed * 60;
      const targetY = particle.y + Math.sin(angle) * speed * 60 - 60;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: 700 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });

      this.debrisParticles.push(particle);
    }
  }

  /**
   * Trigger completion sparkle burst
   */
  triggerCompletionSparkle() {
    if (this.reducedMotion) return;

    const colors = [0xffd700, 0xff69b4, 0x00ffff, 0xadff2f, 0xff6347, 0xdda0dd, 0xffe66d];
    const { canvasW, canvasH, offsetX, offsetY } = this.layout;
    const cx = offsetX + canvasW / 2;
    const cy = offsetY + canvasH / 2;

    // Central burst
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 1 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 6 + Math.random() * 8;

      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      // Draw plus-sign sparkle
      particle.fillRect(-size, -size * 0.25, size * 2, size * 0.5);
      particle.fillRect(-size * 0.25, -size, size * 0.5, size * 2);

      particle.setPosition(
        cx + (Math.random() - 0.5) * canvasW * 0.6,
        cy + (Math.random() - 0.5) * canvasH * 0.6
      );
      particle.setDepth(600);

      const targetX = particle.x + Math.cos(angle) * speed * 80;
      const targetY = particle.y + Math.sin(angle) * speed * 80;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        rotation: Math.PI * 4,
        scaleX: 0,
        scaleY: 0,
        duration: 800 + Math.random() * 500,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });

      this.sparkleParticles.push(particle);
    }
  }

  resize(state) {
    this.state = state;
    this.updateLayout();
    this.drawRevealLayer();
    this.drawGrainOverlay();
    this.buildDirtLayer();
  }

  getCellSize() {
    return this.layout ? this.layout.cellSize : 20;
  }

  // API method for external hit testing
  hitTestPixel(px, py) {
    if (!this.layout) return { gc: -1, gr: -1 };
    return pixelToGrid(px, py, this.layout);
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
    scene: SatisfyingAsmrScene,
    backgroundColor: '#f0e6d2',
    transparent: true
  };

  function init() {
    game = new Phaser.Game(gameConfig);
  }

  function getScene() {
    if (!scene) {
      scene = game.scene.getScene('SatisfyingAsmrScene');
    }
    return scene;
  }

  function resize(state) {
    lastState = state;
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.resize(state);
    }
  }

  function render(state) {
    lastState = state;
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.render(state);
    }
  }

  function buildDirtLayer(cells, w, h) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.buildDirtLayer();
    }
  }

  function eraseArea(cells, cx, cy, radius, w) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.eraseArea(cells, cx, cy, radius, w);
    }
  }

  function pixelToGridFn(px, py) {
    const s = getScene();
    if (!s || !s.layout) return { gc: -1, gr: -1 };
    return pixelToGrid(px, py, s.layout);
  }

  function getCellSize() {
    const s = getScene();
    return s && s.layout ? s.layout.cellSize : 20;
  }

  function spawnDebris(px, py) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.spawnDebris(px, py);
    }
  }

  function triggerCompletionSparkle() {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.triggerCompletionSparkle();
    }
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    const s = getScene();
    if (s) {
      s.setReducedMotion(value);
    }
  }

  function setCallbacks({ onSpray }) {
    const s = getScene();
    if (s) {
      s.onSpray = onSpray;
    }
  }

  // Initialize the game
  init();

  return {
    resize,
    render,
    buildDirtLayer,
    eraseArea,
    pixelToGrid: pixelToGridFn,
    getCellSize,
    spawnDebris,
    triggerCompletionSparkle,
    setReducedMotion,
    setCallbacks
  };
}

export default {
  createRenderer,
  calculateLayout,
  pixelToGrid
};
