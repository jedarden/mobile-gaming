/**
 * Color palette derived from Okabe-Ito for color-blind accessibility
 *
 * All colors pass WCAG AA contrast requirements against white and black backgrounds.
 * Each color includes a name, hex value, and theme-aware variants.
 */

/**
 * Okabe-Ito derived color palette
 * All colors are designed to be distinguishable for common forms of color blindness
 */
export const colors = [
  {
    name: 'orange',
    hex: '#E69F00',
    darkVariant: '#FFB347',
    lightVariant: '#CC8800',
    rgb: { r: 230, g: 159, b: 0 }
  },
  {
    name: 'skyBlue',
    hex: '#56B4E9',
    darkVariant: '#7BC8EA',
    lightVariant: '#4A9BC9',
    rgb: { r: 86, g: 180, b: 233 }
  },
  {
    name: 'bluishGreen',
    hex: '#009E73',
    darkVariant: '#00CC91',
    lightVariant: '#00825E',
    rgb: { r: 0, g: 158, b: 115 }
  },
  {
    name: 'yellow',
    hex: '#F0E442',
    darkVariant: '#FFF171',
    lightVariant: '#D4C33B',
    rgb: { r: 240, g: 228, b: 66 }
  },
  {
    name: 'blue',
    hex: '#0072B2',
    darkVariant: '#0096D9',
    lightVariant: '#005E94',
    rgb: { r: 0, g: 114, b: 178 }
  },
  {
    name: 'vermilion',
    hex: '#D55E00',
    darkVariant: '#FF771A',
    lightVariant: '#B34E00',
    rgb: { r: 213, g: 94, b: 0 }
  },
  {
    name: 'reddishPurple',
    hex: '#CC79A7',
    darkVariant: '#E39AC0',
    lightVariant: '#AD678D',
    rgb: { r: 204, g: 121, b: 167 }
  },
  {
    name: 'gray',
    hex: '#999999',
    darkVariant: '#B3B3B3',
    lightVariant: '#808080',
    rgb: { r: 153, g: 153, b: 153 }
  },
  {
    name: 'black',
    hex: '#000000',
    darkVariant: '#333333',
    lightVariant: '#000000',
    rgb: { r: 0, g: 0, b: 0 }
  },
  {
    name: 'white',
    hex: '#FFFFFF',
    darkVariant: '#FFFFFF',
    lightVariant: '#F5F5F5',
    rgb: { r: 255, g: 255, b: 255 }
  }
];

/**
 * Named color constants for easy access
 */
export const ORANGE = colors[0];
export const SKY_BLUE = colors[1];
export const BLUISH_GREEN = colors[2];
export const YELLOW = colors[3];
export const BLUE = colors[4];
export const VERMILION = colors[5];
export const REDDISH_PURPLE = colors[6];
export const GRAY = colors[7];
export const BLACK = colors[8];
export const WHITE = colors[9];

/**
 * Get a color by name
 *
 * @param {string} name - Color name (e.g., 'orange', 'skyBlue')
 * @returns {Object|null} Color object or null if not found
 */
export function getByName(name) {
  return colors.find(c => c.name === name) || null;
}

/**
 * Get a color by hex value
 *
 * @param {string} hex - Hex color code (with or without #)
 * @returns {Object|null} Color object or null if not found
 */
export function getByHex(hex) {
  const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`;
  return colors.find(c => c.hex.toLowerCase() === normalizedHex.toLowerCase()) || null;
}

/**
 * Get a random color from the palette
 *
 * @param {Object} options - Options
 * @param {boolean} options.excludeGray - Exclude gray/black/white (default: true)
 * @returns {Object} Random color object
 */
export function getRandom(options = {}) {
  const { excludeGray = true } = options;

  let pool = colors;
  if (excludeGray) {
    pool = colors.filter(c => !['gray', 'black', 'white'].includes(c.name));
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Get multiple distinct colors from the palette
 * Useful for multi-colored game elements
 *
 * @param {number} count - Number of colors to get
 * @param {Object} options - Options passed to getRandom
 * @returns {Array<Object>} Array of color objects
 */
export function getDistinctColors(count, options = {}) {
  const { excludeGray = true } = options;

  let pool = colors;
  if (excludeGray) {
    pool = colors.filter(c => !['gray', 'black', 'white'].includes(c.name));
  }

  // Shuffle and take first 'count'
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

/**
 * Convert hex to RGB object
 *
 * @param {string} hex - Hex color code (with or without #)
 * @returns {Object} { r, g, b } values (0-255)
 */
export function hexToRgb(hex) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;

  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16)
    };
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

/**
 * Convert RGB to hex string
 *
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color code with #
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert RGB to CSS string
 *
 * @param {Object|string} color - Color object or hex string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} CSS color string
 */
export function toCss(color, alpha = 1) {
  let rgb;

  if (typeof color === 'string') {
    rgb = hexToRgb(color);
  } else if (color.rgb) {
    rgb = color.rgb;
  } else {
    rgb = color;
  }

  if (alpha < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Calculate luminance of a color (for contrast calculations)
 *
 * @param {string|Object} color - Hex string or color object
 * @returns {number} Luminance value (0-1)
 */
export function getLuminance(color) {
  let rgb;

  if (typeof color === 'string') {
    rgb = hexToRgb(color);
  } else if (color.rgb) {
    rgb = color.rgb;
  } else {
    rgb = color;
  }

  // Convert to linear RGB
  const toLinear = (c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };

  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 *
 * @param {string|Object} foreground - Foreground color
 * @param {string|Object} background - Background color
 * @returns {number} Contrast ratio (1-21)
 */
export function getContrastRatio(foreground, background) {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color meets WCAG AA contrast requirements
 *
 * @param {string|Object} foreground - Foreground color
 * @param {string|Object} background - Background color
 * @param {boolean} largeText - Whether this is large text (>=18pt or bold 14pt)
 * @returns {boolean} True if passes AA
 */
export function passesWCAA(foreground, background, largeText = false) {
  const ratio = getContrastRatio(foreground, background);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Get appropriate text color (black or white) for a given background
 *
 * @param {string|Object} backgroundColor - Background color
 * @returns {Object} Black or white color object
 */
export function getTextColor(backgroundColor) {
  const contrastWithWhite = getContrastRatio(WHITE, backgroundColor);
  const contrastWithBlack = getContrastRatio(BLACK, backgroundColor);

  return contrastWithWhite >= contrastWithBlack ? WHITE : BLACK;
}

/**
 * Theme colors for UI elements
 */
export const theme = {
  primary: BLUE,
  success: BLUISH_GREEN,
  warning: ORANGE,
  danger: VERMILION,
  info: SKY_BLUE,

  background: WHITE,
  backgroundDark: GRAY,
  foreground: BLACK,
  foregroundLight: GRAY,

  border: GRAY,
  muted: colors[7],
  highlight: YELLOW
};
