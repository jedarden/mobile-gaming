
import { describe, it, expect, beforeEach } from 'vitest';

describe('beforeEach Only', () => {
  let counter = 0;

  beforeEach(() => {
    counter++;
  });

  it('test 1', () => {
    expect(counter).toBe(1);
  });

  it('test 2', () => {
    expect(counter).toBe(2);
  });

  it('test 3', () => {
    expect(counter).toBe(3);
  });
});
    