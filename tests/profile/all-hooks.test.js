
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

describe('All Hooks', () => {
  let setupCounter = 0;
  let testCounter = 0;

  beforeAll(() => {
    setupCounter = 100;
  });

  beforeEach(() => {
    testCounter++;
  });

  afterEach(() => {
    testCounter = 0;
  });

  afterAll(() => {
    setupCounter = 0;
  });

  it('test 1', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });

  it('test 2', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });

  it('test 3', () => {
    expect(setupCounter).toBe(100);
    expect(testCounter).toBe(1);
  });
});
    