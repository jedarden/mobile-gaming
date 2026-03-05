/**
 * Error Tracking - Privacy-focused error monitoring
 *
 * Captures and logs errors for debugging without sending data externally.
 * Errors are stored locally and can be exported for debugging.
 */

const ERROR_LOG_KEY = 'mobile-gaming-errors';
const MAX_ERRORS = 100;

let isInitialized = false;
let errorQueue = [];

/**
 * Initialize error tracking
 */
export function initErrorTracking() {
  if (isInitialized) return;
  isInitialized = true;

  // Load existing errors
  loadErrors();

  // Global error handler
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  console.log('[ErrorTracking] Initialized');
}

/**
 * Handle global errors
 */
function handleGlobalError(event) {
  const error = {
    type: 'error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent
  };

  logError(error);
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event) {
  const error = {
    type: 'unhandledrejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent
  };

  logError(error);
}

/**
 * Log an error manually
 */
export function logError(error) {
  errorQueue.push({
    ...error,
    id: generateErrorId()
  });

  // Limit queue size
  if (errorQueue.length > MAX_ERRORS) {
    errorQueue.shift();
  }

  // Save to storage
  saveErrors();

  // Log to console in development
  console.error('[ErrorTracking]', error.message, error);
}

/**
 * Log a custom error with context
 */
export function trackError(category, message, context = {}) {
  logError({
    type: 'custom',
    category,
    message,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href
  });
}

/**
 * Get all logged errors
 */
export function getErrors() {
  return [...errorQueue];
}

/**
 * Get error count
 */
export function getErrorCount() {
  return errorQueue.length;
}

/**
 * Clear all errors
 */
export function clearErrors() {
  errorQueue = [];
  saveErrors();
}

/**
 * Export errors as JSON
 */
export function exportErrors() {
  return JSON.stringify(errorQueue, null, 2);
}

/**
 * Load errors from storage
 */
function loadErrors() {
  try {
    const stored = localStorage.getItem(ERROR_LOG_KEY);
    if (stored) {
      errorQueue = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[ErrorTracking] Failed to load errors:', e);
    errorQueue = [];
  }
}

/**
 * Save errors to storage
 */
function saveErrors() {
  try {
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(errorQueue));
  } catch (e) {
    console.warn('[ErrorTracking] Failed to save errors:', e);
  }
}

/**
 * Generate unique error ID
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  initErrorTracking,
  logError,
  trackError,
  getErrors,
  getErrorCount,
  clearErrors,
  exportErrors
};
