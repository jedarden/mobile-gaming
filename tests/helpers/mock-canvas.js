/**
 * Canvas mock for unit tests (no DOM)
 *
 * Provides a lightweight canvas implementation for testing
 * rendering logic without requiring a browser DOM.
 */

export class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this._fills = [];
    this._strokes = [];
    this._images = [];
    this._transforms = [];
    this._savedStates = [];

    // Path state
    this._path = [];
    this._currentPath = [];

    // Style state
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.miterLimit = 10;
    this.shadowBlur = 0;
    this.shadowColor = 'rgba(0, 0, 0, 0)';
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';

    // Text state
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.direction = 'inherit';

    // Smoothing
    this.imageSmoothingEnabled = true;
    this.imageSmoothingQuality = 'low';
  }

  // Drawing paths
  beginPath() {
    this._currentPath = [];
  }

  closePath() {
    if (this._currentPath.length > 0) {
      this._currentPath.push({ type: 'close' });
    }
  }

  moveTo(x, y) {
    this._currentPath.push({ type: 'move', x, y });
  }

  lineTo(x, y) {
    this._currentPath.push({ type: 'line', x, y });
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this._currentPath.push({ type: 'quadratic', cpx, cpy, x, y });
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this._currentPath.push({ type: 'bezier', cp1x, cp1y, cp2x, cp2y, x, y });
  }

  arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
    this._currentPath.push({
      type: 'arc',
      x, y, radius, startAngle, endAngle, anticlockwise
    });
  }

  arcTo(x1, y1, x2, y2, radius) {
    this._currentPath.push({ type: 'arcTo', x1, y1, x2, y2, radius });
  }

  ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise = false) {
    this._currentPath.push({
      type: 'ellipse',
      x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise
    });
  }

  rect(x, y, width, height) {
    this._currentPath.push({ type: 'rect', x, y, width, height });
  }

  // Drawing
  fill(path = null) {
    const pathToFill = path || this._currentPath;
    this._fills.push({
      path: [...pathToFill],
      style: this.fillStyle,
      alpha: this.globalAlpha
    });
    this._currentPath = [];
  }

  stroke(path = null) {
    const pathToStroke = path || this._currentPath;
    this._strokes.push({
      path: [...pathToStroke],
      style: this.strokeStyle,
      lineWidth: this.lineWidth,
      alpha: this.globalAlpha
    });
    this._currentPath = [];
  }

  fillRect(x, y, width, height) {
    this._fills.push({
      type: 'rect',
      x, y, width, height,
      style: this.fillStyle,
      alpha: this.globalAlpha
    });
  }

  strokeRect(x, y, width, height) {
    this._strokes.push({
      type: 'rect',
      x, y, width, height,
      style: this.strokeStyle,
      lineWidth: this.lineWidth,
      alpha: this.globalAlpha
    });
  }

  clearRect(x, y, width, height) {
    // In mock, just track the clear
    this._clears = this._clears || [];
    this._clears.push({ x, y, width, height });
  }

  // Images
  drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
    const drawCall = { image, sx, sy };

    if (typeof sWidth === 'number') {
      drawCall.sWidth = sWidth;
      drawCall.sHeight = sHeight;

      if (typeof dx === 'number') {
        drawCall.dx = dx;
        drawCall.dy = dy;
        drawCall.dWidth = dWidth;
        drawCall.dHeight = dHeight;
      }
    } else {
      // 3-argument form: drawImage(image, dx, dy)
      drawCall.dx = sx;
      drawCall.dy = sy;
    }

    this._images.push(drawCall);
  }

  // Text
  fillText(text, x, y, maxWidth) {
    this._fills.push({
      type: 'text',
      text, x, y, maxWidth,
      style: this.fillStyle,
      font: this.font,
      alpha: this.globalAlpha
    });
  }

  strokeText(text, x, y, maxWidth) {
    this._strokes.push({
      type: 'text',
      text, x, y, maxWidth,
      style: this.strokeStyle,
      font: this.font,
      lineWidth: this.lineWidth,
      alpha: this.globalAlpha
    });
  }

  measureText(text) {
    // Rough approximation based on font size
    const fontSize = parseInt(this.font) || 10;
    const width = text.length * fontSize * 0.6;

    return {
      width,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      actualBoundingBoxAscent: fontSize * 0.8,
      actualBoundingBoxDescent: fontSize * 0.2,
      fontBoundingBoxAscent: fontSize * 0.8,
      fontBoundingBoxDescent: fontSize * 0.2
    };
  }

  // State
  save() {
    this._savedStates.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      miterLimit: this.miterLimit,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor,
      shadowOffsetX: this.shadowOffsetX,
      shadowOffsetY: this.shadowOffsetY,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      direction: this.direction,
      transform: this.currentTransform
    });
  }

  restore() {
    const state = this._savedStates.pop();
    if (state) {
      Object.assign(this, state);
    }
  }

  // Transformations
  get currentTransform() {
    return this._transform || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object') {
      this._transform = { ...a };
    } else {
      this._transform = { a, b, c, d, e, f };
    }
  }

  transform(a, b, c, d, e, f) {
    const current = this.currentTransform;
    this._transform = {
      a: current.a * a + current.c * b,
      b: current.b * a + current.d * b,
      c: current.a * c + current.c * d,
      d: current.b * c + current.d * d,
      e: current.a * e + current.c * f + current.e,
      f: current.b * e + current.d * f + current.f
    };
  }

  translate(x, y) {
    this.transform(1, 0, 0, 1, x, y);
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.transform(cos, sin, -sin, cos, 0, 0);
  }

  scale(x, y) {
    this.transform(x, 0, 0, y, 0, 0);
  }

  resetTransform() {
    this._transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  // Hit detection
  isPointInPath(path, x, y) {
    // Simplified: just check if point is within any path bounds
    const checkPath = path || this._currentPath;
    for (const cmd of checkPath) {
      if (cmd.type === 'rect') {
        return x >= cmd.x && x <= cmd.x + cmd.width &&
               y >= cmd.y && y <= cmd.y + cmd.height;
      }
      if (cmd.type === 'arc') {
        const dx = x - cmd.x;
        const dy = y - cmd.y;
        return Math.sqrt(dx * dx + dy * dy) <= cmd.radius;
      }
    }
    return false;
  }

  isPointInStroke(path, x, y) {
    // Simplified: same as isPointInPath for mock purposes
    return this.isPointInPath(path, x, y);
  }

  // Get helpers for testing
  getFills() {
    return this._fills;
  }

  getStrokes() {
    return this._strokes;
  }

  getImages() {
    return this._images;
  }

  getLastFill() {
    return this._fills[this._fills.length - 1];
  }

  getLastStroke() {
    return this._strokes[this._strokes.length - 1];
  }

  clear() {
    this._fills = [];
    this._strokes = [];
    this._images = [];
    this._currentPath = [];
  }
}

export class MockCanvas {
  constructor(width = 390, height = 844) {
    this.width = width;
    this.height = height;
    this.style = {
      width: width + 'px',
      height: height + 'px'
    };
    this._context = new MockCanvasRenderingContext2D(this);
  }

  getContext(contextType) {
    if (contextType === '2d') {
      return this._context;
    }
    return null;
  }

  toDataURL(type = 'image/png') {
    return `data:${type};base64,mock`;
  }

  toBlob(callback, type = 'image/png') {
    setTimeout(() => {
      callback(new Blob(['mock'], { type }));
    }, 0);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.style.width = width + 'px';
    this.style.height = height + 'px';
  }

  getContext2D() {
    return this._context;
  }
}

/**
 * Create a mock canvas element
 *
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {MockCanvas} Mock canvas element
 */
export function createMockCanvas(width = 390, height = 844) {
  return new MockCanvas(width, height);
}

/**
 * Create a mock canvas 2D context
 *
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {MockCanvasRenderingContext2D} Mock context
 */
export function createMockContext(width = 390, height = 844) {
  const canvas = new MockCanvas(width, height);
  return canvas.getContext('2d');
}
