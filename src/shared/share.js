/**
 * Social Sharing Module
 *
 * Handles video and link sharing to short-form video platforms:
 * - Web Share API (primary)
 * - Platform deep-link fallbacks
 * - Platform picker UI
 *
 * @module share
 */

// Platform configurations
const PLATFORMS = {
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    deepLink: 'tiktok://',
    instructions: 'Video saved — open TikTok and upload',
    mobileOnly: true,
    supportsVideo: false // TikTok requires native app upload
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    deepLink: 'instagram://library',
    instructions: 'Video saved — open Instagram → New Reel → select from gallery',
    mobileOnly: true,
    supportsVideo: false // Instagram requires native app upload
  },
  youtube: {
    name: 'YouTube Shorts',
    icon: '▶️',
    uploadUrl: 'https://youtube.com/upload',
    instructions: 'Video saved — upload to YouTube Shorts',
    mobileOnly: false,
    supportsVideo: false // YouTube upload is web-based
  },
  snapchat: {
    name: 'Snapchat',
    icon: '👻',
    deepLink: 'snapchat://',
    instructions: 'Video saved — open Snapchat to share',
    mobileOnly: true,
    supportsVideo: false
  },
  twitter: {
    name: 'X',
    icon: '✕',
    shareUrl: 'https://twitter.com/intent/tweet',
    mobileOnly: false,
    supportsVideo: false // Twitter doesn't accept video via intent
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    shareUrl: 'https://www.facebook.com/sharer/sharer.php',
    mobileOnly: false,
    supportsVideo: false
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    shareUrl: 'https://wa.me/',
    mobileOnly: true,
    supportsVideo: false
  },
  copyLink: {
    name: 'Copy Link',
    icon: '🔗',
    mobileOnly: false,
    supportsVideo: false
  }
};

// Default share options
let shareOverlay = null;
let onCloseCallback = null;

/**
 * Check if Web Share API is available
 * @returns {boolean}
 */
export function hasWebShareSupport() {
  return navigator && typeof navigator.share === 'function';
}

/**
 * Check if Web Share API supports file sharing
 * @returns {boolean}
 */
export function hasFileShareSupport() {
  if (!hasWebShareSupport()) return false;
  if (typeof navigator.canShare !== 'function') return false;
  return navigator.canShare({
    files: [new File([new Blob(['test'], { type: 'text/plain' })], 'test.txt', { type: 'text/plain' })]
  });
}

/**
 * Check if running on mobile device
 * @returns {boolean}
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get available platforms based on device
 * @returns {string[]}
 */
export function getAvailablePlatforms() {
  const mobile = isMobile();
  return Object.entries(PLATFORMS)
    .filter(([_, config]) => !config.mobileOnly || mobile)
    .map(([id]) => id);
}

/**
 * Share via Web Share API
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share text
 * @param {string} options.url - Share URL
 * @param {Blob} options.videoBlob - Video blob to share
 * @returns {Promise<boolean>}
 */
export async function shareViaWebAPI(options) {
  if (!hasWebShareSupport()) {
    return false;
  }

  const { title, text, url, videoBlob } = options;

  try {
    const shareData = {
      title: title || 'My Gameplay',
      text: text || 'Check out my gameplay!',
      url: url || window.location.href
    };

    // Add video file if supported
    if (videoBlob && hasFileShareSupport()) {
      const fileName = videoBlob.type.includes('mp4') ? 'gameplay.mp4' : 'gameplay.webm';
      shareData.files = [new File([videoBlob], fileName, { type: videoBlob.type })];
    }

    // Check if share is possible
    if (navigator.canShare && !navigator.canShare(shareData)) {
      return false;
    }

    await navigator.share(shareData);
    return true;
  } catch (error) {
    // User cancelled or share failed
    if (error.name === 'AbortError') {
      return true; // User cancelled - still counts as "handled"
    }
    console.warn('Web Share API failed:', error);
    return false;
  }
}

/**
 * Share to a specific platform
 * @param {string} platformId - Platform identifier
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share text
 * @param {string} options.url - Share URL
 * @param {Blob} options.videoBlob - Video blob (will be downloaded for app-only platforms)
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function shareToPlatform(platformId, options) {
  const platform = PLATFORMS[platformId];
  if (!platform) {
    return { success: false, message: 'Unknown platform' };
  }

  const { title, text, url } = options;
  const encodedUrl = encodeURIComponent(url || window.location.href);
  const encodedText = encodeURIComponent(text || 'Check out my gameplay!');

  switch (platformId) {
    case 'tiktok':
    case 'instagram':
    case 'snapchat':
      // Download video + open deep link
      await downloadVideo(options.videoBlob, `${platformId}-share.webm`);
      return {
        success: true,
        message: platform.instructions,
        openUrl: platform.deepLink
      };

    case 'youtube':
      // Download video + open upload page
      await downloadVideo(options.videoBlob, 'youtube-share.webm');
      return {
        success: true,
        message: platform.instructions,
        openUrl: `${platform.uploadUrl}?title=${encodeURIComponent(title || 'My Gameplay')}`
      };

    case 'twitter':
      return {
        success: true,
        openUrl: `${platform.shareUrl}?text=${encodedText}&url=${encodedUrl}`
      };

    case 'facebook':
      return {
        success: true,
        openUrl: `${platform.shareUrl}?u=${encodedUrl}&quote=${encodedText}`
      };

    case 'whatsapp':
      return {
        success: true,
        openUrl: `${platform.shareUrl}?text=${encodedText}%20${encodedUrl}`
      };

    case 'copyLink':
      try {
        await navigator.clipboard.writeText(url || window.location.href);
        return { success: true, message: 'Link copied to clipboard!' };
      } catch {
        return { success: false, message: 'Failed to copy link' };
      }

    default:
      return { success: false, message: 'Platform not implemented' };
  }
}

/**
 * Download video blob as file
 * @param {Blob} blob - Video blob
 * @param {string} filename - Filename for download
 * @returns {Promise<void>}
 */
export async function downloadVideo(blob, filename = 'gameplay.webm') {
  if (!blob) {
    throw new Error('No video blob provided');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Create share overlay UI
 * @param {Object} options - UI options
 * @param {Blob} options.videoBlob - Video blob to share
 * @param {string} options.title - Share title
 * @param {string} options.text - Share text
 * @param {string} options.url - Share URL
 * @param {Function} onClose - Callback when overlay is closed
 * @returns {HTMLElement}
 */
export function createShareOverlay(options, onClose = null) {
  onCloseCallback = onClose;

  // Create overlay container
  shareOverlay = document.createElement('div');
  shareOverlay.id = 'share-overlay';
  shareOverlay.className = 'share-overlay';
  shareOverlay.innerHTML = `
    <div class="share-backdrop"></div>
    <div class="share-modal">
      <div class="share-header">
        <h3>Share Your Gameplay</h3>
        <button class="share-close" aria-label="Close">&times;</button>
      </div>
      <div class="share-content">
        <div class="share-platforms">
          ${renderPlatformButtons(options)}
        </div>
        <div class="share-message" id="share-message"></div>
      </div>
      <div class="share-footer">
        <button class="share-download-btn">Download Video</button>
      </div>
    </div>
  `;

  // Add event listeners
  const backdrop = shareOverlay.querySelector('.share-backdrop');
  const closeBtn = shareOverlay.querySelector('.share-close');
  const downloadBtn = shareOverlay.querySelector('.share-download-btn');

  backdrop.addEventListener('click', hideShareOverlay);
  closeBtn.addEventListener('click', hideShareOverlay);
  downloadBtn.addEventListener('click', () => {
    downloadVideo(options.videoBlob);
  });

  // Add platform button listeners
  const platformBtns = shareOverlay.querySelectorAll('.share-platform-btn');
  platformBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const platformId = btn.dataset.platform;
      await handlePlatformShare(platformId, options);
    });
  });

  // Add styles if not already present
  injectStyles();

  return shareOverlay;
}

/**
 * Render platform buttons HTML
 * @param {Object} options - Share options
 * @returns {string}
 */
function renderPlatformButtons(options) {
  const availablePlatforms = getAvailablePlatforms();

  // Try Web Share API first button
  let webShareBtn = '';
  if (hasWebShareSupport()) {
    webShareBtn = `
      <button class="share-platform-btn share-native-btn" data-platform="native">
        <span class="share-icon">📤</span>
        <span class="share-label">Share</span>
      </button>
    `;
  }

  const platformBtns = availablePlatforms
    .map(id => {
      const platform = PLATFORMS[id];
      return `
        <button class="share-platform-btn" data-platform="${id}">
          <span class="share-icon">${platform.icon}</span>
          <span class="share-label">${platform.name}</span>
        </button>
      `;
    })
    .join('');

  return webShareBtn + platformBtns;
}

/**
 * Handle platform share button click
 * @param {string} platformId - Platform identifier
 * @param {Object} options - Share options
 */
async function handlePlatformShare(platformId, options) {
  const messageEl = shareOverlay?.querySelector('#share-message');

  if (platformId === 'native') {
    const success = await shareViaWebAPI(options);
    if (success) {
      hideShareOverlay();
    } else {
      showMessage('Sharing not available on this device');
    }
    return;
  }

  const result = await shareToPlatform(platformId, options);

  if (result.message) {
    showMessage(result.message);
  }

  if (result.openUrl) {
    // Short delay to show message before opening URL
    setTimeout(() => {
      window.open(result.openUrl, '_blank');
    }, 500);
  }

  if (result.success) {
    // Keep overlay open to show instructions
    // User can close manually
  }
}

/**
 * Show message in overlay
 * @param {string} message - Message to display
 */
function showMessage(message) {
  const messageEl = shareOverlay?.querySelector('#share-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.classList.add('visible');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      messageEl.classList.remove('visible');
    }, 3000);
  }
}

/**
 * Show share overlay
 * @param {Object} options - Share options
 * @param {Blob} options.videoBlob - Video blob to share
 * @param {string} options.title - Share title
 * @param {string} options.text - Share text
 * @param {string} options.url - Share URL
 * @returns {Promise<void>}
 */
export async function showShareOverlay(options) {
  // Try native share first on mobile
  if (isMobile() && hasWebShareSupport() && options.videoBlob) {
    const shared = await shareViaWebAPI(options);
    if (shared) {
      return;
    }
  }

  // Show custom overlay
  const overlay = createShareOverlay(options);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
}

/**
 * Hide share overlay
 */
export function hideShareOverlay() {
  if (shareOverlay) {
    shareOverlay.classList.remove('visible');

    setTimeout(() => {
      if (shareOverlay && shareOverlay.parentNode) {
        shareOverlay.parentNode.removeChild(shareOverlay);
      }
      shareOverlay = null;
    }, 300);

    if (onCloseCallback) {
      onCloseCallback();
      onCloseCallback = null;
    }
  }
}

/**
 * Inject CSS styles for share overlay
 */
function injectStyles() {
  if (document.getElementById('share-overlay-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'share-overlay-styles';
  style.textContent = `
    .share-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .share-overlay.visible {
      opacity: 1;
    }

    .share-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
    }

    .share-modal {
      position: relative;
      width: 100%;
      max-width: 400px;
      background: var(--mg-bg, #1a1a2e);
      border-radius: 20px 20px 0 0;
      padding: 20px;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }

    .share-overlay.visible .share-modal {
      transform: translateY(0);
    }

    .share-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .share-header h3 {
      margin: 0;
      color: var(--mg-text, #ffffff);
      font-size: 18px;
    }

    .share-close {
      background: none;
      border: none;
      color: var(--mg-text-secondary, #a0a0a0);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .share-platforms {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .share-platform-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 8px;
      background: var(--mg-card-bg, #2a2a4e);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.1s ease;
    }

    .share-platform-btn:hover {
      background: var(--mg-primary, #4ecdc4);
    }

    .share-platform-btn:active {
      transform: scale(0.95);
    }

    .share-icon {
      font-size: 28px;
    }

    .share-label {
      font-size: 11px;
      color: var(--mg-text, #ffffff);
      text-align: center;
    }

    .share-native-btn {
      grid-column: span 4;
      flex-direction: row;
      padding: 12px 20px;
      background: var(--mg-primary, #4ecdc4);
    }

    .share-native-btn .share-icon {
      font-size: 20px;
    }

    .share-native-btn .share-label {
      font-size: 14px;
      font-weight: 600;
    }

    .share-message {
      margin-top: 16px;
      padding: 12px;
      background: var(--mg-accent, #ffd93d);
      color: var(--mg-bg, #1a1a2e);
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .share-message.visible {
      opacity: 1;
    }

    .share-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--mg-border, #3a3a5e);
    }

    .share-download-btn {
      width: 100%;
      padding: 14px;
      background: var(--mg-secondary, #ff6b6b);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }

    .share-download-btn:hover {
      opacity: 0.9;
    }

    @media (min-width: 768px) {
      .share-overlay {
        align-items: center;
      }

      .share-modal {
        border-radius: 20px;
        margin-bottom: 20px;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Generate share text for a game
 * @param {Object} options - Game options
 * @param {string} options.gameName - Name of the game
 * @param {number} options.moves - Number of moves
 * @param {number} options.time - Time in seconds
 * @param {number} options.stars - Stars earned
 * @returns {string}
 */
export function generateShareText(options) {
  const { gameName, moves, time, stars } = options;

  let text = `${gameName || 'Game'} — `;

  if (moves !== undefined) {
    text += `${moves} moves`;
    if (time !== undefined) {
      text += `, ${Math.floor(time)}s`;
    }
  } else if (time !== undefined) {
    text += `${Math.floor(time)} seconds`;
  }

  if (stars !== undefined) {
    text += ` ⭐`.repeat(stars);
  }

  text += ' — Can you beat my score?';

  return text;
}

/**
 * Quick share function - tries Web Share first, then shows overlay
 * @param {Object} options - Share options
 * @returns {Promise<boolean>}
 */
export async function quickShare(options) {
  // Try Web Share API first
  if (hasWebShareSupport()) {
    const success = await shareViaWebAPI(options);
    if (success) {
      return true;
    }
  }

  // Fall back to overlay
  await showShareOverlay(options);
  return true;
}

export default {
  hasWebShareSupport,
  hasFileShareSupport,
  isMobile,
  getAvailablePlatforms,
  shareViaWebAPI,
  shareToPlatform,
  downloadVideo,
  showShareOverlay,
  hideShareOverlay,
  generateShareText,
  quickShare,
  PLATFORMS
};
