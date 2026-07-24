# Test Infrastructure Optimization Notes

## Overview

This document describes the optimizations made to the test infrastructure to improve efficiency and reduce redundancy.

## Optimizations Implemented

### 1. Shared Test Utilities (`tests/test-utils.js`)

Created a centralized module that consolidates:

- **Mock Utilities**
  - `createMockLocalStorage()` - Consistent localStorage mocking
  - `createMockElement()` - DOM element mock for event testing
  - `createMockAudioContext()` - AudioContext mock for audio tests
  - `createMouseEvent()`, `createTouchEvent()` - Event creation helpers

- **Test Setup Helpers**
  - `setupFakeTimers()`, `resetTimers()` - Timer management
  - `clearAllMocks()` - Comprehensive mock cleanup
  - `resetModules()` - Module reset for singleton testing

- **Test Data Fixtures**
  - `createTestLevel()` - Basic test level structure
  - `createTestWall()` - Test wall creation
  - `createTestState()` - Test game state fixture

- **Generator Mock Utilities**
  - `createMockGenerator()` - Deterministic generator mock
  - `createFailingMockGenerator()` - Generator that fails on specific seeds

### 2. Level Loading Optimization (`tests/level-loader.js`)

Implemented efficient level loading with caching:

- **Caching System**: Levels are cached after first load to avoid redundant file I/O
- **Centralized Access**: Single source of truth for level data
- **Helper Functions**:
  - `loadLevels()` - Load and cache levels for a game
  - `loadLevel()` - Load single level by index
  - `loadRandomLevel()` - Get random level from cache
  - `preloadLevels()` - Preload multiple games in beforeAll()
  - `clearLevelCache()` - Cache cleanup for tests that modify data

### 3. Generator Test Utilities (`tests/generator-test-utils.js`)

Created specialized utilities for generator testing:

- **Shared Fixtures**
  - `HOLE_TEMPLATES` - Standard hole configurations
  - `DIFFICULTY_CONFIGS` - Expected wall counts and speeds per difficulty

- **Validation Helpers**
  - `validateLevelStructure()` - Basic level structure validation
  - `validateWallStructure()` - Individual wall validation
  - `areWallsOrdered()` - Check z-position ordering
  - `validateAllWalls()` - Validate all walls in a level

- **Test Patterns**
  - `testDeterminism()` - Verify generator determinism
  - `testSeedVariation()` - Ensure different seeds produce different levels
  - `testWallCountRange()` - Verify wall count constraints
  - `testGeneratorValidity()` - Comprehensive validity testing
  - `runGeneratorTestSuite()` - Complete generator test suite

- **Performance Tools**
  - `benchmarkGenerator()` - Performance measurement
  - Mock generators for various scenarios

### 4. Vitest Configuration Optimization

Updated `vitest.config.js` with performance improvements:

- **Thread Pool Configuration**
  - Set minThreads: 2, maxThreads: 4 for optimal resource usage
  - Prevents resource exhaustion while maintaining parallelism

- **Automatic Mock Management**
  - `clearMocks: true` - Automatically clear mocks before each test
  - `restoreMocks: true` - Automatically restore mocks after each test
  - Reduces manual setup/teardown code

- **Module Caching**
  - `cache: true` - Enable module caching for faster test execution

### 5. Test Setup Optimization

Enhanced `tests/setup.js`:

- **Comprehensive Navigator Mocking**
  - Added `window.devicePixelRatio` mock for canvas/WebGL tests
  - Improved comments and documentation

- **Centralized Setup**
  - Single source of truth for global test configuration
  - Reference to new utility modules

## Benefits

### Performance Improvements

1. **Reduced File I/O**: Level caching eliminates redundant JSON file reads
2. **Faster Test Execution**: Optimized thread pool and mock management
3. **Less Memory Pressure**: Efficient caching and cleanup

### Code Quality

1. **Reduced Redundancy**: Common patterns centralized in utility modules
2. **Better Maintainability**: Single source of truth for test utilities
3. **Improved Consistency**: Standardized mock and fixture creation

### Developer Experience

1. **Less Boilerplate**: Test files can import utilities instead of recreating mocks
2. **Clearer Tests**: Focused test logic with reduced setup noise
3. **Easier Debugging**: Centralized utilities are easier to debug and maintain

## Migration Guide

### For New Tests

```javascript
// Instead of creating your own mocks:
import { createMockLocalStorage, createMockElement } from '../test-utils.js';

// Instead of manual level loading:
import { loadLevels, clearLevelCache } from '../level-loader.js';

// Instead of manual generator testing:
import { testDeterminism, runGeneratorTestSuite } from '../generator-test-utils.js';
```

### For Existing Tests

Existing tests continue to work without changes. Migrate to new utilities incrementally for best results:

1. Start with new tests using the utilities
2. Gradually update existing tests when making changes
3. Remove duplicate mock code as you migrate

## Future Improvements

Potential areas for further optimization:

1. **More Aggressive Caching**: Cache generator results for repeated seed/difficulty combinations
2. **Parallel Test Execution**: Further optimize thread pool configuration based on CI resources
3. **Coverage Collection**: Add coverage collection (commented out in vitest.config.js)
4. **Test Sharding**: Implement test sharding for large CI runs

## Test Results

All optimizations verified with full test suite:

- **111 test files passed**
- **5,262 tests passed**
- **Duration: ~21s** (within acceptable range)
- **No regressions introduced**

---

*Generated during bead bf-61hcd - Test infrastructure optimization*
