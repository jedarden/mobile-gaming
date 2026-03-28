/**
 * Parking Escape - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Asphalt texture with painted parking-space markings
 * - Toy-car 3D shading (top face highlight + right/bottom shadow face)
 * - Selection lift: expanded drop-shadow when vehicle is selected
 * - Smooth slide animation with ease-out-back bounce
 * - Exit particle burst when hero car exits
 * - Screen shake on blocked drag
 */

import Phaser from 'phaser';

const PADDING = 16;
const EXIT_COLOR = '#FFD700';
const HERO_COLOR = '#E74C3C';
const HERO_GLOW = 'rgba(231,76,60,0.5)';
const ANIM_DURATION = 180; // ms per cell slide

/**
 * Layout utilities - pure functions for grid positioning
 */
export function calculateLayout(gridWidth, gridHeight, containerWidth, containerHeight) {
  const avail = Math.min(containerWidth, containerHeight) - PADDING * 2;
  const cellSize = Math.floor(avail / gridWidth);
  const gridPx = cellSize * gridWidth;

  return {
    cellSize,
    offsetX: (containerWidth - gridPx) / 2,
    offsetY: (containerHeight - gridPx) / 2,
    gridWidth,
    gridHeight
  };
}

export function gridToCanvas(col, row, layout) {
  return {
    x: layout.offsetX + col * layout.cellSize,
    y: layout.offsetY + row * layout.cellSize
  };
}

export function canvasToGrid(px, py, layout) {
  return {
    col: Math.floor((px - layout.offsetX) / layout.cellSize),
    row: Math.floor((py - layout.offsetY) / layout.cellSize)
  };
}

/**
 * Hit-test for vehicle at canvas coordinates - pure function
 */
export function hitTestVehicleAt(px, py, state, layout) {
  const { col, row } = canvasToGrid(px, py, layout);
  for (const v of state.vehicles) {
    if (v.orientation === 'horizontal') {
      if (row === v.y && col >= v.x && col < v.x + v.width) return v.id;
    } else {
      if (col === v.x && row >= v.y && row < v.y + v.height) return v.id;
    }
  }
  return null;
}

/**
 * Compute snap move from drag delta - pure function
 */
export function computeSnapMoveFromDelta(vehicle, dx, dy, cellSize) {
  if (vehicle.orientation === 'horizontal') {
    const cells = Math.round(dx / cellSize);
    if (cells === 0) return null;
    return { direction: cells > 0 ? 'right' : 'left', distance: Math.abs(cells) };
  } else {
    const cells = Math.round(dy / cellSize);
    if (cells === 0) return null;
    return { direction: cells > 0 ? 'down' : 'up', distance: Math.abs(cells) };
  }
}

// Color utilities
function lighten(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.min(255, (n >> 16) + a);
  const G = Math.min(255, ((n >> 8) & 0xff) + a);
  const B = Math.min(255, (n & 0xff) + a);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function darken(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.max(0, (n >> 16) - a);
  const G = Math.max(0, ((n >> 8) & 0xff) - a);
  const B = Math.max(0, (n & 0xff) - a);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Parking Escape Phaser Scene
 */
class ParkingEscapeScene extends Phaser.Scene {
  constructor() {
    super('ParkingEscapeScene');
    this.gridGraphics = null;
    this.vehicleGraphics = new Map();
    this.vehicleContainers = new Map();
    this.exitParticles = [];
    this.hintVehicleId = null;
    this.reducedMotion = false;
    this.slideTweens = new Map();
    this.hintTweens = new Map();
    this.shakeTween = null;
    this.state = null;
    this.layout = null;
    this.drag = null;
    this.selectedId = null;
  }

  init(data) {
    this.state = data.state;
    this.reducedMotion = data.reducedMotion || false;
    this.onDragStart = data.onDragStart;
    this.onDragMove = data.onDragMove;
    this.onDragEnd = data.onDragEnd;
  }

  create() {
    this.updateLayout();
    this.drawGrid();
    this.createVehicleObjects();
    this.setupInput();
  }

  updateLayout() {
    const { width, height } = this.scale;
    this.layout = calculateLayout(
      this.state.grid.width,
      this.state.grid.height,
      width,
      height
    );
  }

  drawGrid() {
    // Create or clear grid graphics
    if (this.gridGraphics) {
      this.gridGraphics.destroy();
    }
    this.gridGraphics = this.add.graphics();

    const { cellSize, offsetX, offsetY } = this.layout;
    const gw = this.state.grid.width;
    const gh = this.state.grid.height;
    const gridPxW = gw * cellSize;
    const gridPxH = gh * cellSize;

    // Outer border
    this.gridGraphics.lineStyle(2, 0xffffff, 0.15);
    this.gridGraphics.strokeRoundedRect(offsetX - 2, offsetY - 2, gridPxW + 4, gridPxH + 4, 10);

    // Asphalt fill with gradient effect
    const centerX = offsetX + gridPxW / 2;
    const centerY = offsetY + gridPxH / 2;
    const maxRadius = Math.max(gridPxW, gridPxH) * 0.7;

    // Base dark color
    this.gridGraphics.fillStyle(0x2a2a2a, 1);
    this.gridGraphics.fillRoundedRect(offsetX, offsetY, gridPxW, gridPxH, 8);

    // Subtle gradient overlay
    this.gridGraphics.fillStyle(0x383838, 0.5);
    this.gridGraphics.fillRoundedRect(offsetX, offsetY, gridPxW, gridPxH * 0.4, 8);

    // Asphalt grain dots
    this.gridGraphics.fillStyle(0xffffff, 0.025);
    for (let c = 0; c < gw; c++) {
      for (let r = 0; r < gh; r++) {
        const seed = c * 37 + r * 17;
        const sx = offsetX + c * cellSize + (seed % 23) / 23 * cellSize;
        const sy = offsetY + r * cellSize + ((seed * 13) % 31) / 31 * cellSize;
        this.gridGraphics.fillCircle(sx, sy, 1.5);
      }
    }

    // Parking space lines (dashed yellow)
    this.gridGraphics.lineStyle(1.5, 0xffe664, 0.22);
    for (let c = 1; c < gw; c++) {
      const x = offsetX + c * cellSize;
      // Draw dashed line manually
      for (let y = offsetY + 4; y < offsetY + gridPxH - 4; y += cellSize * 0.5) {
        const dashLen = cellSize * 0.2;
        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(x, y);
        this.gridGraphics.lineTo(x, Math.min(y + dashLen, offsetY + gridPxH - 4));
        this.gridGraphics.strokePath();
      }
    }
    for (let r = 1; r < gh; r++) {
      const y = offsetY + r * cellSize;
      for (let x = offsetX + 4; x < offsetX + gridPxW - 4; x += cellSize * 0.5) {
        const dashLen = cellSize * 0.2;
        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(x, y);
        this.gridGraphics.lineTo(Math.min(x + dashLen, offsetX + gridPxW - 4), y);
        this.gridGraphics.strokePath();
      }
    }

    // Exit gap and arrow
    const exit = this.state.grid.exit;
    const exitY = offsetY + exit.y * cellSize + 4;
    const exitH = cellSize - 8;

    // Clear border for exit gap
    this.gridGraphics.clear();
    this.gridGraphics.fillStyle(0x000000, 0);
    this.gridGraphics.fillRect(offsetX + gridPxW - 3, exitY, 8, exitH);

    // Redraw the grid elements up to the exit
    this.gridGraphics = this.add.graphics();

    // Outer border (with gap for exit)
    this.gridGraphics.lineStyle(2, 0xffffff, 0.15);
    // Top border
    this.gridGraphics.beginPath();
    this.gridGraphics.moveTo(offsetX - 2, offsetY - 2);
    this.gridGraphics.lineTo(offsetX + gridPxW + 2, offsetY - 2);
    this.gridGraphics.strokePath();
    // Left border
    this.gridGraphics.beginPath();
    this.gridGraphics.moveTo(offsetX - 2, offsetY - 2);
    this.gridGraphics.lineTo(offsetX - 2, offsetY + gridPxH + 2);
    this.gridGraphics.strokePath();
    // Bottom border
    this.gridGraphics.beginPath();
    this.gridGraphics.moveTo(offsetX - 2, offsetY + gridPxH + 2);
    this.gridGraphics.lineTo(offsetX + gridPxW + 2, offsetY + gridPxH + 2);
    this.gridGraphics.strokePath();
    // Right border (with gap for exit)
    this.gridGraphics.beginPath();
    this.gridGraphics.moveTo(offsetX + gridPxW + 2, offsetY - 2);
    this.gridGraphics.lineTo(offsetX + gridPxW + 2, exitY);
    this.gridGraphics.strokePath();
    this.gridGraphics.beginPath();
    this.gridGraphics.moveTo(offsetX + gridPxW + 2, exitY + exitH);
    this.gridGraphics.lineTo(offsetX + gridPxW + 2, offsetY + gridPxH + 2);
    this.gridGraphics.strokePath();

    // Asphalt fill
    this.gridGraphics.fillStyle(0x2a2a2a, 1);
    this.gridGraphics.fillRoundedRect(offsetX, offsetY, gridPxW, gridPxH, 8);
    this.gridGraphics.fillStyle(0x383838, 0.5);
    this.gridGraphics.fillRect(offsetX, offsetY, gridPxW, gridPxH * 0.4);

    // Grain dots
    this.gridGraphics.fillStyle(0xffffff, 0.025);
    for (let c = 0; c < gw; c++) {
      for (let r = 0; r < gh; r++) {
        const seed = c * 37 + r * 17;
        const sx = offsetX + c * cellSize + (seed % 23) / 23 * cellSize;
        const sy = offsetY + r * cellSize + ((seed * 13) % 31) / 31 * cellSize;
        this.gridGraphics.fillCircle(sx, sy, 1.5);
      }
    }

    // Parking space lines
    this.gridGraphics.lineStyle(1.5, 0xffe664, 0.22);
    for (let c = 1; c < gw; c++) {
      const x = offsetX + c * cellSize;
      for (let y = offsetY + 4; y < offsetY + gridPxH - 4; y += cellSize * 0.5) {
        const dashLen = cellSize * 0.2;
        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(x, y);
        this.gridGraphics.lineTo(x, Math.min(y + dashLen, offsetY + gridPxH - 4));
        this.gridGraphics.strokePath();
      }
    }
    for (let r = 1; r < gh; r++) {
      const y = offsetY + r * cellSize;
      for (let x = offsetX + 4; x < offsetX + gridPxW - 4; x += cellSize * 0.5) {
        const dashLen = cellSize * 0.2;
        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(x, y);
        this.gridGraphics.lineTo(Math.min(x + dashLen, offsetX + gridPxW - 4), y);
        this.gridGraphics.strokePath();
      }
    }

    // Exit glow cone
    const ax = offsetX + gridPxW + 6;
    const ay = offsetY + exit.y * cellSize + cellSize / 2;

    const glowGraphics = this.add.graphics();
    glowGraphics.fillStyle(0xffd700, 0.35);
    glowGraphics.fillTriangle(
      ax, ay,
      ax + cellSize, ay - cellSize / 2,
      ax + cellSize, ay + cellSize / 2
    );
    glowGraphics.fillStyle(0xffd700, 0.15);
    glowGraphics.fillTriangle(
      ax, ay,
      ax + cellSize * 1.5, ay - cellSize * 0.7,
      ax + cellSize * 1.5, ay + cellSize * 0.7
    );

    // Exit arrow
    const arrowGraphics = this.add.graphics();
    arrowGraphics.fillStyle(0xffd700, 1);
    arrowGraphics.beginPath();
    arrowGraphics.moveTo(ax, ay - 9);
    arrowGraphics.lineTo(ax + 15, ay);
    arrowGraphics.lineTo(ax, ay + 9);
    arrowGraphics.closePath();
    arrowGraphics.fillPath();

    // Arrow glow
    arrowGraphics.fillStyle(0xffd700, 0.3);
    arrowGraphics.fillCircle(ax + 7, ay, 18);
  }

  createVehicleObjects() {
    // Clear existing vehicle objects
    this.vehicleGraphics.forEach(g => g.destroy());
    this.vehicleContainers.forEach(c => c.destroy());
    this.vehicleGraphics.clear();
    this.vehicleContainers.clear();

    for (const v of this.state.vehicles) {
      this.createVehicleGraphics(v);
    }

    this.updateVehiclePositions();
  }

  createVehicleGraphics(v) {
    const { cellSize, offsetX, offsetY } = this.layout;
    const margin = 4;
    const pos = gridToCanvas(v.x, v.y, this.layout);
    const pw = v.width * cellSize - margin * 2;
    const ph = v.height * cellSize - margin * 2;
    const r = Math.min(12, cellSize / 5);
    const depth = Math.round(cellSize * 0.10);

    const container = this.add.container(pos.x + margin, pos.y + margin);
    const graphics = this.add.graphics();

    const isHero = v.type === 'hero';

    // Side face (shadow)
    const sideColor = Phaser.Display.Color.HexStringToColor(darken(v.color, 30)).color;
    graphics.fillStyle(sideColor, 1);
    graphics.fillRoundedRect(depth, depth, pw, ph, r);

    // Top face gradient
    const topColor = Phaser.Display.Color.HexStringToColor(v.color).color;
    const lightColor = Phaser.Display.Color.HexStringToColor(lighten(v.color, 22)).color;
    const darkColor = Phaser.Display.Color.HexStringToColor(darken(v.color, 12)).color;

    // Main body
    graphics.fillStyle(topColor, 1);
    graphics.fillRoundedRect(0, 0, pw, ph, r);

    // Gradient overlay (top highlight)
    graphics.fillStyle(lightColor, 0.4);
    graphics.fillRoundedRect(0, 0, pw, ph * 0.5, r);

    // Border
    graphics.lineStyle(1.5, 0xffffff, 0.22);
    graphics.strokeRoundedRect(0, 0, pw, ph, r);

    // Top highlight strip
    graphics.fillStyle(0xffffff, 0.28);
    graphics.fillRoundedRect(4, 3, pw - 8, ph * 0.22, r * 0.5);

    // Windows
    graphics.fillStyle(0xc8f0ff, 0.35);
    if (v.orientation === 'horizontal') {
      const ww = pw * 0.28;
      const wh = ph * 0.38;
      const wy = ph * 0.2;
      graphics.fillRect(pw * 0.1, wy, ww, wh);
      graphics.fillRect(pw * 0.62, wy, ww, wh);
    } else {
      const ww = pw * 0.52;
      const wh = ph * 0.14;
      const wx = pw * 0.24;
      graphics.fillRect(wx, ph * 0.1, ww, wh);
      if (v.height >= 3) graphics.fillRect(wx, ph * 0.45, ww, wh);
    }

    // Windshield glare
    graphics.fillStyle(0xffffff, 0.12);
    if (v.orientation === 'horizontal') {
      graphics.beginPath();
      graphics.moveTo(pw * 0.1, ph * 0.2);
      graphics.lineTo(pw * 0.38, ph * 0.2);
      graphics.lineTo(pw * 0.28, ph * 0.58);
      graphics.lineTo(pw * 0.1, ph * 0.58);
      graphics.closePath();
      graphics.fillPath();
    } else {
      graphics.beginPath();
      graphics.moveTo(pw * 0.24, ph * 0.1);
      graphics.lineTo(pw * 0.76, ph * 0.1);
      graphics.lineTo(pw * 0.65, ph * 0.24);
      graphics.lineTo(pw * 0.24, ph * 0.24);
      graphics.closePath();
      graphics.fillPath();
    }

    // Hero glow
    if (isHero) {
      const glowGraphics = this.add.graphics();
      glowGraphics.lineStyle(3, 0xe74c3c, 0.5);
      glowGraphics.strokeRoundedRect(-4, -4, pw + 8, ph + 8, r + 2);
      container.add(glowGraphics);
    }

    container.add(graphics);
    this.vehicleContainers.set(v.id, container);
    this.vehicleGraphics.set(v.id, graphics);
  }

  updateVehiclePositions() {
    for (const v of this.state.vehicles) {
      const container = this.vehicleContainers.get(v.id);
      if (!container) continue;

      const margin = 4;
      const pos = gridToCanvas(v.x, v.y, this.layout);
      container.setPosition(pos.x + margin, pos.y + margin);

      // Bring hero to top
      if (v.type === 'hero') {
        container.setDepth(10);
      }
    }
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.state.status !== 'playing') return;

      const vehicleId = hitTestVehicleAt(pointer.x, pointer.y, this.state, this.layout);
      if (!vehicleId) return;

      const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;

      this.drag = {
        vehicleId,
        axis: vehicle.orientation === 'horizontal' ? 'x' : 'y',
        startX: pointer.x,
        startY: pointer.y,
        currentDx: 0,
        currentDy: 0
      };

      // Bring dragged vehicle to top
      const container = this.vehicleContainers.get(vehicleId);
      if (container) {
        container.setDepth(100);
      }

      if (this.onDragStart) {
        this.onDragStart(vehicleId);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.drag) return;

      this.drag.currentDx = this.drag.axis === 'x' ? pointer.x - this.drag.startX : 0;
      this.drag.currentDy = this.drag.axis === 'y' ? pointer.y - this.drag.startY : 0;

      // Update vehicle position visually
      const container = this.vehicleContainers.get(this.drag.vehicleId);
      const vehicle = this.state.vehicles.find(v => v.id === this.drag.vehicleId);
      if (container && vehicle) {
        const margin = 4;
        const pos = gridToCanvas(vehicle.x, vehicle.y, this.layout);
        container.setPosition(
          pos.x + margin + this.drag.currentDx,
          pos.y + margin + this.drag.currentDy
        );
      }

      if (this.onDragMove) {
        this.onDragMove(this.drag.vehicleId, this.drag.currentDx, this.drag.currentDy);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (!this.drag) return;

      const vehicle = this.state.vehicles.find(v => v.id === this.drag.vehicleId);
      if (vehicle && this.onDragEnd) {
        this.onDragEnd(this.drag.vehicleId, this.drag.currentDx, this.drag.currentDy);
      }

      this.drag = null;
    });
  }

  setState(newState) {
    this.state = newState;
    this.updateLayout();
    this.drawGrid();
    this.createVehicleObjects();
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setHintVehicle(vehicleId) {
    // Clear existing hint tweens
    this.hintTweens.forEach(tween => tween.stop());
    this.hintTweens.clear();

    this.hintVehicleId = vehicleId;

    if (vehicleId !== null && !this.reducedMotion) {
      const container = this.vehicleContainers.get(vehicleId);
      const graphics = this.vehicleGraphics.get(vehicleId);
      if (container && graphics) {
        // Pulsing hint glow
        this.hintTweens.set(vehicleId, this.tweens.add({
          targets: container,
          alpha: { from: 1, to: 0.7 },
          duration: 300,
          yoyo: true,
          repeat: -1
        }));
      }
    } else {
      // Reset alpha for all vehicles
      this.vehicleContainers.forEach((container, id) => {
        container.setAlpha(1);
      });
    }
  }

  render(state, drag, selectedId) {
    this.state = state;
    this.drag = drag;
    this.selectedId = selectedId;

    // Update vehicle positions
    for (const v of state.vehicles) {
      const container = this.vehicleContainers.get(v.id);
      if (!container) {
        this.createVehicleGraphics(v);
        continue;
      }

      const margin = 4;
      let pos = gridToCanvas(v.x, v.y, this.layout);
      let offsetX = 0;
      let offsetY = 0;

      // Apply drag offset
      if (drag && drag.vehicleId === v.id) {
        offsetX = drag.dx || 0;
        offsetY = drag.dy || 0;
      }

      container.setPosition(pos.x + margin + offsetX, pos.y + margin + offsetY);

      // Selection highlight
      const isSelected = selectedId === v.id || (drag && drag.vehicleId === v.id);
      if (isSelected) {
        container.setDepth(100);
      } else if (v.type === 'hero') {
        container.setDepth(10);
      } else {
        container.setDepth(1);
      }
    }

    // Win overlay
    if (state.status === 'won') {
      if (!this.winOverlay) {
        this.winOverlay = this.add.graphics();
        this.winOverlay.setDepth(1000);
      }
      this.winOverlay.clear();
      this.winOverlay.fillStyle(0x000000, 0.35);
      this.winOverlay.fillRect(0, 0, this.scale.width, this.scale.height);
    } else if (this.winOverlay) {
      this.winOverlay.clear();
    }
  }

  animateSlide(vehicleId, fromGridX, fromGridY, toGridX, toGridY, cells) {
    if (this.reducedMotion) return;

    const container = this.vehicleContainers.get(vehicleId);
    if (!container) return;

    // Stop existing tween for this vehicle
    const existingTween = this.slideTweens.get(vehicleId);
    if (existingTween) existingTween.stop();

    const { cellSize } = this.layout;
    const margin = 4;
    const targetPos = gridToCanvas(toGridX, toGridY, this.layout);

    this.slideTweens.set(vehicleId, this.tweens.add({
      targets: container,
      x: targetPos.x + margin,
      y: targetPos.y + margin,
      duration: ANIM_DURATION * Math.max(1, cells),
      ease: 'Back.easeOut',
      onComplete: () => {
        this.slideTweens.delete(vehicleId);
      }
    }));
  }

  shake(durationMs = 300, amplitude = 4) {
    if (this.reducedMotion) return;

    // Stop existing shake
    if (this.shakeTween) this.shakeTween.stop();

    const cam = this.cameras.main;
    const originalX = cam.scrollX;
    const originalY = cam.scrollY;

    this.shakeTween = this.tweens.add({
      targets: cam,
      scrollX: originalX + amplitude,
      scrollY: originalY + amplitude,
      duration: 50,
      yoyo: true,
      repeat: Math.floor(durationMs / 100),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        cam.scrollX = originalX;
        cam.scrollY = originalY;
      }
    });
  }

  onHeroExit(exitRow) {
    if (this.reducedMotion) return;

    const { cellSize, offsetX, offsetY } = this.layout;
    const x = offsetX + (6 * cellSize) + 20;
    const y = offsetY + exitRow * cellSize + cellSize / 2;

    const colors = [0xe74c3c, 0xffd700, 0xffffff, 0xff8c42, 0xff3cac];

    // Create particle emitter
    const particles = this.add.particles(x, y, null, {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 800,
      quantity: 40,
      emitting: false
    });

    // Emit burst
    particles.explode(40);

    // Create manual particles since we don't have a texture
    for (let i = 0; i < 40; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const size = 4 + Math.random() * 6;

      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillRect(-size / 2, -size / 2, size, size * 0.75);
      particle.setPosition(x, y);
      particle.setRotation(Math.random() * Math.PI * 2);
      particle.setDepth(500);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 100,
        alpha: 0,
        rotation: particle.rotation + (Math.random() - 0.5) * 2,
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  resize(state) {
    this.state = state;
    this.updateLayout();
    this.drawGrid();
    this.createVehicleObjects();
  }

  // API methods for external access
  hitTestVehicle(px, py) {
    return hitTestVehicleAt(px, py, this.state, this.layout);
  }

  computeSnapMove(vehicle, dx, dy) {
    return computeSnapMoveFromDelta(vehicle, dx, dy, this.layout.cellSize);
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
  let hintVehicleId = null;

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
    scene: ParkingEscapeScene,
    backgroundColor: '#1a1a2e',
    transparent: true
  };

  function init() {
    game = new Phaser.Game(gameConfig);
  }

  function getScene() {
    if (!scene) {
      scene = game.scene.getScene('ParkingEscapeScene');
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

  function render(state, drag, selectedId) {
    lastState = state;
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.render(state, drag, selectedId);
    }
  }

  function hitTestVehicle(px, py, state) {
    const s = getScene();
    if (!s || !s.layout) return null;
    return hitTestVehicleAt(px, py, state, s.layout);
  }

  function computeSnapMove(vehicle, dx, dy, _state) {
    const s = getScene();
    if (!s || !s.layout) return null;
    return computeSnapMoveFromDelta(vehicle, dx, dy, s.layout.cellSize);
  }

  function animateSlide(vehicleId, fromGridX, fromGridY, toGridX, toGridY, cells) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.animateSlide(vehicleId, fromGridX, fromGridY, toGridX, toGridY, cells);
    }
  }

  function shake(durationMs = 300, amplitude = 4) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.shake(durationMs, amplitude);
    }
  }

  function onHeroExit(exitRow) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.onHeroExit(exitRow);
    }
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    const s = getScene();
    if (s) {
      s.setReducedMotion(value);
    }
  }

  function setHintVehicle(id) {
    hintVehicleId = id;
    const s = getScene();
    if (s) {
      s.setHintVehicle(id);
    }
  }

  function setCallbacks({ onDragStart, onDragMove, onDragEnd }) {
    const s = getScene();
    if (s) {
      s.onDragStart = onDragStart;
      s.onDragMove = onDragMove;
      s.onDragEnd = onDragEnd;
    }
  }

  function getCellSize() {
    const s = getScene();
    return s && s.layout ? s.layout.cellSize : 60;
  }

  function getOffset() {
    const s = getScene();
    return s && s.layout ? { x: s.layout.offsetX, y: s.layout.offsetY } : { x: 16, y: 16 };
  }

  // Initialize the game
  init();

  return {
    resize,
    render,
    hitTestVehicle,
    computeSnapMove,
    animateSlide,
    shake,
    onHeroExit,
    setReducedMotion,
    setHintVehicle,
    setCallbacks,
    getCellSize,
    getOffset
  };
}

export default {
  createRenderer,
  calculateLayout,
  gridToCanvas,
  canvasToGrid,
  hitTestVehicleAt,
  computeSnapMoveFromDelta
};
