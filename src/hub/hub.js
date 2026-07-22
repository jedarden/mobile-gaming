/**
 * Hub page - Main entry point for mobile games
 *
 * Features:
 * - Game card filtering by category
 * - Quick Play: intelligent game selection based on play history
 * - Daily Challenge banner with dynamic link
 * - Progress tracking via shared storage module
 */

import {
  getDailyChallenge,
  isDailyCompleted
} from '../shared/daily.js';
import {
  pickGame,
  getTopCandidates,
  getGameUrl
} from '../shared/quick-play.js';
import { createSettings, getSettings } from '../shared/settings.js';
import { renderDashboard } from '../shared/analytics.js';
import { exportProgress, importProgress } from '../shared/sync.js';

// Game metadata for daily challenge (full list)
const GAMES = [
  { id: 'bus-jam', title: 'Bus Jam', category: 'puzzle' },
  { id: 'pull-the-pin', title: 'Pull the Pin', category: 'puzzle' },
  { id: 'water-sort', title: 'Water Sort', category: 'puzzle' },
  { id: 'brain-teaser', title: 'Brain Teaser', category: 'puzzle' },
  { id: 'parking-escape', title: 'Parking Escape', category: 'puzzle' },
  { id: 'save-the-character', title: 'Save the Character', category: 'puzzle' },
  { id: 'merge-games', title: 'Merge Games', category: 'puzzle' },
  { id: 'satisfying-asmr', title: 'Satisfying ASMR', category: 'simulation' },
  { id: 'crowd-runner', title: 'Crowd Runner', category: 'arcade' },
  { id: 'bridge-race', title: 'Bridge Race', category: 'arcade' },
  { id: 'giant-runner', title: 'Giant Runner', category: 'arcade' },
  { id: 'jelly-shift', title: 'Jelly Shift', category: 'arcade' },
  { id: 'makeover-run', title: 'Makeover Run', category: 'arcade' }
];

/**
 * Preload top candidate games for instant Quick Play
 * Adds modulepreload links for the top 2 games
 */
function preloadTopCandidates() {
  const candidates = getTopCandidates();

  candidates.forEach(({ gameId }) => {
    // Create preload link for game module
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = `/src/games/${gameId}/game.js`;
    document.head.appendChild(link);
  });
}

/**
 * Initialize filter tabs
 */
function initFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  const cards = document.querySelectorAll('.game-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;

      // Filter cards
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

/**
 * Initialize Quick Play button
 * Uses intelligent game selection based on play history
 */
function initQuickPlay() {
  const btn = document.getElementById('quickPlayBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const { gameId, level } = pickGame();
    window.location.href = getGameUrl(gameId, level);
  });
}

/**
 * Initialize Daily Challenge banner
 */
function initDailyChallenge() {
  const banner = document.getElementById('dailyChallengeBanner');
  const subtitle = document.getElementById('dailyChallengeSubtitle');

  if (!banner || !subtitle) return;

  const challenge = getDailyChallenge();
  const game = GAMES.find(g => g.id === challenge.gameId);
  const isCompleted = isDailyCompleted();

  if (game) {
    subtitle.textContent = `${game.title} - ${isCompleted ? 'Completed!' : 'Play now'}`;
    banner.href = `/${challenge.gameId}/?daily=${challenge.seed}`;
  }

  // Update banner style based on completion
  if (isCompleted) {
    banner.classList.add('completed');
    const icon = banner.querySelector('.banner-icon');
    if (icon) icon.textContent = '✓';
  }
}

// Dev dashboard overlay element
let devOverlay = null;

/**
 * Show the analytics dev dashboard as a full-screen overlay
 */
function showDevDashboard() {
  if (!devOverlay) {
    devOverlay = document.createElement('div');
    devOverlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715  Close Dev Dashboard';
    closeBtn.style.cssText = 'flex-shrink:0;padding:10px 16px;background:#222;color:#eee;border:none;border-bottom:1px solid #333;font-family:monospace;font-size:12px;cursor:pointer;text-align:left;';
    closeBtn.addEventListener('click', hideDevDashboard);

    const dashContainer = document.createElement('div');
    dashContainer.style.cssText = 'flex:1;overflow-y:auto;';

    devOverlay.appendChild(closeBtn);
    devOverlay.appendChild(dashContainer);
    document.body.appendChild(devOverlay);
  } else {
    devOverlay.style.display = 'flex';
    // Re-render with latest data
    const dashContainer = devOverlay.querySelector('div');
    renderDashboard(dashContainer);
    return;
  }

  renderDashboard(devOverlay.querySelector('div'));
}

/**
 * Hide the analytics dev dashboard
 */
function hideDevDashboard() {
  if (devOverlay) devOverlay.style.display = 'none';
}

// ─── Cross-Device Progress Sync UI ──────────────────────────────────────────

/** Injected once for sync dialog/toast styles */
let syncStylesInjected = false;

/**
 * Inject styles for the sync export dialog and result toast
 */
function injectSyncStyles() {
  if (syncStylesInjected) return;

  const style = document.createElement('style');
  style.textContent = `
    .mg-sync-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .mg-sync-dialog {
      background: #1a1a2e;
      color: white;
      border-radius: 16px;
      padding: 24px;
      width: 100%;
      max-width: 340px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .mg-sync-dialog-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .mg-sync-dialog-desc {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .mg-sync-code {
      display: block;
      width: 100%;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: white;
      font-family: 'SF Mono', ui-monospace, Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 12px;
      box-sizing: border-box;
      word-break: break-all;
      resize: none;
      margin-bottom: 16px;
    }
    .mg-sync-dialog-actions {
      display: flex;
      gap: 8px;
    }
    .mg-sync-btn {
      flex: 1;
      padding: 12px;
      border-radius: 10px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .mg-sync-btn-primary {
      background: #2ecc71;
      color: #0d1b12;
    }
    .mg-sync-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .mg-sync-toast {
      position: fixed;
      left: 50%;
      bottom: 32px;
      transform: translateX(-50%);
      z-index: 950;
      max-width: 320px;
      padding: 12px 20px;
      border-radius: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: white;
      text-align: center;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }
    .mg-sync-toast.mg-sync-ok { background: #2ecc71; color: #0d1b12; }
    .mg-sync-toast.mg-sync-err { background: #e74c3c; }
  `;
  document.head.appendChild(style);
  syncStylesInjected = true;
}

/**
 * Show a transient toast message for sync results
 * @param {string} message - Message to display
 * @param {boolean} ok - Whether this is a success (green) or error (red) toast
 */
function showSyncToast(message, ok) {
  injectSyncStyles();
  const toast = document.createElement('div');
  toast.className = `mg-sync-toast ${ok ? 'mg-sync-ok' : 'mg-sync-err'}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

/**
 * Show the sync export dialog with the generated code and a copy button.
 * @param {string} code - Sync code from exportProgress()
 */
function showSyncExportDialog(code) {
  injectSyncStyles();

  const backdrop = document.createElement('div');
  backdrop.className = 'mg-sync-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'mg-sync-dialog';
  dialog.innerHTML = `
    <div class="mg-sync-dialog-title">Your Sync Code</div>
    <div class="mg-sync-dialog-desc">Copy this code and enter it in Settings &rarr; Sync Progress (Import) on another device.</div>
    <textarea class="mg-sync-code" readonly rows="4" aria-label="Sync code">${code}</textarea>
    <div class="mg-sync-dialog-actions">
      <button class="mg-sync-btn mg-sync-btn-secondary" data-sync-action="close">Close</button>
      <button class="mg-sync-btn mg-sync-btn-primary" data-sync-action="copy">Copy</button>
    </div>
  `;

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  function close() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  dialog.querySelector('[data-sync-action="close"]').addEventListener('click', close);

  dialog.querySelector('[data-sync-action="copy"]').addEventListener('click', async () => {
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      // Fallback: select the text so the user can copy manually
      const textarea = dialog.querySelector('.mg-sync-code');
      textarea.focus();
      textarea.select();
    }
    close();
    showSyncToast(copied ? 'Sync code copied to clipboard' : 'Select the code and copy it manually', copied);
  });
}

/**
 * Initialize settings drawer with dev mode dashboard and progress sync support
 */
function initSettings() {
  createSettings({
    container: document.body,
    onDevMode() {
      const { devMode } = getSettings();
      if (devMode) {
        showDevDashboard();
      } else {
        hideDevDashboard();
      }
    },
    onSyncExport() {
      const code = exportProgress();
      showSyncExportDialog(code);
    },
    onSyncImport(code) {
      const result = importProgress(code);
      if (result.success) {
        showSyncToast('Progress imported successfully', true);
      } else {
        showSyncToast(`Import failed: ${result.error || 'Invalid code'}`, false);
      }
    },
  });
}

/**
 * Initialize all features
 */
function init() {
  preloadTopCandidates();
  initFilterTabs();
  initQuickPlay();
  initDailyChallenge();
  initSettings();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
