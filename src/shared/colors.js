/**
 * Colors.js - Shared Color Palette
 *
 * Defines the consistent color scheme for all games:
 * - Primary brand colors
 * - Game-specific tube/fluid colors
 * - UI colors (success, warning, error)
 * - Dark mode variants
 */

export const Colors = {
  // Brand colors
  brand: {
    primary: '#6366f1',   // Indigo
    secondary: '#8b5cf6', // Purple
    accent: '#f59e0b',    // Amber
  },

  // Tube/fluid colors for puzzle games
  fluids: [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#6b7280', // Gray (empty/blocked)
  ],

  // UI semantic colors
  ui: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Background colors
  bg: {
    primary: '#0f172a',    // Slate 900
    secondary: '#1e293b',  // Slate 800
    card: '#334155',       // Slate 700
  },

  // Text colors
  text: {
    primary: '#f8fafc',    // Slate 50
    secondary: '#94a3b8',  // Slate 400
    muted: '#64748b',      // Slate 500
  },

  /**
   * Get CSS variable name for a color
   * @param {string} category - Color category (brand, fluids, ui, bg, text)
   * @param {string} name - Color name
   * @returns {string} CSS variable name
   */
  getVar(category, name) {
    return `--color-${category}-${name}`;
  },

  /**
   * Convert hex to RGB values
   * @param {string} hex - Hex color code
   * @returns {{ r: number, g: number, b: number }}
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
};

export default Colors;
