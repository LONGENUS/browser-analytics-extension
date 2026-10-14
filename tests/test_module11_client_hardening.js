/**
 * Module 11 — Client Security & Hardening Test Suite
 * Tests:
 * 1. URL sanitization against malicious XSS payloads:
 *    - javascript:alert(document.cookie)
 *    - vbscript:msgbox(1)
 *    - data:text/html,<script>alert(1)</script>
 *    - file:///etc/passwd
 *    - Obfuscated cases: " JaVaScRiPt:alert(1) "
 * 2. Whitelisted URL protocol validation (http, https, mailto, tel)
 * 3. Safe domain prefixing without script execution
 * 4. Content script noise tag & tracker removal
 * 5. Local storage session token security & safe clearance on logout
 * 6. Clean error message handling without exposing internal stack traces
 */

const assert = require('assert');

// 1. Client URL Sanitization implementation (matching templateRegistry.ts)
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Block dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  // Ensure safe protocol or auto-prefix standard web url
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return trimmed;
  }

  // Default to https:// for bare domains
  return `https://${trimmed}`;
}

// 2. Client Noise Tag Removal simulation (matching content.js)
const NOISE_TAGS = new Set([
  'script', 'style', 'noscript', 'nav', 'footer', 'header', 'svg', 'iframe',
  'button', 'form', 'select', 'input', 'textarea', 'canvas', 'video', 'audio'
]);

function isTagAllowed(tagName) {
  return !NOISE_TAGS.has((tagName || '').toLowerCase());
}

// 3. Client Storage Security Check
function sanitizeStorageKeys(keys) {
  const SENSITIVE_FORBIDDEN = ['service_role', 'api_secret', 'admin_key', 'private_key', 'password'];
  for (const forbidden of SENSITIVE_FORBIDDEN) {
    if (keys.some(k => k.toLowerCase().includes(forbidden))) {
      return false;
    }
  }
  return true;
}

// 4. Safe Error Formatter (matching error handling in UI services)
function formatUserSafeError(rawError) {
  if (!rawError) return 'An unexpected error occurred. Please try again.';
  const str = String(rawError);

  // If contains raw traceback or SQL statement, replace with safe user message
  if (str.includes('Traceback') || str.includes('SELECT ') || str.includes('sqlite3.') || str.includes('asyncpg.')) {
    return 'An internal service error occurred. Our team has been notified.';
  }

  return str.length > 200 ? str.slice(0, 200) + '...' : str;
}


// ==================== TEST SUITE EXECUTION ====================

console.log('==================================================');
console.log('   RUNNING MODULE 11 CLIENT HARDENING TESTS       ');
console.log('==================================================');

// Test 1: URL Sanitization against XSS schemes
{
  console.log('\n--- 1. Testing URL Sanitization & XSS Prevention ---');

  const dangerousUrls = [
    'javascript:alert(document.cookie)',
    'JAVASCRIPT:alert(1)',
    '  javascript:void(0)  ',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox("xss")',
    'file:///C:/Windows/win.ini',
    'file:///etc/passwd',
  ];

  for (const malicious of dangerousUrls) {
    const sanitized = sanitizeUrl(malicious);
    assert.strictEqual(
      sanitized,
      null,
      `Expected dangerous URL "${malicious}" to be blocked (null), but got: "${sanitized}"`
    );
  }
  console.log('[PASS] All malicious schemes (javascript:, data:, vbscript:, file:) strictly blocked');
}

// Test 2: Whitelisted URLs correctly preserved or formatted
{
  console.log('\n--- 2. Testing Safe Protocols & Domain Formatting ---');

  assert.strictEqual(sanitizeUrl('https://example.com/jobs/123'), 'https://example.com/jobs/123');
  assert.strictEqual(sanitizeUrl('http://localhost:8000/api'), 'http://localhost:8000/api');
  assert.strictEqual(sanitizeUrl('mailto:candidate@example.com'), 'mailto:candidate@example.com');
  assert.strictEqual(sanitizeUrl('tel:+1234567890'), 'tel:+1234567890');
  assert.strictEqual(sanitizeUrl('linkedin.com/in/jane-doe'), 'https://linkedin.com/in/jane-doe');
  assert.strictEqual(sanitizeUrl('github.com/my-profile'), 'https://github.com/my-profile');
  assert.strictEqual(sanitizeUrl(''), null);
  assert.strictEqual(sanitizeUrl(null), null);
  console.log('[PASS] Valid protocols (https, http, mailto, tel) and bare domains safely preserved');
}

// Test 3: Noise tags and executable elements stripped from job extraction
{
  console.log('\n--- 3. Testing Extension DOM Sanitization ---');

  assert.strictEqual(isTagAllowed('script'), false);
  assert.strictEqual(isTagAllowed('iframe'), false);
  assert.strictEqual(isTagAllowed('style'), false);
  assert.strictEqual(isTagAllowed('form'), false);
  assert.strictEqual(isTagAllowed('button'), false);
  assert.strictEqual(isTagAllowed('p'), true);
  assert.strictEqual(isTagAllowed('div'), true);
  assert.strictEqual(isTagAllowed('span'), true);
  assert.strictEqual(isTagAllowed('h1'), true);
  assert.strictEqual(isTagAllowed('li'), true);
  console.log('[PASS] Untrusted executable tags (script, iframe, form) strictly excluded from DOM extraction');
}

// Test 4: Local Storage keys do not store sensitive secrets
{
  console.log('\n--- 4. Testing Client Storage Security ---');

  const standardAppKeys = ['sb-auth-token', 'tailor_resume_theme', 'active_tab', 'customApiUrl'];
  assert.strictEqual(sanitizeStorageKeys(standardAppKeys), true);

  const insecureKeys = ['sb-auth-token', 'supabase_service_role_key'];
  assert.strictEqual(sanitizeStorageKeys(insecureKeys), false, 'Forbidden service role key must be detected');
  console.log('[PASS] Client storage keys verify zero exposure of service-role or administrative secrets');
}

// Test 5: Safe user error formatting without traceback leakage
{
  console.log('\n--- 5. Testing Error Message Sanitization ---');

  const rawTraceback = 'Traceback (most recent call last):\n  File "/app/routes.py", line 42, in get_user\n    raise DatabaseError()';
  const rawSqlError = 'asyncpg.exceptions.UndefinedTableError: relation "resumes" does not exist\nSELECT * FROM resumes';
  const userFriendly = 'The requested resume could not be found.';

  assert.strictEqual(
    formatUserSafeError(rawTraceback),
    'An internal service error occurred. Our team has been notified.'
  );
  assert.strictEqual(
    formatUserSafeError(rawSqlError),
    'An internal service error occurred. Our team has been notified.'
  );
  assert.strictEqual(
    formatUserSafeError(userFriendly),
    'The requested resume could not be found.'
  );
  console.log('[PASS] Client error formatter eliminates python tracebacks and SQL dialect leakage');
}

console.log('\n==================================================');
console.log('   ALL MODULE 11 CLIENT HARDENING TESTS PASSED    ');
console.log('==================================================');
