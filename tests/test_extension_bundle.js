/**
 * Chrome Extension Bundle & Manifest Verification Suite
 */

const fs = require('fs');
const path = require('path');

function verifyExtension() {
  console.log('Verifying Chrome Extension Side Panel Bundle...');

  const extDir = path.resolve(__dirname, '..', 'extension');

  // 1. Check Manifest
  const manifestPath = path.join(extDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json exists');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert(manifest.manifest_version === 3, 'Manifest is version 3');
  assert(manifest.permissions.includes('sidePanel'), 'Permissions include sidePanel');
  assert(manifest.side_panel && manifest.side_panel.default_path === 'sidepanel.html', 'side_panel config points to sidepanel.html');
  console.log('[OK] manifest.json configuration verified');

  // 2. Check Sidepanel HTML
  const sidepanelPath = path.join(extDir, 'sidepanel.html');
  assert(fs.existsSync(sidepanelPath), 'sidepanel.html exists');
  const sidepanelHtml = fs.readFileSync(sidepanelPath, 'utf8');
  assert(sidepanelHtml.includes('dist/assets/index.js'), 'sidepanel.html references compiled JS bundle');
  assert(sidepanelHtml.includes('dist/assets/index.css'), 'sidepanel.html references compiled CSS bundle');
  console.log('[OK] sidepanel.html verified');

  // 3. Check Compiled Assets
  const jsBundlePath = path.join(extDir, 'dist', 'assets', 'index.js');
  const cssBundlePath = path.join(extDir, 'dist', 'assets', 'index.css');
  assert(fs.existsSync(jsBundlePath), 'dist/assets/index.js exists');
  assert(fs.existsSync(cssBundlePath), 'dist/assets/index.css exists');

  const jsSize = fs.statSync(jsBundlePath).size;
  const cssSize = fs.statSync(cssBundlePath).size;
  console.log(`[OK] Compiled bundle assets: JS (${(jsSize / 1024).toFixed(1)} KB), CSS (${(cssSize / 1024).toFixed(1)} KB)`);

  console.log('\nALL CHROME EXTENSION UI BUNDLE CHECKS PASSED!');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
}

verifyExtension();
