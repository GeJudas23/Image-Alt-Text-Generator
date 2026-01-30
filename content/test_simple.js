// Simple test script
console.log('[TEST] Simple test script loaded!');

// Create global marker
window.extensionLoaded = true;

// Test alert
setTimeout(() => {
    console.log('[TEST] Extension is working!');
    console.log('[TEST] Location:', window.location.href);
}, 1000);
