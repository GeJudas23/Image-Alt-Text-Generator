/**
 * Image Processor - Detects and filters meaningful images on the page
 * Handles the core logic for identifying which images should be processed
 */

// Configuration
const MIN_IMAGE_WIDTH = 100;
const MIN_IMAGE_HEIGHT = 100;
const MIN_ASPECT_RATIO = 0.1;
const MAX_ASPECT_RATIO = 10;
const MIN_OPACITY = 0.1;

function log(level, message, data) {
  imageAltLog('ImageProcessor', level, message, data);
}

/**
 * Check if image meets size requirements
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if size is acceptable
 */
function isSizeAcceptable(img) {
  if (img.naturalWidth < MIN_IMAGE_WIDTH || img.naturalHeight < MIN_IMAGE_HEIGHT) {
    log('debug', `Filtered by size: ${img.naturalWidth}x${img.naturalHeight}`, img.src.substring(0, 50));
    return false;
  }
  return true;
}

/**
 * Check if image has acceptable aspect ratio
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if aspect ratio is acceptable
 */
function isAspectRatioAcceptable(img) {
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
    log('debug', `Filtered by aspect ratio: ${aspectRatio.toFixed(2)}`, img.src.substring(0, 50));
    return false;
  }

  return true;
}

/**
 * Check if image is visible
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if visible
 */
function isVisible(img) {
  const style = window.getComputedStyle(img);

  // Check display and visibility
  if (style.display === 'none' || style.visibility === 'hidden') {
    log('debug', 'Filtered by visibility', img.src.substring(0, 50));
    return false;
  }

  // Check opacity
  const opacity = parseFloat(style.opacity);
  if (opacity < MIN_OPACITY) {
    log('debug', `Filtered by opacity: ${opacity}`, img.src.substring(0, 50));
    return false;
  }

  return true;
}

/**
 * Check if image class/id matches exclusion patterns
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if should be excluded
 */
function matchesExclusionPatterns(img) {
  const classId = (img.className + ' ' + img.id).toLowerCase();

  // Exclusion patterns for common system images
  const excludePatterns = [
    /\bicon\b/,
    /\bico\b/,
    /\bsprite\b/,
    /\bemoji\b/,
    /\bavatar-small\b/,
    /\blogo\b/,
    /\bbadge\b/,
    /\bbutton-img\b/,
    /\bdecoration\b/,
    /\bad-/,
    /\badvertisement\b/,
    /\bsponsored\b/,
    /\bnav-/,
    /\bmenu-/,
    /\bheader-/,
    /\bfooter-/,
    /\bthumbnail\b/
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(classId)) {
      log('debug', `Filtered by class/id pattern: ${pattern}`, img.src.substring(0, 50));
      return true;
    }
  }

  return false;
}

/**
 * Check if image is in an excluded parent context
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if should be excluded
 */
function isInExcludedContext(img) {
  // Check if image is within excluded parent elements
  const excludedParent = img.closest('nav, header, footer, aside, [role="navigation"], [role="banner"]');

  if (excludedParent) {
    log('debug', `Filtered by parent context: ${excludedParent.tagName}`, img.src.substring(0, 50));
    return true;
  }

  return false;
}

/**
 * Check if image URL matches exclusion patterns
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if should be excluded
 */
function isExcludedByURL(img) {
  const src = img.src.toLowerCase();

  // Tracking pixels (typically 1x1)
  if (img.naturalWidth === 1 && img.naturalHeight === 1) {
    log('debug', 'Filtered as tracking pixel (1x1)', img.src.substring(0, 50));
    return true;
  }

  // URL patterns to exclude
  const excludeURLPatterns = [
    /tracking/,
    /pixel/,
    /analytics/,
    /beacon/
  ];

  for (const pattern of excludeURLPatterns) {
    if (pattern.test(src)) {
      log('debug', `Filtered by URL pattern: ${pattern}`, img.src.substring(0, 50));
      return true;
    }
  }

  return false;
}

/**
 * Check if image is loaded and valid
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if valid
 */
function isImageLoaded(img) {
  // Check if image has valid src
  if (!img.src || img.src === '') {
    log('debug', 'Filtered: no src');
    return false;
  }

  // Check if image is actually loaded
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    log('debug', 'Filtered: not loaded or broken', img.src.substring(0, 50));
    return false;
  }

  // Check if it's a valid image (not SVG placeholders, etc.)
  if (img.complete === false) {
    log('debug', 'Filtered: not complete', img.src.substring(0, 50));
    return false;
  }

  return true;
}

/**
 * Main filter function - determines if image should be processed
 * @param {HTMLImageElement} img - The image element
 * @returns {boolean} True if image is meaningful and should be processed
 */
function isMeaningfulImage(img) {
  // Run all checks
  return (
    isImageLoaded(img) &&
    isSizeAcceptable(img) &&
    isAspectRatioAcceptable(img) &&
    isVisible(img) &&
    !matchesExclusionPatterns(img) &&
    !isInExcludedContext(img) &&
    !isExcludedByURL(img)
  );
}

/**
 * Find all images on the page
 * @returns {HTMLImageElement[]} Array of image elements
 */
function findAllImages() {
  return Array.from(document.querySelectorAll('img'));
}

/**
 * Filter images to only meaningful ones
 * @param {HTMLImageElement[]} images - Array of image elements
 * @returns {HTMLImageElement[]} Filtered array
 */
function filterMeaningfulImages(images) {
  const meaningful = images.filter(isMeaningfulImage);

  log('info', `Found ${meaningful.length} meaningful images out of ${images.length} total`);

  return meaningful;
}

/**
 * Process a single image: convert to base64, send to API, update alt
 * @param {HTMLImageElement} img - The image element
 * @returns {Promise<void>}
 */
async function processSingleImage(img) {
  try {
    // Check if already processed or in flight
    if (tracker.isProcessed(img)) {
      log('debug', 'Skipping already processed image', img.src.substring(0, 50));
      return;
    }

    if (tracker.isInFlight(img)) {
      log('debug', 'Skipping image already in flight', img.src.substring(0, 50));
      return;
    }

    // Mark as in-flight
    tracker.markInFlight(img);

    log('info', `Processing image: ${img.src.substring(0, 50)}`);

    // Convert to base64
    const base64 = await convertImageToBase64(img);

    // Check size limit
    if (!isWithinSizeLimit(base64, 5)) {
      log('warn', 'Image too large, skipping', img.src.substring(0, 50));
      tracker.clearInFlight(img);
      return;
    }

    // Send to API
    const description = await processImage(base64);

    // Update alt attribute
    img.alt = description;
    img.title = description; // Also set title for tooltip

    // Mark as processed
    tracker.markProcessed(img, description);

    log('info', `Successfully processed: ${description.substring(0, 50)}...`);

  } catch (error) {
    log('error', `Failed to process image:`, error.message);
    // Clear from in-flight on error
    tracker.clearInFlight(img);
    throw error;
  }
}

/**
 * Process multiple images
 * @param {HTMLImageElement[]} images - Array of image elements
 * @returns {Promise<void>}
 */
async function processImages(images) {
  if (images.length === 0) {
    log('info', 'No images to process');
    return;
  }

  log('info', `Starting to process ${images.length} images`);

  // Filter to meaningful images
  const meaningful = filterMeaningfulImages(images);

  if (meaningful.length === 0) {
    log('info', 'No meaningful images found');
    return;
  }

  // Process each image (queue will handle rate limiting)
  const promises = meaningful.map(img => {
    return processSingleImage(img).catch(error => {
      // Log but don't stop processing other images
      log('error', `Error processing image:`, error.message);
    });
  });

  await Promise.all(promises);

  log('info', `Finished processing batch`);
}

/**
 * Process all images on the current page
 * @returns {Promise<void>}
 */
async function processAllImages() {
  log('info', 'Starting to process all images on page');

  const images = findAllImages();
  await processImages(images);

  log('info', 'Completed processing all images');
}
