/**
 * Content Script - Main entry point
 * Coordinates all modules and handles page lifecycle
 */

function log(level, message, data) {
  imageAltLog('Content', level, message, data);
}

/**
 * Main initialization function
 */
async function initialize() {
  try {
    log('info', '=== Image Alt Text Generator Extension Started ===');
    log('info', `URL: ${window.location.href}`);

    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      log('debug', 'Waiting for DOM to load');
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    log('info', 'DOM ready, starting initialization');

    // Wait a bit for images to start loading
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process initial images on the page
    log('info', 'Processing initial images');
    await processAllImages();

    // Start observers for dynamic content
    log('info', 'Starting observers for dynamic content');
    const observers = startObservers();

    // Store observers globally for cleanup
    window.__imageAltObservers = observers;

    log('info', '=== Initialization Complete ===');

    // Log statistics
    setTimeout(() => {
      const trackerStats = tracker.getStats();
      const apiStats = getAPIStats();

      log('info', 'Statistics:', {
        processed: trackerStats.processedCount,
        inFlight: trackerStats.inFlightCount,
        apiTotal: apiStats.total,
        apiSuccess: apiStats.success,
        apiFailed: apiStats.failed,
        apiQueued: apiStats.queued
      });
    }, 5000);

  } catch (error) {
    log('error', 'Initialization failed:', error);
  }
}

/**
 * Cleanup function
 */
function cleanup() {
  log('info', 'Cleaning up extension');

  // Stop observers
  if (window.__imageAltObservers) {
    stopObservers(window.__imageAltObservers);
    delete window.__imageAltObservers;
  }

  // Clear queues
  if (typeof clearQueue === 'function') {
    clearQueue();
  }

  log('info', 'Cleanup complete');
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    log('debug', 'Page hidden');
  } else {
    log('debug', 'Page visible');
    // Optionally reprocess images when page becomes visible
    // processAllImages();
  }
}

/**
 * Handle page unload
 */
function handleUnload() {
  log('info', 'Page unloading');
  cleanup();
}

// Listen for visibility changes
document.addEventListener('visibilitychange', handleVisibilityChange);

// Listen for page unload
window.addEventListener('beforeunload', handleUnload);

// Start initialization
initialize().catch(error => {
  log('error', 'Fatal error during initialization:', error);
});

// Expose global interface for debugging
if (window.IMAGE_ALT_DEBUG) {
  window.imageAltExtension = {
    processAllImages,
    processImages,
    getTrackerStats: () => tracker.getStats(),
    getAPIStats: getAPIStats,
    cleanup,
    reinitialize: initialize
  };

  log('info', 'Debug interface available at window.imageAltExtension');
}
