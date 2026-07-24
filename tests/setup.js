/**
 * Vitest Setup File
 *
 * This file runs before all tests and provides common mocks and setup.
 * It's particularly important for tests using @vitest-environment jsdom
 * which may reference navigator properties that don't exist in all CI contexts.
 */

import { beforeAll } from 'vitest';

// Mock navigator properties that may be missing in CI/node environments
// This ensures jsdom-based tests can access navigator.clipboard, navigator.share, etc.
beforeAll(() => {
  // Ensure navigator exists (jsdom provides this, but defensive check)
  if (typeof global.navigator === 'undefined') {
    global.navigator = {};
  }

  // Mock navigator.clipboard if missing (used in sync.test.js)
  if (!global.navigator.clipboard) {
    global.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    };
  }

  // Mock navigator.share if missing (used in sync.test.js)
  if (!global.navigator.share) {
    global.navigator.share = vi.fn().mockRejectedValue(new Error('Share not supported'));
  }

  // Mock other navigator properties that may be referenced
  if (!global.navigator.userAgent) {
    global.navigator.userAgent = 'Mozilla/5.0 (ci-test) Vitest/1.0';
  }
});
