/* ========================================
   WebIntel — Background Service Worker
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
  if (message.type === 'ANALYZE_URL') {
    analyzeUrl(message.url, message.title)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'EXPORT') {
    exportData(message.format, message.data)
      .then(blob => sendResponse({ success: true, data: blob }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_HISTORY') {
    getHistory()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// --- API Calls ---
async function analyzeUrl(url, title) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server error (${response.status})`);
  }

  return response.json();
}

async function exportData(format, data) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }

  return response.blob();
}

async function getHistory() {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/history`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`History fetch failed (${response.status})`);
  }

  return response.json();
}

// --- Badge Updates ---
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

// --- Side Panel Behavior ---
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn('Could not set side panel behavior:', error));
}

