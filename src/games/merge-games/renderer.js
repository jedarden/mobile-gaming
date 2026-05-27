/**
 * Merge Games - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Vibrant tier color palette with warm/cool progression
 * - Drag float: shadow, slight rotation, scale-up
 * - Merge burst: particle explosion + elastic scale pop
 * - Tier glow aura for high-tier items
 * - Grid background gradient
 * - Matching-tier cell highlight pulse
 */

import Phaser from 'phaser';

// Curated tier palette: pastels → vibrant → warm
const TIER_COLORS = [
  '',           // 0 — empty
  '#A8DADC',   // 1 — cool sky
  '#45B7D1',   // 2 — vivid teal
  '#4ECDC4',   // 3 — mint
  '#FFE66D',   // 4 — golden yellow
  '#FF6B6B',   // 5 — coral red
  '#C678DD'    // 6 — vibrant purple
];
const TIER_LABELS = ['', '1', '2', '3', '4', '5', '6'];
const CELL_GAP = 6;
const CELL_RADIUS = 12;
const CELL_BG = 'rgba(255,255,255,0.07)';

/**
 * Layout utilities - pure functions for cell positioning
 */
export function calculateLayout(gridWidth, gridHeight, containerWidth, containerHeight) {
  const padding = 16;
  const avail = Math.min(containerWidth, containerHeight) - padding * 2;
  const maxDim = Math.max(gridWidth, gridHeight);
  const cellSize = Math.floor((avail - CELL_GAP * (maxDim - 1)) / maxDim);

  const gridW = gridWidth * cellSize + (gridWidth - 1) * CELL_GAP;
  const gridH = gridHeight * cellSize + (gridHeight - 1) * CELL_GAP;

  const offsetX = (containerWidth - gridW) / 2;
  const offsetY = (containerHeight - gridH) / 2;

  return { cellSize, offsetX, offsetY, gridW, gridH };
}

export function getCellPosition(r, c, cellSize, offsetX, offsetY) {
  return {
    x: offsetX + c * (cellSize + CELL_GAP),
    y: offsetY + r * (cellSize + CELL_GAP)
  };
}

/**
 * Convert canvas coordinates to cell - pure hit-testing
 */
export function canvasToCell(canvasX, canvasY, gridWidth, gridHeight, cellSize, offsetX, offsetY) {
  for (let r = 0; r < gridHeight; r++) {
    for (let c = 0; c < gridWidth; c++) {
      const pos = getCellPosition(r, c, cellSize, offsetX, offsetY);
      if (canvasX >= pos.x && canvasX <= pos.x + cellSize &&
          canvasY >= pos.y && canvasY <= pos.y + cellSize) {
        return { r, c };
      }
    }
  }
  return null;
}

/**
 * Merge Games Phaser Scene
 */
class MergeGamesScene extends Phaser.Scene {
  constructor() {
    super('MergeGamesScene');
    this.cellGraphics = [];
    this.cellContainers = [];
    this.hintCells = null;
    this.reducedMotion = false;
    this.state = null;
    this.layout = null;
    this.particles = [];
    this.dragGraphics = null;
    this.hintTweens = [];
  }

  init(data) {
    this.state = data.state;
    this.onMerge = data.onMerge;
    this.reducedMotion = data.reducedMotion || false;
  }

  create() {
    this.updateLayout();
    this.createCellObjects();
    this.setupInput();

    // Create graphics for drag item
    this.dragGraphics = this.add.graphics();
    this.dragGraphics.setVisible(false);
  }

  updateLayout() {
    const { width, height } = this.scale;
    this.layout = calculateLayout(this.state.width, this.state.height, width, height);
  }

  createCellObjects() {
    // Clear existing graphics
    this.cellGraphics.forEach(g => g.destroy());
    this.cellContainers.forEach(c => c.destroy());
    this.cellGraphics = [];
    this.cellContainers = [];

    for (let r = 0; r < this.state.height; r++) {
      this.cellGraphics[r] = [];
      this.cellContainers[r] = [];
      for (let c = 0; c < this.state.width; c++) {
        const pos = getCellPosition(r, c, this.layout.cellSize, this.layout.offsetX, this.layout.offsetY);

        // Create container for each cell
        const container = this.add.container(pos.x, pos.y);

        // Create cell graphics
        const graphics = this.add.graphics();
        container.add(graphics);
        this.cellGraphics[r][c] = graphics;
        this.cellContainers[r][c] = container;
      }
    }

    this.renderCells();
  }

  setupInput() {
    let dragStartCell = null;
    let isDragging = false;

    this.input.on('pointerdown', (pointer) => {
      if (this.reducedMotion || isDragging) return;

      const cell = canvasToCell(
        pointer.x, pointer.y,
        this.state.width, this.state.height,
        this.layout.cellSize,
        this.layout.offsetX,
        this.layout.offsetY
      );

      if (cell) {
        const tier = this.state.grid[cell.r]?.[cell.c];
        if (tier) {
          dragStartCell = cell;
          isDragging = true;
          this.updateDragItem(pointer.x, pointer.y, tier);
        }
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!isDragging || !dragStartCell) return;

      const tier = this.state.grid[dragStartCell.r]?.[dragStartCell.c];
      if (tier) {
        this.updateDragItem(pointer.x, pointer.y, tier);
        this.renderCells({ fromR: dragStartCell.r, fromC: dragStartCell.c, px: pointer.x, py: pointer.y, tier });
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (!isDragging || !dragStartCell) {
        isDragging = false;
        dragStartCell = null;
        this.dragGraphics.setVisible(false);
        this.renderCells();
        return;
      }

      const dropCell = canvasToCell(
        pointer.x, pointer.y,
        this.state.width, this.state.height,
        this.layout.cellSize,
        this.layout.offsetX,
        this.layout.offsetY
      );

      if (dropCell && this.onMerge) {
        const dr = Math.abs(dropCell.r - dragStartCell.r);
        const dc = Math.abs(dropCell.c - dragStartCell.c);
        if (dr + dc === 1 && !(dropCell.r === dragStartCell.r && dropCell.c === dragStartCell.c)) {
          this.onMerge(dragStartCell.r, dragStartCell.c, dropCell.r, dropCell.c);
        }
      }

      isDragging = false;
      dragStartCell = null;
      this.dragGraphics.setVisible(false);
      this.renderCells();
    });
  }

  updateDragItem(px, py, tier) {
    this.dragGraphics.clear();
    this.dragGraphics.setVisible(true);

    const cellSize = this.layout.cellSize;
    const half = cellSize / 2;
    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#888';
    const phaserColor = Phaser.Display.Color.HexStringToColor(color).color;

    this.dragGraphics.save();
    this.dragGraphics.setPosition(px, py);
    this.dragGraphics.setRotation(0.04);
    this.dragGraphics.setScale(1.08, 1.08);

    // Shadow
    this.dragGraphics.fillStyle(0x000000, 0.4);
    this.dragGraphics.fillRoundedRect(-half + 4, -half + 4, cellSize, cellSize, CELL_RADIUS);

    // Body gradient
    const gradColor = this.lightenColor(color, 10);
    const gradPhaser = Phaser.Display.Color.HexStringToColor(gradColor).color;
    this.dragGraphics.fillStyle(gradPhaser, 1);
    this.dragGraphics.fillRoundedRect(-half, -half, cellSize, cellSize, CELL_RADIUS);

    // Top sheen
    this.dragGraphics.fillStyle(0xffffff, 0.3);
    this.dragGraphics.fillRoundedRect(-half + 2, -half + 2, cellSize - 4, cellSize * 0.45, [CELL_RADIUS - 2, CELL_RADIUS - 2, 0, 0]);

    // Tier label
    const label = TIER_LABELS[Math.min(tier, TIER_LABELS.length - 1)];
    this.dragGraphics.fillStyle(0xffffff, 1);
    this.dragGraphics.setFontStyle('bold');
    this.dragGraphics.setFontSize(Math.round(cellSize * 0.38));
    this.dragGraphics.setTextAlign('center');
    this.dragGraphics.setTextBaseline('middle');
    this.dragGraphics.fillText(label, 0, 0);

    this.dragGraphics.restore();
  }

  renderCells(drag = null) {
    // Draw background gradient
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x16213e, 1);
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-100);

    for (let r = 0; r < this.state.height; r++) {
      for (let c = 0; c < this.state.width; c++) {
        this.drawCell(r, c, drag);
      }
    }

    // Win tint
    if (this.state.status === 'won') {
      const tint = this.add.graphics();
      tint.fillStyle(0x000000, 0.3);
      tint.fillRect(0, 0, width, height);
      tint.setDepth(100);
    }
  }

  drawCell(r, c, drag) {
    const graphics = this.cellGraphics[r]?.[c];
    const container = this.cellContainers[r]?.[c];
    if (!graphics || !container) return;

    graphics.clear();

    const tier = this.state.grid[r]?.[c] || 0;
    const cellSize = this.layout.cellSize;
    const pos = getCellPosition(r, c, cellSize, this.layout.offsetX, this.layout.offsetY);

    const isDragging = drag && drag.fromR === r && drag.fromC === c;
    const isHighlight = drag && tier !== 0 && tier === this.state.grid[drag.fromR]?.[drag.fromC] && !(r === drag.fromR && c === drag.fromC);
    const isHinted = this.hintCells && tier !== 0 && (
      (r === this.hintCells.r1 && c === this.hintCells.c1) ||
      (r === this.hintCells.r2 && c === this.hintCells.c2)
    );

    // Reset container scale
    container.setScale(1);

    if (tier === 0) {
      // Empty cell
      graphics.fillStyle(Phaser.Display.Color.HexStringToColor(CELL_BG).color, 0.07);
      graphics.fillRoundedRect(0, 0, cellSize, cellSize, CELL_RADIUS);
      return;
    }

    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#888';
    const phaserColor = Phaser.Display.Color.HexStringToColor(color).color;
    const alpha = isDragging ? 0.25 : 1;

    // Hint glow for suggested merge cells
    if (isHinted && !this.reducedMotion) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 300);
      graphics.lineStyle(3, 0xffc800, 0.8 + 0.2 * pulse);
      graphics.strokeRoundedRect(-2, -2, cellSize + 4, cellSize + 4, CELL_RADIUS + 2);
    }

    graphics.setAlpha(alpha);

    // Shadow
    graphics.fillStyle(0x000000, 0.22);
    graphics.fillRoundedRect(0, 3, cellSize, cellSize, CELL_RADIUS);

    // Tier glow for higher tiers
    if (tier >= 4) {
      graphics.lineStyle(2, phaserColor, 0.5);
      graphics.strokeRoundedRect(-2, -2, cellSize + 4, cellSize + 4, CELL_RADIUS + 2);
    }

    // Body
    const bodyColor = this.lightenColor(color, 10);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(bodyColor).color, 1);
    graphics.fillRoundedRect(0, 0, cellSize, cellSize, CELL_RADIUS);

    // Highlight ring when matching drag target
    if (isHighlight) {
      graphics.lineStyle(2.5, 0xffffff, 1);
      graphics.strokeRoundedRect(1, 1, cellSize - 2, cellSize - 2, CELL_RADIUS);
    }

    // Top sheen
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRoundedRect(2, 2, cellSize - 4, cellSize * 0.45, [CELL_RADIUS - 2, CELL_RADIUS - 2, 0, 0]);

    // Tier label
    const label = TIER_LABELS[Math.min(tier, TIER_LABELS.length - 1)];
    graphics.setAlpha(1);
    graphics.fillStyle(0xffffff, 1);
    graphics.setFontStyle('bold');
    graphics.setFontSize(Math.round(cellSize * 0.40));
    graphics.setTextAlign('center');
    graphics.setTextBaseline('middle');
    graphics.fillText(label, cellSize / 2, cellSize / 2);
  }

  lightenColor(hex, pct) {
    const n = parseInt(hex.replace('#', ''), 16);
    const a = Math.round(2.55 * pct);
    return `#${[
      Math.min(255, (n >> 16) + a),
      Math.min(255, ((n >> 8) & 0xff) + a),
      Math.min(255, (n & 0xff) + a)
    ].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  setState(newState) {
    this.state = newState;
    this.updateLayout();
    this.renderCells();
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setHintCells(r1, c1, r2, c2) {
    // Clear existing hint tweens
    this.hintTweens.forEach(t => t.stop());
    this.hintTweens = [];

    this.hintCells = (r1 === null) ? null : { r1, c1, r2, c2 };

    if (this.hintCells && !this.reducedMotion) {
      // Create pulsing hint effect
      const cells = [
        this.cellContainers[this.hintCells.r1]?.[this.hintCells.c1],
        this.cellContainers[this.hintCells.r2]?.[this.hintCells.c2]
      ];

      cells.forEach(container => {
        if (container) {
          const tween = this.tweens.add({
            targets: container,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          this.hintTweens.push(tween);
        }
      });
    }

    this.renderCells();
  }

  spawnMergeBurst(r, c, tier) {
    if (this.reducedMotion) return;

    const cellSize = this.layout.cellSize;
    const pos = getCellPosition(r, c, cellSize, this.layout.offsetX, this.layout.offsetY);
    const cx = pos.x + cellSize / 2;
    const cy = pos.y + cellSize / 2;
    const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)] || '#fff';
    const phaserColor = Phaser.Display.Color.HexStringToColor(color).color;

    // Create particle explosion
    const particleCount = 12 + tier * 3;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * (2 + tier);
      const particle = this.add.graphics();
      particle.fillStyle(phaserColor, 1);
      const r = 2 + Math.random() * 3;
      particle.fillCircle(0, 0, r);
      particle.setPosition(cx, cy);

      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * speed * 30,
        y: cy + Math.sin(angle) * speed * 30 + 20,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 600 + Math.random() * 200,
        ease: 'Power2.easeOut',
        onComplete: () => particle.destroy()
      });
    }

    // Elastic scale pop on the cell
    const container = this.cellContainers[r]?.[c];
    if (container) {
      this.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 210,
        ease: 'Elastic.easeOut',
        yoyo: true,
        repeat: 0
      });
    }
  }

  resize(state) {
    this.state = state;
    this.updateLayout();
    this.createCellObjects();
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
  let onMergeCallback = null;
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
    backgroundColor: '#16213e',
    transparent: true
  };

  function maybeStartScene() {
    if (!gameReady || !lastState || sceneStarted) return;
    sceneStarted = true;
    game.scene.add('MergeGamesScene', MergeGamesScene, true, {
      state: lastState,
      onMerge: onMergeCallback,
      reducedMotion
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
      scene = game.scene.getScene('MergeGamesScene');
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

  function render(state, drag) {
    lastState = state;
    maybeStartScene();
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.renderCells(drag);
    }
  }

  function canvasToCell(x, y) {
    const s = getScene();
    if (!s || !s.layout) return null;
    return canvasToCell(
      x, y,
      s.state.width,
      s.state.height,
      s.layout.cellSize,
      s.layout.offsetX,
      s.layout.offsetY
    );
  }

  function spawnMergeBurst(r, c, tier) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.spawnMergeBurst(r, c, tier);
    }
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    const s = getScene();
    if (s) {
      s.setReducedMotion(value);
    }
  }

  function setHintCells(r1, c1, r2, c2) {
    const s = getScene();
    if (s) {
      s.setHintCells(r1, c1, r2, c2);
    }
  }

  function setOnMerge(callback) {
    onMergeCallback = callback;
    const s = getScene();
    if (s) {
      s.onMerge = callback;
    }
  }

  function stopLoop() {
    // Phaser handles its own loop
  }

  function getCellSize() {
    const s = getScene();
    return s && s.layout ? s.layout.cellSize : 60;
  }

  // Initialize the game
  init();

  return {
    resize,
    render,
    canvasToCell,
    spawnMergeBurst,
    setReducedMotion,
    setHintCells,
    stopLoop,
    getCellSize,
    setOnMerge,
    get cellSize() {
      return getCellSize();
    }
  };
}

export default { createRenderer, calculateLayout, getCellPosition, canvasToCell };
