/**
 * Image Converter - Converts images to base64 format
 * Handles CORS issues using canvas method and background script fallback
 */

function log(level, message, data) {
  imageAltLog('ImageConverter', level, message, data);
}

/**
 * Convert an image to base64 using canvas
 * @param {HTMLImageElement} img - The image element
 * @param {number} quality - JPEG quality (0-1), default 0.8
 * @returns {Promise<string>} Base64 data URL
 */
async function imageToBase64Canvas(img, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Convert to base64 with compression
      const base64 = canvas.toDataURL('image/jpeg', quality);

      log('debug', `Converted to base64 (canvas): ${img.src.substring(0, 50)}`);
      resolve(base64);
    } catch (error) {
      // This will typically be a CORS error
      log('warn', `Canvas conversion failed (likely CORS):`, error.message);
      reject(error);
    }
  });
}

/**
 * Convert an image to base64 using fetch + FileReader
 * @param {string} url - The image URL
 * @returns {Promise<string>} Base64 data URL
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    log('error', `Fetch conversion failed:`, error.message);
    throw error;
  }
}

/**
 * Request base64 conversion via background script (for CORS bypass)
 * @param {string} url - The image URL
 * @returns {Promise<string>} Base64 data URL
 */
async function requestBackgroundConversion(url) {
  return new Promise((resolve, reject) => {
    // Send message to background script
    browser.runtime.sendMessage({
      type: 'CONVERT_IMAGE',
      url: url
    }).then(response => {
      if (response && response.success) {
        log('debug', `Converted via background: ${url.substring(0, 50)}`);
        resolve(response.base64);
      } else {
        reject(new Error(response?.error || 'Background conversion failed'));
      }
    }).catch(error => {
      log('error', `Background conversion failed:`, error.message);
      reject(error);
    });
  });
}

/**
 * Main image conversion function with fallback chain
 * @param {HTMLImageElement} img - The image element
 * @returns {Promise<string>} Base64 data URL
 */
async function convertImageToBase64(img) {
  // Validate image
  if (!img || !img.src) {
    throw new Error('Invalid image element');
  }

  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    throw new Error('Image not loaded or broken');
  }

  // Skip data URIs (already base64)
  if (img.src.startsWith('data:')) {
    log('debug', 'Image is already a data URI, skipping conversion');
    return img.src;
  }

  // Try conversion methods in order
  try {
    // Method 1: Canvas (fastest, but fails on CORS)
    return await imageToBase64Canvas(img);
  } catch (canvasError) {
    log('warn', 'Canvas method failed, trying fetch method');

    try {
      // Method 2: Fetch (works if image is CORS-enabled)
      return await fetchImageAsBase64(img.src);
    } catch (fetchError) {
      log('warn', 'Fetch method failed, trying background script');

      try {
        // Method 3: Background script (works for any URL due to extension privileges)
        return await requestBackgroundConversion(img.src);
      } catch (backgroundError) {
        // All methods failed
        log('error', `All conversion methods failed for: ${img.src.substring(0, 50)}`);
        throw new Error('Image conversion failed: ' + backgroundError.message);
      }
    }
  }
}

/**
 * Convert base64 data URL to Blob
 * @param {string} base64 - Base64 data URL (data:image/jpeg;base64,...)
 * @returns {Blob} Blob object
 */
function base64ToBlob(base64) {
  try {
    // Split the base64 string
    const parts = base64.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid base64 format');
    }

    const [metadata, data] = parts;

    // Extract MIME type
    const mimeMatch = metadata.match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Could not extract MIME type');
    }
    const mime = mimeMatch[1];

    // Decode base64
    const binary = atob(data);

    // Convert to byte array
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    return new Blob([array], { type: mime });
  } catch (error) {
    log('error', 'Failed to convert base64 to blob:', error.message);
    throw error;
  }
}

/**
 * Get the size of a base64 string in bytes
 * @param {string} base64 - Base64 string
 * @returns {number} Size in bytes
 */
function getBase64Size(base64) {
  const padding = (base64.match(/=/g) || []).length;
  const base64Length = base64.length - base64.indexOf(',') - 1;
  return Math.ceil((base64Length * 3) / 4) - padding;
}

/**
 * Check if image size is within acceptable limits
 * @param {string} base64 - Base64 string
 * @param {number} maxSizeMB - Maximum size in megabytes
 * @returns {boolean} True if within limits
 */
function isWithinSizeLimit(base64, maxSizeMB = 5) {
  const sizeBytes = getBase64Size(base64);
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB > maxSizeMB) {
    log('warn', `Image too large: ${sizeMB.toFixed(2)}MB (max ${maxSizeMB}MB)`);
    return false;
  }

  return true;
}
