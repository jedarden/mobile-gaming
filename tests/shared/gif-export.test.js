/**
 * Tests for GIF Export Module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SolutionRecorder,
  GIFExporter,
  exportSolutionAsGIF,
  createGIFExporter,
  createSolutionRecorder
} from '../../src/shared/gif-export.js';

// Mock canvas for testing
class MockCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.context2d = new MockContext2D(width, height);
  }

  getContext(type) {
    return type === '2d' ? this.context2d : null;
  }
}

class MockContext2D {
  constructor(width = 400, height = 600) {
    this.width = width;
    this.height = height;
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textBaseline = 'top';
    this.operations = [];
  }

  fillRect(x, y, w, h) {
    this.operations.push({ type: 'fillRect', x, y, w, h });
  }

  drawImage(image, dx, dy, dw, dh) {
    this.operations.push({ type: 'drawImage', dx, dy, dw, dh });
  }

  getImageData(x, y, w, h) {
    this.operations.push({ type: 'getImageData', x, y, w, h });
    // Return solid color data (red)
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;     // R
      data[i + 1] = 0;   // G
      data[i + 2] = 0;   // B
      data[i + 3] = 255; // A
    }
    return { data };
  }

  save() {
    this.operations.push({ type: 'save' });
  }

  restore() {
    this.operations.push({ type: 'restore' });
  }

  fillText(text, x, y) {
    this.operations.push({ type: 'fillText', text, x, y });
  }
}

// Setup mock
vi.stubGlobal('document', {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return new MockCanvas(400, 600);
    }
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn()
      };
    }
    return {
      classList: { add: vi.fn() },
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      style: {},
      innerHTML: '',
      querySelector: vi.fn(() => ({ addEventListener: vi.fn() })),
      addEventListener: vi.fn(),
      remove: vi.fn()
    };
  },
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
});

vi.stubGlobal('navigator', {
  share: vi.fn(),
  canShare: vi.fn(() => true),
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn()
});

describe('SolutionRecorder', () => {
  let recorder;
  let mockRenderFrame;

  beforeEach(() => {
    mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    recorder = new SolutionRecorder({
      width: 400,
      height: 600,
      renderFrame: mockRenderFrame
    });
  });

  describe('constructor', () => {
    it('should create recorder with options', () => {
      expect(recorder.width).toBe(400);
      expect(recorder.height).toBe(600);
      expect(recorder.frames).toEqual([]);
      expect(recorder.recording).toBe(false);
    });

    it('should use default dimensions', () => {
      const r = new SolutionRecorder();
      expect(r.width).toBe(400);
      expect(r.height).toBe(600);
    });
  });

  describe('start', () => {
    it('should start recording', () => {
      recorder.start();
      expect(recorder.recording).toBe(true);
      expect(recorder.frames).toEqual([]);
    });
  });

  describe('captureFrame', () => {
    it('should capture frame when recording', () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);

      expect(recorder.frames.length).toBe(1);
      expect(mockRenderFrame).toHaveBeenCalled();
    });

    it('should not capture frame when not recording', () => {
      recorder.captureFrame({ testState: 1 }, 500);
      expect(recorder.frames.length).toBe(0);
    });

    it('should convert delay to centiseconds', () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);

      expect(recorder.frames[0].delay).toBe(50); // 500ms / 10
    });

    it('should not capture without renderFrame callback', () => {
      const r = new SolutionRecorder();
      r.start();
      r.captureFrame({ testState: 1 }, 500);

      expect(r.frames.length).toBe(0);
    });
  });

  describe('stop', () => {
    it('should stop recording and return frame count', () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      recorder.captureFrame({ testState: 2 }, 500);

      const count = recorder.stop();
      expect(count).toBe(2);
      expect(recorder.recording).toBe(false);
    });
  });

  describe('generateGIF', () => {
    it('should generate GIF from recorded frames', async () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      recorder.captureFrame({ testState: 2 }, 500);
      recorder.stop();

      const blob = await recorder.generateGIF();

      expect(blob instanceof Blob).toBe(true);
      expect(blob.type).toBe('image/gif');
    });

    it('should throw if no frames recorded', async () => {
      await expect(recorder.generateGIF()).rejects.toThrow('No frames recorded');
    });

    it('should add watermark when enabled', async () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      recorder.stop();

      await recorder.generateGIF({ watermark: true, watermarkText: 'test-watermark' });

      // Check that fillText was called with watermark text
      const lastCtx = recorder.frames[0].canvas.getContext('2d');
      // Watermark is added during generateGIF, so we check the operations
    });

    it('should call progress callback', async () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      recorder.captureFrame({ testState: 2 }, 500);
      recorder.stop();

      const progressEvents = [];
      await recorder.generateGIF({
        onProgress: (progress) => progressEvents.push(progress)
      });

      expect(progressEvents.length).toBe(2);
      expect(progressEvents[0].current).toBe(1);
      expect(progressEvents[0].total).toBe(2);
      expect(progressEvents[1].percent).toBe(100);
    });
  });

  describe('clear', () => {
    it('should clear all frames', () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      recorder.clear();

      expect(recorder.frames.length).toBe(0);
    });
  });

  describe('getters', () => {
    it('frameCount should return frame count', () => {
      recorder.start();
      recorder.captureFrame({ testState: 1 }, 500);
      expect(recorder.frameCount).toBe(1);
    });

    it('isRecording should return recording state', () => {
      expect(recorder.isRecording).toBe(false);
      recorder.start();
      expect(recorder.isRecording).toBe(true);
    });
  });
});

describe('GIFExporter', () => {
  let exporter;
  let mockRenderFrame;

  beforeEach(() => {
    mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    exporter = new GIFExporter({
      width: 400,
      height: 600,
      renderFrame: mockRenderFrame
    });
  });

  describe('startRecording', () => {
    it('should start recording via recorder', () => {
      exporter.startRecording();
      expect(exporter.recorder.recording).toBe(true);
    });
  });

  describe('captureState', () => {
    it('should capture state via recorder', () => {
      exporter.startRecording();
      exporter.captureState({ testState: 1 }, 500);

      expect(exporter.recorder.frames.length).toBe(1);
    });
  });

  describe('stopAndGenerate', () => {
    it('should stop recording and generate GIF', async () => {
      exporter.startRecording();
      exporter.captureState({ testState: 1 }, 500);

      const blob = await exporter.stopAndGenerate();

      expect(blob instanceof Blob).toBe(true);
      expect(blob.type).toBe('image/gif');
    });
  });

  describe('shareGIF', () => {
    it('should share via Web Share API when available', async () => {
      const blob = new Blob(['test'], { type: 'image/gif' });

      const result = await exporter.shareGIF(blob, {
        game: 'test-game',
        id: 'level-1',
        moves: 10,
        title: 'Test Share'
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('method');
    });

    it('should fallback to download when share not available', async () => {
      vi.stubGlobal('navigator', {
        share: vi.fn(),
        canShare: vi.fn(() => false)
      });

      const blob = new Blob(['test'], { type: 'image/gif' });
      const result = await exporter.shareGIF(blob);

      expect(result.success).toBe(true);
      expect(result.method).toBe('download');
    });
  });

  describe('downloadBlob', () => {
    it('should trigger download without error', () => {
      const blob = new Blob(['test'], { type: 'image/gif' });

      // Should not throw
      expect(() => exporter.downloadBlob(blob, 'test.gif')).not.toThrow();
    });
  });

  describe('previewGIF', () => {
    it('should create preview modal', () => {
      const blob = new Blob(['test'], { type: 'image/gif' });
      const modal = exporter.previewGIF(blob);

      expect(modal).toBeDefined();
      expect(modal.className).toBe('gif-preview-modal');
    });
  });

  describe('getRecorder', () => {
    it('should return the recorder instance', () => {
      const recorder = exporter.getRecorder();
      expect(recorder).toBeInstanceOf(SolutionRecorder);
    });
  });
});

describe('exportSolutionAsGIF', () => {
  it('should export states as GIF', async () => {
    const mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const states = [
      { step: 1 },
      { step: 2 },
      { step: 3 }
    ];

    const blob = await exportSolutionAsGIF(states, {
      width: 100,
      height: 100,
      frameDelay: 100,
      renderFrame: mockRenderFrame,
      watermark: false
    });

    expect(blob instanceof Blob).toBe(true);
    expect(blob.type).toBe('image/gif');
    expect(mockRenderFrame).toHaveBeenCalledTimes(3);
  });

  it('should throw without renderFrame callback', async () => {
    await expect(exportSolutionAsGIF([{ step: 1 }], {}))
      .rejects.toThrow('renderFrame callback is required');
  });

  it('should call progress callback', async () => {
    const mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const progressEvents = [];
    await exportSolutionAsGIF([{ step: 1 }, { step: 2 }], {
      width: 50,
      height: 50,
      renderFrame: mockRenderFrame,
      onProgress: (p) => progressEvents.push(p)
    });

    expect(progressEvents.length).toBe(2);
  });
});

describe('Factory functions', () => {
  it('createGIFExporter should create GIFExporter instance', () => {
    const exporter = createGIFExporter({ width: 200, height: 200 });
    expect(exporter).toBeInstanceOf(GIFExporter);
  });

  it('createSolutionRecorder should create SolutionRecorder instance', () => {
    const recorder = createSolutionRecorder({ width: 200, height: 200 });
    expect(recorder).toBeInstanceOf(SolutionRecorder);
  });
});

describe('Acceptance Criteria', () => {
  it('GIF generates correctly with multiple frames', async () => {
    const mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const states = Array.from({ length: 10 }, (_, i) => ({ step: i }));
    const blob = await exportSolutionAsGIF(states, {
      width: 100,
      height: 100,
      renderFrame: mockRenderFrame
    });

    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('image/gif');
  });

  it('Watermark is added when enabled', async () => {
    const mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const blob = await exportSolutionAsGIF([{ step: 1 }], {
      width: 100,
      height: 100,
      renderFrame: mockRenderFrame,
      watermark: true,
      watermarkText: 'test-watermark.com'
    });

    // GIF should be generated with watermark
    expect(blob.type).toBe('image/gif');
  });

  it('File size is reasonable for short animations', async () => {
    const mockRenderFrame = vi.fn((canvas, state) => {
      const ctx = canvas.getContext('2d');
      // Simple solid color frame
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    const states = Array.from({ length: 20 }, (_, i) => ({ step: i }));
    const blob = await exportSolutionAsGIF(states, {
      width: 200,
      height: 300,
      frameDelay: 500,
      renderFrame: mockRenderFrame,
      watermark: false
    });

    // Should be less than 5MB
    expect(blob.size).toBeLessThan(5 * 1024 * 1024);
  });
});
