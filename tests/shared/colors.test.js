/**
 * Tests for Colors.js - Shared Color Palette
 */

import { describe, it, expect } from 'vitest';
import Colors from '../../src/shared/colors.js';

describe('Colors', () => {
  describe('brand colors', () => {
    it('should have primary brand color', () => {
      expect(Colors.brand.primary).toBe('#6366f1');
    });

    it('should have secondary brand color', () => {
      expect(Colors.brand.secondary).toBe('#8b5cf6');
    });

    it('should have accent color', () => {
      expect(Colors.brand.accent).toBe('#f59e0b');
    });
  });

  describe('fluids', () => {
    it('should have 9 fluid colors', () => {
      expect(Colors.fluids).toHaveLength(9);
    });

    it('should all be valid hex colors', () => {
      const hexPattern = /^#[0-9a-f]{6}$/i;

      Colors.fluids.forEach(color => {
        expect(color).toMatch(hexPattern);
      });
    });
  });

  describe('ui colors', () => {
    it('should have semantic colors', () => {
      expect(Colors.ui.success).toBe('#22c55e');
      expect(Colors.ui.warning).toBe('#f59e0b');
      expect(Colors.ui.error).toBe('#ef4444');
      expect(Colors.ui.info).toBe('#3b82f6');
    });
  });

  describe('getVar', () => {
    it('should generate CSS variable names', () => {
      expect(Colors.getVar('brand', 'primary')).toBe('--color-brand-primary');
      expect(Colors.getVar('ui', 'success')).toBe('--color-ui-success');
      expect(Colors.getVar('bg', 'card')).toBe('--color-bg-card');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex to RGB correctly', () => {
      // Red
      expect(Colors.hexToRgb('#ef4444')).toEqual({ r: 239, g: 68, b: 68 });

      // Green
      expect(Colors.hexToRgb('#22c55e')).toEqual({ r: 34, g: 197, b: 94 });

      // Blue
      expect(Colors.hexToRgb('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
    });

    it('should handle hex without # prefix', () => {
      expect(Colors.hexToRgb('ef4444')).toEqual({ r: 239, g: 68, b: 68 });
    });

    it('should return null for invalid hex', () => {
      expect(Colors.hexToRgb('invalid')).toBeNull();
      expect(Colors.hexToRgb('#gggggg')).toBeNull();
      expect(Colors.hexToRgb('#123')).toBeNull(); // Short hex not supported
    });

    it('should handle black and white', () => {
      expect(Colors.hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(Colors.hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });
  });
});
