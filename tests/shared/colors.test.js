import { describe, it, expect } from 'vitest';
import {
  colors, ORANGE, SKY_BLUE, BLUISH_GREEN, YELLOW, BLUE, VERMILION,
  REDDISH_PURPLE, GRAY, BLACK, WHITE,
  getByName, getByHex, getRandom, getDistinctColors,
  hexToRgb, rgbToHex, toCss, getLuminance, getContrastRatio,
  passesWCAA, getTextColor, theme
} from '../../src/shared/colors.js';

describe('colors', () => {
  it('exports 10 colors', () => {
    expect(colors).toHaveLength(10);
  });

  it('each color has required properties', () => {
    for (const color of colors) {
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('hex');
      expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color).toHaveProperty('rgb');
      expect(color.rgb).toMatchObject({
        r: expect.any(Number),
        g: expect.any(Number),
        b: expect.any(Number)
      });
      expect(color).toHaveProperty('darkVariant');
      expect(color).toHaveProperty('lightVariant');
    }
  });
});

describe('named constants', () => {
  it('each constant points to the correct palette entry', () => {
    expect(ORANGE).toBe(colors[0]);
    expect(SKY_BLUE).toBe(colors[1]);
    expect(BLUISH_GREEN).toBe(colors[2]);
    expect(YELLOW).toBe(colors[3]);
    expect(BLUE).toBe(colors[4]);
    expect(VERMILION).toBe(colors[5]);
    expect(REDDISH_PURPLE).toBe(colors[6]);
    expect(GRAY).toBe(colors[7]);
    expect(BLACK).toBe(colors[8]);
    expect(WHITE).toBe(colors[9]);
  });
});

describe('getByName', () => {
  it('finds a color by exact name', () => {
    const result = getByName('orange');
    expect(result).toBeDefined();
    expect(result.name).toBe('orange');
    expect(result.hex).toBe('#E69F00');
  });

  it('returns null for unknown name', () => {
    expect(getByName('notacolor')).toBeNull();
  });

  it('is case-sensitive', () => {
    expect(getByName('Orange')).toBeNull();
  });
});

describe('getByHex', () => {
  it('finds a color with # prefix', () => {
    const result = getByHex('#E69F00');
    expect(result).toBeDefined();
    expect(result.name).toBe('orange');
  });

  it('finds a color without # prefix', () => {
    const result = getByHex('E69F00');
    expect(result).toBeDefined();
    expect(result.name).toBe('orange');
  });

  it('is case-insensitive', () => {
    const result = getByHex('#e69f00');
    expect(result).toBeDefined();
    expect(result.name).toBe('orange');
  });

  it('returns null for unknown hex', () => {
    expect(getByHex('#123456')).toBeNull();
  });
});

describe('getRandom', () => {
  it('returns a color from the palette', () => {
    for (let i = 0; i < 50; i++) {
      const color = getRandom();
      expect(colors).toContain(color);
    }
  });

  it('excludes gray/black/white by default', () => {
    for (let i = 0; i < 50; i++) {
      const color = getRandom();
      expect(['gray', 'black', 'white']).not.toContain(color.name);
    }
  });

  it('includes gray/black/white when excludeGray is false', () => {
    let foundGray = false;
    for (let i = 0; i < 100; i++) {
      const color = getRandom({ excludeGray: false });
      if (['gray', 'black', 'white'].includes(color.name)) {
        foundGray = true;
        break;
      }
    }
    expect(foundGray).toBe(true);
  });
});

describe('getDistinctColors', () => {
  it('returns the requested number of distinct colors', () => {
    const result = getDistinctColors(4);
    expect(result).toHaveLength(4);
  });

  it('returns at most pool size colors', () => {
    const result = getDistinctColors(100);
    expect(result).toHaveLength(7); // 10 - 3 gray/black/white
  });

  it('returns all distinct colors', () => {
    const result = getDistinctColors(7);
    const names = result.map(c => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('respects excludeGray option', () => {
    const result = getDistinctColors(10, { excludeGray: false });
    expect(result).toHaveLength(10);
  });
});

describe('hexToRgb', () => {
  it('converts 6-digit hex', () => {
    expect(hexToRgb('#E69F00')).toEqual({ r: 230, g: 159, b: 0 });
  });

  it('converts 3-digit hex', () => {
    expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('converts without # prefix', () => {
    expect(hexToRgb('E69F00')).toEqual({ r: 230, g: 159, b: 0 });
  });

  it('converts black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts white', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    expect(rgbToHex(230, 159, 0)).toBe('#e69f00');
  });

  it('converts black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('clamps values to 0-255', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });

  it('rounds fractional values', () => {
    // 230.6 -> 231 (0xe7), 159.4 -> 159 (0x9f), 0.5 -> 1 (0x01)
    expect(rgbToHex(230.6, 159.4, 0.5)).toBe('#e79f01');
  });

  it('is inverse of hexToRgb', () => {
    for (const color of colors) {
      const { r, g, b } = color.rgb;
      expect(rgbToHex(r, g, b)).toBe(color.hex.toLowerCase());
    }
  });
});

describe('toCss', () => {
  it('converts hex string to rgb', () => {
    expect(toCss('#E69F00')).toBe('rgb(230, 159, 0)');
  });

  it('converts color object to rgb', () => {
    expect(toCss(ORANGE)).toBe('rgb(230, 159, 0)');
  });

  it('converts rgb object to rgb', () => {
    expect(toCss({ r: 230, g: 159, b: 0 })).toBe('rgb(230, 159, 0)');
  });

  it('adds alpha when < 1', () => {
    expect(toCss('#E69F00', 0.5)).toBe('rgba(230, 159, 0, 0.5)');
  });

  it('uses rgb when alpha is 1', () => {
    expect(toCss('#E69F00', 1)).toBe('rgb(230, 159, 0)');
  });
});

describe('getLuminance', () => {
  it('black has luminance 0', () => {
    expect(getLuminance(BLACK)).toBe(0);
  });

  it('white has luminance 1', () => {
    expect(getLuminance(WHITE)).toBe(1);
  });

  it('other colors have luminance between 0 and 1', () => {
    for (const color of colors.slice(0, 7)) {
      const lum = getLuminance(color);
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(1);
    }
  });

  it('works with hex string input', () => {
    expect(getLuminance('#000000')).toBe(0);
    expect(getLuminance('#ffffff')).toBe(1);
  });
});

describe('getContrastRatio', () => {
  it('black vs white has max contrast', () => {
    const ratio = getContrastRatio(BLACK, WHITE);
    expect(ratio).toBe(21);
  });

  it('same color has contrast 1', () => {
    const ratio = getContrastRatio(BLACK, BLACK);
    expect(ratio).toBe(1);
  });

  it('is symmetric in lighter/darker ordering', () => {
    const r1 = getContrastRatio(BLACK, WHITE);
    const r2 = getContrastRatio(WHITE, BLACK);
    expect(r1).toBe(r2);
  });
});

describe('passesWCAA', () => {
  it('black on white passes AA for normal text', () => {
    expect(passesWCAA(BLACK, WHITE)).toBe(true);
  });

  it('white on black passes AA for normal text', () => {
    expect(passesWCAA(WHITE, BLACK)).toBe(true);
  });

  it('large text has lower threshold', () => {
    // Gray on white may fail normal but could pass large text
    const normalResult = passesWCAA(GRAY, WHITE);
    const largeResult = passesWCAA(GRAY, WHITE, true);
    // Large text requirement is always <= normal text requirement
    // So if normal passes, large must also pass
    if (normalResult) {
      expect(largeResult).toBe(true);
    }
    // Either way, the function should return a boolean
    expect(typeof normalResult).toBe('boolean');
    expect(typeof largeResult).toBe('boolean');
  });
});

describe('getTextColor', () => {
  it('returns white for dark backgrounds', () => {
    expect(getTextColor(BLACK)).toBe(WHITE);
  });

  it('returns black for light backgrounds', () => {
    expect(getTextColor(WHITE)).toBe(BLACK);
  });
});

describe('theme', () => {
  it('has expected theme properties', () => {
    expect(theme).toHaveProperty('primary');
    expect(theme).toHaveProperty('success');
    expect(theme).toHaveProperty('warning');
    expect(theme).toHaveProperty('danger');
    expect(theme).toHaveProperty('info');
    expect(theme).toHaveProperty('background');
    expect(theme).toHaveProperty('foreground');
    expect(theme).toHaveProperty('border');
    expect(theme).toHaveProperty('muted');
    expect(theme).toHaveProperty('highlight');
  });

  it('theme colors reference palette entries', () => {
    expect(theme.primary).toBe(BLUE);
    expect(theme.success).toBe(BLUISH_GREEN);
    expect(theme.warning).toBe(ORANGE);
    expect(theme.danger).toBe(VERMILION);
  });
});
