/**
 * Background Script - CORS proxy and extension state management
 * Handles requests from content scripts that need elevated privileges
 */

const DEBUG = true; // Background script can have its own DEBUG

function log(level, message, data) {
  if (!DEBUG) return;
  console[level](`[ImageAlt:Background] ${message}`, data || '');
}

/**
 * Convert a blob to base64
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Base64 data URL
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch image and convert to base64 (CORS bypass)
 * @param {string} url - Image URL
 * @returns {Promise<string>} Base64 data URL
 */
async function fetchImageAsBase64(url) {
  try {
    log('info', `Fetching image: ${url.substring(0, 50)}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Check if it's actually an image
    if (!blob.type.startsWith('image/')) {
      throw new Error(`Not an image: ${blob.type}`);
    }

    const base64 = await blobToBase64(blob);

    log('info', `Successfully converted to base64`);

    return base64;
  } catch (error) {
    log('error', `Failed to fetch image:`, error.message);
    throw error;
  }
}

/**
 * Handle messages from content scripts
 * @param {object} message - Message from content script
 * @param {object} sender - Sender information
 * @returns {Promise<object>} Response to send back
 */
async function handleMessage(message, sender) {
  log('debug', `Received message type: ${message.type}`);

  try {
    switch (message.type) {
      case 'CONVERT_IMAGE':
        // CORS proxy: fetch image and convert to base64
        if (!message.url) {
          throw new Error('No URL provided');
        }

        const base64 = await fetchImageAsBase64(message.url);

        return {
          success: true,
          base64: base64
        };

      case 'GET_STATS':
        // Return extension statistics
        return {
          success: true,
          stats: {
            // Add any background-level statistics here
          }
        };

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    log('error', `Error handling message:`, error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize background script
 */
function initialize() {
  log('info', '=== Background Script Started ===');

  // Listen for messages from content scripts
  browser.runtime.onMessage.addListener((message, sender) => {
    // Return promise for async handling
    return handleMessage(message, sender);
  });

  log('info', 'Message listener registered');
}

// Start initialization
initialize();

/**
 * Handle extension installation/update
 */
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    log('info', 'Extension installed');
  } else if (details.reason === 'update') {
    log('info', `Extension updated to version ${browser.runtime.getManifest().version}`);
  }
});

/**
 * Handle browser startup
 */
browser.runtime.onStartup.addListener(() => {
  log('info', 'Browser started');
});
