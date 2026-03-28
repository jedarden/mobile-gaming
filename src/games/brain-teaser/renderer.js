/**
 * Brain Teaser - Phaser Renderer
 *
 * Migrated from Canvas 2D to Phaser 3 game framework.
 * Visual improvements preserved:
 * - Notebook/lined-paper background for doodle-puzzle aesthetic
 * - Handwriting-style font for prompt text
 * - Sketch wobble on element borders (three slightly offset strokes)
 * - Rainbow confetti rain on celebration
 * - Comedic fail reaction: big emoji face + dramatic shake
 */

import Phaser from 'phaser';

// Visual constants
const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 600;
const PADDING = 20;

// Handwriting font stack (Comic Sans as fallback for notebook feel)
const HAND_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";

// Colors — warm cream notebook palette
const COLORS = {
  background: 0xfdf6e3,       // warm cream
  notebookLine: 'rgba(100,140,200,0.18)',
  prompt: '#2a2a2a',           // dark ink
  banner: 0xff6b6b,
  bannerText: '#ffffff',
  element: 0x4a4a6a,
  elementHover: 0x5a5a7a,
  elementActive: 0x6a6a8a,
  text: '#ffffff',
  success: '#4ade80',
  error: '#ef4444',
  sparkle: [0xffd700, 0xff69b4, 0x00ffff, 0x7cfc00, 0xff6347, 0x9b59b6, 0x3498db]
};

/** Deterministic wobble offset — creates hand-drawn feel */
function wobble(seed) {
  return ((seed * 7919) % 7 - 3) * 0.7;
}

/**
 * Hit test for an element - pure function
 */
export function hitTest(canvasX, canvasY, element, scale) {
  const x = element.x * scale;
  const y = element.y * scale;
  const w = (element.w || 60) * scale;
  const h = (element.h || 60) * scale;

  return canvasX >= x && canvasX <= x + w &&
         canvasY >= y && canvasY <= y + h;
}

/**
 * Find element at canvas position - pure function
 */
export function getElementAt(canvasX, canvasY, elements, scale) {
  // Check in reverse order (top elements first)
  const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  for (const element of sorted) {
    if (!element.hidden && hitTest(canvasX, canvasY, element, scale)) {
      return element;
    }
  }

  return null;
}

/**
 * Brain Teaser Phaser Scene
 */
class BrainTeaserScene extends Phaser.Scene {
  constructor() {
    super('BrainTeaserScene');
    this.state = null;
    this.scale = 1;
    this.reducedMotion = false;
    this.hintTargetId = null;
    this.hintTween = null;
    this.animating = false;
    this.shakeOffset = { x: 0, y: 0 };
    this.flashAlpha = 0;
    this.failEmojiAlpha = 0;
    this.failEmojiScale = 1;
    this.particles = [];
    this.backgroundGraphics = null;
    this.elementGraphics = null;
    this.overlayGraphics = null;
    this.emojiText = null;
  }

  init(data) {
    this.state = data.state;
    this.reducedMotion = data.reducedMotion || false;
    this.onElementTap = data.onElementTap;
    this.onDragStart = data.onDragStart;
    this.onDragMove = data.onDragMove;
    this.onDragEnd = data.onDragEnd;
    this.getElementAtCallback = data.getElementAtCallback;
  }

  create() {
    const { width, height } = this.scale;
    this.currentWidth = width;
    this.currentHeight = height;
    this.scale = width / CANVAS_WIDTH;

    // Background graphics
    this.backgroundGraphics = this.add.graphics();

    // Element graphics
    this.elementGraphics = this.add.graphics();

    // Overlay graphics (for flash, shake effects)
    this.overlayGraphics = this.add.graphics();

    // Fail emoji text
    this.emojiText = this.add.text(width / 2, height / 2, '', {
      fontSize: '80px'
    });
    this.emojiText.setOrigin(0.5);
    this.emojiText.setAlpha(0);

    // Setup input
    this.setupInput();

    // Initial render
    this.renderState();
  }

  setupInput() {
    let isDragging = false;
    let draggedElement = null;
    let dragStartPos = null;

    this.input.on('pointerdown', (pointer) => {
      if (this.animating || this.state.status === 'solved') return;

      const element = getElementAt(pointer.x, pointer.y, this.state.puzzle.elements, this.scale);
      if (!element) return;

      if (element.draggable) {
        isDragging = true;
        draggedElement = element;
        dragStartPos = { x: pointer.x, y: pointer.y };
        if (this.onDragStart) {
          this.onDragStart(element);
        }
      } else if (element.clickable !== false) {
        // Tap action
        const action = {
          action: 'tap',
          targetId: element.id
        };
        if (this.onElementTap) {
          this.onElementTap(element, action);
        }
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!isDragging || !draggedElement) return;

      if (this.onDragMove && dragStartPos) {
        const dx = pointer.x - dragStartPos.x;
        const dy = pointer.y - dragStartPos.y;
        this.onDragMove(draggedElement, dx, dy);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (isDragging && draggedElement) {
        const targetElement = getElementAt(pointer.x, pointer.y, this.state.puzzle.elements, this.scale);

        if (this.onDragEnd && targetElement && targetElement.id !== draggedElement.id) {
          this.onDragEnd(draggedElement, targetElement);
        }
      }

      isDragging = false;
      draggedElement = null;
      dragStartPos = null;
    });
  }

  renderState() {
    this.renderBackground();
    this.renderElements();
    this.renderOverlays();
  }

  renderBackground() {
    const g = this.backgroundGraphics;
    const s = this.scale;
    const w = this.currentWidth;
    const h = this.currentHeight;

    g.clear();

    // Cream fill
    g.fillStyle(COLORS.background, 1);
    g.fillRect(0, 0, w, h);

    // Red margin line
    g.lineStyle(1.5 * s, 0xdc5050, 0.25);
    const marginX = 38 * s;
    g.beginPath();
    g.moveTo(marginX, 0);
    g.lineTo(marginX, h);
    g.strokePath();

    // Horizontal ruled lines
    g.lineStyle(1 * s, 0x648cc8, 0.18);
    const lineSpacing = 28 * s;
    const startY = 24 * s;
    for (let y = startY; y < h; y += lineSpacing) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.strokePath();
    }

    // Subtle paper texture: tiny grain dots
    g.fillStyle(0xb49650, 0.04);
    for (let i = 0; i < 120; i++) {
      const seed = i * 6271;
      const gx = ((seed * 1009) % 1000) / 1000 * w;
      const gy = ((seed * 2017) % 1000) / 1000 * h;
      g.fillCircle(gx, gy, 1.2);
    }

    // Banner (optional)
    if (this.state.puzzle.showBanner) {
      const bannerY = 20 * s;
      const bannerHeight = 30 * s;

      g.fillStyle(COLORS.banner, 1);
      g.fillRect(0, bannerY, w, bannerHeight);

      // Banner text - use text object
      if (!this.bannerText) {
        this.bannerText = this.add.text(w / 2, bannerY + bannerHeight / 2, 'Only 1% can solve this! 🤔', {
          fontFamily: HAND_FONT,
          fontSize: `${14 * s}px`,
          fontStyle: 'bold',
          color: COLORS.bannerText
        });
        this.bannerText.setOrigin(0.5);
      } else {
        this.bannerText.setPosition(w / 2, bannerY + bannerHeight / 2);
        this.bannerText.setFontSize(`${14 * s}px`);
      }
    } else if (this.bannerText) {
      this.bannerText.setAlpha(0);
    }

    // Prompt text
    this.renderPrompt();
  }

  renderPrompt() {
    const s = this.scale;
    const promptY = this.state.puzzle.showBanner ? 70 * s : 40 * s;

    if (!this.promptText) {
      this.promptText = this.add.text(this.currentWidth / 2, promptY, '', {
        fontFamily: HAND_FONT,
        fontSize: `${18 * s}px`,
        fontStyle: 'bold',
        color: COLORS.prompt,
        wordWrap: { width: this.currentWidth - PADDING * 2 * s },
        align: 'center'
      });
      this.promptText.setOrigin(0.5, 0);
    }

    this.promptText.setText(this.state.puzzle.prompt);
    this.promptText.setPosition(this.currentWidth / 2, promptY);
    this.promptText.setStyle({
      fontFamily: HAND_FONT,
      fontSize: `${18 * s}px`,
      fontStyle: 'bold',
      color: COLORS.prompt,
      wordWrap: { width: this.currentWidth - PADDING * 2 * s },
      align: 'center'
    });
  }

  renderElements() {
    const g = this.elementGraphics;
    const s = this.scale;

    g.clear();

    // Elements (sorted by zIndex)
    const sortedElements = [...this.state.puzzle.elements].sort((a, b) =>
      (a.zIndex || 0) - (b.zIndex || 0)
    );

    sortedElements.forEach(element => {
      const isRevealed = this.state.revealedElements.includes(element.id);
      const isSequenceTarget = this.state.currentSequence &&
        this.state.puzzle.type === 'sequence' &&
        this.state.currentSequence.includes(element.id);
      const isHinted = element.id === this.hintTargetId;

      if (!element.hidden || isRevealed) {
        this.renderElement(g, element, s, { isRevealed, isSequenceTarget, isHinted });
      }
    });
  }

  renderElement(g, element, s, options = {}) {
    const { isRevealed, isSequenceTarget, isHinted } = options;
    const x = element.x * s;
    const y = element.y * s;
    const w = (element.w || 60) * s;
    const h = (element.h || 60) * s;

    const seed = (element.id || '').charCodeAt(0) || 1;

    // Pulsing gold glow for hint target
    if (isHinted && this.hintPulse) {
      const pulse = this.hintPulse;
      g.lineStyle(2.5 * s, 0xffc800, 0.8 + 0.2 * pulse);
      g.strokeRoundedRect(x - 3 * s, y - 3 * s, w + 6 * s, h + 6 * s, 8 * s);
    }

    // Highlight revealed/target elements
    if (isRevealed || isSequenceTarget) {
      const glowColor = isRevealed ? 0x4ade80 : 0xffd700;
      // Draw glow
      g.fillStyle(glowColor, 0.3);
      g.fillRoundedRect(x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s, 10 * s);
    }

    // Render element based on type
    switch (element.type) {
      case 'circle':
        this.renderCircle(g, element, s, x, y, w, h);
        break;
      case 'rect':
        this.renderRect(g, element, s, x, y, w, h);
        break;
      case 'triangle':
        this.renderTriangle(g, element, s, x, y, w, h);
        break;
      case 'star':
        this.renderStar(g, element, s, x, y, w, h);
        break;
      case 'heart':
        this.renderHeart(g, element, s, x, y, w, h);
        break;
      case 'diamond':
        this.renderDiamond(g, element, s, x, y, w, h);
        break;
      case 'cup':
        this.renderCup(g, element, s, x, y, w, h);
        break;
      case 'ball':
        this.renderBall(g, element, s, x, y, w, h);
        break;
      case 'box':
        this.renderBox(g, element, s, x, y, w, h);
        break;
      case 'key':
        this.renderKey(g, element, s, x, y, w, h);
        break;
      case 'door':
        this.renderDoor(g, element, s, x, y, w, h);
        break;
      case 'button':
        this.renderButton(g, element, s, x, y, w, h);
        break;
      case 'arrow':
        this.renderArrow(g, element, s, x, y, w, h);
        break;
      case 'text':
        this.renderTextElement(element, s, x, y);
        break;
      case 'image':
        this.renderImage(g, element, s, x, y, w, h);
        break;
      case 'hidden':
        this.renderHidden(g, element, s, x, y, w, h);
        break;
      default:
        this.renderRect(g, element, s, x, y, w, h);
    }

    // Sketch border: 2 slightly offset thin strokes = hand-drawn feel
    if (element.type !== 'text' && element.type !== 'hidden') {
      g.lineStyle(1.5 * s, 0x281e14, 0.25);
      for (let pass = 0; pass < 2; pass++) {
        const ox = wobble(seed + pass * 13) * s;
        const oy = wobble(seed + pass * 7 + 3) * s;
        g.strokeRoundedRect(x + ox, y + oy, w + ox * 0.3, h + oy * 0.3, 6 * s);
      }
    }
  }

  renderCircle(g, el, s, x, y, w, h) {
    const radius = w / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : COLORS.element;

    g.fillStyle(color, 1);
    g.fillCircle(x + radius, y + radius, radius);

    if (el.label) {
      this.renderLabel(el.label, el.textColor, x + radius, y + radius, 14 * s);
    }
  }

  renderRect(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : COLORS.element;

    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);

    if (el.label) {
      this.renderLabel(el.label, el.textColor, x + w / 2, y + h / 2, 14 * s);
    }
  }

  renderTriangle(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : COLORS.element;

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x + w / 2, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fillPath();

    if (el.label) {
      this.renderLabel(el.label, el.textColor, x + w / 2, y + h * 0.65, 12 * s);
    }
  }

  renderStar(g, el, s, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const outerRadius = Math.min(w, h) / 2;
    const innerRadius = outerRadius * 0.4;
    const points = 5;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xffd700;

    g.fillStyle(color, 1);
    g.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;

      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }

    g.closePath();
    g.fillPath();
  }

  renderHeart(g, el, s, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const size = Math.min(w, h) / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xff6b6b;

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy + size * 0.3);

    // Left curve (approximated with lines since Phaser Graphics doesn't have bezier)
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = cx - size * (1 - t) * (1 - t) * 2;
      const py = cy - size * 0.5 + size * 1.5 * t * t;
      g.lineTo(px, py);
    }

    // Right curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = cx + size * t * t * 2;
      const py = cy + size * 0.3 + size * 0.7 * (1 - (1 - t) * (1 - t));
      g.lineTo(px, py);
    }

    g.closePath();
    g.fillPath();
  }

  renderDiamond(g, el, s, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0x9333ea;

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, y);
    g.lineTo(x + w, cy);
    g.lineTo(cx, y + h);
    g.lineTo(x, cy);
    g.closePath();
    g.fillPath();
  }

  renderCup(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0x8b4513;
    const rimColor = el.rimColor ? Phaser.Display.Color.HexStringToColor(el.rimColor).color : 0xa0522d;

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x + 5 * s, y);
    g.lineTo(x + w - 5 * s, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.closePath();
    g.fillPath();

    // Cup rim
    g.fillStyle(rimColor, 1);
    g.fillRect(x, y, w, 8 * s);
  }

  renderBall(g, el, s, x, y, w, h) {
    const radius = (w || 30) / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xff0000;

    g.fillStyle(color, 1);
    g.fillCircle(x + radius, y + radius, radius);

    // Highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(x + radius * 0.7, y + radius * 0.7, radius * 0.3);
  }

  renderBox(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0x8b4513;
    const lidColor = el.lidColor ? Phaser.Display.Color.HexStringToColor(el.lidColor).color : 0xa0522d;

    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);

    // Box lid line
    g.lineStyle(3 * s, lidColor, 1);
    g.beginPath();
    g.moveTo(x, y + h * 0.3);
    g.lineTo(x + w, y + h * 0.3);
    g.strokePath();

    // Cross lines
    g.lineStyle(2 * s, 0x000000, 0.2);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y + h);
    g.moveTo(x + w, y);
    g.lineTo(x, y + h);
    g.strokePath();
  }

  renderKey(g, el, s, x, y, w, h) {
    const keySize = Math.min(w, h) * 0.8;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xffd700;

    g.lineStyle(4 * s, color, 1);

    // Key head (circle)
    g.strokeCircle(cx - keySize * 0.3, cy, keySize * 0.25);

    // Key shaft
    g.beginPath();
    g.moveTo(cx - keySize * 0.05, cy);
    g.lineTo(cx + keySize * 0.4, cy);
    g.strokePath();

    // Key teeth
    g.beginPath();
    g.moveTo(cx + keySize * 0.2, cy);
    g.lineTo(cx + keySize * 0.2, cy + keySize * 0.15);
    g.moveTo(cx + keySize * 0.35, cy);
    g.lineTo(cx + keySize * 0.35, cy + keySize * 0.1);
    g.strokePath();
  }

  renderDoor(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0x4a3728;

    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);

    // Door frame
    g.lineStyle(3 * s, 0x2a1708, 1);
    g.strokeRect(x, y, w, h);

    // Door knob
    g.fillStyle(0xffd700, 1);
    g.fillCircle(x + w * 0.8, y + h * 0.5, 5 * s);
  }

  renderButton(g, el, s, x, y, w, h) {
    const radius = Math.min(w, h) / 2;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xef4444;

    // Button shadow
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(x + w / 2, y + h / 2 + 3 * s, radius);

    // Button body
    g.fillStyle(color, 1);
    g.fillCircle(x + w / 2, y + h / 2, radius);

    // Button highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(x + w / 2 - radius * 0.3, y + h / 2 - radius * 0.3, radius * 0.4);
  }

  renderArrow(g, el, s, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const size = Math.min(w, h) * 0.4;
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : 0xffffff;

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx - size, cy - size);
    g.lineTo(cx + size, cy);
    g.lineTo(cx - size, cy + size);
    g.closePath();
    g.fillPath();
  }

  renderTextElement(el, s, x, y) {
    const key = `text-${el.id}`;
    let textObj = this.children.getByName(key);

    if (!textObj) {
      textObj = this.add.text(x, y, el.text || el.label || '', {
        fontFamily: 'sans-serif',
        fontSize: `${el.fontSize || 16}px`,
        color: el.color || COLORS.text
      });
      textObj.setName(key);
      textObj.setOrigin(el.textAlign === 'left' ? 0 : 0.5, 0.5);
    } else {
      textObj.setPosition(x, y);
      textObj.setText(el.text || el.label || '');
    }
  }

  renderImage(g, el, s, x, y, w, h) {
    const color = el.color ? Phaser.Display.Color.HexStringToColor(el.color).color : COLORS.element;

    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);

    if (el.sprite) {
      this.renderLabel(el.sprite, '#ffffff', x + w / 2, y + h / 2, 10 * s);
    }
  }

  renderHidden(g, el, s, x, y, w, h) {
    g.fillStyle(0xffffff, 0.1);
    g.fillRect(x, y, w, h);
  }

  renderLabel(text, textColor, x, y, fontSize) {
    const key = `label-${text}-${Math.round(x)}-${Math.round(y)}`;
    let labelObj = this.children.getByName(key);

    if (!labelObj) {
      labelObj = this.add.text(x, y, text, {
        fontFamily: 'sans-serif',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: textColor || COLORS.text
      });
      labelObj.setName(key);
      labelObj.setOrigin(0.5);
    }
  }

  renderOverlays() {
    const g = this.overlayGraphics;
    g.clear();

    // Red flash overlay
    if (this.flashAlpha > 0) {
      g.fillStyle(0xef4444, this.flashAlpha);
      g.fillRect(0, 0, this.currentWidth, this.currentHeight);
    }

    // Confetti particles
    this.renderParticles();
  }

  renderParticles() {
    for (const p of this.particles) {
      if (!p.graphics) {
        p.graphics = this.add.graphics();
      }
      const g = p.graphics;
      g.clear();
      g.globalAlpha = Math.min(1, p.life * 1.5);
      g.fillStyle(p.color, 1);

      if (p.w && p.rot !== undefined) {
        // Rectangular confetti
        const s = this.scale;
        g.save();
        g.translateCanvas(p.x, p.y);
        g.rotateCanvas(p.rot);
        g.fillRect(-p.w / 2 * s, -p.h / 2 * s, p.w * s, p.h * s);
        g.restore();
      } else {
        // Circle sparkle fallback
        g.fillCircle(p.x, p.y, (p.size || 4) * this.scale);
      }
    }

    // Fail emoji overlay
    this.emojiText.setAlpha(this.failEmojiAlpha);
    this.emojiText.setFontSize(`${80 * this.scale * this.failEmojiScale}px`);
    if (this.failEmojiAlpha > 0) {
      this.emojiText.setText('😤');
    }
  }

  setState(newState) {
    this.state = newState;
    this.renderState();
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setHintTarget(id) {
    this.hintTargetId = id;

    // Stop existing hint tween
    if (this.hintTween) {
      this.hintTween.stop();
      this.hintTween = null;
    }

    if (id !== null && !this.reducedMotion) {
      // Create pulsing effect
      this.hintPulse = 0;
      this.hintTween = this.tweens.add({
        targets: this,
        hintPulse: 1,
        duration: 300,
        yoyo: true,
        repeat: -1,
        onUpdate: () => {
          this.renderElements();
        }
      });
    } else {
      this.hintPulse = 0;
      this.renderElements();
    }
  }

  playAnimation(animation) {
    return new Promise(resolve => {
      if (!animation) {
        resolve();
        return;
      }

      switch (animation.type) {
        case 'shake':
          this.playShake(animation.target).then(resolve);
          break;
        case 'flash':
          this.playFlash().then(resolve);
          break;
        case 'celebration':
          this.playCelebration().then(resolve);
          break;
        default:
          resolve();
      }
    });
  }

  playShake(_targetId) {
    if (this.reducedMotion) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.animating = true;
      const duration = 600;
      const startTime = performance.now();
      this.failEmojiAlpha = 1;
      this.failEmojiScale = 1.5;

      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
          const intensity = Math.sin(progress * Math.PI * 10) * (1 - progress) * 12;
          this.shakeOffset.x = intensity;
          this.shakeOffset.y = Math.sin(progress * Math.PI * 7) * (1 - progress) * 5;
          this.flashAlpha = progress < 0.15 ? progress / 0.15 * 0.35 : (1 - progress) * 0.1;
          this.failEmojiAlpha = Math.max(0, 1 - progress * 2);
          this.failEmojiScale = 1.5 - progress * 0.5;
          this.renderOverlays();
          requestAnimationFrame(animate);
        } else {
          this.shakeOffset.x = 0;
          this.shakeOffset.y = 0;
          this.flashAlpha = 0;
          this.failEmojiAlpha = 0;
          this.animating = false;
          this.renderOverlays();
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  playFlash() {
    return new Promise(resolve => {
      this.flashAlpha = 0.5;
      this.renderOverlays();
      this.time.delayedCall(200, () => {
        this.flashAlpha = 0;
        this.renderOverlays();
        resolve();
      });
    });
  }

  playCelebration() {
    if (this.reducedMotion) {
      return Promise.resolve();
    }

    this.particles = [];

    // Burst from center
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      this.particles.push({
        x: this.currentWidth / 2,
        y: this.currentHeight / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.25,
        w: 6 + Math.random() * 8,
        h: 3 + Math.random() * 5,
        color: COLORS.sparkle[Math.floor(Math.random() * COLORS.sparkle.length)],
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        graphics: null
      });
    }

    // Rain from top
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * this.currentWidth,
        y: -10 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 3,
        vy: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.18,
        w: 5 + Math.random() * 7,
        h: 3 + Math.random() * 4,
        color: COLORS.sparkle[Math.floor(Math.random() * COLORS.sparkle.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.008,
        graphics: null
      });
    }

    return new Promise(resolve => {
      const duration = 2400;
      const startTime = performance.now();

      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = elapsed / duration;

        // Update particles
        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18;
          p.vx *= 0.99;
          p.rot += p.rotV;
          p.life -= p.decay;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        this.renderParticles();

        if (progress < 1 && this.particles.length > 0) {
          requestAnimationFrame(animate);
        } else {
          // Clean up particle graphics
          this.particles.forEach(p => {
            if (p.graphics) p.graphics.destroy();
          });
          this.particles = [];
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  resize(state) {
    this.state = state;
    const { width, height } = this.scale;
    this.currentWidth = width;
    this.currentHeight = height;
    this.scale = width / CANVAS_WIDTH;
    this.renderState();
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
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      parent: canvas.parentElement,
      canvas: canvas
    },
    scene: BrainTeaserScene,
    backgroundColor: COLORS.background,
    transparent: false
  };

  function init() {
    game = new Phaser.Game(gameConfig);
  }

  function getScene() {
    if (!scene) {
      scene = game.scene.getScene('BrainTeaserScene');
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
      s.setState(state);
    }
  }

  function clear() {
    // Phaser handles clearing
  }

  function getElementAtFunc(canvasX, canvasY, elements, scale) {
    return getElementAt(canvasX, canvasY, elements, scale || getScene()?.scale || 1);
  }

  function playAnimation(animation, callback) {
    const s = getScene();
    if (s && s.scene.isActive()) {
      return s.playAnimation(animation).then(() => {
        if (callback) callback();
      });
    }
    if (callback) callback();
    return Promise.resolve();
  }

  function stopAnimation() {
    const s = getScene();
    if (s) {
      s.animating = false;
      s.shakeOffset = { x: 0, y: 0 };
      s.flashAlpha = 0;
      s.particles.forEach(p => {
        if (p.graphics) p.graphics.destroy();
      });
      s.particles = [];
    }
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    const s = getScene();
    if (s) {
      s.setReducedMotion(value);
    }
  }

  function setHintTarget(id) {
    const s = getScene();
    if (s) {
      s.setHintTarget(id);
    }
  }

  function setCallbacks(callbacks) {
    const s = getScene();
    if (s) {
      s.onElementTap = callbacks.onElementTap;
      s.onDragStart = callbacks.onDragStart;
      s.onDragMove = callbacks.onDragMove;
      s.onDragEnd = callbacks.onDragEnd;
    }
  }

  // Initialize the game
  init();

  return {
    resize,
    render,
    clear,
    getElementAt: getElementAtFunc,
    playAnimation,
    stopAnimation,
    setReducedMotion,
    setHintTarget,
    setCallbacks,
    get scale() {
      const s = getScene();
      return s ? s.scale : 1;
    },
    get width() {
      const s = getScene();
      return s ? s.currentWidth : CANVAS_WIDTH;
    },
    get height() {
      const s = getScene();
      return s ? s.currentHeight : CANVAS_HEIGHT;
    }
  };
}

export default { createRenderer, hitTest, getElementAt };
