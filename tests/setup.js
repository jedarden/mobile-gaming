/**
 * Test setup file
 * Configures the test environment before tests run
 *
 * Note: happy-dom provides its own localStorage implementation
 * We just need to clear it before each test
 */

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});
