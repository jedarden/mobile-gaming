/**
 * Pull the Pin - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Drop shadows for 3D depth illusion
 * - Scale-pop animation when balls enter cups
 * - Squash/stretch on ball landing
 * - Confetti burst on level complete
 * - Pin pull ease-out with ring ripple
 * - Background grid for spatial reference
 */

import Phaser from 'phaser';
import { BALL_RADIUS } from './state.js';
import { getPatternLabel } from '../../shared/color-blind.js';

// Color palette
const COLORS = {
  red: '#FF6B6B',
  blue: '#4DABF7',
  green: '#69DB7C',
  yellow: '#FFD93D',
  purple: '#B197FC',
  orange: '#FFA94D'
};

const UI = {
  pinMetal: '#8B8B8B',
  pinHighlight: '#C0C0C0',
  pinShadow: '#4A4A4A',
  channelWall: '#3D3D3D',
  channelHighlight: '#5A5A5A',
  background1: '#E8F4F8',
  background2: '#D0E8F0'
};

/**
 * Hit-test a pin at coordinates - pure function for reusability
 */
export function hitTestPin(x, y, pin) {
  const handleRadius = 10;

  // Check main body
  if (x >= pin.x - 20 && x <= pin.x + 20 &&
      y >= pin.y - 10 && y <= pin.y + 10) {
    return true;
  }

  // Check handle circle
  const handleX = pin.x + 30;
  const handleY = pin.y;
  const dist = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2);
  if (dist <= handleRadius) {
    return true;
  }

  return false;
}

/**
 * Find pin at coordinates - pure hit-testing function
 */
export function getPinAtPosition(x, y, pins) {
  for (const pin of pins) {
    if (!pin.removed && hitTestPin(x, y, pin)) {
      return pin;
    }
  }
  return null;
}

/**
 * Pull the Pin Phaser Scene
 */
class PullThePinScene extends Phaser.Scene {
  constructor() {
    super('PullThePinScene');
    this.state = null;
    this.onPinTap = null;
    this.reducedMotion = false;
    this.colorBlindMode = false;
    this.hintPinId = null;
    this.lastState = null;
    this.winAnimStarted = false;

    // Graphics objects
    this.backgroundGraphics = null;
    this.channelGraphics = null;
    this.cupGraphics = [];
    this.ballGraphics = [];
    this.pinGraphics = [];
    this.uiText = null;
    this.statusText = null;

    // Animation state
    this.cupPops = new Map();
    this.pinRipples = new Map();
    this.confettiParticles = [];
  }

  init(data) {
    this.state = data.state;
    this.onPinTap = data.onPinTap;
    this.reducedMotion = data.reducedMotion || false;
    this.colorBlindMode = data.colorBlindMode || false;
  }

  create() {
    // Create background
    this.backgroundGraphics = this.add.graphics();
    this.channelGraphics = this.add.graphics();

    // Create UI text
    this.statusText = this.add.text(this.scale.width / 2, 40, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#4CAF50'
    }).setOrigin(0.5);

    this.pinCountText = this.add.text(10, 25, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#666666'
    });

    // Setup input
    this.setupInput();

    // Initial render
    this.renderScene();
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (!this.state || this.state.status !== 'playing') return;

      const pin = getPinAtPosition(pointer.x, pointer.y, this.state.pins);
      if (pin && this.onPinTap) {
        this.onPinTap(pin.id);
      }
    });
  }

  renderScene() {
    this.renderBackground();
    this.renderGrid();
    this.renderChannels();
    this.renderCups();
    this.renderBalls();
    this.renderPins();
    this.renderConfetti();
    this.renderUI();
  }

  renderBackground() {
    const { width, height } = this.scale;
    const g = this.backgroundGraphics;
    g.clear();

    // Gradient background
    const color1 = Phaser.Display.Color.HexStringToColor(UI.background1).color;
    const color2 = Phaser.Display.Color.HexStringToColor(UI.background2).color;

    for (let y = 0; y < height; y++) {
      const t = y / height;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(color1),
        Phaser.Display.Color.IntegerToColor(color2),
        100, t * 100
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(0, y, width, 1);
    }
  }

  renderGrid() {
    const { width, height } = this.scale;
    const g = this.backgroundGraphics;
    const step = 24;
    const dotColor = Phaser.Display.Color.HexStringToColor('rgba(100, 150, 180, 0.12)').color;

    g.fillStyle(0x6496B4, 0.12);
    for (let x = step; x < width; x += step) {
      for (let y = step; y < height; y += step) {
        g.fillCircle(x, y, 1.5);
      }
    }
  }

  renderChannels() {
    if (!this.state) return;
    const g = this.channelGraphics;
    g.clear();

    const channels = this.state.channels || [];
    for (const channel of channels) {
      const isBlocked = this.state.pins.some(p => p.id === channel.blockedByPin && !p.removed);

      // Shadow side
      g.lineStyle(isBlocked ? 5 : 8, 0x000000, 0.18);
      for (const seg of channel.segments) {
        g.beginPath();
        g.moveTo(seg.x1 + 1, seg.y1 + 2);
        g.lineTo(seg.x2 + 1, seg.y2 + 2);
        g.strokePath();
      }

      // Main wall
      const wallColor = Phaser.Display.Color.HexStringToColor(isBlocked ? '#666666' : UI.channelWall).color;
      g.lineStyle(isBlocked ? 4 : 6, wallColor, 1);
      for (const seg of channel.segments) {
        g.beginPath();
        g.moveTo(seg.x1, seg.y1);
        g.lineTo(seg.x2, seg.y2);
        g.strokePath();
      }

      if (!isBlocked) {
        const highlightColor = Phaser.Display.Color.HexStringToColor(UI.channelHighlight).color;
        g.lineStyle(2, highlightColor, 1);
        for (const seg of channel.segments) {
          g.beginPath();
          g.moveTo(seg.x1 + 1, seg.y1 + 1);
          g.lineTo(seg.x2 + 1, seg.y2 + 1);
          g.strokePath();
        }
      }
    }
  }

  renderCups() {
    // Clear existing cup graphics
    this.cupGraphics.forEach(g => g.destroy());
    this.cupGraphics = [];

    if (!this.state) return;

    const t = this.time.now;

    for (const cup of this.state.cups) {
      const graphics = this.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(COLORS[cup.acceptColor] || '#888888').color;

      const pop = this.cupPops.get(cup.id);
      let scale = 1;

      if (pop) {
        const elapsed = (t - pop.startTime) / 300;
        if (elapsed < 1) {
          scale = 1 + 0.12 * this.easeOutElastic(elapsed);
        } else {
          this.cupPops.delete(cup.id);
        }
      }

      const topWidth = cup.width;
      const bottomWidth = cup.width * 0.7;
      const x = cup.x;
      const y = cup.y;
      const cx = x + topWidth / 2;
      const cy = y + cup.height / 2;

      graphics.setScale(scale, scale);
      graphics.setPosition((1 - scale) * cx, (1 - scale) * cy);

      // Drop shadow
      graphics.fillStyle(0x000000, 0.25);
      graphics.fillEllipse(cx, cy + cup.height / 2 + 3, topWidth * 0.9, 8);

      // Cup shape (trapezoid)
      graphics.beginPath();
      graphics.moveTo(x, y);
      graphics.lineTo(x + topWidth, y);
      graphics.lineTo(x + (topWidth + bottomWidth) / 2, y + cup.height);
      graphics.lineTo(x + (topWidth - bottomWidth) / 2, y + cup.height);
      graphics.closePath();

      // Gradient fill
      graphics.fillStyle(0xffffff, 0.92);
      graphics.fillPath();

      graphics.lineStyle(pop ? 3.5 : 2.5, color, 1);
      graphics.strokePath();

      // Color stripe at top
      graphics.fillStyle(color, 1);
      graphics.fillRect(x + 5, y - 8, topWidth - 10, 6);

      // Color-blind label
      if (this.colorBlindMode) {
        const label = getPatternLabel(cup.acceptColor);
        if (label) {
          const labelText = this.add.text(x + topWidth / 2, y - 5, label, {
            fontFamily: 'monospace',
            fontSize: '10px',
            fontStyle: 'bold',
            color: 'rgba(0,0,0,0.85)'
          }).setOrigin(0.5);
          graphics.addChild = labelText; // Track for cleanup
        }
      }

      // Glow when captured balls present
      if (cup.captured && cup.captured.length > 0) {
        graphics.lineStyle(2, color, 1);
        graphics.setAlpha(0.8);
      }

      this.cupGraphics.push(graphics);
    }
  }

  renderBalls() {
    // Clear existing ball graphics
    this.ballGraphics.forEach(g => g.destroy());
    this.ballGraphics = [];

    if (!this.state) return;

    for (const ball of this.state.balls) {
      if (ball.lost) continue;

      const graphics = this.add.graphics();
      const x = ball.x;
      const y = ball.settled && ball.cupId
        ? this.getCupBallPosition(ball.cupId, ball)
        : ball.y;
      const color = Phaser.Display.Color.HexStringToColor(COLORS[ball.color] || '#888888').color;
      const r = BALL_RADIUS;

      // Squash calculation
      const velY = ball.vy || 0;
      const squash = ball.settled ? 1 : Math.max(0.85, 1 - Math.abs(velY) * 0.012);
      const scaleX = ball.settled ? 1 : 1 / squash;
      const scaleY = squash;

      // Drop shadow
      graphics.fillStyle(0x000000, 0.20);
      graphics.fillEllipse(x + 3, y + 3, r * scaleX * 0.9 * 2, r * scaleY * 0.5 * 2);

      // Main ball with gradient effect
      graphics.save();
      graphics.translateCanvas(x, y);
      graphics.scaleCanvas(scaleX, scaleY);

      // Ball gradient (approximated with multiple circles)
      const lightColor = this.lightenColor(COLORS[ball.color] || '#888888', 40);
      const darkColor = this.darkenColor(COLORS[ball.color] || '#888888', 20);
      const lightColorInt = Phaser.Display.Color.HexStringToColor(lightColor).color;
      const darkColorInt = Phaser.Display.Color.HexStringToColor(darkColor).color;

      graphics.fillStyle(darkColorInt, 1);
      graphics.fillCircle(0, 0, r);

      graphics.fillStyle(color, 1);
      graphics.fillCircle(0, 0, r * 0.85);

      graphics.fillStyle(lightColorInt, 1);
      graphics.fillCircle(-r * 0.15, -r * 0.15, r * 0.65);

      // Specular highlight
      graphics.fillStyle(0xffffff, 0.62);
      graphics.fillCircle(-r * 0.27, -r * 0.27, r * 0.28);

      // Edge gloss
      graphics.lineStyle(1.5, 0xffffff, 0.18);
      graphics.strokeCircle(0, 0, r);

      // Color-blind label
      if (this.colorBlindMode) {
        const label = getPatternLabel(ball.color);
        if (label) {
          const labelText = this.add.text(0, 0, label, {
            fontFamily: 'monospace',
            fontSize: `${Math.round(r * 0.9)}px`,
            fontStyle: 'bold',
            color: 'rgba(255,255,255,0.9)'
          }).setOrigin(0.5);
          graphics.addChild = labelText;
        }
      }

      graphics.restore();

      this.ballGraphics.push(graphics);
    }
  }

  renderPins() {
    // Clear existing pin graphics
    this.pinGraphics.forEach(g => g.destroy());
    this.pinGraphics = [];

    if (!this.state) return;

    const t = this.time.now;

    // Draw removal ripples first (behind everything)
    for (const [pinId, ripple] of this.pinRipples) {
      const elapsed = (t - ripple.startTime) / 500;
      if (elapsed >= 1) {
        this.pinRipples.delete(pinId);
        continue;
      }

      const rippleGraphics = this.add.graphics();
      const radius = 20 + elapsed * 40;
      const alpha = (1 - elapsed) * 0.5;

      rippleGraphics.lineStyle(2, 0xC8C8C8, alpha);
      rippleGraphics.strokeCircle(ripple.x, ripple.y, radius);

      this.pinGraphics.push(rippleGraphics);
    }

    for (const pin of this.state.pins) {
      if (pin.removed) continue;

      const graphics = this.add.graphics();
      const x = pin.x;
      const y = pin.y;
      const pw = 40;
      const ph = 12;

      // Hint glow
      if (pin.id === this.hintPinId) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 300);
        graphics.lineStyle(2.5, 0xFFC800, 0.8 + 0.2 * pulse);
        graphics.strokeRoundedRect(x - pw / 2 - 4, y - ph / 2 - 4, pw + 8, ph + 8, 8);

        // Glow effect
        graphics.fillStyle(0xFFDC32, 0.5 + 0.4 * pulse);
        graphics.fillRoundedRect(x - pw / 2 - 4, y - ph / 2 - 4, pw + 8, ph + 8, 8);
      }

      // Drop shadow
      graphics.fillStyle(0x000000, 0.3);
      graphics.fillRoundedRect(x - pw / 2 + 2, y - ph / 2 + 3, pw, ph, 5);

      // Metallic gradient (approximated)
      const highlightColor = Phaser.Display.Color.HexStringToColor(UI.pinHighlight).color;
      const metalColor = Phaser.Display.Color.HexStringToColor(UI.pinMetal).color;
      const shadowColor = Phaser.Display.Color.HexStringToColor(UI.pinShadow).color;

      // Main body
      graphics.fillStyle(metalColor, 1);
      graphics.fillRoundedRect(x - pw / 2, y - ph / 2, pw, ph, 5);

      // Highlight stripe
      graphics.fillStyle(highlightColor, 1);
      graphics.fillRect(x - pw / 2 + 4, y - ph / 2 + 2, pw - 8, 3);

      // Border
      graphics.lineStyle(1, shadowColor, 1);
      graphics.strokeRoundedRect(x - pw / 2, y - ph / 2, pw, ph, 5);

      // Pull handle (ring)
      const hx = x + pw / 2 + 10;
      graphics.fillStyle(highlightColor, 1);
      graphics.fillCircle(hx, y, 9);
      graphics.lineStyle(1.5, shadowColor, 1);
      graphics.strokeCircle(hx, y, 9);

      // Inner ring
      graphics.lineStyle(2, metalColor, 1);
      graphics.strokeCircle(hx, y, 4.5);

      this.pinGraphics.push(graphics);
    }
  }

  renderConfetti() {
    // Clean up old confetti
    this.confettiParticles.forEach(p => {
      if (p.sprite) p.sprite.destroy();
    });
    this.confettiParticles = this.confettiParticles.filter(p => p.life > 0 && p.y < this.scale.height + 20);

    // Update and render confetti
    for (const p of this.confettiParticles) {
      if (!p.sprite) {
        p.sprite = this.add.graphics();
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= 0.012;

      const g = p.sprite;
      g.clear();
      g.save();
      g.translateCanvas(p.x, p.y);
      g.rotateCanvas(p.rotation);
      g.globalAlpha = Math.min(1, p.life * 2);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(p.color).color, 1);
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
  }

  renderUI() {
    if (!this.state) return;

    if (this.state.status === 'won') {
      this.statusText.setText('Level Complete!');
      this.statusText.setColor('#4CAF50');
    } else if (this.state.status === 'lost') {
      this.statusText.setText('Try Again');
      this.statusText.setColor('#F44336');
    } else {
      this.statusText.setText('');
    }

    const remainingPins = this.state.pins.filter(p => !p.removed).length;
    this.pinCountText.setText(`Pins: ${remainingPins}`);
  }

  setState(newState) {
    // Check for state transitions and trigger animations
    this.updateAnimations(newState);
    this.state = newState;
    this.renderScene();
  }

  updateAnimations(state) {
    if (!this.lastState) {
      this.lastState = state;
      return;
    }

    // Detect balls newly settled into cups
    for (const ball of state.balls) {
      if (ball.settled && ball.cupId) {
        const prev = this.lastState.balls.find(b => b.id === ball.id);
        if (prev && !prev.settled) {
          this.cupPops.set(ball.cupId, { startTime: this.time.now, color: COLORS[ball.color] || '#888' });
        }
      }
    }

    // Detect pins newly removed
    for (const pin of state.pins) {
      if (pin.removed) {
        const prev = this.lastState.pins.find(p => p.id === pin.id);
        if (prev && !prev.removed) {
          this.pinRipples.set(pin.id, { startTime: this.time.now, x: pin.x, y: pin.y });
        }
      }
    }

    // Level complete confetti
    if (state.status === 'won' && !this.winAnimStarted) {
      this.winAnimStarted = true;
      if (!this.reducedMotion) {
        this.spawnConfetti();
      }
    }
    if (state.status !== 'won') {
      this.winAnimStarted = false;
    }

    this.lastState = state;
  }

  spawnConfetti() {
    const { width } = this.scale;
    const colors = Object.values(COLORS);

    for (let i = 0; i < 60; i++) {
      this.confettiParticles.push({
        x: Math.random() * width,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        life: 1,
        sprite: null
      });
    }
  }

  getCupBallPosition(cupId, ball) {
    const cup = this.state.cups.find(c => c.id === cupId);
    if (!cup) return ball.y;
    const ballIndex = cup.captured.findIndex(c => c.id === ball.id);
    const stackOffset = ballIndex >= 0 ? ballIndex * (BALL_RADIUS * 1.5) : 0;
    return cup.y + cup.height - BALL_RADIUS - stackOffset;
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setColorBlindMode(value) {
    this.colorBlindMode = value;
    this.renderScene();
  }

  setHintPin(id) {
    this.hintPinId = id;
  }

  resetAnimations() {
    this.cupPops.clear();
    this.pinRipples.clear();
    this.confettiParticles.forEach(p => {
      if (p.sprite) p.sprite.destroy();
    });
    this.confettiParticles = [];
    this.winAnimStarted = false;
    this.lastState = null;
    this.hintPinId = null;
  }

  // Easing helpers
  easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  }

  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  startLoop() {
    // Confetti animation loop - already handled in renderScene
  }
}

/**
 * Create renderer instance - returns Phaser game and API
 */
export function createRenderer(canvas) {
  let game = null;
  let scene = null;
  let reducedMotion = false;
  let colorBlindMode = false;
  let onPinTapCallback = null;

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
    scene: PullThePinScene,
    backgroundColor: '#E8F4F8',
    transparent: true
  };

  function init() {
    game = new Phaser.Game(gameConfig);
  }

  function getScene() {
    if (!scene) {
      scene = game.scene.getScene('PullThePinScene');
    }
    return scene;
  }

  function render(state) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      s.setState(state);
    }
  }

  function resetAnimations() {
    const s = getScene();
    if (s) {
      s.resetAnimations();
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

  function setHintPin(id) {
    const s = getScene();
    if (s) {
      s.setHintPin(id);
    }
  }

  function setOnPinTap(callback) {
    onPinTapCallback = callback;
    const s = getScene();
    if (s) {
      s.onPinTap = callback;
    }
  }

  function startLoop() {
    const s = getScene();
    if (s) {
      s.startLoop();
    }
  }

  // Initialize the game
  init();

  return {
    render,
    resetAnimations,
    setReducedMotion,
    setColorBlindMode,
    setHintPin,
    setOnPinTap,
    startLoop
  };
}

export default { createRenderer, COLORS, UI, hitTestPin, getPinAtPosition };
