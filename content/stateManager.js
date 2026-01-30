/**
 * State Manager - Tracks processed images to avoid duplicate API calls
 * Uses WeakMap for automatic garbage collection and hash-based Set for persistence
 */

function log(level, message, data) {
  imageAltLog('StateManager', level, message, data);
}

class ProcessedImageTracker {
  constructor() {
    // WeakMap for tracking DOM elements (auto garbage collection)
    this.processedImages = new WeakMap();

    // Set for hash-based tracking (persists across DOM changes)
    this.processedHashes = new Set();

    // Track currently processing images to avoid duplicates
    this.inFlight = new Set();

    log('info', 'ProcessedImageTracker initialized');
  }

  /**
   * Generate a hash for an image based on its URL and dimensions
   * @param {HTMLImageElement} img - The image element
   * @returns {string} Hash string
   */
  getImageHash(img) {
    const key = `${img.src}_${img.naturalWidth}x${img.naturalHeight}`;
    return this.simpleHash(key);
  }

  /**
   * Simple string hash function
   * @param {string} str - String to hash
   * @returns {string} Hash as base36 string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if an image has already been processed
   * @param {HTMLImageElement} img - The image element
   * @returns {boolean} True if already processed
   */
  isProcessed(img) {
    // Check WeakMap first (fastest)
    if (this.processedImages.has(img)) {
      return true;
    }

    // Check hash set (for re-added elements)
    const hash = this.getImageHash(img);
    if (this.processedHashes.has(hash)) {
      return true;
    }

    return false;
  }

  /**
   * Check if an image is currently being processed
   * @param {HTMLImageElement} img - The image element
   * @returns {boolean} True if currently in flight
   */
  isInFlight(img) {
    const hash = this.getImageHash(img);
    return this.inFlight.has(hash);
  }

  /**
   * Mark an image as currently being processed
   * @param {HTMLImageElement} img - The image element
   */
  markInFlight(img) {
    const hash = this.getImageHash(img);
    this.inFlight.add(hash);
    log('debug', `Marked as in-flight:`, hash);
  }

  /**
   * Remove an image from the in-flight set
   * @param {HTMLImageElement} img - The image element
   */
  clearInFlight(img) {
    const hash = this.getImageHash(img);
    this.inFlight.delete(hash);
    log('debug', `Cleared from in-flight:`, hash);
  }

  /**
   * Mark an image as processed
   * @param {HTMLImageElement} img - The image element
   * @param {string} description - The description that was set
   */
  markProcessed(img, description) {
    // Store in WeakMap
    this.processedImages.set(img, {
      description,
      timestamp: Date.now()
    });

    // Store hash for persistence
    const hash = this.getImageHash(img);
    this.processedHashes.add(hash);

    // Remove from in-flight
    this.clearInFlight(img);

    log('info', `Marked as processed (${hash}):`, img.src.substring(0, 50));
  }

  /**
   * Check if an image should be reprocessed
   * Useful if user manually changes alt text
   * @param {HTMLImageElement} img - The image element
   * @returns {boolean} True if should reprocess
   */
  shouldReprocess(img) {
    const data = this.processedImages.get(img);
    if (!data) return true;

    // Check if alt text still matches what we set
    return img.alt !== data.description;
  }

  /**
   * Get statistics about processed images
   * @returns {object} Statistics
   */
  getStats() {
    return {
      processedCount: this.processedHashes.size,
      inFlightCount: this.inFlight.size
    };
  }

  /**
   * Clear all tracking data (for testing/debugging)
   */
  clear() {
    this.processedHashes.clear();
    this.inFlight.clear();
    log('warn', 'All tracking data cleared');
  }
}

// Create singleton instance
const tracker = new ProcessedImageTracker();

// For debugging in console
if (window.IMAGE_ALT_DEBUG) {
  window.imageAltTracker = tracker;
}
