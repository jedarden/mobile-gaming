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

    it('uses video stream only when audioContext provided but initAudioCapture not called (ctx && audioDestination false branch)', () => {
      // recorder.js line 167: `if (ctx && audioDestination)` — ctx is truthy (audioContext
      // option passed) but audioDestination is null (initAudioCapture never called).
      // Condition short-circuits to false → else branch: combinedStream = videoStream.
      const canvas = createMockCanvas();
      const mockCtx = { createMediaStreamDestination: vi.fn() };
      // No initAudioCapture call → audioDestination remains null
      const stream = recorderModule.startCapture(canvas, { audioContext: mockCtx });
      expect(stream).toBeDefined();
      // Only video tracks (no audio combined since audioDestination was null)
      expect(stream.getTracks().length).toBe(1);
      // initAudioCapture creates the destination; it should NOT have been called
      expect(mockCtx.createMediaStreamDestination).not.toHaveBeenCalled();
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

    it('does not set auto-stop when maxDuration is 0 (if (maxDuration > 0) false branch)', async () => {
      vi.useFakeTimers();
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);

      await recorderModule.startRecording({ maxDuration: 0 });
      expect(recorderModule.isActive()).toBe(true);

      // Advance time by 10 minutes — no auto-stop should fire
      vi.advanceTimersByTime(600000);
      expect(recorderModule.isActive()).toBe(true);

      vi.useRealTimers();
    });

    it('auto-stops recording when maxDuration elapses (if (maxDuration > 0) true branch)', async () => {
      vi.useFakeTimers();
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);

      await recorderModule.startRecording({ maxDuration: 5000 });
      expect(recorderModule.isActive()).toBe(true);

      // Advance past the maxDuration — auto-stop setTimeout fires → stopRecording() called
      vi.advanceTimersByTime(5001);
      // isActive() should now be false since the auto-stop fired
      expect(recorderModule.isActive()).toBe(false);

      vi.useRealTimers();
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

    it('returns blob when called twice (mediaRecorder.state==="inactive" branch)', async () => {
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas);
      await recorderModule.startRecording();
      await recorderModule.stopRecording(); // first call: recorder stops → state='inactive'
      // Second call: !mediaRecorder is false, mediaRecorder.state==='inactive' is true → early return
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

    it('returns a Blob when circular buffer has chunks (success path)', async () => {
      vi.useFakeTimers();
      recorderModule.startCapture(createMockCanvas(), { passive: true });
      await recorderModule.startRecording();
      vi.advanceTimersByTime(2000); // populates circularBuffer via ondataavailable
      const blob = await recorderModule.captureBuffer();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('video/webm');
      vi.useRealTimers();
    });
  });

  describe('convertToMP4', () => {
    it('returns WebM blob when VideoEncoder not supported', async () => {
      const webmBlob = new Blob(['video data'], { type: 'video/webm' });
      const result = await recorderModule.convertToMP4(webmBlob);
      expect(result).toBe(webmBlob);
    });

    it('routes through convertWithVideoEncoder when VideoEncoder is supported (if branch)', async () => {
      // Set up VideoEncoder globally so hasVideoEncoderSupport() returns true
      vi.resetModules();
      global.VideoEncoder = vi.fn();
      global.VideoDecoder = vi.fn();
      try {
        const mod = await import('../../src/shared/recorder.js');
        const webmBlob = new Blob(['video data'], { type: 'video/webm' });
        // convertWithVideoEncoder is a stub that calls remuxToMP4 which returns the original blob
        const result = await mod.convertToMP4(webmBlob);
        expect(result).toBe(webmBlob);
      } finally {
        delete global.VideoEncoder;
        delete global.VideoDecoder;
      }
    });
  });

  describe('encodeToMP4', () => {
    it('throws when VideoEncoder is not supported', async () => {
      // In test environment VideoEncoder is not defined, so encodeToMP4 should throw
      await expect(recorderModule.encodeToMP4(null, [])).rejects.toThrow('VideoEncoder API not supported');
    });
  });

  describe('encodeToMP4 — keyFrame logic (index===0 || index%60===0 branches)', () => {
    afterEach(() => {
      delete global.VideoEncoder;
      delete global.VideoDecoder;
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it('marks index 0 as keyFrame=true and index 1 as keyFrame=false (covers both || arms)', async () => {
      // Need to mock mp4-muxer before importing recorder.js fresh
      const encodeCalls = [];

      const mockEncoderInstance = {
        configure: vi.fn(),
        encode: vi.fn((frame, opts) => { encodeCalls.push({ ...opts }); }),
        flush: vi.fn(() => Promise.resolve()),
        close: vi.fn()
      };
      const MockVideoEncoder = vi.fn(() => mockEncoderInstance);

      const mockMuxerInstance = {
        addVideoChunk: vi.fn(),
        finalize: vi.fn(),
        target: { buffer: new ArrayBuffer(0) }
      };
      const MockMuxer = vi.fn(() => mockMuxerInstance);
      const MockArrayBufferTarget = vi.fn(() => ({}));

      global.VideoEncoder = MockVideoEncoder;
      global.VideoDecoder = vi.fn();
      // Synchronous requestAnimationFrame so encodeNextFrame runs inline
      vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); });

      vi.resetModules();
      vi.doMock('mp4-muxer', () => ({
        Muxer: MockMuxer,
        ArrayBufferTarget: MockArrayBufferTarget
      }));

      const mod = await import('../../src/shared/recorder.js');

      const frames = [
        { close: vi.fn() }, // index 0 → keyFrame = true (index===0)
        { close: vi.fn() }  // index 1 → keyFrame = false (1!==0 && 1%60!==0)
      ];

      await mod.encodeToMP4(null, frames);

      // Both frames were encoded
      expect(encodeCalls).toHaveLength(2);
      // index 0: index===0 → true (first arm of ||)
      expect(encodeCalls[0].keyFrame).toBe(true);
      // index 1: index!==0 && 1%60!==0 → false (both arms false)
      expect(encodeCalls[1].keyFrame).toBe(false);
    });
  });

  describe('getSupportedFormat', () => {
    it('returns format info', () => {
      const format = recorderModule.getSupportedFormat();
      expect(format).toHaveProperty('format');
      expect(format).toHaveProperty('mimeType');
      expect(format).toHaveProperty('canShare');
    });

    it('returns webm when VP9 is supported but VideoEncoder is unavailable (VP9/H264 branch)', () => {
      // Default test env: VideoEncoder undefined, MockMediaRecorder VP9 = true
      const format = recorderModule.getSupportedFormat();
      expect(format.format).toBe('webm');
      expect(format.canShare).toBe(true);
    });

    it('returns { format: "none", canShare: false } when no codecs supported (else branch)', async () => {
      // Make isTypeSupported always return false by replacing global MediaRecorder
      const origIsTypeSupported = global.MediaRecorder.isTypeSupported;
      global.MediaRecorder.isTypeSupported = () => false;
      vi.resetModules();
      const mod = await import('../../src/shared/recorder.js');
      // Also ensure VideoEncoder is absent
      const format = mod.getSupportedFormat();
      expect(format.format).toBe('none');
      expect(format.canShare).toBe(false);
      global.MediaRecorder.isTypeSupported = origIsTypeSupported;
    });

    it('returns mp4 when VideoEncoder is available (hasVideoEncoderSupport branch)', async () => {
      global.VideoEncoder = vi.fn();
      vi.resetModules();
      try {
        const mod = await import('../../src/shared/recorder.js');
        const format = mod.getSupportedFormat();
        expect(format.format).toBe('mp4');
        expect(format.canShare).toBe(true);
      } finally {
        delete global.VideoEncoder;
      }
    });
  });

  describe('startCapture — non-passive mode (recordedChunks branch)', () => {
    it('routes ondataavailable chunks to recordedChunks when passive=false (else branch)', async () => {
      vi.useFakeTimers();
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas); // passive defaults to false
      await recorderModule.startRecording();
      // Advance 2s to fire ondataavailable twice (mock fires every 1000ms)
      vi.advanceTimersByTime(2000);
      vi.useRealTimers();
      // Non-passive: chunks go to recordedChunks; blob from stopRecording has content
      const blob = await recorderModule.stopRecording();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('startCapture — passive mode (isPassiveMode branch)', () => {
    it('routes ondataavailable chunks to circularBuffer when passive=true', async () => {
      vi.useFakeTimers();
      const canvas = createMockCanvas();
      recorderModule.startCapture(canvas, { passive: true });
      await recorderModule.startRecording();
      // Advance time to trigger ondataavailable events (mock fires every 1000ms)
      vi.advanceTimersByTime(2000);
      // In passive mode, chunks go to circularBuffer, not recordedChunks
      // getBufferedChunks returns circularBuffer contents
      const buffered = recorderModule.getBufferedChunks();
      expect(Array.isArray(buffered)).toBe(true);
      expect(buffered.length).toBeGreaterThan(0);
      vi.useRealTimers();
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

// ── ondataavailable empty-data guard ─────────────────────────────────────────
// Tests the `if (event.data && event.data.size > 0)` false branch in startRecording.
// When data is null or zero-size, no chunk should be pushed to recordedChunks.

describe('ondataavailable — event.data size=0 (if false branch)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('does not push chunk when event.data.size === 0', async () => {
    vi.useFakeTimers();

    class MockMRZeroSize {
      constructor(stream) {
        this.stream = stream; this.state = 'inactive';
        this.ondataavailable = null; this.onstop = null;
      }
      start(t) {
        this.state = 'recording';
        this._iv = setInterval(() => {
          if (this.state === 'recording' && this.ondataavailable) {
            this.ondataavailable({ data: new Blob([], { type: 'video/webm' }) }); // size=0
          }
        }, t);
      }
      stop() {
        this.state = 'inactive';
        clearInterval(this._iv);
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(t) {
        return ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=h264'].includes(t);
      }
    }

    vi.resetModules();
    global.MediaRecorder = MockMRZeroSize;
    global.MediaStream = MockMediaStream;
    global.window = { MediaRecorder: MockMRZeroSize, MediaStream: MockMediaStream, devicePixelRatio: 2, location: { href: '' } };
    global.performance = { now: () => Date.now() };
    global.document = { createElement: vi.fn(tag => tag === 'canvas' ? createMockCanvas() : {}), head: { appendChild: vi.fn() } };

    const mod = await import('../../src/shared/recorder.js');
    mod.startCapture(createMockCanvas());
    await mod.startRecording();

    vi.advanceTimersByTime(2000); // fires 2 events with size=0 blob — skipped by guard

    const blob = await mod.stopRecording();
    expect(blob.size).toBe(0); // no chunks were collected
    mod.cleanup();
  });
});

describe('ondataavailable — event.data null (if false branch)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('does not push chunk when event.data is null', async () => {
    vi.useFakeTimers();

    class MockMRNullData {
      constructor(stream) {
        this.stream = stream; this.state = 'inactive';
        this.ondataavailable = null; this.onstop = null;
      }
      start(t) {
        this.state = 'recording';
        this._iv = setInterval(() => {
          if (this.state === 'recording' && this.ondataavailable) {
            this.ondataavailable({ data: null }); // null data — fails event.data check
          }
        }, t);
      }
      stop() {
        this.state = 'inactive';
        clearInterval(this._iv);
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(t) {
        return ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=h264'].includes(t);
      }
    }

    vi.resetModules();
    global.MediaRecorder = MockMRNullData;
    global.MediaStream = MockMediaStream;
    global.window = { MediaRecorder: MockMRNullData, MediaStream: MockMediaStream, devicePixelRatio: 2, location: { href: '' } };
    global.performance = { now: () => Date.now() };
    global.document = { createElement: vi.fn(tag => tag === 'canvas' ? createMockCanvas() : {}), head: { appendChild: vi.fn() } };

    const mod = await import('../../src/shared/recorder.js');
    mod.startCapture(createMockCanvas());
    await mod.startRecording();

    vi.advanceTimersByTime(2000); // fires 2 events with null data — skipped by guard

    const blob = await mod.stopRecording();
    expect(blob.size).toBe(0); // no chunks were collected
    mod.cleanup();
  });
});

// ── circularBuffer overflow — shift() branch ──────────────────────────────────
// Tests the `if (circularBuffer.length > CIRCULAR_BUFFER_MAX_CHUNKS) circularBuffer.shift()`
// branch. Requires 902+ ondataavailable events in passive mode.

describe('circularBuffer overflow — shift() branch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('shifts oldest chunk when circularBuffer exceeds 900 chunks (shift() true branch)', async () => {
    let capturedMR;
    class MockMRCapture {
      constructor(stream) {
        this.stream = stream; this.state = 'inactive';
        this.ondataavailable = null; this.onstop = null;
        capturedMR = this;
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(t) {
        return ['video/webm', 'video/webm;codecs=vp9', 'video/webm;codecs=h264'].includes(t);
      }
    }

    vi.resetModules();
    global.MediaRecorder = MockMRCapture;
    global.MediaStream = MockMediaStream;
    global.window = { MediaRecorder: MockMRCapture, MediaStream: MockMediaStream, devicePixelRatio: 2, location: { href: '' } };
    global.performance = { now: () => Date.now() };
    global.document = { createElement: vi.fn(tag => tag === 'canvas' ? createMockCanvas() : {}), head: { appendChild: vi.fn() } };

    const mod = await import('../../src/shared/recorder.js');
    mod.startCapture(createMockCanvas(), { passive: true });
    await mod.startRecording();

    // Fire ondataavailable 902 times — exceeds CIRCULAR_BUFFER_MAX_CHUNKS (900)
    // After each push past 900, shift() removes the oldest chunk
    const chunk = new Blob(['x'], { type: 'video/webm' });
    for (let i = 0; i < 902; i++) {
      capturedMR.ondataavailable({ data: chunk });
    }

    // 902 pushes with 2 shifts → buffer length is 900, not 902
    const buffered = mod.getBufferedChunks();
    expect(buffered.length).toBe(900);
    mod.cleanup();
  });
});
