/**
 * API Client - Handles communication with the image analysis API
 * Includes retry logic, rate limiting, and queue management
 */

// Configuration
const API_ENDPOINT = 'http://localhost:8000/analyze';
const MAX_CONCURRENT_REQUESTS = 3;
const BATCH_DELAY_MS = 500;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30000;

function log(level, message, data) {
  imageAltLog('APIClient', level, message, data);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Queue manager for controlling concurrent requests
 */
class RequestQueue {
  constructor(concurrency = MAX_CONCURRENT_REQUESTS, delayMs = BATCH_DELAY_MS) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.queue = [];
    this.active = 0;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0
    };
  }

  /**
   * Add a task to the queue
   * @param {Function} task - Async function to execute
   * @returns {Promise} Result of the task
   */
  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.stats.total++;
      this.process();
    });
  }

  /**
   * Process the queue
   */
  async process() {
    if (this.active >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.active++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      this.stats.success++;
      resolve(result);
    } catch (error) {
      this.stats.failed++;
      reject(error);
    } finally {
      this.active--;

      // Delay before processing next batch
      if (this.queue.length > 0) {
        await sleep(this.delayMs);
      }

      this.process();
    }
  }

  /**
   * Get queue statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      queued: this.queue.length,
      active: this.active
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    log('warn', 'Queue cleared');
  }
}

// Create global queue instance
const requestQueue = new RequestQueue();

/**
 * Send image to API with timeout
 * @param {FormData} formData - Form data with image
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<object>} API response
 */
async function sendWithTimeout(formData, timeout = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || typeof data.description !== 'string') {
      throw new Error('Invalid API response format');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }

    throw error;
  }
}

/**
 * Send image to API with retry logic
 * @param {string} base64 - Base64 encoded image
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<string>} Description from API
 */
async function sendImageToAPI(base64, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('debug', `API request attempt ${attempt}/${maxRetries}`);

      // Convert base64 to blob
      const blob = base64ToBlob(base64);

      // Create FormData
      const formData = new FormData();
      formData.append('image', blob, 'image.jpg');

      // Send request with timeout
      const data = await sendWithTimeout(formData);

      log('info', `API success: ${data.description.substring(0, 50)}...`);
      return data.description;

    } catch (error) {
      lastError = error;
      log('warn', `API attempt ${attempt} failed:`, error.message);

      // Don't retry on certain errors
      if (error.message.includes('400') || error.message.includes('Invalid')) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        log('debug', `Waiting ${waitTime}ms before retry`);
        await sleep(waitTime);
      }
    }
  }

  // All retries failed
  throw new Error(`API failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Process an image through the API (queued)
 * @param {string} base64 - Base64 encoded image
 * @returns {Promise<string>} Description from API
 */
async function processImage(base64) {
  return requestQueue.add(() => sendImageToAPI(base64));
}

/**
 * Get API client statistics
 * @returns {object} Statistics
 */
function getAPIStats() {
  return requestQueue.getStats();
}

/**
 * Clear the request queue
 */
function clearQueue() {
  requestQueue.clear();
}

// For debugging in console
if (window.IMAGE_ALT_DEBUG) {
  window.imageAltAPI = {
    getStats: getAPIStats,
    clearQueue: clearQueue
  };
}
