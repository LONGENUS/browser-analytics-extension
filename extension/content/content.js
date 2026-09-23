/* ========================================
   WebIntel — Content Script
   Extracts page metadata from the active tab
   ======================================== */

(() => {
  'use strict';

  // --- Message Handler ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_METADATA') {
      try {
        const metadata = extractPageMetadata();
        sendResponse({ success: true, data: metadata });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });

  // --- Metadata Extraction ---
  function extractPageMetadata() {
    return {
      // Basic info
      title: document.title || '',
      url: window.location.href,
      domain: window.location.hostname,
      pathname: window.location.pathname,

      // Meta tags
      meta: extractMetaTags(),

      // Open Graph
      openGraph: extractOpenGraph(),

      // Headings
      headings: extractHeadings(),

      // Links
      links: extractLinkStats(),

      // Images
      images: extractImageStats(),

      // Structured data
      jsonLd: extractJsonLd(),

      // Quick product detection (basic heuristic)
      hasProducts: detectProducts(),

      // Page stats
      stats: {
        wordCount: document.body?.innerText?.split(/\s+/).length || 0,
        charCount: document.body?.innerText?.length || 0
      }
    };
  }

  function extractMetaTags() {
    const meta = {};
    const title = document.querySelector('meta[name="title"]');
    const description = document.querySelector('meta[name="description"]');
    const keywords = document.querySelector('meta[name="keywords"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const robots = document.querySelector('meta[name="robots"]');

    if (title) meta.title = title.content;
    if (description) meta.description = description.content;
    if (keywords) meta.keywords = keywords.content;
    if (canonical) meta.canonical = canonical.href;
    if (robots) meta.robots = robots.content;

    return meta;
  }

  function extractOpenGraph() {
    const og = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(el => {
      const key = el.getAttribute('property').replace('og:', '');
      og[key] = el.content;
    });
    return og;
  }

  function extractHeadings() {
    const headings = {};
    for (let i = 1; i <= 6; i++) {
      const els = document.querySelectorAll(`h${i}`);
      headings[`h${i}`] = {
        count: els.length,
        texts: Array.from(els).slice(0, 5).map(el => el.textContent.trim().slice(0, 100))
      };
    }
    return headings;
  }

  function extractLinkStats() {
    const links = document.querySelectorAll('a[href]');
    const internal = [];
    const external = [];
    const currentHost = window.location.hostname;

    links.forEach(link => {
      try {
        const url = new URL(link.href);
        if (url.hostname === currentHost) {
          internal.push(link.href);
        } else {
          external.push(link.href);
        }
      } catch {}
    });

    return {
      total: links.length,
      internal: internal.length,
      external: external.length,
      uniqueExternal: [...new Set(external)].length
    };
  }

  function extractImageStats() {
    const images = document.querySelectorAll('img');
    let withAlt = 0;
    let withoutAlt = 0;

    images.forEach(img => {
      if (img.alt && img.alt.trim()) withAlt++;
      else withoutAlt++;
    });

    return {
      total: images.length,
      withAlt,
      withoutAlt,
      altCoverage: images.length ? Math.round((withAlt / images.length) * 100) : 0
    };
  }

  function extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const schemas = [];

    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        schemas.push({
          type: data['@type'] || 'Unknown',
          keys: Object.keys(data).slice(0, 10)
        });
      } catch {}
    });

    return {
      count: schemas.length,
      schemas
    };
  }

  function detectProducts() {
    // Heuristic: look for common product-related selectors
    const selectors = [
      '[data-component-type="s-search-result"]', // Amazon
      '.product-card', '.product-item', '.product-tile',
      '[data-product]', '[data-asin]',
      '._1AtVbE', // Flipkart
      '.s-result-item'
    ];

    for (const sel of selectors) {
      const count = document.querySelectorAll(sel).length;
      if (count > 0) return { detected: true, selector: sel, count };
    }

    return { detected: false };
  }
})();
