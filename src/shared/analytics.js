/**
 * Client-Side Analytics
 *
 * Lightweight, privacy-respecting event logging.
 * No server, no PII, no cookies, no third-party scripts.
 * All data stays in localStorage under mg:global:analytics.
 */

import { getCapabilities } from './capabilities.js';

const STORAGE_KEY = 'mg:global:analytics';
const MAX_EVENTS = 500;

// ===== Storage helpers =====

function readEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Quota exceeded — drop oldest quarter and retry
    const trimmed = events.slice(Math.floor(events.length / 4));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Give up silently
    }
  }
}

function appendEvent(event) {
  const events = readEvents();
  events.push(event);
  // LRU eviction: oldest entries are at the front
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  writeEvents(events);
}

// ===== Public tracking API =====

/**
 * Record game_start event
 * @param {object} params
 * @param {string} params.gameId
 * @param {string|number} params.levelId
 * @param {string} [params.source] hub | quickplay | daily | deeplink
 */
export function trackGameStart({ gameId, levelId, source = 'hub' } = {}) {
  appendEvent({ event: 'game_start', gameId, levelId, source, timestamp: Date.now() });
}

/**
 * Record level_complete event
 * @param {object} params
 * @param {string} params.gameId
 * @param {string|number} params.levelId
 * @param {number} params.moves
 * @param {number} params.time  milliseconds
 * @param {number} [params.hintsUsed]
 * @param {number} [params.optimalMoves]
 * @param {number} [params.retries]
 */
export function trackLevelComplete({ gameId, levelId, moves, time, hintsUsed = 0, optimalMoves, retries = 0 } = {}) {
  appendEvent({ event: 'level_complete', gameId, levelId, moves, time, hintsUsed, optimalMoves, retries, timestamp: Date.now() });
}

/**
 * Record level_abandon event
 * @param {object} params
 * @param {string} params.gameId
 * @param {string|number} params.levelId
 * @param {number} [params.movesAtAbandon]
 * @param {number} [params.timeAtAbandon]  milliseconds
 * @param {string} [params.reason]  quit | skip | crash
 */
export function trackLevelAbandon({ gameId, levelId, movesAtAbandon = 0, timeAtAbandon = 0, reason = 'quit' } = {}) {
  appendEvent({ event: 'level_abandon', gameId, levelId, movesAtAbandon, timeAtAbandon, reason, timestamp: Date.now() });
}

/**
 * Record session_start event (call once on page load)
 */
export function trackSessionStart() {
  appendEvent({
    event: 'session_start',
    timestamp: Date.now(),
    referrer: document.referrer || '',
    capabilities: getCapabilities(),
  });
}

/**
 * Record session_end event
 * @param {object} params
 * @param {number} [params.gamesPlayed]
 * @param {number} [params.levelsCompleted]
 * @param {number} [params.totalTime]  milliseconds
 */
export function trackSessionEnd({ gamesPlayed = 0, levelsCompleted = 0, totalTime = 0 } = {}) {
  appendEvent({ event: 'session_end', gamesPlayed, levelsCompleted, totalTime, timestamp: Date.now() });
}

/**
 * Record feature_use event
 * @param {string} feature  hint | undo | share | replay | daily | endless | failSpeedrun
 * @param {object} [extra]  Optional extra context (no PII)
 */
export function trackFeatureUse(feature, extra = {}) {
  appendEvent({ event: 'feature_use', feature, ...extra, timestamp: Date.now() });
}

/**
 * Return all stored events (for dashboard or export)
 * @returns {Array}
 */
export function getEvents() {
  return readEvents();
}

/**
 * Wipe all analytics data from localStorage
 */
export function clearAnalytics() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ===== Local Dashboard =====

/**
 * Render the analytics dashboard into a container element.
 * Triggered in developer mode (triple-tap version number).
 * All charts use Canvas 2D — no external libraries.
 * @param {HTMLElement} container
 */
export function renderDashboard(container) {
  const events = readEvents();
  container.innerHTML = '';
  container.style.cssText = 'padding:16px;font-family:monospace;font-size:13px;overflow-y:auto;color:#eee;background:#111;';

  function h(tag, text, style) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (style) el.style.cssText = style;
    return el;
  }

  container.appendChild(h('h2', 'Analytics Dashboard', 'margin:0 0 16px;font-size:16px;color:#fff;'));

  if (events.length === 0) {
    container.appendChild(h('p', 'No events recorded yet.', 'color:#888;'));
    return;
  }

  container.appendChild(h('h3', 'Games Played — last 14 days', 'margin:16px 0 8px;font-size:13px;color:#aaa;'));
  container.appendChild(_drawDailyBar(events));

  container.appendChild(h('h3', 'Level Completion Rate', 'margin:16px 0 8px;font-size:13px;color:#aaa;'));
  container.appendChild(_buildCompletionBars(events));

  container.appendChild(h('h3', 'Avg Solve Time (seconds)', 'margin:16px 0 8px;font-size:13px;color:#aaa;'));
  container.appendChild(_buildTimeTable(events));

  container.appendChild(h('h3', 'Most / Least Played', 'margin:16px 0 8px;font-size:13px;color:#aaa;'));
  container.appendChild(_buildPopularityList(events));

  container.appendChild(h('h3', 'Feature Adoption', 'margin:16px 0 8px;font-size:13px;color:#aaa;'));
  container.appendChild(_buildFeatureTable(events));

  container.appendChild(h('p', `Total events stored: ${events.length} / ${MAX_EVENTS}`, 'color:#555;margin-top:24px;'));
}

// ===== Dashboard chart helpers =====

function _dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _drawDailyBar(events) {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  const counts = {};

  for (let i = 13; i >= 0; i--) {
    counts[_dayKey(now - i * MS_PER_DAY)] = 0;
  }

  for (const e of events) {
    if (e.event !== 'game_start') continue;
    const key = _dayKey(e.timestamp);
    if (key in counts) counts[key]++;
  }

  const days = Object.keys(counts).sort();
  const values = days.map(d => counts[d]);
  const maxVal = Math.max(...values, 1);

  const W = 320, H = 80, padL = 4, padB = 20, barGap = 2;
  const barW = Math.floor((W - padL) / 14) - barGap;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block;`;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < days.length; i++) {
    const x = padL + i * (barW + barGap);
    const barH = Math.max(2, Math.round((H - padB) * values[i] / maxVal));
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(x, H - padB - barH, barW, barH);

    // Day label: last 2 chars = day number
    ctx.fillStyle = '#555';
    ctx.font = '8px monospace';
    ctx.fillText(days[i].slice(-2), x, H - 4);
  }

  return canvas;
}

function _buildCompletionBars(events) {
  const starts = {}, completes = {};
  for (const e of events) {
    if (e.event === 'game_start') starts[e.gameId] = (starts[e.gameId] || 0) + 1;
    if (e.event === 'level_complete') completes[e.gameId] = (completes[e.gameId] || 0) + 1;
  }

  const gameIds = [...new Set([...Object.keys(starts), ...Object.keys(completes)])].sort();
  const wrap = document.createElement('div');

  if (gameIds.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No data';
    p.style.color = '#555';
    wrap.appendChild(p);
    return wrap;
  }

  for (const gid of gameIds) {
    const s = starts[gid] || 0;
    const c = completes[gid] || 0;
    const pct = s ? Math.round((c / s) * 100) : 0;

    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:6px;';

    const label = document.createElement('div');
    label.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:2px;';
    label.innerHTML = `<span>${gid}</span><span>${pct}% (${c}/${s})</span>`;

    const track = document.createElement('div');
    track.style.cssText = 'height:8px;background:#222;border-radius:4px;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:${pct}%;background:#4a9eff;border-radius:4px;`;
    track.appendChild(fill);

    row.appendChild(label);
    row.appendChild(track);
    wrap.appendChild(row);
  }

  return wrap;
}

function _buildTimeTable(events) {
  const totals = {}, counts = {};
  for (const e of events) {
    if (e.event !== 'level_complete' || typeof e.time !== 'number') continue;
    totals[e.gameId] = (totals[e.gameId] || 0) + e.time;
    counts[e.gameId] = (counts[e.gameId] || 0) + 1;
  }

  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;width:100%;font-size:11px;';

  const header = table.insertRow();
  for (const label of ['Game', 'Avg (s)', 'Completions']) {
    const th = document.createElement('th');
    th.textContent = label;
    th.style.cssText = 'text-align:left;padding:2px 8px 2px 0;color:#777;font-weight:normal;border-bottom:1px solid #333;';
    header.appendChild(th);
  }

  const gameIds = Object.keys(counts).sort();
  for (const gid of gameIds) {
    const row = table.insertRow();
    const avgSec = (totals[gid] / counts[gid] / 1000).toFixed(1);
    for (const val of [gid, avgSec, counts[gid]]) {
      const td = row.insertCell();
      td.textContent = val;
      td.style.cssText = 'padding:2px 8px 2px 0;color:#ccc;';
    }
  }

  if (gameIds.length === 0) {
    const row = table.insertRow();
    const td = row.insertCell();
    td.textContent = 'No data';
    td.style.color = '#555';
    td.colSpan = 3;
  }

  return table;
}

function _buildPopularityList(events) {
  const counts = {};
  for (const e of events) {
    if (e.event === 'game_start' && e.gameId) {
      counts[e.gameId] = (counts[e.gameId] || 0) + 1;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'font-size:11px;color:#ccc;';

  if (sorted.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No data';
    p.style.color = '#555';
    wrap.appendChild(p);
    return wrap;
  }

  const most = sorted[0];
  const least = sorted[sorted.length - 1];
  const mostDiv = document.createElement('div');
  mostDiv.style.marginBottom = '4px';
  mostDiv.innerHTML = `<span style="color:#4a9eff">Most played:</span> ${most[0]} (${most[1]} starts)`;

  const leastDiv = document.createElement('div');
  leastDiv.innerHTML = `<span style="color:#ff6b6b">Least played:</span> ${least[0]} (${least[1]} starts)`;

  wrap.appendChild(mostDiv);
  wrap.appendChild(leastDiv);
  return wrap;
}

function _buildFeatureTable(events) {
  const counts = {};
  for (const e of events) {
    if (e.event !== 'feature_use') continue;
    counts[e.feature] = (counts[e.feature] || 0) + 1;
  }

  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;width:100%;font-size:11px;';

  const header = table.insertRow();
  for (const label of ['Feature', 'Uses']) {
    const th = document.createElement('th');
    th.textContent = label;
    th.style.cssText = 'text-align:left;padding:2px 8px 2px 0;color:#777;font-weight:normal;border-bottom:1px solid #333;';
    header.appendChild(th);
  }

  const features = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [feat, count] of features) {
    const row = table.insertRow();
    for (const val of [feat, count]) {
      const td = row.insertCell();
      td.textContent = val;
      td.style.cssText = 'padding:2px 8px 2px 0;color:#ccc;';
    }
  }

  if (features.length === 0) {
    const row = table.insertRow();
    const td = row.insertCell();
    td.textContent = 'No data';
    td.style.color = '#555';
    td.colSpan = 2;
  }

  return table;
}
