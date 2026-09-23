/* ========================================
   WebIntel — Background Service Worker
   ======================================== */

const API_BASE = 'http://localhost:8000';

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
  const response = await fetch(`${API_BASE}/analyze`, {
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
  const response = await fetch(`${API_BASE}/export/${format}`, {
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
  const response = await fetch(`${API_BASE}/history`, {
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

// --- Install Event ---
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('WebIntel installed successfully');
    // Initialize storage
    chrome.storage.local.set({
      history: [],
      cache: {},
      analysesCount: { count: 0, date: new Date().toDateString() },
      settings: {
        apiBase: API_BASE,
        currency: 'INR',
        maxHistory: 50
      }
    });
  }
});
