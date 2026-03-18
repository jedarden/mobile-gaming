/**
 * Browser capability detection
 *
 * Detects available browser features on first load.
 * Results are cached for fast subsequent access.
 */

// Cached capability检测结果
let cachedCapabilities = null;

/**
 * Run all capability checks and cache results
 * @returns {Object} Capability检测结果
 */
function detectCapabilities() {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const capabilities = {
    // Canvas rendering
    canvas2d: checkCanvas2D(),
    webgl: checkWebGL(),
    webgl2: checkWebGL2(),

    // Audio/video
    webAudio: checkWebAudio(),
    mediaRecorder: checkMediaRecorder(),
    videoEncoder: checkVideoEncoder(),

    // Storage
    localStorage: checkLocalStorage(),
    sessionStorage: checkSessionStorage(),
    indexedDB: checkIndexedDB(),

    // Device APIs
    vibration: checkVibration(),
    deviceOrientation: checkDeviceOrientation(),
    deviceMotion: checkDeviceMotion(),
    touch: checkTouch(),

    // Web APIs
    webWorker: checkWebWorker(),
    shareApi: checkShareApi(),
    clipboard: checkClipboard(),
    fullscreen: checkFullscreen(),

    // Performance
    performanceNow: checkPerformanceNow(),
    requestAnimationFrame: checkRAF(),
    performanceObserver: checkPerformanceObserver(),

    // Other
    websockets: checkWebSockets(),
    serviceWorker: checkServiceWorker(),
  };

  cachedCapabilities = capabilities;
  return capabilities;
}

/**
 * Check Canvas 2D support
 */
function checkCanvas2D() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  } catch {
    return false;
  }
}

/**
 * Check WebGL support
 */
function checkWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    ));
  } catch {
    return false;
  }
}

/**
 * Check WebGL2 support
 */
function checkWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Check Web Audio API support
 */
function checkWebAudio() {
  return !!(window.AudioContext || window.webkitAudioContext);
}

/**
 * Check MediaRecorder support
 */
function checkMediaRecorder() {
  return !!(window.MediaRecorder && navigator.mediaDevices);
}

/**
 * Check VideoEncoder support
 */
function checkVideoEncoder() {
  return !!(window.VideoEncoder && window.VideoDecoder);
}

/**
 * Check localStorage support
 */
function checkLocalStorage() {
  try {
    const test = '__cap_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check sessionStorage support
 */
function checkSessionStorage() {
  try {
    const test = '__cap_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check IndexedDB support
 */
function checkIndexedDB() {
  return !!(window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB);
}

/**
 * Check Vibration API support
 */
function checkVibration() {
  return 'vibrate' in navigator;
}

/**
 * Check Device Orientation API support
 */
function checkDeviceOrientation() {
  return 'DeviceOrientationEvent' in window;
}

/**
 * Check Device Motion API support
 */
function checkDeviceMotion() {
  return 'DeviceMotionEvent' in window;
}

/**
 * Check touch support
 */
function checkTouch() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check Web Worker support
 */
function checkWebWorker() {
  return !!window.Worker;
}

/**
 * Check Web Share API support
 */
function checkShareApi() {
  return 'share' in navigator;
}

/**
 * Check Clipboard API support
 */
function checkClipboard() {
  return 'clipboard' in navigator;
}

/**
 * Check Fullscreen API support
 */
function checkFullscreen() {
  return !!(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled
  );
}

/**
 * Check performance.now() support
 */
function checkPerformanceNow() {
  return !!(window.performance && typeof window.performance.now === 'function');
}

/**
 * Check requestAnimationFrame support
 */
function checkRAF() {
  return !!(window.requestAnimationFrame && window.cancelAnimationFrame);
}

/**
 * Check PerformanceObserver support
 */
function checkPerformanceObserver() {
  return !!(window.Performance && window.PerformanceObserver);
}

/**
 * Check WebSocket support
 */
function checkWebSockets() {
  return !!window.WebSocket;
}

/**
 * Check Service Worker support
 */
function checkServiceWorker() {
  return 'serviceWorker' in navigator;
}

/**
 * Get all capabilities
 * @returns {Object} All capability检测结果
 */
export function getCapabilities() {
  return detectCapabilities();
}

/**
 * Check a single capability
 * @param {string} name - Capability name
 * @returns {boolean} Capability status
 */
export function hasCapability(name) {
  const caps = detectCapabilities();
  return !!caps[name];
}

/**
 * Check if the browser supports all required features for the game
 * @param {string[]} required - Array of required capability names
 * @returns {{supported: boolean, missing: string[]}}
 */
export function checkRequirements(required) {
  const caps = detectCapabilities();
  const missing = [];

  for (const name of required) {
    if (!caps[name]) {
      missing.push(name);
    }
  }

  return {
    supported: missing.length === 0,
    missing,
  };
}

/**
 * Get a human-readable capability report
 * @returns {string} Formatted capability list
 */
export function getCapabilityReport() {
  const caps = detectCapabilities();
  const lines = [];

  lines.push('Browser Capabilities:');
  lines.push('====================');

  const groups = {
    'Rendering': ['canvas2d', 'webgl', 'webgl2'],
    'Audio/Video': ['webAudio', 'mediaRecorder', 'videoEncoder'],
    'Storage': ['localStorage', 'sessionStorage', 'indexedDB'],
    'Device': ['vibration', 'deviceOrientation', 'deviceMotion', 'touch'],
    'Web APIs': ['webWorker', 'shareApi', 'clipboard', 'fullscreen'],
    'Performance': ['performanceNow', 'requestAnimationFrame', 'performanceObserver'],
    'Other': ['websockets', 'serviceWorker'],
  };

  for (const [group, features] of Object.entries(groups)) {
    lines.push(`\n${group}:`);
    for (const feature of features) {
      const status = caps[feature] ? '✓' : '✗';
      lines.push(`  ${status} ${feature}`);
    }
  }

  return lines.join('\n');
}

/**
 * Detect if running in a mobile browser
 * @returns {boolean}
 */
export function isMobile() {
  const caps = detectCapabilities();
  return caps.touch && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    caps.deviceOrientation ||
    caps.deviceMotion
  );
}

/**
 * Detect if running in iOS
 * @returns {boolean}
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect if running in Android
 * @returns {boolean}
 */
export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Get device pixel ratio
 * @returns {number}
 */
export function getPixelRatio() {
  return window.devicePixelRatio || 1;
}
