/**
 * Global variables and utilities for the extension
 * This file must be loaded first!
 */

// Global debug flag
window.IMAGE_ALT_DEBUG = true;

// Global logging function
window.imageAltLog = function(module, level, message, data) {
  if (!window.IMAGE_ALT_DEBUG) return;
  console[level](`[ImageAlt:${module}] ${message}`, data || '');
};
