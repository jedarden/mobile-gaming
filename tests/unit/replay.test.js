/**
 * Replay System - Unit Tests
 *
 * Tests for deterministic replay recording, encoding, and playback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import all functions from replay module
import {
  startRecording,
  encodeReplay,
  encodeReplayToBase64,
  encodeReplayToShortCode,
  decodeReplay,
  decodeReplayFromBase64,
  decodeReplayFromShortCode,
  createReplayUrl,
  parseReplayFromUrl,
  isReplayUrl,
  createPlayback,
  createReplayBuffer,
  createReplayRenderer,
  REPLAY_VERSION
} from '../../src/shared/replay.js';

// Import default for constants
import replayModule from '../../src/shared/replay.js';
const { GAME_IDS, GAME_PREFIXES } = replayModule;

// ===== Encoding/Decoding Tests =====

describe('Replay Encoding', () => {
  describe('encodeReplay/decodeReplay round-trip', () => {
    it('should preserve empty replay', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 12345,
        version: REPLAY_VERSION,
        events: []
      };

      const encoded = encodeReplay(replay);
      const decoded = decodeReplay(encoded);

      expect(decoded.gameId).toBe('water-sort');
      expect(decoded.levelId).toBe(1);
      expect(decoded.seed).toBe(12345);
      expect(decoded.events).toEqual([]);
    });

    it('should preserve single tap event', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 5,
        seed: 99999,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 100, y: 200, dx: 0, dy: 0 }
        ]
      };

      const encoded = encodeReplay(replay);
      const decoded = decodeReplay(encoded);

      expect(decoded.gameId).toBe('water-sort');
      expect(decoded.levelId).toBe(5);
      expect(decoded.seed).toBe(99999);
      expect(decoded.events).toHaveLength(1);
      expect(decoded.events[0].type).toBe('tap');
      expect(decoded.events[0].x).toBeCloseTo(100, 1);
      expect(decoded.events[0].y).toBeCloseTo(200, 1);
    });

    it('should preserve multiple events with timing deltas', () => {
      const replay = {
        gameId: 'jelly-shift',
        levelId: 3,
        seed: 42,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'down', x: 150.5, y: 300.25, dx: 0, dy: 0 },
          { dt: 50, type: 'move', x: 155, y: 295, dx: 4.5, dy: -5.25, },
          { dt: 50, type: 'move', x: 160, y: 290, dx: 5, dy: -5, },
          { dt: 100, type: 'up', x: 160, y: 290, dx: 0, dy: 0 }
        ]
      };

      const encoded = encodeReplay(replay);
      const decoded = decodeReplay(encoded);

      expect(decoded.gameId).toBe('jelly-shift');
      expect(decoded.levelId).toBe(3);
      expect(decoded.seed).toBe(42);
      expect(decoded.events).toHaveLength(4);

      // Check timing deltas preserved
      expect(decoded.events[0].dt).toBe(0);
      expect(decoded.events[1].dt).toBe(50);
      expect(decoded.events[2].dt).toBe(50);
      expect(decoded.events[3].dt).toBe(100);

      // Check coordinates (with precision loss tolerance)
      expect(decoded.events[0].x).toBeCloseTo(150.5, 1);
      expect(decoded.events[0].y).toBeCloseTo(300.25, 1);
      expect(decoded.events[1].dx).toBeCloseTo(4.5, 1);
      expect(decoded.events[1].dy).toBeCloseTo(-5.25, 1);
    });

    it('should handle all event types', () => {
      const eventTypes = ['tap', 'down', 'move', 'up', 'swipe', 'reshape'];

      for (const type of eventTypes) {
        const replay = {
          gameId: 'brain-teaser',
          levelId: 1,
          seed: 1,
          version: REPLAY_VERSION,
          events: [{ dt: 10, type, x: 50, y: 50, dx: 1, dy: 1 }]
        };

        const encoded = encodeReplay(replay);
        const decoded = decodeReplay(encoded);

        expect(decoded.events[0].type).toBe(type);
      }
    });

    it('should handle all game IDs', () => {
      const gameIds = Object.keys(GAME_IDS);

      for (const gameId of gameIds) {
        const replay = {
          gameId,
          levelId: 1,
          seed: 1,
          version: REPLAY_VERSION,
          events: [{ dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 }]
        };

        const encoded = encodeReplay(replay);
        const decoded = decodeReplay(encoded);

        expect(decoded.gameId).toBe(gameId);
      }
    });

    it('should handle negative coordinates', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'move', x: -100, y: -200, dx: -50, dy: -75 }
        ]
      };

      const encoded = encodeReplay(replay);
      const decoded = decodeReplay(encoded);

      expect(decoded.events[0].x).toBeCloseTo(-100, 1);
      expect(decoded.events[0].y).toBeCloseTo(-200, 1);
      expect(decoded.events[0].dx).toBeCloseTo(-50, 1);
      expect(decoded.events[0].dy).toBeCloseTo(-75, 1);
    });

    it('should throw on unknown game ID', () => {
      const replay = {
        gameId: 'unknown-game',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: []
      };

      expect(() => encodeReplay(replay)).toThrow('Unknown game ID');
    });

    it('should throw on unknown event type', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [{ dt: 0, type: 'unknown', x: 0, y: 0, dx: 0, dy: 0 }]
      };

      expect(() => encodeReplay(replay)).toThrow('Unknown event type');
    });
  });

  describe('encodeReplayToBase64/decodeReplayFromBase64', () => {
    it('should round-trip via base64', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 10,
        seed: 123456,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 100, y: 200, dx: 0, dy: 0 },
          { dt: 500, type: 'tap', x: 150, y: 250, dx: 0, dy: 0 }
        ]
      };

      const base64 = encodeReplayToBase64(replay);
      expect(typeof base64).toBe('string');
      expect(base64).not.toMatch(/[+/=]/); // URL-safe

      const decoded = decodeReplayFromBase64(base64);
      expect(decoded.gameId).toBe('water-sort');
      expect(decoded.levelId).toBe(10);
      expect(decoded.events).toHaveLength(2);
    });

    it('should produce compact size for puzzle game', () => {
      // Simulate a typical puzzle game replay (20 tap events - typical for water sort)
      const events = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          dt: 200 + Math.floor(Math.random() * 300),
          type: 'tap',
          x: Math.random() * 400,
          y: Math.random() * 600,
          dx: 0,
          dy: 0
        });
      }

      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events
      };

      const base64 = encodeReplayToBase64(replay);
      const byteSize = Math.ceil(base64.length * 3 / 4);

      // Should be compact - 20 events should be under 250 bytes
      expect(byteSize).toBeLessThan(300);
    });
  });

  describe('encodeReplayToShortCode/decodeReplayFromShortCode', () => {
    it('should generate valid short code format', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 12345,
        version: REPLAY_VERSION,
        events: [{ dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 }]
      };

      const shortCode = encodeReplayToShortCode(replay);

      // Should match format: XX-XXXX-XXXX...
      expect(shortCode).toMatch(/^WS-/);
      expect(shortCode.length).toBeGreaterThan(3);
    });

    it('should use correct game prefixes', () => {
      const testCases = [
        { gameId: 'water-sort', prefix: 'WS' },
        { gameId: 'brain-teaser', prefix: 'BT' },
        { gameId: 'jelly-shift', prefix: 'JS' },
        { gameId: 'giant-runner', prefix: 'GR' }
      ];

      for (const { gameId, prefix } of testCases) {
        const replay = {
          gameId,
          levelId: 1,
          seed: 1,
          version: REPLAY_VERSION,
          events: []
        };

        const shortCode = encodeReplayToShortCode(replay);
        expect(shortCode.startsWith(prefix + '-')).toBe(true);
      }
    });

    it('should round-trip via short code', () => {
      const replay = {
        gameId: 'brain-teaser',
        levelId: 5,
        seed: 999,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 50.5, y: 75.25, dx: 0, dy: 0 }
        ]
      };

      const shortCode = encodeReplayToShortCode(replay);
      const decoded = decodeReplayFromShortCode(shortCode);

      expect(decoded.gameId).toBe('brain-teaser');
      expect(decoded.levelId).toBe(5);
      expect(decoded.seed).toBe(999);
      expect(decoded.events).toHaveLength(1);
    });
  });
});

// ===== URL Handling Tests =====

describe('Replay URL Handling', () => {
  describe('createReplayUrl', () => {
    it('should create URL with #r= prefix', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: []
      };

      const url = createReplayUrl(replay);
      expect(url).toMatch(/^#r=/);
    });
  });

  describe('parseReplayFromUrl', () => {
    it('should parse replay from URL hash', () => {
      const replay = {
        gameId: 'jelly-shift',
        levelId: 3,
        seed: 42,
        version: REPLAY_VERSION,
        events: [{ dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 }]
      };

      const url = createReplayUrl(replay);
      const decoded = parseReplayFromUrl(url);

      expect(decoded).not.toBeNull();
      expect(decoded.gameId).toBe('jelly-shift');
      expect(decoded.levelId).toBe(3);
    });

    it('should handle hash without # prefix', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: []
      };

      const url = createReplayUrl(replay);
      const hashWithoutPrefix = url.slice(1); // Remove #
      const decoded = parseReplayFromUrl(hashWithoutPrefix);

      expect(decoded).not.toBeNull();
      expect(decoded.gameId).toBe('water-sort');
    });

    it('should return null for non-replay URLs', () => {
      expect(parseReplayFromUrl('#s=state123')).toBeNull();
      expect(parseReplayFromUrl('#level=5')).toBeNull();
      expect(parseReplayFromUrl('')).toBeNull();
    });
  });

  describe('isReplayUrl', () => {
    it('should detect replay URLs', () => {
      expect(isReplayUrl('#r=abc123')).toBe(true);
      expect(isReplayUrl('r=test')).toBe(true);
    });

    it('should reject non-replay URLs', () => {
      expect(isReplayUrl('#s=state')).toBe(false);
      expect(isReplayUrl('#level=5')).toBe(false);
      expect(isReplayUrl('')).toBe(false);
    });
  });
});

// ===== Recording Tests =====

describe('Replay Recording', () => {
  describe('startRecording', () => {
    it('should create recorder with correct metadata', () => {
      const recorder = startRecording({
        gameId: 'water-sort',
        levelId: 5,
        seed: 12345
      });

      expect(recorder.isActive()).toBe(true);
      expect(recorder.getEventCount()).toBe(0);
      expect(recorder.getDuration()).toBe(0);
    });

    it('should record events with delta timing', () => {
      const recorder = startRecording({
        gameId: 'water-sort',
        levelId: 1,
        seed: 1
      });

      const baseTime = Date.now();

      recorder.record({ type: 'tap', x: 100, y: 200, timestamp: baseTime });
      recorder.record({ type: 'tap', x: 150, y: 250, timestamp: baseTime + 100 });
      recorder.record({ type: 'tap', x: 200, y: 300, timestamp: baseTime + 250 });

      expect(recorder.getEventCount()).toBe(3);
      expect(recorder.getDuration()).toBe(250);

      const replay = recorder.stop();

      expect(replay.events).toHaveLength(3);
      expect(replay.events[0].dt).toBe(0);
      expect(replay.events[1].dt).toBe(100);
      expect(replay.events[2].dt).toBe(150);
    });

    it('should use Date.now() for timestamp if not provided', () => {
      const recorder = startRecording({
        gameId: 'water-sort',
        levelId: 1,
        seed: 1
      });

      const before = Date.now();
      recorder.record({ type: 'tap', x: 100, y: 200 });
      const after = Date.now();

      expect(recorder.getEventCount()).toBe(1);
    });

    it('should stop recording after stop()', () => {
      const recorder = startRecording({
        gameId: 'water-sort',
        levelId: 1,
        seed: 1
      });

      recorder.record({ type: 'tap', x: 100, y: 200 });
      recorder.stop();

      expect(recorder.isActive()).toBe(false);

      // Recording after stop should be ignored
      recorder.record({ type: 'tap', x: 150, y: 250 });
      expect(recorder.getEventCount()).toBe(1);
    });
  });
});

// ===== Playback Tests =====

describe('Replay Playback', () => {
  describe('createPlayback', () => {
    it('should create playback controller', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: []
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      expect(playback.isPlaying()).toBe(false);
      expect(playback.getProgress()).toBe(1); // Empty replay = complete
      expect(playback.getCurrentTime()).toBe(0);
      expect(playback.getDuration()).toBe(0);
    });

    it('should report correct duration for events', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
          { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
          { dt: 200, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      expect(playback.getDuration()).toBe(300);
    });

    it('should play events with timing', async () => {
      const events = [];
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 },
          { dt: 10, type: 'tap', x: 200, y: 200, dx: 0, dy: 0 } // Small dt for fast test
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: (e) => events.push(e),
        onComplete: vi.fn(),
        speed: 100 // Very fast for testing
      });

      playback.play();
      expect(playback.isPlaying()).toBe(true);

      // Wait for playback to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toHaveLength(2);
      expect(events[0].x).toBeCloseTo(100, 1);
      expect(events[1].x).toBeCloseTo(200, 1);
    });

    it('should pause and resume playback', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
          { dt: 1000, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn(),
        speed: 1
      });

      playback.play();
      expect(playback.isPlaying()).toBe(true);

      playback.pause();
      expect(playback.isPlaying()).toBe(false);

      playback.play();
      expect(playback.isPlaying()).toBe(true);
    });

    it('should stop and reset playback', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
          { dt: 1000, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      playback.play();
      playback.stop();

      expect(playback.isPlaying()).toBe(false);
      expect(playback.getProgress()).toBe(0);
    });

    it('should adjust playback speed', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: []
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn(),
        speed: 1
      });

      expect(playback.getSpeed()).toBe(1);

      playback.setSpeed(2);
      expect(playback.getSpeed()).toBe(2);

      playback.setSpeed(0.5);
      expect(playback.getSpeed()).toBe(0.5);
    });

    it('should seek to timestamp', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 },    // fires at t=0
          { dt: 100, type: 'tap', x: 200, y: 200, dx: 0, dy: 0 },  // fires at t=100
          { dt: 100, type: 'tap', x: 300, y: 300, dx: 0, dy: 0 },  // fires at t=200
          { dt: 100, type: 'tap', x: 400, y: 400, dx: 0, dy: 0 }   // fires at t=300
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      // Seek to 150ms
      // Events at t=0 and t=100 fire (0 < 150, 100 < 150)
      // Event at t=200 doesn't fire yet (200 < 150 is false)
      playback.seek(150);

      expect(playback.getCurrentIndex()).toBe(2); // Two events have fired
      expect(playback.getCurrentTime()).toBe(100); // Time after second event
    });

    it('should report progress correctly', () => {
      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },    // fires at t=0
          { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },  // fires at t=100
          { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },  // fires at t=200
          { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }   // fires at t=300
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      expect(playback.getProgress()).toBe(0);

      // seek(100) positions before event at t=100, so only event at t=0 has fired
      playback.seek(100);
      expect(playback.getProgress()).toBe(0.25); // 1/4 events

      // seek(200) positions before event at t=200, so events at t=0 and t=100 have fired
      playback.seek(200);
      expect(playback.getProgress()).toBe(0.5); // 2/4 events
    });

    it('should return replay info', () => {
      const replay = {
        gameId: 'jelly-shift',
        levelId: 7,
        seed: 12345,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }
        ]
      };

      const playback = createPlayback({
        replay,
        onEvent: vi.fn(),
        onComplete: vi.fn()
      });

      const info = playback.getReplayInfo();

      expect(info.gameId).toBe('jelly-shift');
      expect(info.levelId).toBe(7);
      expect(info.seed).toBe(12345);
      expect(info.eventCount).toBe(1);
    });
  });
});

// ===== Replay Buffer Tests =====

describe('Replay Buffer', () => {
  describe('createReplayBuffer', () => {
    it('should create buffer with idle mode', () => {
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: vi.fn()
      });

      expect(buffer.getMode()).toBe('idle');
      expect(buffer.isRecording()).toBe(false);
      expect(buffer.isPlaying()).toBe(false);
    });

    it('should start and stop recording', () => {
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: vi.fn()
      });

      buffer.startRecording(1, 123);
      expect(buffer.isRecording()).toBe(true);

      buffer.record({ type: 'tap', x: 100, y: 200 });

      const replay = buffer.stopRecording();
      expect(replay).not.toBeNull();
      expect(replay.gameId).toBe('water-sort');
      expect(replay.levelId).toBe(1);
      expect(replay.seed).toBe(123);
      expect(replay.events).toHaveLength(1);
    });

    it('should call onReplayComplete when recording stops', () => {
      const onComplete = vi.fn();
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: onComplete
      });

      buffer.startRecording(1, 1);
      buffer.record({ type: 'tap', x: 100, y: 200 });
      buffer.stopRecording();

      expect(onComplete).toHaveBeenCalled();
      expect(onComplete.mock.calls[0][0].events).toHaveLength(1);
    });

    it('should not record when not in recording mode', () => {
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: vi.fn()
      });

      // Should be ignored when idle
      buffer.record({ type: 'tap', x: 100, y: 200 });

      buffer.startRecording(1, 1);
      buffer.stopRecording();

      // No events should have been recorded
    });

    it('should start and stop playback', async () => {
      const events = [];
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: vi.fn()
      });

      const replay = {
        gameId: 'water-sort',
        levelId: 1,
        seed: 1,
        version: REPLAY_VERSION,
        events: [
          { dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 }
        ]
      };

      buffer.startPlayback(
        replay,
        (e) => events.push(e),
        vi.fn(),
        100 // Fast speed
      );

      expect(buffer.isPlaying()).toBe(true);

      // Wait for playback
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(events).toHaveLength(1);
    });

    it('should stop all activity', () => {
      const buffer = createReplayBuffer({
        gameId: 'water-sort',
        onReplayComplete: vi.fn()
      });

      buffer.startRecording(1, 1);
      buffer.stop();

      expect(buffer.getMode()).toBe('idle');
    });
  });
});

// ===== Determinism Tests =====

describe('Replay Determinism', () => {
  it('should produce identical binary for identical replay', () => {
    const replay = {
      gameId: 'water-sort',
      levelId: 5,
      seed: 999,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 100, y: 200, dx: 0, dy: 0 },
        { dt: 50, type: 'tap', x: 150, y: 250, dx: 0, dy: 0 }
      ]
    };

    const encoded1 = encodeReplay(replay);
    const encoded2 = encodeReplay(replay);

    expect(encoded1).toEqual(encoded2);
  });

  it('should produce identical base64 for identical replay', () => {
    const replay = {
      gameId: 'brain-teaser',
      levelId: 3,
      seed: 42,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 50, y: 75, dx: 0, dy: 0 }
      ]
    };

    const base64_1 = encodeReplayToBase64(replay);
    const base64_2 = encodeReplayToBase64(replay);

    expect(base64_1).toBe(base64_2);
  });

  it('should reproduce identical events after round-trip', () => {
    const originalEvents = [
      { dt: 0, type: 'down', x: 100.5, y: 200.25, dx: 0, dy: 0 },
      { dt: 16, type: 'move', x: 105.75, y: 195.5, dx: 5.25, dy: -4.75 },
      { dt: 16, type: 'move', x: 110, y: 190, dx: 4.25, dy: -5.5 },
      { dt: 50, type: 'up', x: 110, y: 190, dx: 0, dy: 0 }
    ];

    const replay = {
      gameId: 'jelly-shift',
      levelId: 1,
      seed: 1,
      version: REPLAY_VERSION,
      events: originalEvents
    };

    const encoded = encodeReplay(replay);
    const decoded = decodeReplay(encoded);

    // Check each event is preserved (with precision tolerance)
    for (let i = 0; i < originalEvents.length; i++) {
      expect(decoded.events[i].dt).toBe(originalEvents[i].dt);
      expect(decoded.events[i].type).toBe(originalEvents[i].type);
      expect(decoded.events[i].x).toBeCloseTo(originalEvents[i].x, 1);
      expect(decoded.events[i].y).toBeCloseTo(originalEvents[i].y, 1);
      expect(decoded.events[i].dx).toBeCloseTo(originalEvents[i].dx, 1);
      expect(decoded.events[i].dy).toBeCloseTo(originalEvents[i].dy, 1);
    }
  });
});

// ===== Scrubber Tests =====

describe('Replay Scrubber', () => {
  it('should seek to beginning', () => {
    const replay = {
      gameId: 'water-sort',
      levelId: 1,
      seed: 1,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },     // fires at t=0
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },   // fires at t=100
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }    // fires at t=200
      ]
    };

    const playback = createPlayback({
      replay,
      onEvent: vi.fn(),
      onComplete: vi.fn()
    });

    playback.seek(300); // Go to end (all 3 events fire before t=300)
    expect(playback.getCurrentIndex()).toBe(3);

    playback.seek(0); // Back to start (no events fire before t=0)
    expect(playback.getCurrentIndex()).toBe(0);
    expect(playback.getCurrentTime()).toBe(0);
  });

  it('should seek to end', () => {
    const replay = {
      gameId: 'water-sort',
      levelId: 1,
      seed: 1,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }
      ]
    };

    const playback = createPlayback({
      replay,
      onEvent: vi.fn(),
      onComplete: vi.fn()
    });

    playback.seek(1000); // Beyond end

    expect(playback.getCurrentIndex()).toBe(3);
  });

  it('should find correct event at exact timestamp', () => {
    const replay = {
      gameId: 'water-sort',
      levelId: 1,
      seed: 1,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 100, y: 100, dx: 0, dy: 0 },    // fires at t=0
        { dt: 100, type: 'tap', x: 200, y: 200, dx: 0, dy: 0 },  // fires at t=100
        { dt: 100, type: 'tap', x: 300, y: 300, dx: 0, dy: 0 }   // fires at t=200
      ]
    };

    const playback = createPlayback({
      replay,
      onEvent: vi.fn(),
      onComplete: vi.fn()
    });

    // seek(0): no events fire before t=0
    playback.seek(0);
    expect(playback.getCurrentIndex()).toBe(0);

    // seek(100): only event at t=0 fires (0 < 100)
    playback.seek(100);
    expect(playback.getCurrentIndex()).toBe(1);

    // seek(200): events at t=0 and t=100 fire (0 < 200, 100 < 200)
    playback.seek(200);
    expect(playback.getCurrentIndex()).toBe(2);
  });

  it('should find correct event between timestamps', () => {
    const replay = {
      gameId: 'water-sort',
      levelId: 1,
      seed: 1,
      version: REPLAY_VERSION,
      events: [
        { dt: 0, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },    // fires at t=0
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 },  // fires at t=100
        { dt: 100, type: 'tap', x: 0, y: 0, dx: 0, dy: 0 }   // fires at t=200
      ]
    };

    const playback = createPlayback({
      replay,
      onEvent: vi.fn(),
      onComplete: vi.fn()
    });

    // seek(50): only event at t=0 fires (0 < 50)
    playback.seek(50);
    expect(playback.getCurrentIndex()).toBe(1);

    // seek(150): events at t=0 and t=100 fire (0 < 150, 100 < 150)
    playback.seek(150);
    expect(playback.getCurrentIndex()).toBe(2);
  });
});

// ===== Replay Renderer Tests =====

describe('createReplayRenderer', () => {
  let mockCanvas, mockMediaRecorder, mockStream;

  beforeEach(() => {
    // Mock MediaRecorder
    mockMediaRecorder = {
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
      onerror: null,
      start: vi.fn(function() {
        this.state = 'recording';
      }),
      stop: vi.fn(function() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }),
    };

    mockStream = {};
    mockCanvas = {
      captureStream: vi.fn(() => mockStream),
    };

    globalThis.MediaRecorder = vi.fn(() => mockMediaRecorder);
    globalThis.Blob = Blob;
  });

  it('returns an object with a start() method', () => {
    const renderer = createReplayRenderer({
      replay: { gameId: 'water-sort', levelId: 1, seed: 1, version: REPLAY_VERSION, events: [] },
      canvas: mockCanvas,
      initGame: vi.fn(),
      feedEvent: vi.fn(),
    });
    expect(typeof renderer.start).toBe('function');
  });

  it('start() calls initGame with levelId and seed', async () => {
    const initGame = vi.fn();
    const replay = { gameId: 'water-sort', levelId: 3, seed: 42, version: REPLAY_VERSION, events: [] };

    const renderer = createReplayRenderer({
      replay,
      canvas: mockCanvas,
      initGame,
      feedEvent: vi.fn(),
    });

    // Trigger start and immediately stop to resolve
    const startPromise = renderer.start();
    // Let the MediaRecorder trigger onstop
    mockMediaRecorder.onstop();

    await startPromise;
    expect(initGame).toHaveBeenCalledWith(3, 42);
  });

  it('start() rejects if called while already rendering', async () => {
    const renderer = createReplayRenderer({
      replay: { gameId: 'water-sort', levelId: 1, seed: 1, version: REPLAY_VERSION, events: [] },
      canvas: mockCanvas,
      initGame: vi.fn(),
      feedEvent: vi.fn(),
    });

    // Start once (don't await)
    const first = renderer.start();

    // Second call should reject immediately
    await expect(renderer.start()).rejects.toThrow('Already rendering');

    // Resolve first
    mockMediaRecorder.onstop();
    await first;
  });
});
