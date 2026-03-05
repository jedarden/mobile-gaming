/**
 * GIF Export Module - Solution Recording and Animated GIF Generation
 *
 * Provides:
 * - Frame-by-frame recording of game solutions
 * - GIF encoding with LZW compression
 * - Web Share API integration for file sharing
 * - Watermark support
 * - Progress callbacks
 */

/**
 * Simple GIF Encoder using LZW compression
 * Based on the GIF89a specification
 */
class GIFEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
    this.delay = 100; // Default delay in centiseconds
    this.repeat = 0; // 0 = infinite loop
  }

  /**
   * Set frame delay in centiseconds (1/100th of a second)
   */
  setDelay(delay) {
    this.delay = Math.max(1, Math.round(delay));
  }

  /**
   * Set loop count (0 = infinite)
   */
  setRepeat(repeat) {
    this.repeat = repeat;
  }

  /**
   * Add a frame from canvas
   */
  addFrame(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push({
      data: imageData.data,
      delay: this.delay
    });
  }

  /**
   * Generate GIF blob
   */
  async encode() {
    const buffer = [];

    // Header
    buffer.push(...this.writeString('GIF89a'));

    // Logical Screen Descriptor
    buffer.push(...this.writeShort(this.width));
    buffer.push(...this.writeShort(this.height));

    // Global Color Table Flag (1), Color Resolution (7), Sort Flag (0), Size of Global Color Table (7)
    // This gives us 256 colors
    buffer.push(0xF7); // 11110111

    // Background color index
    buffer.push(0);

    // Pixel aspect ratio
    buffer.push(0);

    // Global Color Table (256 colors)
    // Build a color palette from all frames
    const palette = this.buildPalette();
    for (let i = 0; i < 256; i++) {
      if (i < palette.length) {
        buffer.push(palette[i].r, palette[i].g, palette[i].b);
      } else {
        buffer.push(0, 0, 0);
      }
    }

    // Netscape Application Extension for looping
    buffer.push(0x21); // Extension Introducer
    buffer.push(0xFF); // Application Extension Label
    buffer.push(11);   // Block Size
    buffer.push(...this.writeString('NETSCAPE2.0'));
    buffer.push(3);    // Sub-block size
    buffer.push(1);    // Sub-block ID
    buffer.push(...this.writeShort(this.repeat));
    buffer.push(0);    // Block terminator

    // Encode each frame
    for (const frame of this.frames) {
      // Graphic Control Extension
      buffer.push(0x21); // Extension Introducer
      buffer.push(0xF9); // Graphic Control Label
      buffer.push(4);    // Block Size
      buffer.push(0x04); // Packed field (disposal method = none, user input = 0, transparent color = 0)
      buffer.push(...this.writeShort(frame.delay));
      buffer.push(0);    // Transparent color index
      buffer.push(0);    // Block terminator

      // Image Descriptor
      buffer.push(0x2C); // Image Separator
      buffer.push(...this.writeShort(0));  // Left
      buffer.push(...this.writeShort(0));  // Top
      buffer.push(...this.writeShort(this.width));
      buffer.push(...this.writeShort(this.height));
      buffer.push(0);    // Packed field (no local color table)

      // Image Data with LZW compression
      const indexedPixels = this.quantizeFrame(frame.data, palette);
      const lzwData = this.lzwEncode(indexedPixels, 8);
      buffer.push(...lzwData);
    }

    // Trailer
    buffer.push(0x3B);

    return new Uint8Array(buffer);
  }

  /**
   * Build optimized color palette from frames
   */
  buildPalette() {
    const colorCounts = new Map();

    // Sample colors from frames
    for (const frame of this.frames) {
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        // Reduce color precision to avoid too many unique colors
        const r = data[i] & 0xF8;     // 5 bits
        const g = data[i + 1] & 0xF8; // 5 bits
        const b = data[i + 2] & 0xF8; // 5 bits
        const key = (r << 16) | (g << 8) | b;

        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
      }
    }

    // Sort by frequency and take top 256
    const sortedColors = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 256)
      .map(([color]) => ({
        r: (color >> 16) & 0xFF,
        g: (color >> 8) & 0xFF,
        b: color & 0xFF
      }));

    // Ensure we have at least some basic colors
    if (sortedColors.length < 16) {
      // Add grayscale
      for (let i = 0; i < 16; i++) {
        const v = i * 17;
        sortedColors.push({ r: v, g: v, b: v });
      }
    }

    return sortedColors;
  }

  /**
   * Quantize frame data to palette indices
   */
  quantizeFrame(data, palette) {
    const indices = new Uint8Array(this.width * this.height);

    for (let i = 0; i < indices.length; i++) {
      const pixelStart = i * 4;
      const r = data[pixelStart] & 0xF8;
      const g = data[pixelStart + 1] & 0xF8;
      const b = data[pixelStart + 2] & 0xF8;

      // Find closest palette color
      let bestIndex = 0;
      let bestDistance = Infinity;

      for (let j = 0; j < palette.length; j++) {
        const dr = r - palette[j].r;
        const dg = g - palette[j].g;
        const db = b - palette[j].b;
        const distance = dr * dr + dg * dg + db * db;

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = j;
        }
      }

      indices[i] = bestIndex;
    }

    return indices;
  }

  /**
   * LZW encode pixel data
   */
  lzwEncode(indices, minCodeSize) {
    const buffer = [];
    buffer.push(minCodeSize);

    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;

    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    const codeTable = new Map();

    // Initialize code table
    for (let i = 0; i < clearCode; i++) {
      codeTable.set(String.fromCharCode(i), i);
    }

    let current = String.fromCharCode(indices[0]);
    const bitBuffer = { data: 0, size: 0 };

    const emitCode = (code) => {
      bitBuffer.data |= code << bitBuffer.size;
      bitBuffer.size += codeSize;

      while (bitBuffer.size >= 8) {
        buffer.push(bitBuffer.data & 0xFF);
        bitBuffer.data >>= 8;
        bitBuffer.size -= 8;
      }
    };

    // Emit clear code
    emitCode(clearCode);

    for (let i = 1; i < indices.length; i++) {
      const next = String.fromCharCode(indices[i]);
      const combined = current + next;

      if (codeTable.has(combined)) {
        current = combined;
      } else {
        emitCode(codeTable.get(current));

        if (nextCode < 4096) {
          codeTable.set(combined, nextCode++);

          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          // Reset on overflow
          emitCode(clearCode);
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
          codeTable.clear();
          for (let j = 0; j < clearCode; j++) {
            codeTable.set(String.fromCharCode(j), j);
          }
        }

        current = next;
      }
    }

    // Emit last code
    emitCode(codeTable.get(current));
    emitCode(eoiCode);

    // Flush remaining bits
    if (bitBuffer.size > 0) {
      buffer.push(bitBuffer.data & 0xFF);
    }

    // Sub-block format
    const result = [];
    let offset = 0;
    while (offset < buffer.length) {
      const chunk = buffer.slice(offset, offset + 255);
      result.push(chunk.length);
      result.push(...chunk);
      offset += 255;
    }
    result.push(0); // Block terminator

    return result;
  }

  writeShort(value) {
    return [value & 0xFF, (value >> 8) & 0xFF];
  }

  writeString(str) {
    return [...str].map(c => c.charCodeAt(0));
  }
}

/**
 * Solution Recorder - Records game states for GIF export
 */
export class SolutionRecorder {
  constructor(options = {}) {
    this.width = options.width || 400;
    this.height = options.height || 600;
    this.frames = [];
    this.recording = false;
    this.renderFrame = options.renderFrame; // Function to render state to canvas
  }

  /**
   * Start recording
   */
  start() {
    this.frames = [];
    this.recording = true;
  }

  /**
   * Capture a frame from current state
   */
  captureFrame(state, delay = 500) {
    if (!this.recording || !this.renderFrame) return;

    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;

    this.renderFrame(canvas, state);

    this.frames.push({
      canvas: canvas,
      delay: Math.round(delay / 10) // Convert ms to centiseconds
    });
  }

  /**
   * Stop recording
   */
  stop() {
    this.recording = false;
    return this.frames.length;
  }

  /**
   * Generate GIF from recorded frames
   */
  async generateGIF(options = {}) {
    const {
      watermark = true,
      watermarkText = 'mobile-gaming.pages.dev',
      onProgress = null
    } = options;

    if (this.frames.length === 0) {
      throw new Error('No frames recorded');
    }

    const encoder = new GIFEncoder(this.width, this.height);

    // Process each frame
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i];

      // Create frame canvas with optional watermark
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = this.width;
      frameCanvas.height = this.height;
      const ctx = frameCanvas.getContext('2d');

      // Draw original frame
      ctx.drawImage(frame.canvas, 0, 0);

      // Add watermark if enabled
      if (watermark) {
        this.addWatermark(ctx, watermarkText);
      }

      encoder.setDelay(frame.delay);
      encoder.addFrame(frameCanvas);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: this.frames.length,
          percent: Math.round(((i + 1) / this.frames.length) * 100)
        });
      }

      // Yield to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const data = await encoder.encode();

    return new Blob([data], { type: 'image/gif' });
  }

  /**
   * Add watermark to frame
   */
  addWatermark(ctx, text) {
    const padding = 8;
    const fontSize = 12;

    ctx.save();

    // Background bar at bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, this.height - 28, this.width, 28);

    // Watermark text
    ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding, this.height - 14);

    ctx.restore();
  }

  /**
   * Clear recorded frames
   */
  clear() {
    this.frames = [];
  }

  /**
   * Get frame count
   */
  get frameCount() {
    return this.frames.length;
  }

  /**
   * Check if recording
   */
  get isRecording() {
    return this.recording;
  }
}

/**
 * GIF Export Manager - High-level API for GIF export and sharing
 */
export class GIFExporter {
  constructor(options = {}) {
    this.recorder = new SolutionRecorder(options);
    this.onProgress = options.onProgress;
  }

  /**
   * Start recording a solution
   */
  startRecording() {
    this.recorder.start();
  }

  /**
   * Capture current state
   */
  captureState(state, delayMs = 500) {
    this.recorder.captureFrame(state, delayMs);
  }

  /**
   * Stop recording and generate GIF
   */
  async stopAndGenerate(options = {}) {
    this.recorder.stop();

    return this.recorder.generateGIF({
      ...options,
      onProgress: this.onProgress
    });
  }

  /**
   * Share GIF using Web Share API or download
   */
  async shareGIF(blob, levelInfo = {}) {
    const filename = `${levelInfo.game || 'game'}-${levelInfo.id || 'solution'}.gif`;
    const file = new File([blob], filename, { type: 'image/gif' });

    const shareData = {
      title: levelInfo.title || 'My Solution',
      text: levelInfo.text || `Solved in ${levelInfo.moves || '?'} moves!`,
      files: [file]
    };

    // Check if Web Share API supports files
    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return { success: true, method: 'share' };
      } catch (e) {
        if (e.name === 'AbortError') {
          return { success: false, method: 'aborted' };
        }
        // Fall through to download
      }
    }

    // Fallback: Download
    this.downloadBlob(blob, filename);
    return { success: true, method: 'download' };
  }

  /**
   * Download blob as file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Preview GIF in a modal
   */
  previewGIF(blob) {
    const url = URL.createObjectURL(blob);

    const modal = document.createElement('div');
    modal.className = 'gif-preview-modal';
    modal.innerHTML = `
      <div class="gif-preview-content">
        <img src="${url}" alt="Solution preview" />
        <div class="gif-preview-actions">
          <button class="gif-btn gif-btn-share">Share</button>
          <button class="gif-btn gif-btn-download">Download</button>
          <button class="gif-btn gif-btn-close">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('.gif-btn-close').addEventListener('click', () => {
      URL.revokeObjectURL(url);
      modal.remove();
    });

    modal.querySelector('.gif-btn-download').addEventListener('click', () => {
      this.downloadBlob(blob, 'solution.gif');
    });

    modal.querySelector('.gif-btn-share').addEventListener('click', async () => {
      await this.shareGIF(blob);
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        URL.revokeObjectURL(url);
        modal.remove();
      }
    });

    return modal;
  }

  /**
   * Get recorder instance for custom use
   */
  getRecorder() {
    return this.recorder;
  }
}

/**
 * Quick export function - Generate GIF from array of states
 */
export async function exportSolutionAsGIF(states, options = {}) {
  const {
    width = 400,
    height = 600,
    frameDelay = 500,
    renderFrame,
    watermark = true,
    watermarkText = 'mobile-gaming.pages.dev',
    onProgress = null
  } = options;

  if (!renderFrame) {
    throw new Error('renderFrame callback is required');
  }

  const exporter = new GIFExporter({
    width,
    height,
    renderFrame,
    onProgress
  });

  exporter.startRecording();

  for (const state of states) {
    exporter.captureState(state, frameDelay);
  }

  return exporter.stopAndGenerate({ watermark, watermarkText });
}

// Export factory functions
export function createGIFExporter(options) {
  return new GIFExporter(options);
}

export function createSolutionRecorder(options) {
  return new SolutionRecorder(options);
}

export default {
  GIFEncoder,
  SolutionRecorder,
  GIFExporter,
  exportSolutionAsGIF,
  createGIFExporter,
  createSolutionRecorder
};
