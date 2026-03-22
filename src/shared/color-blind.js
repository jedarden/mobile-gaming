/**
 * Color-Blind Mode
 *
 * Provides two complementary mechanisms so every game remains distinguishable
 * without relying on hue alone:
 *
 *   1. CSS class  — <body class="color-blind-mode"> toggles CSS pattern
 *      overlays. Games that render in HTML/CSS can layer SVG patterns on
 *      top of colored elements purely through CSS.
 *
 *   2. Pattern label — getPatternLabel(colorName) returns a short string
 *      ('/', 'X', '·', …) that Canvas-based games can stamp over colored
 *      elements as a secondary distinguishing glyph.
 *
 *   3. SVG <defs> injection — injectPatternDefs(svgEl) writes repeating
 *      SVG <pattern> elements keyed by color name into an SVG's <defs>.
 *      Games using SVG rendering can then set fill="url(#cb-orange)" etc.
 *
 * Reading the setting:
 *   Color-blind mode is read from both the 'global:settings' key (new schema)
 *   and the legacy 'settings' key written by settings.js.
 *
 * Usage:
 *   import {
 *     isColorBlindEnabled, applyColorBlindClass, removeColorBlindClass,
 *     getPatternLabel, injectPatternDefs, COLOR_PATTERNS,
 *   } from '../shared/color-blind.js';
 *
 *   // On app init:
 *   if (isColorBlindEnabled()) applyColorBlindClass();
 *
 *   // When user toggles the setting:
 *   applyColorBlindClass();   // or removeColorBlindClass()
 *
 *   // Canvas game rendering (Water Sort tube label):
 *   if (isColorBlindEnabled()) {
 *     ctx.fillText(getPatternLabel('red'), x, y);
 *   }
 */

import { StorageManager } from './storage.js';

const storage = new StorageManager();

// ─── Pattern definitions ──────────────────────────────────────────────────────

/**
 * Per-color pattern metadata.
 *
 * label     : short string drawn over canvas elements (≤ 2 chars)
 * svgStroke : colour used in the SVG pattern lines/dots
 * svgPattern: 'stripes-h' | 'stripes-v' | 'dots' | 'crosshatch' | 'diagonal'
 */
export const COLOR_PATTERNS = {
  red:          { label: '/',  svgPattern: 'diagonal',   svgStroke: '#000' },
  orange:       { label: '\\', svgPattern: 'stripes-v',  svgStroke: '#000' },
  yellow:       { label: '—',  svgPattern: 'stripes-h',  svgStroke: '#000' },
  green:        { label: '+',  svgPattern: 'crosshatch',  svgStroke: '#000' },
  blue:         { label: '·',  svgPattern: 'dots',        svgStroke: '#fff' },
  purple:       { label: 'x',  svgPattern: 'crosshatch',  svgStroke: '#fff' },
  cyan:         { label: '~',  svgPattern: 'stripes-h',   svgStroke: '#000' },
  pink:         { label: 'o',  svgPattern: 'dots',        svgStroke: '#000' },
  teal:         { label: '=',  svgPattern: 'stripes-v',   svgStroke: '#000' },
  lime:         { label: '*',  svgPattern: 'diagonal',    svgStroke: '#000' },
  indigo:       { label: '#',  svgPattern: 'crosshatch',  svgStroke: '#fff' },
  coral:        { label: '^',  svgPattern: 'stripes-h',   svgStroke: '#000' },
  // Okabe-Ito names from colors.js
  skyBlue:      { label: '·',  svgPattern: 'dots',        svgStroke: '#000' },
  bluishGreen:  { label: '+',  svgPattern: 'crosshatch',  svgStroke: '#000' },
  vermilion:    { label: '/',  svgPattern: 'diagonal',    svgStroke: '#fff' },
  reddishPurple:{ label: 'x',  svgPattern: 'dots',        svgStroke: '#fff' },
};

// CSS class applied to <body>
const BODY_CLASS = 'color-blind-mode';

// ─── Setting read ─────────────────────────────────────────────────────────────

/**
 * Return whether color-blind mode is currently enabled in settings.
 * @returns {boolean}
 */
export function isColorBlindEnabled() {
  const global = storage.get('global:settings');
  if (global && typeof global.colorBlind === 'boolean') return global.colorBlind;

  const legacy = storage.get('settings');
  if (legacy && typeof legacy.colorBlind === 'boolean') return legacy.colorBlind;

  return false;
}

// ─── DOM class helpers ────────────────────────────────────────────────────────

/**
 * Add 'color-blind-mode' to document.body.
 * Safe to call multiple times — idempotent.
 */
export function applyColorBlindClass() {
  if (typeof document === 'undefined') return;
  document.body.classList.add(BODY_CLASS);
}

/**
 * Remove 'color-blind-mode' from document.body.
 */
export function removeColorBlindClass() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove(BODY_CLASS);
}

/**
 * Sync the body class to the current setting value.
 */
export function syncColorBlindClass() {
  if (isColorBlindEnabled()) {
    applyColorBlindClass();
  } else {
    removeColorBlindClass();
  }
}

// ─── Canvas helper ────────────────────────────────────────────────────────────

/**
 * Get the text label that Canvas games should stamp over colored elements
 * when color-blind mode is active.
 *
 * @param {string} colorName - e.g. 'red', 'blue', 'skyBlue'
 * @returns {string|null} Short label (1–2 chars), or null if unknown color.
 */
export function getPatternLabel(colorName) {
  return COLOR_PATTERNS[colorName]?.label ?? null;
}

// ─── SVG defs injection ───────────────────────────────────────────────────────

/**
 * Build the SVG <pattern> markup for a given color entry.
 * @param {string} colorName
 * @param {Object} entry
 * @returns {string}
 */
function buildSvgPattern(colorName, entry) {
  const id = `cb-${colorName}`;
  const s = entry.svgStroke;
  const type = entry.svgPattern;

  let inner;
  switch (type) {
    case 'stripes-h':
      inner = `<line x1="0" y1="4" x2="8" y2="4" stroke="${s}" stroke-width="1.5"/>`;
      break;
    case 'stripes-v':
      inner = `<line x1="4" y1="0" x2="4" y2="8" stroke="${s}" stroke-width="1.5"/>`;
      break;
    case 'diagonal':
      inner = `<line x1="0" y1="0" x2="8" y2="8" stroke="${s}" stroke-width="1.5"/>`;
      break;
    case 'dots':
      inner = `<circle cx="4" cy="4" r="1.5" fill="${s}"/>`;
      break;
    case 'crosshatch':
      inner = [
        `<line x1="0" y1="0" x2="8" y2="8" stroke="${s}" stroke-width="1"/>`,
        `<line x1="8" y1="0" x2="0" y2="8" stroke="${s}" stroke-width="1"/>`,
      ].join('');
      break;
    default:
      inner = '';
  }

  return `<pattern id="${id}" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">${inner}</pattern>`;
}

/**
 * Inject SVG <pattern> definitions for all known colors into an SVG element's
 * <defs> block. Creates <defs> if absent.
 *
 * After calling this, SVG elements can use `fill="url(#cb-red)"` etc.
 *
 * @param {SVGSVGElement} svgEl - The SVG element to inject into.
 */
export function injectPatternDefs(svgEl) {
  if (!svgEl) return;

  let defs = svgEl.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgEl.insertBefore(defs, svgEl.firstChild);
  }

  const markup = Object.entries(COLOR_PATTERNS)
    .map(([name, entry]) => buildSvgPattern(name, entry))
    .join('');

  defs.innerHTML = markup;
}

/**
 * Remove all color-blind pattern <pattern> elements from an SVG element's <defs>.
 *
 * @param {SVGSVGElement} svgEl
 */
export function removePatternDefs(svgEl) {
  if (!svgEl) return;
  const defs = svgEl.querySelector('defs');
  if (!defs) return;

  for (const name of Object.keys(COLOR_PATTERNS)) {
    const el = defs.querySelector(`#cb-${name}`);
    if (el) el.remove();
  }
}
