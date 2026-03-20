/**
 * Deterministic Replay System
 *
 * Records and shares input sequences that reproduce exact gameplay
 * via deterministic physics and RNG.
 *
 * Features:
 * - Input recording with delta timestamps
 * - Compact binary encoding (20-80 bytes for puzzles, 200-400 for runners)
 * - URL encoding via #r=<base64>
 * - Short replay codes: WS-7K3M-XNPL (game prefix + base36)
 * - Playback engine with speed control and scrubber
 */

// Game ID mappings (1 byte each)
const GAME_IDS = {
  'water-sort': 0x01,
  'brain-teaser': 0x02,
  'parking-escape': 0x03,
  'save-the-character': 0x04,
  'merge': 0x05,
  'satisfying': 0x06,
  'crowd-runner': 0x07,
  'bridge-race': 0x08,
  'giant-runner': 0x09,
  'jelly-shift': 0x0A,
  'makeover-run': 0x0B,
  'pull-the-pin': 0x0C,
  'bus-jam': 0x0D
};

const GAME_ID_TO_KEY = Object.fromEntries(
  Object.entries(GAME_IDS).map(([k, v]) => [v, k])
);

// Game prefixes for short codes
const GAME_PREFIXES = {
  'water-sort': 'WS',
  'brain-teaser': 'BT',
  'parking-escape': 'PE',
  'save-the-character': 'SC',
  'merge': 'MG',
  'satisfying': 'SF',
  'crowd-runner': 'CR',
  'bridge-race': 'BR',
  'giant-runner': 'GR',
  'jelly-shift': 'JS',
  'makeover-run': 'MR',
  'pull-the-pin': 'PP',
  'bus-jam': 'BJ'
};

const PREFIX_TO_GAME = Object.fromEntries(
  Object.entries(GAME_PREFIXES).map(([k, v]) => [v, k])
);

// Input event types (1 byte each)
const EVENT_TYPES = {
  'tap': 0x01,
  'down': 0x02,
  'move': 0x03,
  'up': 0x04,
  'swipe': 0x05,
  'reshape': 0x06  // Game-specific (e.g., jelly-shift width change)
};

const EVENT_TYPE_TO_KEY = Object.fromEntries(
  Object.entries(EVENT_TYPES).map(([k, v]) => [v, k])
);

// Current format version
const REPLAY_VERSION = 1;

/**
 * Varint encoding for compact integers
 * Uses 1-5 bytes depending on value size
 *
 * @param {number} value - Non-negative integer to encode
 * @returns {Uint8Array} Encoded bytes
 */
function encodeVarint(value) {
  const bytes = [];
  let v = value >>> 0; // Ensure unsigned 32-bit

  while (v >= 0x80) {
    bytes.push((v & 0x7F) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);

  return new Uint8Array(bytes);
}

/**
 * Varint decoding
 *
 * @param {Uint8Array} bytes - Byte array starting with varint
 * @param {number} offset - Start position
 * @returns {{ value: number, bytesRead: number }} Decoded value and bytes consumed
 */
function decodeVarint(bytes, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    bytesRead++;

    value |= (byte & 0x7F) << shift;
    shift += 7;

    if (!(byte & 0x80)) break;
  }

  return { value: value >>> 0, bytesRead };
}

/**
 * Signed varint encoding (zigzag encoding)
 * Efficiently encodes signed integers
 *
 * @param {number} value - Signed integer
 * @returns {Uint8Array} Encoded bytes
 */
function encodeSignedVarint(value) {
  // Zigzag encoding: maps signed to unsigned
  const zigzag = (value << 1) ^ (value >> 31);
  return encodeVarint(zigzag >>> 0);
}

/**
 * Signed varint decoding
 *
 * @param {Uint8Array} bytes - Byte array
 * @param {number} offset - Start position
 * @returns {{ value: number, bytesRead: number }}
 */
function decodeSignedVarint(bytes, offset = 0) {
  const { value, bytesRead } = decodeVarint(bytes, offset);
  // Zigzag decoding: maps unsigned back to signed
  const signed = (value >>> 1) ^ -(value & 1);
  return { value: signed, bytesRead };
}

/**
 * Encode a float coordinate to integer (multiply by 100 for 2 decimal precision)
 *
 * @param {number} value - Float value
 * @returns {number} Scaled integer
 */
function encodeCoord(value) {
  return Math.round(value * 100);
}

/**
 * Decode integer coordinate back to float
 *
 * @param {number} value - Scaled integer
 * @returns {number} Float value
 */
function decodeCoord(value) {
  return value / 100;
}

// ===== Recording =====

/**
 * Create a new replay recorder
 *
 * @param {Object} options
 * @param {string} options.gameId - Game identifier
 * @param {number} options.levelId - Level number
 * @param {number} options.seed - RNG seed for deterministic level generation
 * @returns {Object} Recorder instance
 */
export function startRecording({ gameId, levelId, seed }) {
  const events = [];
  let lastTimestamp = null;
  let isRecording = true;

  return {
    /**
     * Record an input event
     *
     * @param {Object} event - Input event
     * @param {string} event.type - Event type ('tap', 'down', 'move', 'up', 'swipe', 'reshape')
     * @param {number} event.x - X coordinate (logical pixels)
     * @param {number} event.y - Y coordinate (logical pixels)
     * @param {number} [event.dx] - Delta X for move/drag events
     * @param {number} [event.dy] - Delta Y for move/drag events
     * @param {number} [event.timestamp] - Event timestamp (defaults to Date.now())
     */
    record(event) {
      if (!isRecording) return;

      const timestamp = event.timestamp || Date.now();
      const dt = lastTimestamp === null ? 0 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      events.push({
        dt,
        type: event.type,
        x: event.x,
        y: event.y,
        dx: event.dx || 0,
        dy: event.dy || 0
      });
    },

    /**
     * Stop recording and get the replay data
     *
     * @returns {Object} Replay data
     */
    stop() {
      isRecording = false;
      return {
        gameId,
        levelId,
        seed,
        version: REPLAY_VERSION,
        events: [...events]
      };
    },

    /**
     * Check if currently recording
     *
     * @returns {boolean}
     */
    isActive() {
      return isRecording;
    },

    /**
     * Get current event count
     *
     * @returns {number}
     */
    getEventCount() {
      return events.length;
    },

    /**
     * Get total duration in milliseconds
     *
     * @returns {number}
     */
    getDuration() {
      if (events.length === 0) return 0;
      return events.reduce((sum, e) => sum + e.dt, 0);
    }
  };
}

// ===== Encoding =====

/**
 * Encode a replay to compact binary format
 *
 * Binary format:
 * - Header (10 bytes):
 *   - gameId: 1 byte
 *   - levelId: 4 bytes (little-endian uint32)
 *   - seed: 4 bytes (little-endian uint32)
 *   - version: 1 byte
 * - Events (variable):
 *   - dt: varint (milliseconds delta)
 *   - type: 1 byte
 *   - x: signed varint (scaled by 100)
 *   - y: signed varint (scaled by 100)
 *   - dx: signed varint (scaled by 100)
 *   - dy: signed varint (scaled by 100)
 *
 * @param {Object} replay - Replay data from recorder
 * @returns {Uint8Array} Encoded binary
 */
export function encodeReplay(replay) {
  const gameIdByte = GAME_IDS[replay.gameId];
  if (gameIdByte === undefined) {
    throw new Error(`Unknown game ID: ${replay.gameId}`);
  }

  // Build header
  const header = new Uint8Array(10);
  header[0] = gameIdByte;

  // Level ID (4 bytes little-endian)
  const levelId = replay.levelId >>> 0;
  header[1] = levelId & 0xFF;
  header[2] = (levelId >>> 8) & 0xFF;
  header[3] = (levelId >>> 16) & 0xFF;
  header[4] = (levelId >>> 24) & 0xFF;

  // Seed (4 bytes little-endian)
  const seed = replay.seed >>> 0;
  header[5] = seed & 0xFF;
  header[6] = (seed >>> 8) & 0xFF;
  header[7] = (seed >>> 16) & 0xFF;
  header[8] = (seed >>> 24) & 0xFF;

  // Version
  header[9] = replay.version || REPLAY_VERSION;

  // Encode events
  const eventBuffers = [];
  for (const event of replay.events) {
    const typeByte = EVENT_TYPES[event.type];
    if (typeByte === undefined) {
      throw new Error(`Unknown event type: ${event.type}`);
    }

    eventBuffers.push(encodeVarint(event.dt));
    eventBuffers.push(new Uint8Array([typeByte]));
    eventBuffers.push(encodeSignedVarint(encodeCoord(event.x)));
    eventBuffers.push(encodeSignedVarint(encodeCoord(event.y)));
    eventBuffers.push(encodeSignedVarint(encodeCoord(event.dx || 0)));
    eventBuffers.push(encodeSignedVarint(encodeCoord(event.dy || 0)));
  }

  // Combine all buffers
  const totalLength = header.length + eventBuffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  result.set(header, 0);

  let offset = header.length;
  for (const buffer of eventBuffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

/**
 * Encode replay to base64 URL-safe string
 *
 * @param {Object} replay - Replay data
 * @returns {string} Base64-encoded string
 */
export function encodeReplayToBase64(replay) {
  const binary = encodeReplay(replay);
  let binaryString = '';
  for (let i = 0; i < binary.length; i++) {
    binaryString += String.fromCharCode(binary[i]);
  }
  // Use URL-safe base64 (replace + with -, / with _, remove =)
  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate short replay code (e.g., WS-7K3M-XNPL)
 *
 * @param {Object} replay - Replay data
 * @returns {string} Short code
 */
export function encodeReplayToShortCode(replay) {
  const prefix = GAME_PREFIXES[replay.gameId];
  if (!prefix) {
    throw new Error(`Unknown game ID: ${replay.gameId}`);
  }

  const binary = encodeReplay(replay);

  // Convert binary to base36 string
  // We'll process in chunks to handle large binaries
  let hexString = '';
  for (let i = 0; i < binary.length; i++) {
    hexString += binary[i].toString(16).padStart(2, '0');
  }

  // Convert hex to BigInt, then to base36
  const bigInt = BigInt('0x' + hexString);
  const base36 = bigInt.toString(36).toUpperCase();

  // Format with hyphens for readability (4 chars per group)
  const formatted = base36.match(/.{1,4}/g)?.join('-') || base36;

  return `${prefix}-${formatted}`;
}

// ===== Decoding =====

/**
 * Decode binary data to replay object
 *
 * @param {Uint8Array} binary - Encoded binary data
 * @returns {Object} Decoded replay
 */
export function decodeReplay(binary) {
  if (binary.length < 10) {
    throw new Error('Invalid replay data: too short');
  }

  // Parse header
  const gameIdByte = binary[0];
  const gameId = GAME_ID_TO_KEY[gameIdByte];
  if (!gameId) {
    throw new Error(`Unknown game ID byte: ${gameIdByte}`);
  }

  // Level ID (4 bytes little-endian)
  const levelId = binary[1] | (binary[2] << 8) | (binary[3] << 16) | (binary[4] << 24);

  // Seed (4 bytes little-endian)
  const seed = binary[5] | (binary[6] << 8) | (binary[7] << 16) | (binary[8] << 24);

  // Version
  const version = binary[9];

  // Parse events
  const events = [];
  let offset = 10;

  while (offset < binary.length) {
    // dt
    const dtResult = decodeVarint(binary, offset);
    offset += dtResult.bytesRead;

    // type
    const typeByte = binary[offset++];
    const type = EVENT_TYPE_TO_KEY[typeByte];
    if (!type) {
      throw new Error(`Unknown event type byte: ${typeByte}`);
    }

    // x
    const xResult = decodeSignedVarint(binary, offset);
    offset += xResult.bytesRead;

    // y
    const yResult = decodeSignedVarint(binary, offset);
    offset += yResult.bytesRead;

    // dx
    const dxResult = decodeSignedVarint(binary, offset);
    offset += dxResult.bytesRead;

    // dy
    const dyResult = decodeSignedVarint(binary, offset);
    offset += dyResult.bytesRead;

    events.push({
      dt: dtResult.value,
      type,
      x: decodeCoord(xResult.value),
      y: decodeCoord(yResult.value),
      dx: decodeCoord(dxResult.value),
      dy: decodeCoord(dyResult.value)
    });
  }

  return {
    gameId,
    levelId,
    seed,
    version,
    events
  };
}

/**
 * Decode base64 string to replay
 *
 * @param {string} base64 - URL-safe base64 string
 * @returns {Object} Decoded replay
 */
export function decodeReplayFromBase64(base64) {
  // Restore standard base64
  let standardBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Pad with = if needed
  while (standardBase64.length % 4 !== 0) {
    standardBase64 += '=';
  }

  const binaryString = atob(standardBase64);
  const binary = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binary[i] = binaryString.charCodeAt(i);
  }

  return decodeReplay(binary);
}

/**
 * Decode short replay code to replay
 *
 * @param {string} shortCode - Short code (e.g., WS-7K3M-XNPL)
 * @returns {Object} Decoded replay
 */
export function decodeReplayFromShortCode(shortCode) {
  // Parse prefix
  const match = shortCode.match(/^([A-Z]{2})-(.+)$/);
  if (!match) {
    throw new Error(`Invalid short code format: ${shortCode}`);
  }

  const [, prefix, code] = match;
  const gameId = PREFIX_TO_GAME[prefix];
  if (!gameId) {
    throw new Error(`Unknown game prefix: ${prefix}`);
  }

  // Remove hyphens and convert base36 to binary
  const base36 = code.replace(/-/g, '').toLowerCase();

  // Convert base36 string to BigInt by processing each character
  let bigInt = BigInt(0);
  for (let i = 0; i < base36.length; i++) {
    const char = base36[i];
    const digit = parseInt(char, 36);
    bigInt = bigInt * BigInt(36) + BigInt(digit);
  }

  // Convert to hex string
  let hexString = bigInt.toString(16);
  // Pad to even length
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString;
  }

  // Convert to Uint8Array
  const binary = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < binary.length; i++) {
    binary[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }

  return decodeReplay(binary);
}

// ===== URL Handling =====

/**
 * Create replay URL hash
 *
 * @param {Object} replay - Replay data
 * @returns {string} URL hash like #r=abc123...
 */
export function createReplayUrl(replay) {
  const encoded = encodeReplayToBase64(replay);
  return `#r=${encoded}`;
}

/**
 * Parse replay from URL hash
 *
 * @param {string} hash - URL hash (with or without #)
 * @returns {Object|null} Decoded replay or null if not found
 */
export function parseReplayFromUrl(hash) {
  const cleanHash = hash.replace(/^#/, '');

  // Check for replay parameter
  const replayMatch = cleanHash.match(/^r=(.+)$/);
  if (replayMatch) {
    try {
      return decodeReplayFromBase64(replayMatch[1]);
    } catch (e) {
      console.error('Failed to decode replay from URL:', e);
      return null;
    }
  }

  return null;
}

/**
 * Check if URL contains a replay
 *
 * @param {string} hash - URL hash
 * @returns {boolean}
 */
export function isReplayUrl(hash) {
  return /^#?r=/.test(hash);
}

// ===== Playback Engine =====

/**
 * Create a playback engine for replaying recorded inputs
 *
 * @param {Object} options
 * @param {Object} options.replay - Decoded replay data
 * @param {Function} options.onEvent - Callback for each event: (event) => void
 * @param {Function} options.onComplete - Callback when playback finishes: () => void
 * @param {number} [options.speed=1] - Playback speed multiplier
 * @returns {Object} Playback controller
 */
export function createPlayback({ replay, onEvent, onComplete, speed = 1 }) {
  let isPlaying = false;
  let currentIndex = 0;
  let timeoutId = null;
  let startTime = 0;
  let pausedAt = 0;
  let playbackSpeed = speed;

  // Pre-calculate cumulative timestamps for scrubbing
  let cumulativeTime = 0;
  const eventTimes = replay.events.map(e => {
    const time = cumulativeTime;
    cumulativeTime += e.dt;
    return time;
  });
  const totalDuration = cumulativeTime;

  /**
   * Schedule the next event
   */
  function scheduleNext() {
    if (currentIndex >= replay.events.length) {
      isPlaying = false;
      if (onComplete) onComplete();
      return;
    }

    const event = replay.events[currentIndex];
    const delay = event.dt / playbackSpeed;

    timeoutId = setTimeout(() => {
      if (!isPlaying) return;

      onEvent({
        ...event,
        timestamp: Date.now()
      });

      currentIndex++;
      scheduleNext();
    }, delay);
  }

  return {
    /**
     * Start or resume playback
     */
    play() {
      if (isPlaying) return;
      if (currentIndex >= replay.events.length) {
        currentIndex = 0; // Restart from beginning
      }

      isPlaying = true;
      startTime = Date.now() - pausedAt;
      scheduleNext();
    },

    /**
     * Pause playback
     */
    pause() {
      if (!isPlaying) return;
      isPlaying = false;
      pausedAt = Date.now() - startTime;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    /**
     * Stop playback and reset to beginning
     */
    stop() {
      this.pause();
      currentIndex = 0;
      pausedAt = 0;
    },

    /**
     * Seek to a specific timestamp (in milliseconds)
     * Events will be replayed up to that point instantly
     * Positions playback such that events at exactly the target timestamp have NOT yet fired
     *
     * @param {number} timestamp - Target timestamp in ms
     */
    seek(timestamp) {
      const wasPlaying = isPlaying;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Find the event index at the target timestamp
      // targetIndex = number of events that have fired BEFORE this timestamp
      // (events at exactly this timestamp should not have fired yet)
      let targetIndex = 0;
      let cumulativeTime = 0;

      for (let i = 0; i < replay.events.length; i++) {
        cumulativeTime += replay.events[i].dt;
        if (cumulativeTime < timestamp) {
          targetIndex = i + 1;
        } else {
          break;
        }
      }

      currentIndex = targetIndex;
      pausedAt = timestamp;

      if (wasPlaying && targetIndex < replay.events.length) {
        isPlaying = false; // Will be set to true by play()
        this.play();
      }
    },

    /**
     * Set playback speed
     *
     * @param {number} newSpeed - Speed multiplier (0.5, 1, 1.5, 2)
     */
    setSpeed(newSpeed) {
      playbackSpeed = Math.max(0.1, Math.min(10, newSpeed));
    },

    /**
     * Get current playback speed
     *
     * @returns {number}
     */
    getSpeed() {
      return playbackSpeed;
    },

    /**
     * Check if currently playing
     *
     * @returns {boolean}
     */
    isPlaying() {
      return isPlaying;
    },

    /**
     * Get current progress (0-1)
     *
     * @returns {number}
     */
    getProgress() {
      if (replay.events.length === 0) return 1;
      return currentIndex / replay.events.length;
    },

    /**
     * Get current timestamp in milliseconds
     * Returns the cumulative time up to the last fired event
     *
     * @returns {number}
     */
    getCurrentTime() {
      if (currentIndex === 0) return 0;
      // Return the end time of the last fired event (currentIndex - 1)
      // eventTimes[i] stores the START time of event i
      // The END time of event i is eventTimes[i] + events[i].dt
      const lastFiredIndex = currentIndex - 1;
      return eventTimes[lastFiredIndex] + replay.events[lastFiredIndex].dt;
    },

    /**
     * Get total duration in milliseconds
     *
     * @returns {number}
     */
    getDuration() {
      return totalDuration;
    },

    /**
     * Get current event index
     *
     * @returns {number}
     */
    getCurrentIndex() {
      return currentIndex;
    },

    /**
     * Get total event count
     *
     * @returns {number}
     */
    getTotalEvents() {
      return replay.events.length;
    },

    /**
     * Get replay metadata
     *
     * @returns {Object}
     */
    getReplayInfo() {
      return {
        gameId: replay.gameId,
        levelId: replay.levelId,
        seed: replay.seed,
        version: replay.version,
        eventCount: replay.events.length
      };
    }
  };
}

// ===== Replay Buffer (for game integration) =====

/**
 * Create a replay buffer that can be attached to a game
 * This wraps the recording and provides easy integration
 *
 * @param {Object} options
 * @param {string} options.gameId - Game identifier
 * @param {Function} options.onReplayComplete - Callback when recording stops
 * @returns {Object} Buffer controller
 */
export function createReplayBuffer({ gameId, onReplayComplete }) {
  let recorder = null;
  let playback = null;
  let mode = 'idle'; // 'idle' | 'recording' | 'playing'

  return {
    /**
     * Start recording a new replay
     *
     * @param {number} levelId - Level number
     * @param {number} seed - RNG seed
     */
    startRecording(levelId, seed) {
      if (mode !== 'idle') {
        this.stop();
      }

      recorder = startRecording({ gameId, levelId, seed });
      mode = 'recording';
    },

    /**
     * Record an input event
     *
     * @param {Object} event - Input event
     */
    record(event) {
      if (mode === 'recording' && recorder) {
        recorder.record(event);
      }
    },

    /**
     * Stop recording and get the replay
     *
     * @returns {Object|null} Replay data or null
     */
    stopRecording() {
      if (mode !== 'recording' || !recorder) return null;

      const replay = recorder.stop();
      mode = 'idle';
      recorder = null;

      if (onReplayComplete) {
        onReplayComplete(replay);
      }

      return replay;
    },

    /**
     * Start playback of a replay
     *
     * @param {Object} replay - Decoded replay
     * @param {Function} onEvent - Event callback
     * @param {Function} onComplete - Completion callback
     * @param {number} [speed=1] - Playback speed
     */
    startPlayback(replay, onEvent, onComplete, speed = 1) {
      if (mode !== 'idle') {
        this.stop();
      }

      playback = createPlayback({
        replay,
        onEvent,
        onComplete: () => {
          mode = 'idle';
          if (onComplete) onComplete();
        },
        speed
      });

      mode = 'playing';
      playback.play();
    },

    /**
     * Get playback controller
     *
     * @returns {Object|null}
     */
    getPlayback() {
      return playback;
    },

    /**
     * Stop all activity
     */
    stop() {
      if (mode === 'recording' && recorder) {
        recorder.stop();
      }
      if (mode === 'playing' && playback) {
        playback.stop();
      }

      recorder = null;
      playback = null;
      mode = 'idle';
    },

    /**
     * Get current mode
     *
     * @returns {string} 'idle' | 'recording' | 'playing'
     */
    getMode() {
      return mode;
    },

    /**
     * Check if currently recording
     *
     * @returns {boolean}
     */
    isRecording() {
      return mode === 'recording';
    },

    /**
     * Check if currently playing
     *
     * @returns {boolean}
     */
    isPlaying() {
      return mode === 'playing';
    }
  };
}

// ===== Video Rendering Support =====

/**
 * Create a video renderer for replay-to-video conversion
 *
 * @param {Object} options
 * @param {Object} options.replay - Decoded replay
 * @param {HTMLCanvasElement} options.canvas - Canvas to capture
 * @param {Function} options.initGame - Function to initialize game: (levelId, seed) => void
 * @param {Function} options.feedEvent - Function to feed event to game: (event) => void
 * @param {number} [options.fps=30] - Target FPS for video
 * @param {number} [options.speed=1.5] - Rendering speed (faster = quicker render)
 * @returns {Object} Renderer controller
 */
export function createReplayRenderer({
  replay,
  canvas,
  initGame,
  feedEvent,
  fps = 30,
  speed = 1.5
}) {
  let isRendering = false;
  let recordedChunks = [];
  let mediaRecorder = null;
  let playback = null;

  return {
    /**
     * Start rendering the replay to video
     *
     * @returns {Promise<Blob>} Video blob when complete
     */
    async start() {
      if (isRendering) {
        throw new Error('Already rendering');
      }

      isRendering = true;
      recordedChunks = [];

      return new Promise((resolve, reject) => {
        try {
          // Initialize game with replay settings
          initGame(replay.levelId, replay.seed);

          // Setup MediaRecorder
          const stream = canvas.captureStream(fps);
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 5000000
          });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunks.push(e.data);
            }
          };

          mediaRecorder.onstop = () => {
            isRendering = false;
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            resolve(blob);
          };

          mediaRecorder.onerror = (e) => {
            isRendering = false;
            reject(new Error(`MediaRecorder error: ${e}`));
          };

          // Start recording
          mediaRecorder.start();

          // Start playback at render speed
          playback = createPlayback({
            replay,
            onEvent: (event) => {
              feedEvent(event);
            },
            onComplete: () => {
              // Wait a moment for final frames, then stop
              setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                  mediaRecorder.stop();
                }
              }, 500);
            },
            speed
          });

          playback.play();
        } catch (e) {
          isRendering = false;
          reject(e);
        }
      });
    },

    /**
     * Cancel rendering
     */
    cancel() {
      if (playback) {
        playback.stop();
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isRendering = false;
    },

    /**
     * Check if currently rendering
     *
     * @returns {boolean}
     */
    isRendering() {
      return isRendering;
    }
  };
}

// ===== Export default =====

export default {
  // Recording
  startRecording,

  // Encoding
  encodeReplay,
  encodeReplayToBase64,
  encodeReplayToShortCode,

  // Decoding
  decodeReplay,
  decodeReplayFromBase64,
  decodeReplayFromShortCode,

  // URL handling
  createReplayUrl,
  parseReplayFromUrl,
  isReplayUrl,

  // Playback
  createPlayback,

  // Integration helpers
  createReplayBuffer,
  createReplayRenderer,

  // Constants
  REPLAY_VERSION,
  GAME_IDS,
  GAME_PREFIXES,
  EVENT_TYPES
};
