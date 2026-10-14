/* ========================================
   TailorResume — Background Service Worker
   ======================================== */

try {
  importScripts('../config.js');
} catch (e) {
  console.warn('Could not import config.js into service worker context:', e);
}

async function getApiBase() {
  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.getBaseUrl) {
    try {
      return await APP_CONFIG.getBaseUrl();
    } catch (_) {}
  }
  return (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.API_BASE_URL : 'http://localhost:8000');
}

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ success: true, message: 'TailorResume service worker active' });
    return false;
  }

  if (message.type === 'GET_CONFIG') {
    getApiBase()
      .then(apiBase => sendResponse({ success: true, apiBase }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

// --- Side Panel Behavior ---
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn('Could not set side panel behavior:', error));
}

// Fallback action click handler to open side panel
if (typeof chrome !== 'undefined' && chrome.action && chrome.sidePanel && chrome.sidePanel.open) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (e) {
      console.warn('Could not open side panel on action click:', e);
    }
  });
}
