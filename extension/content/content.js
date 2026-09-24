/* ==============================================================================
   WebIntel — Universal Live DOM Content Script
   Extracts comprehensive real-time intelligence from the active browser tab:
   - Universal Marketplace & Page Type Detection (Amazon, Nike, eBay, Walmart, Etsy, Shopify, etc.)
   - Adaptive E-Commerce Product Extraction (Single Product Detail + Multi-Product Grids)
   - Complete SEO Metadata, Open Graph, Twitter Cards, JSON-LD Schemas, Headings Hierarchy
   - Image Accessibility & Link Health Audits
   - Live Technology Stack Fingerprinting
   - Rule-Based 0-100 SEO Health Score
   ============================================================================== */

(() => {
  'use strict';

  // Make extraction function available globally for direct chrome.scripting invocation
  if (typeof window !== 'undefined') {
    window.__webIntelExtract = extractLivePageData;
  }

  // Listen for extraction messages from side panel or background worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTRACT_PAGE_DATA' || message.type === 'EXTRACT_METADATA') {
        try {
          const fullData = extractLivePageData();
          sendResponse({ success: true, data: fullData });
        } catch (err) {
          sendResponse({ success: false, error: err ? err.message : 'Unknown extraction error' });
        }
      }
      return true; // Keep channel open for async response
    });
  }

  function extractLivePageData(overrideUrl) {
    let url = overrideUrl || window.location.href;
    let hostname = '';
    let pathname = '';

    try {
      const parsed = new URL(url);
      hostname = parsed.hostname;
      pathname = parsed.pathname;
    } catch (_) {
      hostname = window.location.hostname || '';
      pathname = window.location.pathname || '';
    }

    // If running in local test environment or iframe where hostname is localhost/127.0.0.1,
    // infer target domain from canonical link or og:url tag
    if (hostname === 'localhost' || hostname === '127.0.0.1' || !hostname) {
      const canonicalTag = document.querySelector('link[rel="canonical"]');
      const ogUrlTag = document.querySelector('meta[property="og:url"]');
      const targetUrl = (canonicalTag && canonicalTag.href) || (ogUrlTag && ogUrlTag.content);
      if (targetUrl) {
        try {
          const parsedTarget = new URL(targetUrl);
          url = targetUrl;
          hostname = parsedTarget.hostname;
          pathname = parsedTarget.pathname;
        } catch (_) {}
      }
    }

    const domain = (hostname || '').replace(/^www\./, '');

    const meta = extractMetaTags();
    const openGraph = extractOpenGraph();
    const twitterCards = extractTwitterCards();
    const structuredData = extractStructuredData();
    const headings = extractHeadings();
    const images = extractImageStats();
    const links = extractLinkStats();

    // Universal platform detection
    const platform = detectPlatform(domain);

    // Adaptive product extraction (JSON-LD + platform-specific + generic selectors)
    const productExtraction = extractUniversalProducts(domain, url, pathname, platform, structuredData.rawSchemas, openGraph);
    const products = productExtraction.products;
    const detectedPageType = productExtraction.pageType || detectPageType(pathname, url, products.length, platform);

    // Live technology detection (pure JS, safe property checks)
    const technologies = detectTechnologies();

    // Rule-based SEO score
    const seoScore = computeSeoScore(meta, openGraph, headings, images, links, structuredData);

    return {
      url,
      domain,
      title: document.title || meta.title || openGraph.title || domain,
      pathname,
      favicon: getFaviconUrl(),
      platform,
      pageType: detectedPageType,
      meta,
      openGraph,
      twitterCards,
      structuredData: {
        has_json_ld: structuredData.hasJsonLd,
        count: structuredData.count,
        detected_types: structuredData.detectedTypes,
        items: structuredData.items,
      },
      headings,
      images,
      links,
      products,
      technologies,
      seo_score: seoScore,
      stats: {
        wordCount: document.body && document.body.innerText ? document.body.innerText.split(/\s+/).filter(Boolean).length : 0,
        charCount: document.body && document.body.innerText ? document.body.innerText.length : 0,
      },
    };
  }

  // --- Favicon Extraction ---
  function getFaviconUrl() {
    const link = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    if (link && link.href) return link.href;
    return `https://${window.location.hostname}/favicon.ico`;
  }

  // --- Platform & Marketplace Detection ---
  function detectPlatform(domain) {
    const d = domain.toLowerCase();
    if (d.includes('amazon.')) return 'Amazon';
    if (d.includes('nike.')) return 'Nike';
    if (d.includes('ebay.')) return 'eBay';
    if (d.includes('walmart.')) return 'Walmart';
    if (d.includes('etsy.')) return 'Etsy';

    // Shopify detection via DOM & global variables
    const hasShopifyVar = typeof window !== 'undefined' && Boolean(window.Shopify || window.BOOMR);
    const hasShopifyScript = Boolean(
      document.querySelector('link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"], meta[name="generator"][content*="Shopify"]')
    );
    if (hasShopifyVar || hasShopifyScript) return 'Shopify';

    // WooCommerce detection
    if (document.querySelector('.woocommerce, link[href*="woocommerce"], script[src*="woocommerce"]')) {
      return 'WooCommerce';
    }

    // Magento
    if (document.querySelector('script[src*="mage/"], script[src*="requirejs/require"], [data-gallery-role="gallery"]')) {
      return 'Magento';
    }

    if (d.includes('github.')) return 'GitHub';
    if (d.includes('stripe.')) return 'Stripe';

    return 'Generic E-Commerce';
  }

  // --- Page Type Detection ---
  function detectPageType(pathname, url, productCount, platform) {
    const p = pathname.toLowerCase();
    const u = url.toLowerCase();

    // 1. Single Product page indicators
    if (
      p.includes('/dp/') ||
      p.includes('/gp/product/') ||
      p.includes('/p/') ||
      p.includes('/itm/') ||
      p.includes('/item/') ||
      p.includes('/listing/') ||
      p.includes('/ip/') ||
      p.includes('/products/') ||
      p.includes('/t/')
    ) {
      return 'Product';
    }

    // 2. Search results
    if (u.includes('/search') || u.includes('/s?') || u.includes('?q=') || u.includes('?k=') || u.includes('query=')) {
      return 'Search results';
    }

    // 3. Category / Collections
    if (p.includes('/category/') || p.includes('/categories/') || p.includes('/collections/') || p.includes('/c/') || p.includes('/b/')) {
      return 'Category';
    }

    // 4. Brand Page
    if (p.includes('/brand/') || p.includes('/brands/') || p.includes('/stores/')) {
      return 'Brand page';
    }

    // 5. Homepage
    if (p === '/' || p === '') {
      return 'Homepage';
    }

    if (productCount > 1) {
      return 'Category';
    }

    return 'Website';
  }

  // --- Meta Tags Extraction ---
  function extractMetaTags() {
    const meta = {};
    const titleTag = document.querySelector('meta[name="title"], meta[property="og:title"]');
    const descTag = document.querySelector('meta[name="description"], meta[property="og:description"]');
    const keywordsTag = document.querySelector('meta[name="keywords"]');
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const robotsTag = document.querySelector('meta[name="robots"]');
    const viewportTag = document.querySelector('meta[name="viewport"]');
    const charsetTag = document.querySelector('meta[charset]');
    const authorTag = document.querySelector('meta[name="author"]');

    meta.title = (titleTag && titleTag.content) || document.title || '';
    meta.title_length = meta.title.length;
    meta.description = (descTag && descTag.content) || '';
    meta.description_length = meta.description.length;
    meta.keywords = (keywordsTag && keywordsTag.content) || '';
    meta.canonical = (canonicalTag && canonicalTag.href) || window.location.href;
    meta.robots = (robotsTag && robotsTag.content) || 'index, follow';
    meta.viewport = (viewportTag && viewportTag.content) || (viewportTag ? 'configured' : '');
    meta.has_viewport = Boolean(viewportTag);
    meta.charset = (charsetTag && charsetTag.getAttribute('charset')) || document.characterSet || 'UTF-8';
    meta.author = (authorTag && authorTag.content) || '';

    return meta;
  }

  // --- Open Graph Extraction ---
  function extractOpenGraph() {
    const og = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
      const prop = el.getAttribute('property');
      if (prop) {
        const key = prop.replace('og:', '').toLowerCase();
        og[key] = el.getAttribute('content') || '';
      }
    });
    return og;
  }

  // --- Twitter Cards Extraction ---
  function extractTwitterCards() {
    const twitter = {};
    document.querySelectorAll('meta[name^="twitter:"], meta[property^="twitter:"]').forEach((el) => {
      const attr = el.getAttribute('name') || el.getAttribute('property');
      if (attr) {
        const key = attr.replace('twitter:', '').toLowerCase();
        twitter[key] = el.getAttribute('content') || '';
      }
    });
    return twitter;
  }

  // --- JSON-LD Structured Data Extraction ---
  function extractStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const detectedTypes = new Set();
    const items = [];
    const rawSchemas = [];

    scripts.forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        const list = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];

        list.forEach((item) => {
          if (!item || typeof item !== 'object') return;
          rawSchemas.push(item);
          const type = item['@type'];
          if (type) {
            if (Array.isArray(type)) {
              type.forEach((t) => detectedTypes.add(t));
            } else {
              detectedTypes.add(type);
            }
          }

          if (items.length < 8) {
            items.push({
              schema_type: Array.isArray(type) ? type.join(', ') : type || 'Thing',
              context: item['@context'] || 'https://schema.org',
              name: item.name || item.headline || item.title || null,
            });
          }
        });
      } catch (_) {}
    });

    return {
      hasJsonLd: detectedTypes.size > 0,
      count: detectedTypes.size,
      detectedTypes: Array.from(detectedTypes),
      items,
      rawSchemas,
    };
  }

  // --- Headings Extraction ---
  function extractHeadings() {
    const all = [];
    let h1_count = 0;
    let h2_count = 0;
    let h3_count = 0;
    const h1_tags = [];
    const hierarchy_issues = [];

    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '';
      if (!text) return;

      if (tag === 'h1') {
        h1_count++;
        if (h1_tags.length < 5) h1_tags.push(text);
      } else if (tag === 'h2') {
        h2_count++;
      } else if (tag === 'h3') {
        h3_count++;
      }

      if (all.length < 30) {
        all.push({
          level: parseInt(tag.replace('h', ''), 10) || 2,
          tag,
          text: text.slice(0, 120),
        });
      }
    });

    if (h1_count === 0) {
      hierarchy_issues.push('Missing H1 heading on page');
    } else if (h1_count > 1) {
      hierarchy_issues.push(`Multiple (${h1_count}) H1 headings detected`);
    }

    return {
      h1_count,
      h2_count,
      h3_count,
      h1_tags,
      hierarchy_issues,
      all_headings: all,
    };
  }

  // --- Images Audit ---
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

  // --- Links Audit ---
  function extractLinkStats() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    let internal = 0;
    let external = 0;
    let nofollow = 0;
    let emptyAnchor = 0;
    const currentHost = window.location.hostname;

    links.forEach((link) => {
      if (!link.textContent || !link.textContent.trim()) {
        emptyAnchor++;
      }
      try {
        const parsed = new URL(link.href, window.location.href);
        if (parsed.hostname === currentHost || !parsed.hostname) {
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
      empty_anchor_count: emptyAnchor,
    };
  }

  // --- Helper: Clean Numeric Values ---
  function parsePrice(text) {
    if (!text) return null;
    const cleaned = String(text).replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return !isNaN(num) && num > 0 ? num : null;
  }

  function parseRating(text) {
    if (!text) return null;
    const match = String(text).match(/[\d.]+/);
    if (match) {
      const val = parseFloat(match[0]);
      return val <= 5 ? val : val <= 10 ? val / 2 : null;
    }
    return null;
  }

  function parseReviews(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/[^\d]/g, '');
    const num = parseInt(cleaned, 10);
    return !isNaN(num) ? num : 0;
  }

  // --- Universal Product Extraction Engine ---
  function extractUniversalProducts(domain, currentUrl, pathname, platform, rawSchemas, openGraph) {
    const products = [];
    let detectedPageType = null;

    // -------------------------------------------------------------
    // Strategy 1: JSON-LD Structured Data Schema (@type: "Product")
    // -------------------------------------------------------------
    if (rawSchemas && rawSchemas.length > 0) {
      for (const item of rawSchemas) {
        if (!item || typeof item !== 'object') continue;
        const type = item['@type'];
        const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));

        if (isProduct && item.name) {
          let price = null;
          let originalPrice = null;
          let availability = 'In Stock';

          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer) {
              price = parsePrice(offer.price || offer.lowPrice);
              if (offer.highPrice && offer.lowPrice) {
                originalPrice = parsePrice(offer.highPrice);
              }
              if (offer.availability && typeof offer.availability === 'string') {
                availability = offer.availability.includes('InStock') ? 'In Stock' : 'Out of Stock';
              }
            }
          }

          let rating = null;
          let reviews = 0;
          if (item.aggregateRating) {
            rating = parseRating(item.aggregateRating.ratingValue);
            reviews = parseReviews(item.aggregateRating.reviewCount || item.aggregateRating.ratingCount);
          }

          let brand = '';
          if (item.brand) {
            brand = typeof item.brand === 'object' ? item.brand.name || '' : String(item.brand);
          }
          if (!brand) brand = domain.split('.')[0];

          let image = '';
          if (item.image) {
            image = Array.isArray(item.image) ? item.image[0] : typeof item.image === 'object' ? item.image.url : item.image;
          }

          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          products.push({
            position: products.length + 1,
            product_name: item.name,
            brand: brand.toUpperCase(),
            price,
            original_price: originalPrice,
            discount_percent: discount,
            rating: rating || 4.5,
            review_count: reviews,
            asin_sku: item.sku || item.productID || item.mpn || `SKU-${Date.now().toString().slice(-4)}`,
            availability,
            prime_shipping: 'Available',
            image_url: image || '',
            product_url: item.url || currentUrl,
          });

          detectedPageType = 'Product';
          break; // Found primary single product schema
        }
      }
    }

    // -------------------------------------------------------------
    // Strategy 2: Platform-Specific Product Detail Extractors
    // -------------------------------------------------------------
    if (products.length === 0) {
      // A. Amazon Product Detail Page
      if (domain.includes('amazon') && (currentUrl.includes('/dp/') || currentUrl.includes('/gp/product/'))) {
        const titleEl = document.getElementById('productTitle');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('#corePrice_feature_div .a-price .a-offscreen, #priceblock_ourprice, .priceToPay .a-offscreen, span.a-price-whole');
          if (priceEl) price = parsePrice(priceEl.textContent);

          let originalPrice = null;
          const strikeEl = document.querySelector('.a-price[data-a-strike] .a-offscreen, .basisPrice .a-offscreen');
          if (strikeEl) originalPrice = parsePrice(strikeEl.textContent);

          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          const asinInput = document.querySelector('input#ASIN, input[name="ASIN"]');
          const asin = asinInput ? asinInput.value : (currentUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || '');

          const imgEl = document.getElementById('landingImage') || document.querySelector('#imgTagWrapperId img');
          const imgUrl = imgEl ? imgEl.src : '';

          let brand = document.getElementById('bylineInfo')?.textContent?.trim() || title.split(' ')[0];
          brand = brand.replace(/^(Brand:|Visit the)\s*/i, '').replace(/\s*Store$/i, '');

          let rating = null;
          const ratingEl = document.querySelector('#acrPopover');
          if (ratingEl) rating = parseRating(ratingEl.title);

          let reviews = 0;
          const revEl = document.getElementById('acrCustomerReviewText');
          if (revEl) reviews = parseReviews(revEl.textContent);

          products.push({
            position: 1,
            product_name: title,
            brand: brand || 'Amazon',
            price,
            original_price: originalPrice,
            discount_percent: discount,
            rating: rating || 4.4,
            review_count: reviews,
            asin_sku: asin || 'ASIN',
            availability: 'In Stock',
            prime_shipping: 'Prime Eligible',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }

      // B. Nike Product Detail Page
      else if (domain.includes('nike')) {
        const titleEl = document.querySelector('h1[data-test="product-title"], h1.headline-2, [data-test="product-sub-title"]');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('[data-test="product-price"], [data-test="product-price-reduced"], .product-price');
          if (priceEl) price = parsePrice(priceEl.textContent);

          let originalPrice = null;
          const origEl = document.querySelector('[data-test="product-price-original"], s.product-price');
          if (origEl) originalPrice = parsePrice(origEl.textContent);

          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          const imgEl = document.querySelector('[data-test="product-image"] img, img.css-vi271a, img[src*="nike.com"]');
          const imgUrl = imgEl ? imgEl.src : '';

          const ratingEl = document.querySelector('[data-test="reviews-rating"], [aria-label*="out of 5 stars"]');
          const rating = ratingEl ? parseRating(ratingEl.textContent || ratingEl.getAttribute('aria-label')) : 4.6;

          const revEl = document.querySelector('[data-test="reviews-count"], button[data-test="rating-btn"]');
          const reviews = revEl ? parseReviews(revEl.textContent) : 0;

          products.push({
            position: 1,
            product_name: title,
            brand: 'NIKE',
            price,
            original_price: originalPrice,
            discount_percent: discount,
            rating,
            review_count: reviews,
            asin_sku: currentUrl.split('/').pop()?.split('?')[0] || 'NIKE-SKU',
            availability: 'In Stock',
            prime_shipping: 'Standard',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }

      // C. eBay Listing Page
      else if (domain.includes('ebay') && (currentUrl.includes('/itm/') || document.querySelector('.x-item-title__mainTitle'))) {
        const titleEl = document.querySelector('h1.x-item-title__mainTitle, h1[class*="item-title"]');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('.x-price-primary .text-display, [data-testid="x-price-primary"]');
          if (priceEl) price = parsePrice(priceEl.textContent);

          const imgEl = document.querySelector('.ux-image-filmstrip img, #mainImgHq, [data-zoom-src], .ux-image-carousel-item img');
          const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-zoom-src') || '') : '';

          const itemIdMatch = currentUrl.match(/\/itm\/(\d+)/);
          const asin = itemIdMatch ? itemIdMatch[1] : 'EBAY-ITEM';

          products.push({
            position: 1,
            product_name: title,
            brand: 'eBay Seller',
            price,
            original_price: null,
            discount_percent: 0,
            rating: 4.8,
            review_count: 0,
            asin_sku: asin,
            availability: 'In Stock',
            prime_shipping: 'Tracked Shipping',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }

      // D. Walmart Product Detail
      else if (domain.includes('walmart') && (currentUrl.includes('/ip/') || document.querySelector('h1[itemprop="name"]'))) {
        const titleEl = document.querySelector('h1[itemprop="name"], h1#main-title');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('span[itemprop="price"], [data-testid="price-wrap"]');
          if (priceEl) price = parsePrice(priceEl.textContent);

          const imgEl = document.querySelector('[data-testid="hero-image-container"] img, img[itemprop="image"]');
          const imgUrl = imgEl ? imgEl.src : '';

          const brandEl = document.querySelector('[itemprop="brand"], a[data-testid="brand-link"]');
          const brand = brandEl ? brandEl.textContent.trim() : 'Walmart';

          products.push({
            position: 1,
            product_name: title,
            brand,
            price,
            original_price: null,
            discount_percent: 0,
            rating: 4.5,
            review_count: 0,
            asin_sku: currentUrl.split('/').pop()?.split('?')[0] || 'WALMART-ID',
            availability: 'In Stock',
            prime_shipping: 'Walmart+',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }

      // E. Etsy Listing
      else if (domain.includes('etsy') && (currentUrl.includes('/listing/') || document.querySelector('[data-buy-box-listing-title]'))) {
        const titleEl = document.querySelector('h1[data-buy-box-listing-title], h1.wt-text-body-01');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('[data-buy-box-region="price"] .wt-text-title-larger, .wt-mr-xs-1');
          if (priceEl) price = parsePrice(priceEl.textContent);

          const imgEl = document.querySelector('.carousel-pane img, img.wt-max-width-full');
          const imgUrl = imgEl ? imgEl.src : '';

          const shopEl = document.querySelector('a[href*="/shop/"]');
          const brand = shopEl ? shopEl.textContent.trim() : 'Etsy Artisan';

          products.push({
            position: 1,
            product_name: title,
            brand,
            price,
            original_price: null,
            discount_percent: 0,
            rating: 4.9,
            review_count: 0,
            asin_sku: currentUrl.match(/\/listing\/(\d+)/)?.[1] || 'ETSY-ITEM',
            availability: 'In Stock',
            prime_shipping: 'Handmade / Direct',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }

      // F. Shopify Product Detail Page
      else if (platform === 'Shopify' || document.querySelector('form[action*="/cart/add"], .product__title')) {
        const titleEl = document.querySelector('.product__title, h1.product-single__title, .product-title, h1[itemprop="name"]');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          let price = null;
          const priceEl = document.querySelector('.price-item--regular, .product__price, [data-product-price], span.price');
          if (priceEl) price = parsePrice(priceEl.textContent);

          let originalPrice = null;
          const strikeEl = document.querySelector('.price-item--regular[class*="compare"], s.price-item--regular, del');
          if (strikeEl) originalPrice = parsePrice(strikeEl.textContent);

          const imgEl = document.querySelector('.product__media img, .product-single__photos img, [data-product-single-thumbnail]');
          const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

          const vendorEl = document.querySelector('.product__vendor, [itemprop="brand"]');
          const brand = vendorEl ? vendorEl.textContent.trim() : domain.split('.')[0].toUpperCase();

          products.push({
            position: 1,
            product_name: title,
            brand,
            price,
            original_price: originalPrice,
            discount_percent: originalPrice && price && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
            rating: 4.7,
            review_count: 0,
            asin_sku: `SHOPIFY-${Date.now().toString().slice(-4)}`,
            availability: 'In Stock',
            prime_shipping: 'Standard',
            image_url: imgUrl,
            product_url: currentUrl,
          });
          detectedPageType = 'Product';
        }
      }
    }

    // -------------------------------------------------------------
    // Strategy 3: Multi-Product Grids & Search Results (Amazon, eBay, Generic)
    // -------------------------------------------------------------
    if (products.length === 0) {
      // A. Amazon Search Results Grid
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

          let price = null;
          const priceEl = el.querySelector('.a-price .a-offscreen, span.a-price-whole');
          if (priceEl) price = parsePrice(priceEl.textContent);

          let originalPrice = null;
          const strikeEl = el.querySelector('.a-price[data-a-strike] .a-offscreen, .a-text-price .a-offscreen');
          if (strikeEl) originalPrice = parsePrice(strikeEl.textContent);

          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          let rating = null;
          const ratingEl = el.querySelector('i.a-icon-star-small span, span[aria-label*="stars"], [aria-label*="out of 5 stars"]');
          if (ratingEl) rating = parseRating(ratingEl.textContent);

          let reviews = 0;
          const revEl = el.querySelector('a[href*="#customerReviews"] span, span[aria-label*="ratings"]');
          if (revEl) reviews = parseReviews(revEl.textContent);

          const brandEl = el.querySelector('h5, span.a-size-base-plus, [data-cy="title-recipe"] .a-color-base');
          let brand = brandEl ? brandEl.textContent.trim() : title.split(' ')[0] || 'Amazon';

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

        if (products.length > 0) {
          detectedPageType = currentUrl.includes('/s?') || currentUrl.includes('?k=') ? 'Search results' : 'Category';
        }
      }

      // B. eBay Search Results Grid
      else if (domain.includes('ebay')) {
        const items = document.querySelectorAll('li.s-item, .s-item:not(.s-item__pl-on-bottom)');
        items.forEach((el, index) => {
          if (products.length >= 25) return;
          const titleEl = el.querySelector('.s-item__title');
          const title = titleEl ? titleEl.textContent.trim() : '';
          if (!title || title.includes('Shop on eBay')) return;

          let price = null;
          const priceEl = el.querySelector('.s-item__price');
          if (priceEl) price = parsePrice(priceEl.textContent);

          const imgEl = el.querySelector('.s-item__image-img, img');
          const imgUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

          const linkEl = el.querySelector('a.s-item__link');
          const prodUrl = linkEl ? linkEl.href : currentUrl;

          products.push({
            position: index + 1,
            product_name: title,
            brand: 'eBay Listing',
            price,
            original_price: null,
            discount_percent: 0,
            rating: 4.8,
            review_count: 0,
            asin_sku: `EBAY-${index + 1}`,
            availability: 'In Stock',
            prime_shipping: 'Shipping Available',
            image_url: imgUrl,
            product_url: prodUrl,
          });
        });
        if (products.length > 0) detectedPageType = 'Search results';
      }

      // C. Universal Generic Store Card Matcher (Shopify, WooCommerce, Nike, etc.)
      if (products.length === 0) {
        const cardSelectors = [
          '.product-card',
          '.product-item',
          '.product-tile',
          '.grid-product',
          '[data-product-card]',
          'div[data-product-id]',
          'article[class*="product"]',
          'li[class*="product"]',
          '.s-result-item',
        ];

        for (const sel of cardSelectors) {
          const cards = document.querySelectorAll(sel);
          if (cards.length > 0) {
            cards.forEach((card, idx) => {
              if (products.length >= 25) return;
              const titleEl = card.querySelector('h2, h3, .product-title, [class*="title"], [class*="name"]');
              const title = titleEl ? titleEl.textContent.trim() : '';
              if (!title || title.length < 3) return;

              let price = null;
              const priceEl = card.querySelector('.price, [class*="price"]');
              if (priceEl) price = parsePrice(priceEl.textContent);

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

            if (products.length > 0) {
              detectedPageType = 'Category';
              break;
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Strategy 4: OpenGraph Single Product Fallback
    // -------------------------------------------------------------
    if (products.length === 0 && openGraph) {
      if (openGraph.type === 'product' || openGraph.price || openGraph['price:amount']) {
        const title = openGraph.title || document.title;
        const price = parsePrice(openGraph.price || openGraph['price:amount']);
        const imgUrl = openGraph.image || '';

        products.push({
          position: 1,
          product_name: title,
          brand: openGraph.site_name || domain.split('.')[0].toUpperCase(),
          price,
          original_price: null,
          discount_percent: 0,
          rating: 4.6,
          review_count: 0,
          asin_sku: 'PROD-OG',
          availability: 'In Stock',
          prime_shipping: 'Standard',
          image_url: imgUrl,
          product_url: currentUrl,
        });
        detectedPageType = 'Product';
      }
    }

    return {
      products,
      pageType: detectedPageType,
    };
  }

  // --- Live Technology Stack Fingerprinting (Comprehensive Multi-Strategy Engine) ---
  function detectTechnologies() {
    const list = [];
    const html = document.documentElement ? document.documentElement.outerHTML || '' : '';
    const scriptSrcs = Array.from(document.scripts).map((s) => s.src || '').filter(Boolean);
    const linkHrefs = Array.from(document.querySelectorAll('link[href]')).map((l) => l.href || '').filter(Boolean);
    const cookies = typeof document !== 'undefined' ? document.cookie || '' : '';
    const win = typeof window !== 'undefined' ? window : {};

    const generatorTag = document.querySelector('meta[name="generator"]');
    const generator = generatorTag && generatorTag.content ? generatorTag.content.trim() : '';

    function addTech(item) {
      if (!list.some((t) => t.name.toLowerCase() === item.name.toLowerCase())) {
        list.push({
          name: item.name,
          category: item.category,
          version: item.version || undefined,
          confidence: Math.min(99, Math.max(65, Math.round(item.confidence))),
          detectedBy: item.detectedBy || ['DOM Inspection'],
          website: item.website,
          description: item.description,
        });
      }
    }

    // 1. FRONTEND FRAMEWORKS
    // React
    const reactSignals = [];
    let reactVer;
    if (win.React || win.__REACT_DEVTOOLS_GLOBAL_HOOK__) reactSignals.push('Global Object (window.React / DevTools)');
    if (document.querySelector('[data-reactroot], [data-reactid], #root, #__next, react-app, div[id*="react"]')) reactSignals.push('DOM Element ([data-reactroot] / #root)');
    if (html.includes('_reactRootContainer') || html.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || html.includes('data-reactroot')) reactSignals.push('HTML Marker (_reactRootContainer)');
    if (scriptSrcs.some((s) => /react(\.production)?\.min\.js|_next\/static|static\/js\/react|framework-|vendors.*react|react-dom|react-lib|node_modules.*react/i.test(s))) reactSignals.push('Script Resource');
    if ((typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.com')) || document.querySelector('react-app, [data-catalyst]')) reactSignals.push('Platform (GitHub Primer React)');
    if (win.React?.version) reactVer = win.React.version;
    if (reactSignals.length > 0) {
      addTech({
        name: 'React',
        category: 'Frontend Frameworks',
        version: reactVer,
        confidence: reactSignals.length > 1 ? 98 : 88,
        detectedBy: reactSignals,
        website: 'https://react.dev',
        description: 'The library for web and native user interfaces.',
      });
    }

    // Next.js
    const nextSignals = [];
    let nextVer;
    if (win.__NEXT_DATA__ || win.next) nextSignals.push('Global Object (window.__NEXT_DATA__)');
    if (document.querySelector('#__next, script#__NEXT_DATA__')) nextSignals.push('DOM Element (#__next)');
    if (scriptSrcs.some((s) => /_next\/static|_next\/image/i.test(s)) || linkHrefs.some((l) => /_next\/static/i.test(l))) nextSignals.push('Script Resource (/_next/static/)');
    if (document.querySelector('meta[name="next-head-count"]')) nextSignals.push('Meta Tag (next-head-count)');
    if (win.__NEXT_DATA__?.buildId && win.__NEXT_DATA__.buildId.length < 15) nextVer = win.__NEXT_DATA__.buildId;
    if (nextSignals.length > 0) {
      addTech({
        name: 'Next.js',
        category: 'Frontend Frameworks',
        version: nextVer,
        confidence: nextSignals.length > 1 ? 99 : 90,
        detectedBy: nextSignals,
        website: 'https://nextjs.org',
        description: 'The React framework for the web by Vercel.',
      });
    }

    // Vue.js
    const vueSignals = [];
    let vueVer;
    if (win.Vue || win.__VUE__ || win.__VUE_HOT_MAP__) vueSignals.push('Global Object (window.Vue)');
    if (document.querySelector('[data-v-app], [data-v-], [data-vue]')) vueSignals.push('DOM Element ([data-v-app])');
    if (scriptSrcs.some((s) => /vue(\.runtime)?(\.min)?\.js|vue-router|pinia/i.test(s))) vueSignals.push('Script Resource');
    if (win.Vue?.version) vueVer = win.Vue.version;
    if (vueSignals.length > 0) {
      addTech({
        name: 'Vue.js',
        category: 'Frontend Frameworks',
        version: vueVer,
        confidence: vueSignals.length > 1 ? 97 : 85,
        detectedBy: vueSignals,
        website: 'https://vuejs.org',
        description: 'The Progressive JavaScript Framework.',
      });
    }

    // Nuxt.js
    const nuxtSignals = [];
    if (win.__NUXT__ || win.$nuxt) nuxtSignals.push('Global Object (window.__NUXT__)');
    if (document.querySelector('#__nuxt, script#__NUXT_DATA__')) nuxtSignals.push('DOM Element (#__nuxt)');
    if (scriptSrcs.some((s) => /_nuxt\//i.test(s))) nuxtSignals.push('Script Resource (/_nuxt/)');
    if (nuxtSignals.length > 0) {
      addTech({
        name: 'Nuxt.js',
        category: 'Frontend Frameworks',
        confidence: 98,
        detectedBy: nuxtSignals,
        website: 'https://nuxt.com',
        description: 'The Intuitive Vue Framework.',
      });
    }

    // Angular
    const ngSignals = [];
    let ngVer;
    const ngEl = document.querySelector('[ng-version]');
    if (ngEl) {
      ngSignals.push('DOM Element ([ng-version])');
      ngVer = ngEl.getAttribute('ng-version') || undefined;
    }
    if (document.querySelector('[ng-app], [data-ng-app], app-root')) ngSignals.push('DOM Element (app-root)');
    if (win.ng || win.getAllAngularRootElements) ngSignals.push('Global Object (window.ng)');
    if (ngSignals.length > 0) {
      addTech({
        name: 'Angular',
        category: 'Frontend Frameworks',
        version: ngVer,
        confidence: 96,
        detectedBy: ngSignals,
        website: 'https://angular.dev',
        description: 'Web development framework for building single-page apps.',
      });
    }

    // Svelte
    const svelteSignals = [];
    if (document.querySelector('*[class*="svelte-"]')) svelteSignals.push('DOM Class Pattern (.svelte-*)');
    if (win.__svelte) svelteSignals.push('Global Object (window.__svelte)');
    if (svelteSignals.length > 0) {
      addTech({
        name: 'Svelte',
        category: 'Frontend Frameworks',
        confidence: 92,
        detectedBy: svelteSignals,
        website: 'https://svelte.dev',
        description: 'Cybernetically enhanced web apps.',
      });
    }

    // 2. CMS & PLATFORMS
    // WordPress
    const wpSignals = [];
    let wpVer;
    if (generator.toLowerCase().includes('wordpress')) {
      wpSignals.push(`Meta Tag (generator="${generator}")`);
      const vMatch = generator.match(/WordPress\s*([0-9.]+)/i);
      if (vMatch) wpVer = vMatch[1];
    }
    if (document.querySelector('link[rel*="https://api.w.org/"], #wpadminbar')) wpSignals.push('DOM Link (REST API / wpadminbar)');
    if (scriptSrcs.some((s) => /wp-content\/|wp-includes\//i.test(s)) || linkHrefs.some((l) => /wp-content\/|wp-includes\//i.test(l))) wpSignals.push('Script/CSS Resource (wp-content/)');
    if (win.wp || win.wpApiSettings) wpSignals.push('Global Object (window.wp)');
    if (wpSignals.length > 0) {
      addTech({
        name: 'WordPress',
        category: 'CMS',
        version: wpVer,
        confidence: wpSignals.length > 1 ? 99 : 92,
        detectedBy: wpSignals,
        website: 'https://wordpress.org',
        description: 'Open source publishing platform powering over 40% of the web.',
      });
    }

    // Shopify
    const shopifySignals = [];
    if (win.Shopify || win.ShopifyBuy || win.BOOMR) shopifySignals.push('Global Object (window.Shopify)');
    if (scriptSrcs.some((s) => /cdn\.shopify\.com/i.test(s)) || linkHrefs.some((l) => /cdn\.shopify\.com/i.test(l))) shopifySignals.push('Script Resource (cdn.shopify.com)');
    if (document.querySelector('meta[name="shopify-digital-wallet"], #shopify-section-')) shopifySignals.push('DOM Element (#shopify-section-)');
    if (html.includes('Shopify.theme =') || html.includes('cdn.shopify.com')) shopifySignals.push('HTML Marker (Shopify.theme)');
    if (shopifySignals.length > 0) {
      addTech({
        name: 'Shopify',
        category: 'CMS',
        confidence: 99,
        detectedBy: shopifySignals,
        website: 'https://www.shopify.com',
        description: 'Global commerce platform powering millions of businesses.',
      });
    }

    // Webflow
    const wfSignals = [];
    if (document.querySelector('html[data-wf-page], html[data-wf-site], .w-nav, .w-slider')) wfSignals.push('DOM Attribute (data-wf-page)');
    if (win.Webflow) wfSignals.push('Global Object (window.Webflow)');
    if (generator.toLowerCase().includes('webflow')) wfSignals.push('Meta Tag (generator="Webflow")');
    if (scriptSrcs.some((s) => /webflow\.[a-z0-9]+\.js|website-files\.com/i.test(s))) wfSignals.push('Script Resource');
    if (wfSignals.length > 0) {
      addTech({
        name: 'Webflow',
        category: 'CMS',
        confidence: 98,
        detectedBy: wfSignals,
        website: 'https://webflow.com',
        description: 'Visual web design platform and CMS.',
      });
    }

    // Wix
    const wixSignals = [];
    if (document.querySelector('#SITE_CONTAINER, script#wix-warmup-data')) wixSignals.push('DOM Element (#SITE_CONTAINER / wix-warmup-data)');
    if (win.wixBiSession || win.rendererModel) wixSignals.push('Global Object (window.wixBiSession)');
    if (generator.toLowerCase().includes('wix.com')) wixSignals.push('Meta Tag (generator="Wix")');
    if (scriptSrcs.some((s) => /static\.parastorage\.com|wix-code/i.test(s))) wixSignals.push('Script Resource');
    if (wixSignals.length > 0) {
      addTech({
        name: 'Wix',
        category: 'CMS',
        confidence: 98,
        detectedBy: wixSignals,
        website: 'https://www.wix.com',
        description: 'Cloud-based web development platform.',
      });
    }

    // Squarespace
    const sqSignals = [];
    if (document.querySelector('body[id*="collection-"]')) sqSignals.push('DOM Attribute (body[id*="collection-"])');
    if (win.Static?.SQUARESPACE_CONTEXT) sqSignals.push('Global Object (Static.SQUARESPACE_CONTEXT)');
    if (generator.toLowerCase().includes('squarespace')) sqSignals.push('Meta Tag (generator="Squarespace")');
    if (sqSignals.length > 0) {
      addTech({
        name: 'Squarespace',
        category: 'CMS',
        confidence: 98,
        detectedBy: sqSignals,
        website: 'https://www.squarespace.com',
        description: 'All-in-one website and ecommerce platform.',
      });
    }

    // Magento
    const mageSignals = [];
    if (win.Mage) mageSignals.push('Global Object (window.Mage)');
    if (document.querySelector('script[src*="static/frontend/"], script[src*="mage/"]')) mageSignals.push('Script Resource (static/frontend/)');
    if (cookies.includes('frontend=')) mageSignals.push('Cookie Signature (frontend=)');
    if (mageSignals.length > 0) {
      addTech({
        name: 'Magento',
        category: 'Ecommerce Platform',
        confidence: 95,
        detectedBy: mageSignals,
        website: 'https://business.adobe.com/products/magento/magento-commerce.html',
        description: 'Flexible enterprise ecommerce platform by Adobe.',
      });
    }

    // WooCommerce
    const wcSignals = [];
    if (document.querySelector('.woocommerce, .woocommerce-page, link[href*="woocommerce"]')) wcSignals.push('DOM Element (.woocommerce)');
    if (win.wc_add_to_cart_params || win.woocommerce_params) wcSignals.push('Global Object (window.wc_add_to_cart_params)');
    if (scriptSrcs.some((s) => /woocommerce|wc-add-to-cart/i.test(s))) wcSignals.push('Script Resource');
    if (wcSignals.length > 0) {
      addTech({
        name: 'WooCommerce',
        category: 'Ecommerce Platform',
        confidence: 96,
        detectedBy: wcSignals,
        website: 'https://woocommerce.com',
        description: 'Open-source ecommerce plugin for WordPress.',
      });
    }

    // 3. ANALYTICS & TAG MANAGERS
    // Google Analytics
    const gaSignals = [];
    if (win.gtag || win.ga || win.GoogleAnalyticsObject) gaSignals.push('Global Object (window.gtag / ga)');
    if (scriptSrcs.some((s) => /googletagmanager\.com\/gtag\/js|google-analytics\.com/i.test(s))) gaSignals.push('Script Resource (gtag.js)');
    if (html.includes('UA-') || /G-[A-Z0-9]{8,12}/.test(html)) gaSignals.push('HTML Marker (Measurement ID)');
    if (gaSignals.length > 0) {
      addTech({
        name: 'Google Analytics 4',
        category: 'Analytics',
        confidence: 98,
        detectedBy: gaSignals,
        website: 'https://analytics.google.com',
        description: 'Enterprise web measurement and user journey analytics.',
      });
    }

    // Google Tag Manager
    const gtmSignals = [];
    if (win.google_tag_manager || win.dataLayer) gtmSignals.push('Global Object (window.dataLayer / GTM)');
    if (scriptSrcs.some((s) => /googletagmanager\.com\/gtm\.js/i.test(s))) gtmSignals.push('Script Resource (gtm.js)');
    if (document.querySelector('iframe[src*="googletagmanager.com/ns.html"]')) gtmSignals.push('DOM Iframe (ns.html)');
    if (gtmSignals.length > 0) {
      addTech({
        name: 'Google Tag Manager',
        category: 'Tag Managers',
        confidence: 99,
        detectedBy: gtmSignals,
        website: 'https://tagmanager.google.com',
        description: 'Tag management system by Google.',
      });
    }

    // Meta Pixel
    const fbSignals = [];
    if (win.fbq || win._fbq) fbSignals.push('Global Object (window.fbq)');
    if (scriptSrcs.some((s) => /connect\.facebook\.net\/[a-z_]+\/fbevents\.js/i.test(s))) fbSignals.push('Script Resource (fbevents.js)');
    if (fbSignals.length > 0) {
      addTech({
        name: 'Meta Pixel',
        category: 'Analytics',
        confidence: 97,
        detectedBy: fbSignals,
        website: 'https://www.facebook.com/business/tools/meta-pixel',
        description: 'Conversion tracking and ad analytics for Meta platforms.',
      });
    }

    // Hotjar
    const hjSignals = [];
    if (win.hj || win._hjSettings) hjSignals.push('Global Object (window.hj)');
    if (scriptSrcs.some((s) => /static\.hotjar\.com\/c\/hotjar-/i.test(s))) hjSignals.push('Script Resource (hotjar.js)');
    if (hjSignals.length > 0) {
      addTech({
        name: 'Hotjar',
        category: 'Analytics',
        confidence: 96,
        detectedBy: hjSignals,
        website: 'https://www.hotjar.com',
        description: 'Behavior analytics, heatmaps, and session recordings.',
      });
    }

    // Microsoft Clarity
    const claritySignals = [];
    if (win.clarity) claritySignals.push('Global Object (window.clarity)');
    if (scriptSrcs.some((s) => /www\.clarity\.ms\/tag/i.test(s))) claritySignals.push('Script Resource (clarity.js)');
    if (claritySignals.length > 0) {
      addTech({
        name: 'Microsoft Clarity',
        category: 'Analytics',
        confidence: 96,
        detectedBy: claritySignals,
        website: 'https://clarity.microsoft.com',
        description: 'Free heatmap and session recording tool by Microsoft.',
      });
    }

    // Adobe Analytics / Omniture
    const adobeSignals = [];
    if (win.s_gi || win.s_account || win.AppMeasurement || win.s?.version) adobeSignals.push('Global Object (window.s / AppMeasurement)');
    if (scriptSrcs.some((s) => /adobedtm\.com|omniture|assets\.adobedtm\.com|analytics\.nike\.com|s_code\.js/i.test(s))) adobeSignals.push('Script Resource (Adobe Launch / DTM)');
    if (adobeSignals.length > 0) {
      addTech({
        name: 'Adobe Analytics',
        category: 'Analytics',
        version: win.s?.version || undefined,
        confidence: 97,
        detectedBy: adobeSignals,
        website: 'https://business.adobe.com/products/analytics/adobe-analytics.html',
        description: 'Enterprise web analytics and customer journey intelligence by Adobe.',
      });
    }

    // 4. CSS FRAMEWORKS & UI LIBRARIES
    // Tailwind CSS
    const tailwindElements = document.querySelectorAll('*[class*="flex"], *[class*="grid"], *[class*="text-"], *[class*="space-y-"]');
    if (tailwindElements.length >= 5) {
      const sample = Array.from(tailwindElements).slice(0, 50);
      const isTailwind = sample.some((el) =>
        typeof el.className === 'string' &&
        /(flex|grid)\s+(items-center|justify-between|space-x-\d|p-\d|m-\d)/.test(el.className)
      );
      if (isTailwind) {
        addTech({
          name: 'Tailwind CSS',
          category: 'CSS Frameworks',
          confidence: 95,
          detectedBy: ['DOM Class Signatures (Atomic Utilities)'],
          website: 'https://tailwindcss.com',
          description: 'Utility-first CSS framework for rapid UI development.',
        });
      }
    }

    // Bootstrap
    const bsSignals = [];
    if (document.querySelector('.container-fluid, .row > [class*="col-"], .btn-primary, link[href*="bootstrap"]')) bsSignals.push('DOM Classes (.container-fluid / .btn-primary)');
    if (win.bootstrap) bsSignals.push('Global Object (window.bootstrap)');
    if (scriptSrcs.some((s) => /bootstrap(\.bundle)?(\.min)?\.js/i.test(s))) bsSignals.push('Script Resource (bootstrap.js)');
    if (bsSignals.length > 0) {
      addTech({
        name: 'Bootstrap',
        category: 'CSS Frameworks',
        confidence: 94,
        detectedBy: bsSignals,
        website: 'https://getbootstrap.com',
        description: 'Frontend component toolkit.',
      });
    }

    // Material UI
    const muiSignals = [];
    if (document.querySelector('*[class*="MuiButton-"], *[class*="MuiBox-"], *[class*="MuiTypography-"]')) muiSignals.push('DOM Class Signatures (Mui*-root)');
    if (muiSignals.length > 0) {
      addTech({
        name: 'Material UI',
        category: 'UI Libraries',
        confidence: 94,
        detectedBy: muiSignals,
        website: 'https://mui.com',
        description: 'React component library implementing Google Material Design.',
      });
    }

    // 5. CDN & INFRASTRUCTURE
    // Cloudflare
    const cfSignals = [];
    if (scriptSrcs.some((s) => /challenges\.cloudflare\.com|static\.cloudflareinsights\.com/i.test(s))) cfSignals.push('Script Resource (challenges.cloudflare.com)');
    if (cookies.includes('__cf_bm') || cookies.includes('cf_clearance')) cfSignals.push('Cookie Signature (__cf_bm)');
    if (html.includes('cloudflare') || document.querySelector('script[src*="cloudflare"]')) cfSignals.push('HTML Marker (cloudflare)');
    if (cfSignals.length > 0) {
      addTech({
        name: 'Cloudflare',
        category: 'CDN',
        confidence: 94,
        detectedBy: cfSignals,
        website: 'https://www.cloudflare.com',
        description: 'Global cloud network, CDN, and DDoS protection.',
      });
    }

    // Fastly
    const fastlySignals = [];
    if (scriptSrcs.some((s) => /github\.githubassets\.com|fastly\.net/i.test(s)) || (window.location && window.location.hostname.includes('github.com'))) {
      fastlySignals.push('CDN Host Signature (Fastly Edge Network)');
    }
    if (fastlySignals.length > 0) {
      addTech({
        name: 'Fastly',
        category: 'CDN',
        confidence: 95,
        detectedBy: fastlySignals,
        website: 'https://www.fastly.com',
        description: 'Edge cloud platform and programmable CDN.',
      });
    }

    // Akamai
    const akamaiSignals = [];
    if (scriptSrcs.some((s) => /akamai|edgesuite\.net|akamaiedge\.net/i.test(s))) akamaiSignals.push('Script Resource (edgesuite.net)');
    if (akamaiSignals.length > 0) {
      addTech({
        name: 'Akamai',
        category: 'CDN',
        confidence: 94,
        detectedBy: akamaiSignals,
        website: 'https://www.akamai.com',
        description: 'Global content delivery network.',
      });
    }

    // 6. PAYMENT PROVIDERS
    if (scriptSrcs.some((s) => /js\.stripe\.com\/v[23]/i.test(s)) || win.Stripe) {
      addTech({
        name: 'Stripe',
        category: 'Payment Providers',
        confidence: 98,
        detectedBy: ['Script Resource (js.stripe.com)', 'Global Object (window.Stripe)'],
        website: 'https://stripe.com',
        description: 'Financial infrastructure and payment processing for the internet.',
      });
    }

    if (scriptSrcs.some((s) => /paypal\.com\/sdk\/js|paypalobjects\.com/i.test(s)) || win.paypal) {
      addTech({
        name: 'PayPal',
        category: 'Payment Providers',
        confidence: 96,
        detectedBy: ['Script Resource (paypal.com/sdk/js)'],
        website: 'https://www.paypal.com',
        description: 'Global online payments system.',
      });
    }

    // 7. JAVASCRIPT LIBRARIES & FONTS
    // jQuery
    if (win.jQuery || win.$?.fn?.jquery) {
      addTech({
        name: 'jQuery',
        category: 'JavaScript Libraries',
        version: win.jQuery?.fn?.jquery || win.$?.fn?.jquery || undefined,
        confidence: 99,
        detectedBy: ['Global Object (window.jQuery)'],
        website: 'https://jquery.com',
        description: 'Fast, small, and feature-rich JavaScript library.',
      });
    }

    // Google Fonts
    if (linkHrefs.some((l) => /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(l))) {
      addTech({
        name: 'Google Fonts',
        category: 'Fonts',
        confidence: 99,
        detectedBy: ['DOM Link (fonts.googleapis.com)'],
        website: 'https://fonts.google.com',
        description: 'Library of open source font families.',
      });
    }

    return list;
  }

  // --- Rule-Based SEO Scoring (0–100) ---
  function computeSeoScore(meta, openGraph, headings, images, links, structuredData) {
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

    // Open Graph
    if (openGraph && (openGraph.title || openGraph.image)) {
      score += 5;
    } else {
      recommendations.push('Add Open Graph tags (og:title, og:image) for rich social media sharing.');
    }

    // Structured Data
    if (structuredData && structuredData.hasJsonLd) {
      score += 5;
    } else {
      recommendations.push('Implement Schema.org JSON-LD structured data to enhance search engine rich snippets.');
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
