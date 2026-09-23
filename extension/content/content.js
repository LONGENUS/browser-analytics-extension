/* ========================================
   WebIntel — Content Script
   Extracts comprehensive live DOM intelligence from the active tab:
   - Live Metadata & Open Graph
   - Live Headings Hierarchy & Links
   - Live Images with ALT audit
   - Live E-Commerce Product Listings
   - Live Technology Stack Signatures
   - Live Client-Side SEO Score
   ======================================== */

(() => {
  'use strict';

  // Listen for extraction requests from side panel or background worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_METADATA' || message.type === 'EXTRACT_PAGE_DATA') {
      try {
        const fullData = extractLivePageData();
        sendResponse({ success: true, data: fullData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true; // Keep channel open
  });

  function extractLivePageData() {
    const url = window.location.href;
    const domain = window.location.hostname.replace(/^www\./, '');
    const meta = extractMetaTags();
    const headings = extractHeadings();
    const images = extractImageStats();
    const links = extractLinkStats();
    const products = extractProducts(domain, url);
    const technologies = detectTechnologies();
    const seoScore = computeSeoScore(meta, headings, images, links);

    return {
      url,
      domain,
      title: document.title || meta.title || domain,
      pathname: window.location.pathname,
      favicon: getFaviconUrl(),
      meta,
      openGraph: extractOpenGraph(),
      headings,
      images,
      links,
      products,
      technologies,
      seo_score: seoScore,
      stats: {
        wordCount: document.body?.innerText?.split(/\s+/).filter(Boolean).length || 0,
        charCount: document.body?.innerText?.length || 0,
      },
    };
  }

  function getFaviconUrl() {
    const link = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
    if (link && link.href) return link.href;
    return `https://${window.location.hostname}/favicon.ico`;
  }

  function extractMetaTags() {
    const meta = {};
    const titleTag = document.querySelector('meta[name="title"], meta[property="og:title"]');
    const descTag = document.querySelector('meta[name="description"], meta[property="og:description"]');
    const keywordsTag = document.querySelector('meta[name="keywords"]');
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const robotsTag = document.querySelector('meta[name="robots"]');
    const viewportTag = document.querySelector('meta[name="viewport"]');

    meta.title = (titleTag && titleTag.content) || document.title || '';
    meta.title_length = meta.title.length;
    meta.description = (descTag && descTag.content) || '';
    meta.description_length = meta.description.length;
    meta.keywords = (keywordsTag && keywordsTag.content) || '';
    meta.canonical = (canonicalTag && canonicalTag.href) || window.location.href;
    meta.robots = (robotsTag && robotsTag.content) || 'index, follow';
    meta.has_viewport = Boolean(viewportTag);

    return meta;
  }

  function extractOpenGraph() {
    const og = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
      const prop = el.getAttribute('property');
      if (prop) {
        const key = prop.replace('og:', '');
        og[key] = el.getAttribute('content') || '';
      }
    });
    return og;
  }

  function extractHeadings() {
    const all = [];
    let h1_count = 0;
    let h2_count = 0;
    let h3_count = 0;

    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '';
      if (!text) return;

      if (tag === 'h1') h1_count++;
      else if (tag === 'h2') h2_count++;
      else if (tag === 'h3') h3_count++;

      if (all.length < 25) {
        all.push({ level: tag, text: text.slice(0, 120) });
      }
    });

    return {
      h1_count,
      h2_count,
      h3_count,
      all_headings: all,
    };
  }

  function extractImageStats() {
    const images = Array.from(document.querySelectorAll('img'));
    let withAlt = 0;
    let withoutAlt = 0;
    const formatBreakdown = {};

    images.forEach((img) => {
      if (img.alt && img.alt.trim()) withAlt++;
      else withoutAlt++;

      const src = img.src || img.getAttribute('data-src') || '';
      const extMatch = src.match(/\.(jpe?g|png|webp|gif|svg|avif)(?:[?#]|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'other';
      formatBreakdown[ext] = (formatBreakdown[ext] || 0) + 1;
    });

    return {
      total_images: images.length,
      missing_alt_count: withoutAlt,
      alt_coverage_percent: images.length ? Math.round((withAlt / images.length) * 100) : 100,
      format_breakdown: formatBreakdown,
    };
  }

  function extractLinkStats() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    let internal = 0;
    let external = 0;
    let nofollow = 0;
    const currentHost = window.location.hostname;

    links.forEach((link) => {
      try {
        const url = new URL(link.href, window.location.href);
        if (url.hostname === currentHost || !url.hostname) {
          internal++;
        } else {
          external++;
        }
        if (link.rel && link.rel.includes('nofollow')) {
          nofollow++;
        }
      } catch (_) {}
    });

    return {
      total_links: links.length,
      internal_links_count: internal,
      external_links_count: external,
      nofollow_count: nofollow,
    };
  }

  function extractProducts(domain, currentUrl) {
    const products = [];

    // 1. Amazon Search Results or Category Grid
    if (domain.includes('amazon')) {
      const items = document.querySelectorAll(
        'div[data-component-type="s-search-result"], div.s-result-item[data-asin]:not([data-asin=""])'
      );

      items.forEach((el, index) => {
        if (products.length >= 30) return;
        const asin = el.getAttribute('data-asin') || '';
        if (!asin) return;

        const titleEl = el.querySelector('h2 a span, h2 span, [data-cy="title-recipe"] h2, h2 a');
        const title = titleEl ? titleEl.textContent.trim() : '';
        if (!title) return;

        // Price extraction
        let price = null;
        const priceEl = el.querySelector('.a-price .a-offscreen, span.a-price-whole');
        if (priceEl) {
          const match = priceEl.textContent.replace(/,/g, '').match(/[\d.]+/);
          if (match) price = parseFloat(match[0]);
        }

        // Original price
        let originalPrice = null;
        const strikeEl = el.querySelector('.a-price[data-a-strike] .a-offscreen, .a-text-price .a-offscreen');
        if (strikeEl) {
          const match = strikeEl.textContent.replace(/,/g, '').match(/[\d.]+/);
          if (match) originalPrice = parseFloat(match[0]);
        }

        const discount = originalPrice && price && originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

        // Rating
        let rating = null;
        const ratingEl = el.querySelector('i.a-icon-star-small span, span[aria-label*="stars"], [aria-label*="out of 5 stars"]');
        if (ratingEl) {
          const match = ratingEl.textContent.match(/[\d.]+/);
          if (match) rating = parseFloat(match[0]);
        }

        // Reviews
        let reviews = 0;
        const revEl = el.querySelector('a[href*="#customerReviews"] span, span[aria-label*="ratings"]');
        if (revEl) {
          const match = revEl.textContent.replace(/,/g, '').match(/\d+/);
          if (match) reviews = parseInt(match[0], 10);
        }

        // Brand heuristic
        const brandEl = el.querySelector('h5, span.a-size-base-plus, [data-cy="title-recipe"] .a-color-base');
        let brand = brandEl ? brandEl.textContent.trim() : '';
        if (!brand) {
          brand = title.split(' ')[0] || 'Generic';
        }

        const imgEl = el.querySelector('img.s-image, img');
        const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

        const linkEl = el.querySelector('h2 a');
        const prodUrl = linkEl ? linkEl.href : `https://${domain}/dp/${asin}`;

        const isPrime = Boolean(el.querySelector('i.a-icon-prime, span[aria-label*="Prime"]'));

        products.push({
          position: index + 1,
          product_name: title,
          brand,
          price,
          original_price: originalPrice,
          discount_percent: discount,
          rating,
          review_count: reviews,
          asin_sku: asin,
          availability: 'In Stock',
          prime_shipping: isPrime ? 'Prime Eligible' : 'Standard Shipping',
          image_url: imgUrl,
          product_url: prodUrl,
        });
      });

      // Amazon Product Detail Page (single product)
      if (products.length === 0 && (currentUrl.includes('/dp/') || currentUrl.includes('/gp/product/'))) {
        const titleEl = document.getElementById('productTitle');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('#corePrice_feature_div .a-price .a-offscreen, #priceblock_ourprice, .priceToPay .a-offscreen');
          if (priceEl) {
            const match = priceEl.textContent.replace(/,/g, '').match(/[\d.]+/);
            if (match) price = parseFloat(match[0]);
          }

          const asinInput = document.querySelector('input#ASIN, input[name="ASIN"]');
          const asin = asinInput ? asinInput.value : (currentUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || '');

          const imgEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
          const imgUrl = imgEl ? imgEl.src : '';

          let brand = document.getElementById('bylineInfo')?.textContent?.trim() || title.split(' ')[0];
          brand = brand.replace(/^(Brand:|Visit the)\s*/i, '').replace(/\s*Store$/i, '');

          let rating = null;
          const ratingEl = document.querySelector('#acrPopover');
          if (ratingEl) {
            const match = ratingEl.title.match(/[\d.]+/);
            if (match) rating = parseFloat(match[0]);
          }

          let reviews = 0;
          const revEl = document.getElementById('acrCustomerReviewText');
          if (revEl) {
            const match = revEl.textContent.replace(/,/g, '').match(/\d+/);
            if (match) reviews = parseInt(match[0], 10);
          }

          products.push({
            position: 1,
            product_name: title,
            brand,
            price,
            original_price: null,
            discount_percent: 0,
            rating,
            review_count: reviews,
            asin_sku: asin,
            availability: 'In Stock',
            prime_shipping: 'Prime Eligible',
            image_url: imgUrl,
            product_url: currentUrl,
          });
        }
      }
    }

    // 2. Generic Store Card Matcher (Shopify, WooCommerce, Nike, etc.)
    if (products.length === 0) {
      const cardSelectors = [
        '.product-card',
        '.product-item',
        '.product-tile',
        'div[data-product-id]',
        'article[class*="product"]',
        'li[class*="product"]',
      ];

      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) {
          cards.forEach((card, idx) => {
            if (products.length >= 25) return;
            const titleEl = card.querySelector('h2, h3, .product-title, [class*="title"], [class*="name"]');
            const title = titleEl ? titleEl.textContent.trim() : '';
            if (!title) return;

            let price = null;
            const priceEl = card.querySelector('.price, [class*="price"]');
            if (priceEl) {
              const match = priceEl.textContent.replace(/,/g, '').match(/[\d.]+/);
              if (match) price = parseFloat(match[0]);
            }

            const imgEl = card.querySelector('img');
            const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

            const linkEl = card.querySelector('a[href]');
            const prodUrl = linkEl ? linkEl.href : currentUrl;

            products.push({
              position: idx + 1,
              product_name: title,
              brand: title.split(' ')[0] || domain,
              price,
              original_price: null,
              discount_percent: 0,
              rating: 4.5,
              review_count: 0,
              asin_sku: `SKU-${idx + 1}`,
              availability: 'In Stock',
              prime_shipping: 'Standard',
              image_url: imgUrl,
              product_url: prodUrl,
            });
          });
          break;
        }
      }
    }

    return products;
  }

  function detectTechnologies() {
    const list = [];
    const html = document.documentElement.outerHTML || '';

    // CMS / Site Generator
    const generatorTag = document.querySelector('meta[name="generator"]');
    const generator = (generatorTag && generatorTag.content) ? generatorTag.content.toLowerCase() : '';

    if (generator.includes('wordpress') || html.includes('wp-content')) {
      list.push({ name: 'WordPress', category: 'CMS', confidence: 0.95 });
    }
    if (generator.includes('shopify') || (window as any).Shopify || html.includes('cdn.shopify.com')) {
      list.push({ name: 'Shopify', category: 'CMS', confidence: 0.98 });
    }
    if (generator.includes('webflow') || html.includes('webflow.com')) {
      list.push({ name: 'Webflow', category: 'CMS', confidence: 0.95 });
    }
    if (generator.includes('squarespace')) {
      list.push({ name: 'Squarespace', category: 'CMS', confidence: 0.95 });
    }

    // Frontend Frameworks
    if (document.querySelector('[data-reactroot], [data-reactid]') || (window as any).React || html.includes('react.production.min.js')) {
      list.push({ name: 'React', category: 'Frontend Framework', confidence: 0.95 });
    }
    if (document.querySelector('#__next') || (window as any).__NEXT_DATA__) {
      list.push({ name: 'Next.js', category: 'Frontend Framework', confidence: 0.98 });
    }
    if (document.querySelector('[data-v-app], [data-vue]') || (window as any).Vue) {
      list.push({ name: 'Vue.js', category: 'Frontend Framework', confidence: 0.92 });
    }

    // CSS & UI
    if (Array.from(document.querySelectorAll('*')).some((el) => typeof el.className === 'string' && /(flex|grid|p-\d|m-\d|text-\w+-\d+)/.test(el.className))) {
      list.push({ name: 'TailwindCSS', category: 'UI Libraries', confidence: 0.9 });
    }
    if (document.querySelector('link[href*="bootstrap"], script[src*="bootstrap"]')) {
      list.push({ name: 'Bootstrap', category: 'UI Libraries', confidence: 0.92 });
    }

    // Analytics & Tags
    if (document.querySelector('script[src*="google-analytics.com"], script[src*="gtag/js"]')) {
      list.push({ name: 'Google Analytics 4', category: 'Analytics', confidence: 0.95 });
    }
    if (document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
      list.push({ name: 'Google Tag Manager', category: 'Tag Manager', confidence: 0.96 });
    }

    // Payments
    if (document.querySelector('script[src*="stripe.com"]')) {
      list.push({ name: 'Stripe', category: 'Payment', confidence: 0.95 });
    }

    // CDN / Infrastructure
    if (html.includes('cloudflare') || document.querySelector('script[src*="cloudflare"]')) {
      list.push({ name: 'Cloudflare', category: 'CDN', confidence: 0.88 });
    }
    if (document.querySelector('script[src*="amazon-adsystem.com"]') || html.includes('amazon-adsystem')) {
      list.push({ name: 'Amazon Advertising', category: 'Advertising', confidence: 0.92 });
    }

    return list;
  }

  function computeSeoScore(meta, headings, images, links) {
    let score = 50;
    const recommendations = [];

    // Title Check
    if (meta.title && meta.title.length >= 30 && meta.title.length <= 70) {
      score += 12;
    } else if (meta.title) {
      score += 6;
      recommendations.push('Optimize page title length (ideal is 40–60 characters).');
    } else {
      score -= 15;
      recommendations.push('Add a descriptive <title> tag to the page.');
    }

    // Description Check
    if (meta.description && meta.description.length >= 100 && meta.description.length <= 165) {
      score += 15;
    } else if (meta.description) {
      score += 8;
      recommendations.push('Refine meta description length (ideal is 120–160 characters).');
    } else {
      score -= 10;
      recommendations.push('Add a meta description tag to improve SERP click-through rate.');
    }

    // Canonical
    if (meta.canonical) {
      score += 8;
    } else {
      recommendations.push('Specify a canonical URL link tag to avoid duplicate content indexing.');
    }

    // Headings
    if (headings.h1_count === 1) {
      score += 10;
    } else if (headings.h1_count > 1) {
      score += 4;
      recommendations.push(`Page has ${headings.h1_count} H1 tags. Best practice is exactly 1 per page.`);
    } else {
      recommendations.push('Add an H1 heading representing the primary topic of this page.');
    }

    // Images
    if (images.alt_coverage_percent >= 85) {
      score += 10;
    } else {
      recommendations.push(`${images.missing_alt_count} images are missing ALT attributes. Add descriptive alt text.`);
    }

    // Links
    if (links.internal_links_count > 5) {
      score += 5;
    }

    score = Math.max(10, Math.min(100, score));
    const rating = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

    return {
      score,
      rating,
      recommendations,
    };
  }
})();
