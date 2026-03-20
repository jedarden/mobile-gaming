import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this._chunks = [];
  }

  start(timeslice) {
    this.state = 'recording';
    this._timeslice = timeslice;

    // Simulate data available events
    if (timeslice) {
      this._interval = setInterval(() => {
        if (this.state === 'recording' && this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['chunk'], { type: 'video/webm' }) });
        }
      }, timeslice);
    }
  }

  stop() {
    this.state = 'inactive';
    if (this._interval) {
      clearInterval(this._interval);
    }
    if (this.onstop) {
      this.onstop();
    }
  }

  static isTypeSupported(mimeType) {
    return ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=h264'].includes(mimeType);
  }
}

// Mock MediaStream
class MockMediaStream {
  constructor(tracks = []) {
    this._tracks = tracks;
  }

  getVideoTracks() {
    return this._tracks.filter(t => t.kind === 'video');
  }

  getAudioTracks() {
    return this._tracks.filter(t => t.kind === 'audio');
  }

  getTracks() {
    return this._tracks;
  }

  addTrack(track) {
    this._tracks.push(track);
  }

  removeTrack(track) {
    this._tracks = this._tracks.filter(t => t !== track);
  }
}

// Mock canvas element
function createMockCanvas() {
  return {
    width: 390,
    height: 844,
    style: {},
    captureStream: vi.fn(() => new MockMediaStream([{ kind: 'video', stop: vi.fn() }])),
    getContext: vi.fn(() => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      scale: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(10000) })),
      putImageData: vi.fn()
    }))
  };
}

// Setup globals
let recorderModule;

async function getFreshModule() {
  // Mock browser globals
  const mockCanvas = createMockCanvas();

  global.MediaRecorder = MockMediaRecorder;
  global.MediaStream = MockMediaStream;
  global.window = {
    MediaRecorder: MockMediaRecorder,
    MediaStream: MockMediaStream,
    devicePixelRatio: 2,
    location: { href: 'https://example.com' }
  };
  global.performance = {
    now: () => Date.now()
  };
  global.document = {
    createElement: vi.fn((tagName) => {
      if (tagName === 'canvas') {
        return createMockCanvas();
      }
      return {};
    }),
    head: {
      appendChild: vi.fn()
    }
  };

  vi.resetModules();
  return await import('../../src/shared/recorder.js');
}

describe('recorder', () => {
  beforeEach(async () => {
    recorderModule = await getFreshModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      recorderModule?.cleanup();
    } catch {
      // cleanup may fail in test environment
    }
  });

  describe('hasVideoEncoderSupport', () => {
    it('returns false when VideoEncoder is not defined', () => {
      expect(recorderModule.hasVideoEncoderSupport()).toBe(false);
    });

    it('returns true when VideoEncoder is available', async () => {
      global.VideoEncoder = vi.fn();
      vi.resetModules();
      const mod = await import('../../src/shared/recorder.js');
      expect(mod.hasVideoEncoderSupport()).toBe(true);
      delete global.VideoEncoder;
    });
  });

  describe('hasVP9Support', () => {
    it('returns true for VP9 support', () => {
      expect(recorderModule.hasVP9Support()).toBe(true);
    });
  });

  describe('hasH264WebMSupport', () => {
    it('returns true for H264 WebM support', () => {
      expect(recorderModule.hasH264WebMSupport()).toBe(true);
    });
  });

  describe('getBestMimeType', () => {
    it('returns H264 WebM as preferred', () => {
      const mimeType = recorderModule.getBestMimeType();
      expect(mimeType).toBe('video/webm;codecs=h264');
    });
  });

  describe('createOutputCanvas', () => {
    it('creates a canvas with 1080x1920 dimensions', () => {
      const { canvas, ctx } = recorderModule.createOutputCanvas();
      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBe(1920);
      expect(ctx).toBeDefined();
    });
  });

  describe('calculateGamePosition', () => {
    it('centers tall game canvas', () => {
      const pos = recorderModule.calculateGamePosition(390, 844);
      expect(pos.width).toBeLessThanOrEqual(1080);
      expect(pos.height).toBeLessThanOrEqual(1920);
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    });

    it('centers wide game canvas', () => {
      const pos = recorderModule.calculateGamePosition(844, 390);
      expect(pos.width).toBeLessThanOrEqual(1080);
      expect(pos.height).toBeLessThanOrEqual(1920);
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    });

    it('handles square game canvas', () => {
      const pos = recorderModule.calculateGamePosition(500, 500);
      expect(pos.width).toBeGreaterThan(0);
      expect(pos.height).toBeGreaterThan(0);
    });
  });

  describe('initAudioCapture', () => {
    it('creates audio destination from audio context', () => {
      const mockCtx = {
        createMediaStreamDestination: vi.fn(() => ({
          stream: {
            getAudioTracks: () => [{ kind: 'audio' }]
          }
        }))
      };

      const destination = recorderModule.initAudioCapture(mockCtx);
      expect(destination).toBeDefined();
      expect(mockCtx.createMediaStreamDestination).toHaveBeenCalled();
    });
  });

  describe('getAudioDestination', () => {
    it('returns null initially', async () => {
      vi.resetModules();
      global.MediaRecorder = MockMediaRecorder;
      global.MediaStream = MockMediaStream;
      global.window = { MediaRecorder: MockMediaRecorder, MediaStream: MockMediaStream };
      global.document = { createElement: vi.fn(() => createMockCanvas()) };
      const mod = await import('../../src/shared/recorder.js');
      expect(mod.getAudioDestination()).toBeNull();
    });
  });

  describe('startCapture', () => {
    it('captures video stream from canvas', () => {
      const canvas = createMockCanvas();
      const stream = recorderModule.startCapture(canvas);

      expect(canvas.captureStream).toHaveBeenCalled();
      expect(stream).toBeDefined();
    });

    it('captures with specified fps', () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas, { fps: 60 });

      expect(canvas.captureStream).toHaveBeenCalledWith(60);
    });

    it('combines audio stream when available', () => {
      const canvas = createMockCanvas();
      const mockCtx = {
        createMediaStreamDestination: vi.fn(() => ({
          stream: new MockMediaStream([{ kind: 'audio', stop: vi.fn() }])
        }))
      };

      recorderModule.initAudioCapture(mockCtx);
      const stream = recorderModule.startCapture(canvas, { audioContext: mockCtx });

      expect(stream).toBeDefined();
      expect(stream.getTracks().length).toBe(2); // video + audio
    });
  });

  describe('startRecording', () => {
    it('throws error without stream', async () => {
      await expect(recorderModule.startRecording({})).rejects.toThrow('No stream to record');
    });

    it('starts recording with default options', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);

      await recorderModule.startRecording();

      expect(recorderModule.isActive()).toBe(true);
    });

    it('starts recording with custom options', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);

      await recorderModule.startRecording({
        maxDuration: 30000,
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 3000000
      });

      expect(recorderModule.isActive()).toBe(true);
    });
  });

  describe('stopRecording', () => {
    it('returns empty blob when not recording', async () => {
      const blob = await recorderModule.stopRecording();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('video/webm');
    });

    it('returns recorded blob after recording', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);
      await recorderModule.startRecording();

      // Wait a bit for chunks
      await new Promise(resolve => setTimeout(resolve, 100));

      const blob = await recorderModule.stopRecording();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('video/webm');
    });
  });

  describe('getRecordingDuration', () => {
    it('returns 0 when not recording', () => {
      expect(recorderModule.getRecordingDuration()).toBe(0);
    });

    it('returns positive duration when recording', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);
      await recorderModule.startRecording();

      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = recorderModule.getRecordingDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('isActive', () => {
    it('returns false initially', () => {
      expect(recorderModule.isActive()).toBe(false);
    });

    it('returns true when recording', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);
      await recorderModule.startRecording();

      expect(recorderModule.isActive()).toBe(true);
    });
  });

  describe('getBufferedChunks', () => {
    it('returns empty array initially', () => {
      expect(recorderModule.getBufferedChunks()).toEqual([]);
    });
  });

  describe('getBufferedDuration', () => {
    it('returns 0 when no buffer', () => {
      expect(recorderModule.getBufferedDuration()).toBe(0);
    });
  });

  describe('captureBuffer', () => {
    it('throws when buffer is empty', async () => {
      await expect(recorderModule.captureBuffer()).rejects.toThrow('No buffered content available');
    });
  });

  describe('convertToMP4', () => {
    it('returns WebM blob when VideoEncoder not supported', async () => {
      const webmBlob = new Blob(['video data'], { type: 'video/webm' });
      const result = await recorderModule.convertToMP4(webmBlob);
      expect(result).toBe(webmBlob);
    });
  });

  describe('getSupportedFormat', () => {
    it('returns format info', () => {
      const format = recorderModule.getSupportedFormat();
      expect(format).toHaveProperty('format');
      expect(format).toHaveProperty('mimeType');
      expect(format).toHaveProperty('canShare');
    });
  });

  describe('cleanup', () => {
    it('stops recording and clears state', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);
      await recorderModule.startRecording();

      recorderModule.cleanup();

      expect(recorderModule.isActive()).toBe(false);
      expect(recorderModule.getBufferedChunks()).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('returns status object', () => {
      const status = recorderModule.getStatus();
      expect(status).toHaveProperty('isRecording');
      expect(status).toHaveProperty('isPassive');
      expect(status).toHaveProperty('duration');
      expect(status).toHaveProperty('bufferedDuration');
    });
  });
});
