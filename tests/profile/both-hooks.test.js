
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Both Hooks', () => {
  let counter = 0;
  let afterCount = 0;
  let testNumber = 0;

  beforeEach(() => {
    counter = 1;
    testNumber++;
  });

  afterEach(() => {
    afterCount++;
  });

  it('test 1', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(1);
    expect(afterCount).toBe(0);
  });

  it('test 2', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(2);
    expect(afterCount).toBe(1);
  });

  it('test 3', () => {
    expect(counter).toBe(1);
    expect(testNumber).toBe(3);
    expect(afterCount).toBe(2);
  });
});
    