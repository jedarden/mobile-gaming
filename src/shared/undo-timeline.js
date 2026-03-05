/**
 * UndoTimeline.js - Visual Undo Timeline Component
 *
 * Provides a horizontal strip of thumbnails showing move history with:
 * - Mini thumbnails (40x60px) generated from game states
 * - Thumbnail caching for performance
 * - Current position indicator
 * - Tap to jump to any state
 * - Drag to scrub through history
 * - Smooth 60fps performance
 */

/**
 * Creates an undo timeline component
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element for the timeline
 * @param {Function} options.renderThumbnail - Function to render state to canvas (state, canvas, scale) => void
 * @param {Function} options.onStateChange - Callback when user selects a state (state, index) => void
 * @param {number} options.thumbnailWidth - Width of thumbnails (default: 40)
 * @param {number} options.thumbnailHeight - Height of thumbnails (default: 60)
 * @param {number} options.maxThumbnails - Maximum thumbnails to display (default: 20)
 */
export function createUndoTimeline(options) {
  const {
    container,
    renderThumbnail,
    onStateChange,
    thumbnailWidth = 40,
    thumbnailHeight = 60,
    maxThumbnails = 20
  } = options;

  // State
  let history = null;
  let currentIndex = -1;
  let thumbnails = [];
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let reducedMotion = false;

  // DOM elements
  const timeline = document.createElement('div');
  timeline.className = 'undo-timeline';
  timeline.setAttribute('role', 'slider');
  timeline.setAttribute('aria-label', 'Move history timeline');
  timeline.setAttribute('aria-valuemin', '0');
  timeline.setAttribute('tabindex', '0');

  const track = document.createElement('div');
  track.className = 'undo-timeline-track';
  timeline.appendChild(track);

  const indicator = document.createElement('div');
  indicator.className = 'undo-timeline-indicator';
  timeline.appendChild(indicator);

  container.appendChild(timeline);

  // Check for reduced motion preference
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = motionQuery.matches;
  motionQuery.addEventListener('change', (e) => {
    reducedMotion = e.matches;
  });

  /**
   * Generate a thumbnail for a state
   */
  function generateThumbnail(state, index) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(
      thumbnailWidth / 300,  // Assuming default game width
      thumbnailHeight / 400  // Assuming default game height
    );

    canvas.width = thumbnailWidth * window.devicePixelRatio;
    canvas.height = thumbnailHeight * window.devicePixelRatio;
    canvas.style.width = `${thumbnailWidth}px`;
    canvas.style.height = `${thumbnailHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio * (1 / scale), window.devicePixelRatio * (1 / scale));

    // Render the state
    if (renderThumbnail) {
      renderThumbnail(state, canvas, scale);
    }

    return canvas.toDataURL('image/png', 0.7);
  }

  /**
   * Create a thumbnail element
   */
  function createThumbnailElement(dataUrl, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'undo-timeline-thumb-wrapper';
    wrapper.dataset.index = index;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'undo-timeline-thumb';
    img.alt = `Move ${index + 1}`;
    img.draggable = false;

    const label = document.createElement('span');
    label.className = 'undo-timeline-thumb-label';
    label.textContent = index + 1;

    wrapper.appendChild(img);
    wrapper.appendChild(label);

    // Click handler
    wrapper.addEventListener('click', (e) => {
      if (!isDragging) {
        jumpToIndex(index);
      }
    });

    // Touch handlers for better mobile support
    wrapper.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });

    return wrapper;
  }

  /**
   * Update the timeline display
   */
  function updateTimeline() {
    if (!history) return;

    track.innerHTML = '';
    thumbnails = [];

    const timelineData = history.getTimeline();
    const totalStates = timelineData.length;

    // Hide timeline if only one state (no history)
    if (totalStates <= 1) {
      timeline.style.display = 'none';
      return;
    }

    timeline.style.display = 'flex';

    // Determine which thumbnails to show
    const startIdx = Math.max(0, currentIndex - Math.floor(maxThumbnails / 2));
    const endIdx = Math.min(totalStates, startIdx + maxThumbnails);

    // Generate and display thumbnails
    for (let i = startIdx; i < endIdx; i++) {
      const { state, isCurrent } = timelineData[i];

      const dataUrl = generateThumbnail(state, i);
      thumbnails.push({ index: i, dataUrl });

      const element = createThumbnailElement(dataUrl, i);

      if (isCurrent) {
        element.classList.add('current');
      }

      // Add future states styling (for redo)
      if (i > currentIndex) {
        element.classList.add('future');
      }

      track.appendChild(element);
    }

    // Update ARIA
    timeline.setAttribute('aria-valuemax', totalStates - 1);
    timeline.setAttribute('aria-valuenow', currentIndex);
    timeline.setAttribute('aria-valuetext', `Move ${currentIndex + 1} of ${totalStates}`);

    // Update indicator position
    updateIndicator();

    // Scroll current into view
    scrollToCurrent();
  }

  /**
   * Update the current position indicator
   */
  function updateIndicator() {
    const currentThumb = track.querySelector('.current');
    if (currentThumb) {
      const trackRect = track.getBoundingClientRect();
      const thumbRect = currentThumb.getBoundingClientRect();
      const offset = thumbRect.left - trackRect.left + track.scrollLeft;

      indicator.style.left = `${offset}px`;
      indicator.style.width = `${thumbRect.width}px`;
    }
  }

  /**
   * Scroll to make current thumbnail visible
   */
  function scrollToCurrent() {
    const currentThumb = track.querySelector('.current');
    if (currentThumb) {
      currentThumb.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }

  /**
   * Jump to a specific state
   */
  function jumpToIndex(index) {
    if (!history || index < 0 || index >= history.length) return;

    const state = history.jumpTo(index);
    if (state && onStateChange) {
      currentIndex = index;
      updateTimeline();
      onStateChange(state, index);
    }
  }

  /**
   * Handle drag start
   */
  function handleDragStart(e) {
    isDragging = true;
    dragStartX = e.clientX || (e.touches && e.touches[0].clientX);
    dragStartScroll = track.scrollLeft;

    timeline.classList.add('dragging');
    document.body.style.cursor = 'grabbing';

    e.preventDefault();
  }

  /**
   * Handle drag move
   */
  function handleDragMove(e) {
    if (!isDragging) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const deltaX = dragStartX - clientX;

    track.scrollLeft = dragStartScroll + deltaX;

    // Determine which thumbnail is under cursor
    const thumbs = track.querySelectorAll('.undo-timeline-thumb-wrapper');
    for (const thumb of thumbs) {
      const rect = thumb.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const idx = parseInt(thumb.dataset.index, 10);
        // Preview highlight (don't jump yet)
        thumbs.forEach(t => t.classList.remove('hover'));
        thumb.classList.add('hover');
        break;
      }
    }

    e.preventDefault();
  }

  /**
   * Handle drag end
   */
  function handleDragEnd(e) {
    if (!isDragging) return;

    // Find the hovered thumbnail and jump to it
    const hovered = track.querySelector('.hover');
    if (hovered) {
      const idx = parseInt(hovered.dataset.index, 10);
      jumpToIndex(idx);
      hovered.classList.remove('hover');
    }

    isDragging = false;
    timeline.classList.remove('dragging');
    document.body.style.cursor = '';

    // Update indicator after drag
    requestAnimationFrame(updateIndicator);
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeyDown(e) {
    if (!history) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        jumpToIndex(Math.max(0, currentIndex - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        jumpToIndex(Math.min(history.length - 1, currentIndex + 1));
        break;
      case 'Home':
        e.preventDefault();
        jumpToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        jumpToIndex(history.length - 1);
        break;
    }
  }

  // Event listeners
  timeline.addEventListener('mousedown', handleDragStart);
  timeline.addEventListener('touchstart', handleDragStart, { passive: false });

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('touchmove', handleDragMove, { passive: false });

  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchend', handleDragEnd);

  timeline.addEventListener('keydown', handleKeyDown);

  // Update indicator on scroll
  track.addEventListener('scroll', () => {
    requestAnimationFrame(updateIndicator);
  }, { passive: true });

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  /**
   * Set the history instance to track
   */
  function setHistory(historyInstance) {
    history = historyInstance;
    updateTimeline();
  }

  /**
   * Update current position (call after undo/redo)
   */
  function setPosition(index) {
    currentIndex = index;
    updateTimeline();
  }

  /**
   * Refresh the timeline (call after new state pushed)
   */
  function refresh() {
    if (history) {
      currentIndex = history.position;
      updateTimeline();
    }
  }

  /**
   * Cleanup resources
   */
  function cleanup() {
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);
    window.removeEventListener('beforeunload', cleanup);
    thumbnails = [];
  }

  /**
   * Show/hide the timeline
   */
  function setVisible(visible) {
    timeline.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Check if timeline is visible
   */
  function isVisible() {
    return timeline.style.display !== 'none';
  }

  return {
    setHistory,
    setPosition,
    refresh,
    updateTimeline,
    setVisible,
    isVisible,
    cleanup,
    jumpToIndex
  };
}

export default createUndoTimeline;
