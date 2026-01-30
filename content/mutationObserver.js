/**
 * Mutation Observer - Monitors DOM changes to detect new images
 * Handles dynamic content, modals, and lazy-loaded images
 */

// Configuration
const DEBOUNCE_DELAY_MS = 1000;

function log(level, message, data) {
  imageAltLog('MutationObserver', level, message, data);
}

/**
 * Debounce function - delays execution until after calls have stopped
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Extract images from mutation records
 * @param {MutationRecord[]} mutations - Array of mutation records
 * @returns {HTMLImageElement[]} Array of new images
 */
function extractImagesFromMutations(mutations) {
  const newImages = [];
  const imageSet = new Set(); // Prevent duplicates

  mutations.forEach(mutation => {
    // Handle added nodes
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the node itself is an image
          if (node.tagName === 'IMG' && !imageSet.has(node)) {
            newImages.push(node);
            imageSet.add(node);
          }

          // Check for images within the added subtree
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(img => {
              if (!imageSet.has(img)) {
                newImages.push(img);
                imageSet.add(img);
              }
            });
          }
        }
      });
    }

    // Handle attribute changes (lazy loading)
    if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
      const img = mutation.target;

      if (mutation.attributeName === 'src' || mutation.attributeName === 'srcset') {
        // Check if image is now loaded
        if (img.src && img.complete && !imageSet.has(img)) {
          newImages.push(img);
          imageSet.add(img);
        }
      }
    }
  });

  return newImages;
}

/**
 * Check if mutation is in a modal/dialog
 * @param {MutationRecord} mutation - Mutation record
 * @returns {boolean} True if in modal
 */
function isInModal(mutation) {
  for (const node of mutation.addedNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Check if it's a modal element
      const role = node.getAttribute?.('role');
      const ariaModal = node.getAttribute?.('aria-modal');

      if (role === 'dialog' || ariaModal === 'true') {
        return true;
      }

      // Check if any parent is a modal
      const modalParent = node.closest?.('[role="dialog"], [aria-modal="true"]');
      if (modalParent) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Handle mutations
 * @param {MutationRecord[]} mutations - Array of mutation records
 */
function handleMutations(mutations) {
  log('debug', `Received ${mutations.length} mutations`);

  // Extract new images
  const newImages = extractImagesFromMutations(mutations);

  if (newImages.length === 0) {
    log('debug', 'No new images in mutations');
    return;
  }

  log('info', `Found ${newImages.length} new images from mutations`);

  // Check if any mutations are in modals
  const hasModal = mutations.some(isInModal);
  if (hasModal) {
    log('info', 'Detected modal opening/closing');
  }

  // Wait for images to load before processing
  const loadPromises = newImages.map(img => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        // Already loaded
        resolve(img);
      } else {
        // Wait for load
        img.addEventListener('load', () => resolve(img), { once: true });
        img.addEventListener('error', () => resolve(null), { once: true });

        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      }
    });
  });

  // Process images after they're loaded
  Promise.all(loadPromises).then(loadedImages => {
    const validImages = loadedImages.filter(img => img !== null);

    if (validImages.length > 0) {
      log('info', `Processing ${validImages.length} loaded images`);
      processImages(validImages);
    }
  });
}

/**
 * Create debounced mutation handler
 */
const debouncedHandler = debounce(handleMutations, DEBOUNCE_DELAY_MS);

/**
 * Initialize mutation observer
 */
function initializeMutationObserver() {
  log('info', 'Initializing MutationObserver');

  // Create observer
  const observer = new MutationObserver(debouncedHandler);

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });

  log('info', 'MutationObserver started');

  // Return observer for potential cleanup
  return observer;
}

/**
 * Intersection Observer for lazy-loaded images
 * Triggers processing when images enter viewport
 */
function initializeIntersectionObserver() {
  log('info', 'Initializing IntersectionObserver');

  const observer = new IntersectionObserver((entries) => {
    const visibleImages = entries
      .filter(entry => entry.isIntersecting)
      .map(entry => entry.target)
      .filter(img => img.tagName === 'IMG');

    if (visibleImages.length > 0) {
      log('info', `${visibleImages.length} images entered viewport`);

      // Wait a bit for images to load
      setTimeout(() => {
        processImages(visibleImages);
      }, 500);
    }
  }, {
    threshold: 0.1,
    rootMargin: '50px' // Start loading slightly before entering viewport
  });

  // Observe all current images
  document.querySelectorAll('img').forEach(img => {
    observer.observe(img);
  });

  // Also observe new images as they're added
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'IMG') {
            observer.observe(node);
          }
          node.querySelectorAll?.('img').forEach(img => {
            observer.observe(img);
          });
        }
      });
    });
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  log('info', 'IntersectionObserver started');

  return observer;
}

/**
 * Start all observers
 * @returns {object} Object containing observer references
 */
function startObservers() {
  const mutationObs = initializeMutationObserver();
  const intersectionObs = initializeIntersectionObserver();

  return {
    mutationObserver: mutationObs,
    intersectionObserver: intersectionObs
  };
}

/**
 * Stop all observers
 * @param {object} observers - Object containing observer references
 */
function stopObservers(observers) {
  if (observers.mutationObserver) {
    observers.mutationObserver.disconnect();
    log('info', 'MutationObserver stopped');
  }

  if (observers.intersectionObserver) {
    observers.intersectionObserver.disconnect();
    log('info', 'IntersectionObserver stopped');
  }
}
