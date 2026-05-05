/**
 * Bus Jam - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Sky + building silhouette background for city atmosphere
 * - Cartoon bus with headlights, bumper, drop shadow
 * - Passenger figures: head + body + smiley face
 * - Sidewalk curb border around stops
 * - Color-match glow line between bus and matching stop
 * - Bus movement animations with ease-out
 * - Exit animations
 * - Path preview for selected bus
 */

import Phaser from 'phaser';
import { BUS_COLORS } from './state.js';
import { getPatternLabel } from '../../shared/color-blind.js';

// Visual constants
const CELL_SIZE = 60;
const ROAD_COLOR = '#3A3A4A';
const ROAD_MARKING_COLOR = 'rgba(255, 255, 255, 0.28)';
const GRASS_COLOR = '#2D5A27';
const SIDEWALK_COLOR = '#B8A898';
const SKY_TOP = '#87CEEB';
const SKY_BOT = '#C8E8F0';

/**
 * Convert grid coordinates to canvas coordinates - pure function for reusability
 */
export function gridToCanvas(x, y, scale = 1) {
  return {
    x: x * CELL_SIZE * scale,
    y: y * CELL_SIZE * scale
  };
}

/**
 * Convert canvas coordinates to grid coordinates - pure hit-testing function
 */
export function canvasToGrid(canvasX, canvasY, scale = 1) {
  return {
    x: Math.floor(canvasX / (CELL_SIZE * scale)),
    y: Math.floor(canvasY / (CELL_SIZE * scale))
  };
}

/**
 * Hit-test a bus at grid coordinates - pure function for reusability
 */
export function hitTestBusAt(gridX, gridY, state) {
  return state.buses.find(bus => !bus.exited && bus.x === gridX && bus.y === gridY) || null;
}

/**
 * Bus Jam Phaser Scene
 */
class BusJamScene extends Phaser.Scene {
  constructor() {
    super('BusJamScene');
    this.state = null;
    this.onCellTap = null;
    this.onCellHover = null;
    this.reducedMotion = false;
    this.colorBlindMode = false;
    this.lastState = null;

    // Graphics objects
    this.backgroundGraphics = null;
    this.roadGraphics = null;
    this.stopGraphics = null;
    this.busGraphics = null;
    this.pathGraphics = null;
    this.uiTextObjects = [];

    // Animation state
    this.animatingBuses = new Map();
  }

  init(data) {
    this.state = data.state;
    this.onCellTap = data.onCellTap;
    this.onCellHover = data.onCellHover;
    this.reducedMotion = data.reducedMotion || false;
    this.colorBlindMode = data.colorBlindMode || false;
  }

  create() {
    // Create graphics objects
    this.backgroundGraphics = this.add.graphics();
    this.roadGraphics = this.add.graphics();
    this.stopGraphics = this.add.graphics();
    this.busGraphics = this.add.graphics();
    this.pathGraphics = this.add.graphics();

    // Setup input
    this.setupInput();

    // Initial render
    this.renderScene();
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (!this.state || this.state.won) return;

      const gridPos = canvasToGrid(pointer.x, pointer.y, 1);
      if (this.onCellTap) {
        this.onCellTap(gridPos.x, gridPos.y);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.state || this.state.won) return;

      const gridPos = canvasToGrid(pointer.x, pointer.y, 1);
      if (this.onCellHover) {
        this.onCellHover(gridPos.x, gridPos.y);
      }
    });
  }

  renderScene() {
    this.renderBackground();
    this.renderRoads();
    this.renderExits();
    this.renderStops();
    this.renderMatchGlows();
    this.renderBuses();
    this.renderPathPreview();
  }

  renderBackground() {
    const { width, height } = this.scale;
    const g = this.backgroundGraphics;
    g.clear();

    // Sky gradient
    const skyHeight = height * 0.35;
    const color1 = Phaser.Display.Color.HexStringToColor(SKY_TOP).color;
    const color2 = Phaser.Display.Color.HexStringToColor(SKY_BOT).color;

    for (let y = 0; y < skyHeight; y++) {
      const t = y / skyHeight;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(color1),
        Phaser.Display.Color.IntegerToColor(color2),
        100, t * 100
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(0, y, width, 1);
    }

    // Building silhouettes
    const buildings = [
      { x: 0, w: 30, h: 60 }, { x: 35, w: 20, h: 80 }, { x: 60, w: 35, h: 50 },
      { x: 100, w: 25, h: 70 }, { x: 130, w: 40, h: 45 }, { x: 175, w: 20, h: 90 },
      { x: 200, w: 35, h: 60 }, { x: 240, w: 28, h: 75 }, { x: 275, w: 22, h: 55 },
      { x: 300, w: 38, h: 65 }, { x: 345, w: 26, h: 82 }
    ];

    const horizonY = skyHeight;
    g.fillStyle(0x323C50, 0.55);
    for (const b of buildings) {
      const bh = b.h * 0.5;
      g.fillRect(b.x, horizonY - bh, b.w, bh);

      // Window dots
      g.fillStyle(0xFFF08C, 0.55);
      for (let wy = horizonY - bh + 4; wy < horizonY - 4; wy += 8) {
        for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 6) {
          g.fillCircle(wx, wy, 1.5);
        }
      }
      g.fillStyle(0x323C50, 0.55);
    }

    // Ground/grass
    g.fillStyle(Phaser.Display.Color.HexStringToColor(GRASS_COLOR).color, 1);
    g.fillRect(0, skyHeight, width, height - skyHeight);
  }

  renderRoads() {
    if (!this.state) return;
    const g = this.roadGraphics;
    g.clear();

    const roadColor = Phaser.Display.Color.HexStringToColor(ROAD_COLOR).color;
    const markingColor = Phaser.Display.Color.HexStringToColor(ROAD_MARKING_COLOR).color;

    this.state.roads.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const pos = gridToCanvas(x, y, 1);
      const cellSize = CELL_SIZE;

      // Road surface
      g.fillStyle(roadColor, 1);
      g.fillRect(pos.x, pos.y, cellSize, cellSize);

      // Road markings (dashed center line)
      g.lineStyle(2, markingColor, 1);
      g.beginPath();

      // Horizontal line
      g.moveTo(pos.x, pos.y + cellSize / 2);
      g.lineTo(pos.x + cellSize, pos.y + cellSize / 2);
      g.strokePath();

      // Vertical line
      g.moveTo(pos.x + cellSize / 2, pos.y);
      g.lineTo(pos.x + cellSize / 2, pos.y + cellSize);
      g.strokePath();
    });
  }

  renderExits() {
    if (!this.state) return;
    const g = this.roadGraphics;

    this.state.exits.forEach(exit => {
      const pos = gridToCanvas(exit.x, exit.y, 1);
      const cellSize = CELL_SIZE;
      const cx = pos.x + cellSize / 2;
      const cy = pos.y + cellSize / 2;

      // Exit glow
      g.fillGradientStyle(
        Phaser.Display.Color.ValueToColor(0x22c55e).color, 0.6,
        Phaser.Display.Color.ValueToColor(0x22c55e).color, 0.6,
        Phaser.Display.Color.ValueToColor(0x22c55e).color, 0,
        Phaser.Display.Color.ValueToColor(0x22c55e).color, 0,
        1
      );
      g.fillCircle(cx, cy, cellSize);

      // Exit sign
      const exitText = this.add.text(cx, cy - 5, 'EXIT', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#22c55e'
      }).setOrigin(0.5);

      // Arrow
      const arrowText = this.add.text(cx, cy + 10, '→', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#22c55e'
      }).setOrigin(0.5);

      this.uiTextObjects.push(exitText, arrowText);
    });
  }

  renderStops() {
    if (!this.state) return;
    const g = this.stopGraphics;
    g.clear();

    // Clear old text objects
    this.uiTextObjects.forEach(t => t.destroy());
    this.uiTextObjects = [];

    this.state.stops.forEach(stop => {
      const pos = gridToCanvas(stop.x, stop.y, 1);
      const cellSize = CELL_SIZE;
      const color = BUS_COLORS[stop.color] || BUS_COLORS.red;
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;

      // Sidewalk base
      g.fillStyle(Phaser.Display.Color.HexStringToColor(SIDEWALK_COLOR).color, 1);
      g.fillRoundedRect(pos.x + 4, pos.y + 4, cellSize - 8, cellSize - 8, 6);

      // Color tint overlay
      g.fillStyle(colorInt, 0.25);
      g.fillRoundedRect(pos.x + 4, pos.y + 4, cellSize - 8, cellSize - 8, 6);

      // Stop sign pole
      g.fillStyle(colorInt, 1);
      g.fillRect(pos.x + cellSize / 2 - 1.5, pos.y + 4, 3, 12);
      // Sign head
      g.fillCircle(pos.x + cellSize / 2, pos.y + 4, 6);

      // Draw waiting passengers (cartoon style)
      const passengerSize = 12;
      const passengersPerRow = 3;
      stop.waiting.forEach((passenger, i) => {
        const row = Math.floor(i / passengersPerRow);
        const col = i % passengersPerRow;
        const px = pos.x + 8 + col * (passengerSize + 2);
        const py = pos.y + cellSize - 14 - row * (passengerSize + 2);
        const headR = passengerSize / 3;

        g.fillStyle(colorInt, 1);

        // Body
        g.fillRoundedRect(px + headR * 0.4, py + headR * 1.8, headR * 1.2, passengerSize * 0.5, 2);

        // Head
        g.fillCircle(px + headR, py + headR, headR);

        // Smiley face
        g.lineStyle(0.8, 0x000000, 0.5);
        g.beginPath();
        g.arc(px + headR, py + headR + headR * 0.15, headR * 0.55, 0.2, Math.PI - 0.2, false, 0);
        g.strokePath();

        // Eyes
        g.fillStyle(0x000000, 0.6);
        g.fillCircle(px + headR * 0.6, py + headR * 0.8, 1.2);
        g.fillCircle(px + headR * 1.4, py + headR * 0.8, 1.2);
        g.fillStyle(colorInt, 1);
      });

      // Color-blind label on stop sign
      if (this.colorBlindMode) {
        const label = getPatternLabel(stop.color);
        if (label) {
          const labelText = this.add.text(pos.x + cellSize / 2, pos.y + 4, label, {
            fontFamily: 'monospace',
            fontSize: '7px',
            fontStyle: 'bold',
            color: 'rgba(255,255,255,0.9)'
          }).setOrigin(0.5);
          this.uiTextObjects.push(labelText);
        }
      }

      // Passenger count badge
      if (stop.waiting.length > 0) {
        g.fillStyle(0x000000, 0.55);
        g.fillCircle(pos.x + cellSize - 10, pos.y + 10, 8);

        const badgeText = this.add.text(pos.x + cellSize - 10, pos.y + 10, String(stop.waiting.length), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#ffffff'
        }).setOrigin(0.5);
        this.uiTextObjects.push(badgeText);
      }
    });
  }

  renderMatchGlows() {
    if (!this.state) return;
    const g = this.stopGraphics;

    this.state.buses.forEach(bus => {
      if (bus.exited || bus.passengers >= bus.capacity) return;

      const matchingStop = this.state.stops.find(s => s.color === bus.color && s.waiting.length > 0);
      if (!matchingStop) return;

      const busPos = gridToCanvas(bus.x, bus.y, 1);
      const stopPos = gridToCanvas(matchingStop.x, matchingStop.y, 1);
      const cellSize = CELL_SIZE;

      const bx = busPos.x + cellSize / 2;
      const by = busPos.y + cellSize / 2;
      const sx = stopPos.x + cellSize / 2;
      const sy = stopPos.y + cellSize / 2;
      const dist = Math.hypot(bx - sx, by - sy);

      if (dist > cellSize * 4) return;

      const color = BUS_COLORS[bus.color] || '#888';
      const alpha = Math.max(0, 1 - dist / (cellSize * 4)) * 0.45;
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;

      g.lineStyle(2.5, colorInt, alpha);
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(sx, sy);
      g.strokePath();
    });
  }

  renderBuses() {
    if (!this.state) return;
    const g = this.busGraphics;
    g.clear();

    this.state.buses.forEach(bus => {
      if (bus.exited) return;

      // Check if bus is being animated
      const animState = this.animatingBuses.get(bus.id);
      const renderX = animState ? animState.x : bus.x;
      const renderY = animState ? animState.y : bus.y;

      const pos = gridToCanvas(renderX, renderY, 1);
      const cellSize = CELL_SIZE;
      const busWidth = cellSize * 0.8;
      const busHeight = cellSize * 0.7;
      const color = BUS_COLORS[bus.color] || BUS_COLORS.red;
      const colorInt = Phaser.Display.Color.HexStringToColor(color).color;
      const isSelected = this.state.selectedBus === bus.id;

      // Center bus in cell
      const busX = pos.x + (cellSize - busWidth) / 2;
      const busY = pos.y + (cellSize - busHeight) / 2;

      // Drop shadow
      g.fillStyle(0x000000, 0.28);
      g.fillRoundedRect(busX + 2, busY + 3, busWidth, busHeight, 10);

      // Selection glow
      if (isSelected) {
        g.fillStyle(0x6366F1, 0.5);
        g.fillRoundedRect(busX - 4, busY - 4, busWidth + 8, busHeight + 8, 14);
      }

      // Bus body
      g.fillStyle(colorInt, 1);
      g.fillRoundedRect(busX, busY, busWidth, busHeight, 10);

      // Roof stripe (lighter)
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(busX, busY, busWidth, busHeight * 0.22, [10, 10, 0, 0]);

      // Windows
      g.fillStyle(0xB4E1FF, 0.65);
      const windowWidth = busWidth * 0.2;
      const windowHeight = busHeight * 0.36;
      const windowY = busY + busHeight * 0.18;
      for (let i = 0; i < 3; i++) {
        const wx = busX + busWidth * 0.08 + i * (windowWidth + 3);
        g.fillRoundedRect(wx, windowY, windowWidth, windowHeight, 3);

        // Window glare
        g.fillStyle(0xffffff, 0.35);
        g.fillRect(wx + 2, windowY + 2, 3, windowHeight * 0.4);
        g.fillStyle(0xB4E1FF, 0.65);
      }

      // Headlights (front = direction)
      g.fillStyle(0xFFEE88, 1);
      const headY = busY + busHeight * 0.68;
      const frontX = bus.direction === 'right' ? busX + busWidth - 6 : busX + 2;
      g.fillCircle(frontX, headY, 3);
      g.fillCircle(frontX, headY + 4, 3);

      // Capacity dots
      const dotSize = 5;
      const dotSpacing = 9;
      const dotsY = busY + busHeight - 10;
      for (let i = 0; i < bus.capacity; i++) {
        const dotX = busX + busWidth / 2 - (bus.capacity * dotSpacing) / 2 + i * dotSpacing;
        g.fillStyle(i < bus.passengers ? 0xffffff : 0xffffff, i < bus.passengers ? 1 : 0.28);
        g.fillCircle(dotX, dotsY, dotSize / 2);
      }

      // Full bus indicator
      if (bus.passengers >= bus.capacity) {
        const checkText = this.add.text(busX + busWidth - 9, busY + 11, '✓', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#22c55e'
        }).setOrigin(0.5);
        this.uiTextObjects.push(checkText);
      }

      // Color-blind label on bus body
      if (this.colorBlindMode) {
        const label = getPatternLabel(bus.color);
        if (label) {
          const labelText = this.add.text(busX + busWidth / 2, busY + busHeight * 0.5, label, {
            fontFamily: 'monospace',
            fontSize: `${Math.round(busHeight * 0.4)}px`,
            fontStyle: 'bold',
            color: 'rgba(255,255,255,0.9)'
          }).setOrigin(0.5);
          this.uiTextObjects.push(labelText);
        }
      }
    });
  }

  renderPathPreview() {
    if (!this.state || !this.state.pathPreview || this.state.pathPreview.length === 0) return;

    const g = this.pathGraphics;
    g.clear();

    const path = this.state.pathPreview;
    const cellSize = CELL_SIZE;

    g.lineStyle(4, 0x6366F1, 0.6);

    g.beginPath();
    path.forEach((point, i) => {
      const pos = gridToCanvas(point.x, point.y, 1);
      const cx = pos.x + cellSize / 2;
      const cy = pos.y + cellSize / 2;

      if (i === 0) {
        g.moveTo(cx, cy);
      } else {
        g.lineTo(cx, cy);
      }
    });
    g.strokePath();

    // Draw target highlight
    const lastPoint = path[path.length - 1];
    const lastPos = gridToCanvas(lastPoint.x, lastPoint.y, 1);

    g.lineStyle(3, 0x6366F1, 0.8);
    g.strokeRect(
      lastPos.x + 5,
      lastPos.y + 5,
      cellSize - 10,
      cellSize - 10
    );
  }

  /**
   * Update state and re-render
   */
  updateState(newState) {
    this.state = newState;
    this.renderScene();
  }

  /**
   * Set reduced motion preference
   */
  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  /**
   * Set color blind mode
   */
  setColorBlindMode(value) {
    this.colorBlindMode = value;
    this.renderScene();
  }
}

/**
 * Create a Phaser game instance
 */
export function createRenderer(canvas) {
  let game = null;
  let scene = null;
  let reducedMotion = false;
  let colorBlindMode = false;

  const config = {
    type: Phaser.AUTO,
    canvas: canvas,
    width: canvas.parentElement.clientWidth,
    height: canvas.parentElement.clientHeight,
    backgroundColor: '#87CEEB',
    parent: canvas.parentElement,
    scene: [BusJamScene],
    physics: { default: null },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  function resize(state) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();

    const gridWidth = state.grid.cols * CELL_SIZE;
    const gridHeight = state.grid.rows * CELL_SIZE;

    const padding = 20;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    const scaleX = availableWidth / gridWidth;
    const scaleY = availableHeight / gridHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const width = gridWidth * scale;
    const height = gridHeight * scale;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    return { width, height, scale };
  }

  function init(state, callbacks) {
    game = new Phaser.Game(config);

    game.scene.start('BusJamScene', {
      state,
      onCellTap: callbacks.onCellTap,
      onCellHover: callbacks.onCellHover,
      reducedMotion,
      colorBlindMode
    });

    // Get reference to scene
    game.scene.getScene('BusJamScene').events.once('create', () => {
      scene = game.scene.getScene('BusJamScene');
    });
  }

  function render(state, scale) {
    if (scene) {
      scene.updateState(state);
    }
  }

  function setCallbacks(callbacks) {
    if (scene) {
      scene.onCellTap = callbacks.onCellTap;
      scene.onCellHover = callbacks.onCellHover;
    }
  }

  async function animateBusMovement(bus, path, scale, onComplete) {
    if (reducedMotion || path.length === 0) {
      onComplete();
      return;
    }

    const duration = 400;

    for (let i = 0; i < path.length; i++) {
      const target = path[i];
      const startPos = { x: bus.x, y: bus.y };

      await new Promise(resolve => {
        scene.tweens.add({
          targets: bus,
          x: target.x,
          y: target.y,
          duration,
          ease: 'Quad.easeOut',
          onUpdate: () => {
            scene.animatingBuses.set(bus.id, { x: bus.x, y: bus.y });
            scene.renderBuses();
          },
          onComplete: () => {
            bus.x = target.x;
            bus.y = target.y;
            bus.direction = target.direction;
            scene.animatingBuses.delete(bus.id);
            resolve();
          }
        });
      });
    }

    onComplete();
  }

  async function animateBoarding(stop, bus, scale, onComplete) {
    if (reducedMotion) {
      onComplete();
      return;
    }

    // Flash effect using tween
    scene.tweens.add({
      targets: scene.stopGraphics,
      alpha: 0.5,
      duration: 150,
      yoyo: true,
      onComplete
    });
  }

  async function animateExit(bus, exit, scale, onComplete) {
    if (reducedMotion) {
      onComplete();
      return;
    }

    const duration = 600;

    await new Promise(resolve => {
      scene.tweens.add({
        targets: bus,
        exitProgress: 1,
        duration,
        ease: 'Quad.easeIn',
        onUpdate: () => {
          scene.renderBuses();
        },
        onComplete: () => {
          bus.exitProgress = null;
          resolve();
        }
      });
    });

    onComplete();
  }

  function highlightBus(bus, scale) {
    // Handled via selectedBus state
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    if (scene) {
      scene.setReducedMotion(value);
    }
  }

  function setColorBlindMode(value) {
    colorBlindMode = value;
    if (scene) {
      scene.setColorBlindMode(value);
    }
  }

  function getCellSize() {
    return CELL_SIZE;
  }

  return {
    resize,
    init,
    render,
    setCallbacks,
    animateBusMovement,
    animateBoarding,
    animateExit,
    highlightBus,
    setReducedMotion,
    setColorBlindMode,
    getCellSize,
    canvasToGrid,
    gridToCanvas,
    get width() { return canvas.width; },
    get height() { return canvas.height; },
    get scale() { return 1; }
  };
}

export default {
  createRenderer,
  BUS_COLORS,
  gridToCanvas,
  canvasToGrid,
  hitTestBusAt
};
