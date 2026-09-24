import { TECH_CATEGORIES, TechCategory } from './categories';

export interface DetectionContext {
  url?: string;
  html?: string;
  scripts?: string[];
  links?: string[];
  meta?: Record<string, string>;
  cookies?: string[];
  headers?: Record<string, string>;
  domSelectorsFound?: Set<string>;
  globalsFound?: Set<string>;
  windowObj?: any;
}

export interface Fingerprint {
  name: string;
  category: TechCategory;
  website?: string;
  description?: string;
  icon?: string;
  domSelectors?: string[];
  scripts?: RegExp[];
  globals?: string[];
  meta?: Array<{ key: string; regex: RegExp }>;
  cookies?: RegExp[];
  headers?: Array<{ name: string; regex: RegExp }>;
  htmlPatterns?: RegExp[];
  extractVersion?: (context: DetectionContext) => string | undefined;
}

export const FINGERPRINTS: Fingerprint[] = [
  // =========================================================================
  // 1. FRONTEND FRAMEWORKS
  // =========================================================================
  {
    name: 'React',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://react.dev',
    description: 'The library for web and native user interfaces.',
    icon: 'Atom',
    domSelectors: [
      '[data-reactroot]',
      '[data-reactid]',
      '#root',
      'div[id*="react"]',
    ],
    globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'],
    scripts: [
      /react(\.production)?\.min\.js/i,
      /react-dom(\.production)?\.min\.js/i,
      /_next\/static/i,
      /static\/js\/react/i,
      /chunks\/framework-/i,
    ],
    htmlPatterns: [
      /_reactRootContainer/i,
      /react-root/i,
      /__REACT_DEVTOOLS_GLOBAL_HOOK__/i,
    ],
    extractVersion: (ctx) => {
      if (ctx.windowObj?.React?.version) return ctx.windowObj.React.version;
      const match = ctx.html?.match(/react@([0-9]+\.[0-9]+\.[0-9]+)/i);
      return match ? match[1] : undefined;
    },
  },
  {
    name: 'Next.js',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://nextjs.org',
    description: 'The React framework for the web by Vercel.',
    icon: 'Layers',
    domSelectors: ['#__next', 'script#__NEXT_DATA__'],
    globals: ['__NEXT_DATA__', 'next'],
    scripts: [/_next\/static/i, /_next\/image/i],
    meta: [{ key: 'next-head-count', regex: /.+/ }],
    headers: [
      { name: 'x-powered-by', regex: /next\.js/i },
      { name: 'x-nextjs-cache', regex: /.+/i },
    ],
    htmlPatterns: [/__NEXT_DATA__/i, /\/_next\/static\//i],
    extractVersion: (ctx) => {
      try {
        if (ctx.windowObj?.__NEXT_DATA__?.buildId) {
          const buildId = ctx.windowObj.__NEXT_DATA__.buildId;
          return buildId.length < 15 ? buildId : undefined;
        }
      } catch (_) {}
      return undefined;
    },
  },
  {
    name: 'Vue.js',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://vuejs.org',
    description: 'The Progressive JavaScript Framework.',
    icon: 'Code2',
    domSelectors: ['[data-v-app]', '[data-v-]', '[data-vue]', '#app[data-v-]'],
    globals: ['Vue', '__VUE__', '__VUE_HOT_MAP__'],
    scripts: [/vue(\.runtime)?(\.min)?\.js/i, /vue-router/i, /pinia/i],
    htmlPatterns: [/data-v-[a-f0-9]{6,8}/i, /__VUE__/i],
    extractVersion: (ctx) => {
      if (ctx.windowObj?.Vue?.version) return ctx.windowObj.Vue.version;
      const match = ctx.html?.match(/vue@([0-9]+\.[0-9]+\.[0-9]+)/i);
      return match ? match[1] : undefined;
    },
  },
  {
    name: 'Nuxt.js',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://nuxt.com',
    description: 'The Intuitive Vue Framework.',
    icon: 'Layers',
    domSelectors: ['#__nuxt', 'script#__NUXT_DATA__'],
    globals: ['__NUXT__', '$nuxt'],
    scripts: [/_nuxt\//i],
    htmlPatterns: [/__NUXT__/i, /\/_nuxt\//i],
    headers: [{ name: 'x-powered-by', regex: /nuxt/i }],
  },
  {
    name: 'Angular',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://angular.dev',
    description: 'Web development framework for building single-page apps.',
    icon: 'Shield',
    domSelectors: ['[ng-version]', '[ng-app]', '[data-ng-app]', 'app-root'],
    globals: ['ng', 'getAllAngularRootElements'],
    scripts: [/angular(\.min)?\.js/i, /main\.[a-f0-9]{16,}\.js/i],
    htmlPatterns: [/ng-version="([0-9.]+)"/i, /ng-binding/i],
    extractVersion: (ctx) => {
      const match = ctx.html?.match(/ng-version="([0-9.]+)"/i);
      return match ? match[1] : undefined;
    },
  },
  {
    name: 'Svelte',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://svelte.dev',
    description: 'Cybernetically enhanced web apps.',
    icon: 'Zap',
    domSelectors: ['*[class*="svelte-"]'],
    globals: ['__svelte'],
    scripts: [/svelte/i],
    htmlPatterns: [/class="[^"]*svelte-[a-z0-9]+/i],
  },
  {
    name: 'Gatsby',
    category: TECH_CATEGORIES.FRONTEND_FRAMEWORKS,
    website: 'https://www.gatsbyjs.com',
    description: 'React-based open-source framework for websites.',
    icon: 'Boxes',
    domSelectors: ['#___gatsby'],
    globals: ['___gatsby'],
    meta: [{ key: 'generator', regex: /gatsby/i }],
  },

  // =========================================================================
  // 2. CMS (Content Management Systems)
  // =========================================================================
  {
    name: 'WordPress',
    category: TECH_CATEGORIES.CMS,
    website: 'https://wordpress.org',
    description: 'Open source publishing platform powers over 40% of the web.',
    icon: 'FileText',
    domSelectors: [
      'link[rel*="https://api.w.org/"]',
      'link[href*="wp-content"]',
      'link[href*="wp-includes"]',
      '#wpadminbar',
    ],
    globals: ['wp', 'wpApiSettings'],
    scripts: [/wp-content\//i, /wp-includes\//i, /wp-embed\.min\.js/i],
    meta: [{ key: 'generator', regex: /wordpress\s*([0-9.]+)?/i }],
    htmlPatterns: [/\/wp-content\/themes\//i, /\/wp-includes\/js\//i],
    headers: [{ name: 'x-powered-by', regex: /wordpress/i }],
    extractVersion: (ctx) => {
      const match = ctx.html?.match(/name="generator" content="WordPress ([0-9.]+)"/i);
      return match ? match[1] : undefined;
    },
  },
  {
    name: 'Shopify',
    category: TECH_CATEGORIES.CMS,
    website: 'https://www.shopify.com',
    description: 'Global commerce platform powering millions of businesses.',
    icon: 'ShoppingBag',
    domSelectors: [
      '#shopify-section-',
      'link[href*="cdn.shopify.com"]',
      'script[src*="cdn.shopify.com"]',
    ],
    globals: ['Shopify', 'ShopifyBuy', 'BOOMR'],
    scripts: [/cdn\.shopify\.com/i, /shopify-theme/i],
    meta: [{ key: 'shopify-digital-wallet', regex: /.+/ }],
    htmlPatterns: [/Shopify\.theme\s*=/i, /cdn\.shopify\.com\/s\/files/i],
  },
  {
    name: 'Webflow',
    category: TECH_CATEGORIES.CMS,
    website: 'https://webflow.com',
    description: 'Visual web design platform and CMS.',
    icon: 'Compass',
    domSelectors: ['html[data-wf-page]', 'html[data-wf-site]', '.w-nav', '.w-slider'],
    globals: ['Webflow'],
    scripts: [/webflow\.[a-z0-9]+\.js/i, /assets\.website-files\.com/i],
    meta: [{ key: 'generator', regex: /webflow/i }],
    htmlPatterns: [/data-wf-page=/i, /data-wf-site=/i],
  },
  {
    name: 'Wix',
    category: TECH_CATEGORIES.CMS,
    website: 'https://www.wix.com',
    description: 'Cloud-based web development platform.',
    icon: 'Globe',
    domSelectors: ['#SITE_CONTAINER', 'script#wix-warmup-data'],
    globals: ['wixBiSession', 'rendererModel'],
    scripts: [/static\.parastorage\.com/i, /wix-code/i],
    meta: [{ key: 'generator', regex: /wix\.com/i }],
    htmlPatterns: [/static\.parastorage\.com/i, /wix-warmup-data/i],
  },
  {
    name: 'Squarespace',
    category: TECH_CATEGORIES.CMS,
    website: 'https://www.squarespace.com',
    description: 'All-in-one website and ecommerce platform.',
    icon: 'Square',
    domSelectors: ['body[id*="collection-"]', 'link[href*="squarespace.com"]'],
    globals: ['Static', 'SQUARESPACE_CONTEXT'],
    scripts: [/static1\.squarespace\.com/i],
    meta: [{ key: 'generator', regex: /squarespace/i }],
    htmlPatterns: [/Static\.SQUARESPACE_CONTEXT/i],
  },
  {
    name: 'Magento',
    category: TECH_CATEGORIES.CMS,
    website: 'https://business.adobe.com/products/magento/magento-commerce.html',
    description: 'Flexible enterprise ecommerce platform by Adobe.',
    icon: 'ShoppingBag',
    domSelectors: [
      'script[src*="static/frontend/"]',
      'script[src*="mage/"]',
      'link[href*="static/frontend/"]',
    ],
    globals: ['Mage', 'requirejs'],
    scripts: [/mage\/cookies\.js/i, /static\/frontend\/Magento/i],
    cookies: [/frontend=/i],
    htmlPatterns: [/Magento_Theme/i, /static\/frontend\//i],
  },

  // =========================================================================
  // 3. ECOMMERCE PLATFORMS
  // =========================================================================
  {
    name: 'WooCommerce',
    category: TECH_CATEGORIES.ECOMMERCE,
    website: 'https://woocommerce.com',
    description: 'Open-source ecommerce plugin for WordPress.',
    icon: 'ShoppingBag',
    domSelectors: [
      '.woocommerce',
      '.woocommerce-page',
      'link[href*="woocommerce"]',
      'script[src*="woocommerce"]',
    ],
    globals: ['wc_add_to_cart_params', 'woocommerce_params'],
    scripts: [/woocommerce(\.min)?\.js/i, /wc-add-to-cart/i],
    htmlPatterns: [/woocommerce/i, /class="[^"]*woocommerce[^"]*"/i],
  },
  {
    name: 'BigCommerce',
    category: TECH_CATEGORIES.ECOMMERCE,
    website: 'https://www.bigcommerce.com',
    description: 'Open SaaS ecommerce platform for growing and enterprise brands.',
    icon: 'ShoppingBag',
    domSelectors: ['link[href*="cdn.bigcommerce.com"]'],
    globals: ['BCData'],
    scripts: [/cdn\.bigcommerce\.com/i],
    htmlPatterns: [/stencil-utils/i],
  },

  // =========================================================================
  // 4. ANALYTICS & TAG MANAGERS
  // =========================================================================
  {
    name: 'Google Analytics 4',
    category: TECH_CATEGORIES.ANALYTICS,
    website: 'https://analytics.google.com',
    description: 'Enterprise web measurement and user journey analytics.',
    icon: 'BarChart2',
    globals: ['gtag', 'ga', 'GoogleAnalyticsObject'],
    scripts: [
      /googletagmanager\.com\/gtag\/js/i,
      /google-analytics\.com\/analytics\.js/i,
      /google-analytics\.com\/ga\.js/i,
    ],
    htmlPatterns: [/G-[A-Z0-9]{8,12}/i, /UA-[0-9]+-[0-9]+/i],
  },
  {
    name: 'Google Tag Manager',
    category: TECH_CATEGORIES.TAG_MANAGERS,
    website: 'https://tagmanager.google.com',
    description: 'Tag management system by Google.',
    icon: 'Tag',
    domSelectors: ['iframe[src*="googletagmanager.com/ns.html"]'],
    globals: ['google_tag_manager', 'dataLayer'],
    scripts: [/googletagmanager\.com\/gtm\.js/i],
    htmlPatterns: [/GTM-[A-Z0-9]{4,10}/i],
  },
  {
    name: 'Meta Pixel',
    category: TECH_CATEGORIES.ANALYTICS,
    website: 'https://www.facebook.com/business/tools/meta-pixel',
    description: 'Conversion tracking and ad analytics for Facebook and Instagram.',
    icon: 'Share2',
    globals: ['fbq', '_fbq'],
    scripts: [/connect\.facebook\.net\/[a-z_]+\/fbevents\.js/i],
    htmlPatterns: [/fbq\('init'/i],
  },
  {
    name: 'Hotjar',
    category: TECH_CATEGORIES.ANALYTICS,
    website: 'https://www.hotjar.com',
    description: 'Behavior analytics, heatmaps, and session recordings.',
    icon: 'Flame',
    globals: ['hj', '_hjSettings'],
    scripts: [/static\.hotjar\.com\/c\/hotjar-/i],
  },
  {
    name: 'Microsoft Clarity',
    category: TECH_CATEGORIES.ANALYTICS,
    website: 'https://clarity.microsoft.com',
    description: 'Free heatmap and session recording tool by Microsoft.',
    icon: 'Eye',
    globals: ['clarity'],
    scripts: [/www\.clarity\.ms\/tag/i],
  },
  {
    name: 'Adobe Analytics',
    category: TECH_CATEGORIES.ANALYTICS,
    website: 'https://business.adobe.com/products/analytics/adobe-analytics.html',
    description: 'Enterprise web analytics and customer journey intelligence by Adobe.',
    icon: 'BarChart2',
    globals: ['s_gi', 's_account', 'AppMeasurement', 's'],
    scripts: [/adobedtm\.com/i, /assets\.adobedtm\.com/i, /omniture/i, /analytics\.nike\.com/i, /s_code\.js/i],
    htmlPatterns: [/adobedtm/i, /s_gi\(/i],
  },

  // =========================================================================
  // 5. CSS FRAMEWORKS & UI LIBRARIES
  // =========================================================================
  {
    name: 'Tailwind CSS',
    category: TECH_CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://tailwindcss.com',
    description: 'Utility-first CSS framework for rapid UI development.',
    icon: 'Palette',
    domSelectors: [
      '*[class*="flex"]',
      '*[class*="grid"]',
      '*[class*="space-y-"]',
      '*[class*="text-"]',
    ],
    htmlPatterns: [
      /(flex|grid)\s+(items-center|justify-between|space-x-\d|p-\d|m-\d)/i,
      /text-(slate|gray|blue|red|emerald)-\d{2,3}/i,
      /bg-(slate|gray|blue|white|black)/i,
    ],
  },
  {
    name: 'Bootstrap',
    category: TECH_CATEGORIES.CSS_FRAMEWORKS,
    website: 'https://getbootstrap.com',
    description: 'Powerful, extensible, and feature-packed frontend toolkit.',
    icon: 'Layout',
    domSelectors: [
      '.container-fluid',
      '.row > [class*="col-"]',
      '.btn-primary',
      '.navbar-nav',
      'link[href*="bootstrap"]',
    ],
    globals: ['bootstrap'],
    scripts: [/bootstrap(\.bundle)?(\.min)?\.js/i],
    htmlPatterns: [/class="[^"]*(col-md-|col-lg-|d-flex|btn-primary)[^"]*"/i],
  },
  {
    name: 'Material UI',
    category: TECH_CATEGORIES.UI_LIBRARIES,
    website: 'https://mui.com',
    description: 'React component library implementing Google Material Design.',
    icon: 'Component',
    domSelectors: ['*[class*="MuiButton-"]', '*[class*="MuiBox-"]', '*[class*="MuiTypography-"]'],
    htmlPatterns: [/MuiButton-root/i, /MuiBox-root/i, /MuiGrid-root/i],
  },

  // =========================================================================
  // 6. CDN & INFRASTRUCTURE
  // =========================================================================
  {
    name: 'Cloudflare',
    category: TECH_CATEGORIES.CDN,
    website: 'https://www.cloudflare.com',
    description: 'Global cloud network, CDN, and DDoS protection.',
    icon: 'Cloud',
    headers: [
      { name: 'server', regex: /cloudflare/i },
      { name: 'cf-ray', regex: /.+/ },
      { name: 'cf-cache-status', regex: /.+/ },
    ],
    cookies: [/__cf_bm/i, /cf_clearance/i],
    scripts: [/challenges\.cloudflare\.com/i, /static\.cloudflareinsights\.com/i],
  },
  {
    name: 'Fastly',
    category: TECH_CATEGORIES.CDN,
    website: 'https://www.fastly.com',
    description: 'Edge cloud platform and programmable CDN.',
    icon: 'Zap',
    headers: [
      { name: 'x-served-by', regex: /cache-/i },
      { name: 'x-cache', regex: /hit|miss/i },
      { name: 'server', regex: /fastly/i },
    ],
    scripts: [/fastly\.net/i, /dualstack\.fastly\.net/i, /github\.githubassets\.com/i],
    htmlPatterns: [/fastly/i, /github\.githubassets\.com/i],
  },
  {
    name: 'Akamai',
    category: TECH_CATEGORIES.CDN,
    website: 'https://www.akamai.com',
    description: 'Global content delivery network and cybersecurity provider.',
    icon: 'Globe',
    headers: [
      { name: 'x-akamai-transformed', regex: /.+/ },
      { name: 'server', regex: /akamaighost/i },
    ],
    scripts: [/akamai/i, /edgesuite\.net/i, /akamaiedge\.net/i],
  },
  {
    name: 'Vercel',
    category: TECH_CATEGORIES.HOSTING,
    website: 'https://vercel.com',
    description: 'Frontend cloud platform for static and serverless frameworks.',
    icon: 'Triangle',
    headers: [
      { name: 'x-vercel-id', regex: /.+/ },
      { name: 'server', regex: /vercel/i },
    ],
  },

  // =========================================================================
  // 7. PAYMENT PROVIDERS
  // =========================================================================
  {
    name: 'Stripe',
    category: TECH_CATEGORIES.PAYMENT_PROVIDERS,
    website: 'https://stripe.com',
    description: 'Financial infrastructure and payment processing for the internet.',
    icon: 'CreditCard',
    globals: ['Stripe'],
    scripts: [/js\.stripe\.com\/v[23]/i],
    htmlPatterns: [/js\.stripe\.com/i],
  },
  {
    name: 'PayPal',
    category: TECH_CATEGORIES.PAYMENT_PROVIDERS,
    website: 'https://www.paypal.com',
    description: 'Global online payments system.',
    icon: 'CreditCard',
    globals: ['paypal'],
    scripts: [/paypal\.com\/sdk\/js/i, /paypalobjects\.com/i],
  },

  // =========================================================================
  // 8. JAVASCRIPT LIBRARIES
  // =========================================================================
  {
    name: 'jQuery',
    category: TECH_CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://jquery.com',
    description: 'Fast, small, and feature-rich JavaScript library.',
    icon: 'Code2',
    globals: ['jQuery', '$'],
    scripts: [/jquery(\.min)?\.js/i, /jquery-[0-9.]+(\.min)?\.js/i],
    extractVersion: (ctx) => {
      if (ctx.windowObj?.jQuery?.fn?.jquery) return ctx.windowObj.jQuery.fn.jquery;
      const match = ctx.html?.match(/jquery[-/]([0-9]+\.[0-9]+\.[0-9]+)/i);
      return match ? match[1] : undefined;
    },
  },
  {
    name: 'Lodash',
    category: TECH_CATEGORIES.JAVASCRIPT_LIBRARIES,
    website: 'https://lodash.com',
    description: 'Modern JavaScript utility library delivering modularity and performance.',
    icon: 'Code2',
    globals: ['_'],
    scripts: [/lodash(\.min)?\.js/i],
  },

  // =========================================================================
  // 9. FONTS
  // =========================================================================
  {
    name: 'Google Fonts',
    category: TECH_CATEGORIES.FONTS,
    website: 'https://fonts.google.com',
    description: 'Library of open source and free font families.',
    icon: 'Type',
    domSelectors: [
      'link[href*="fonts.googleapis.com"]',
      'link[href*="fonts.gstatic.com"]',
    ],
    htmlPatterns: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i],
  },

  // =========================================================================
  // 10. SECURITY / WAF
  // =========================================================================
  {
    name: 'Google reCAPTCHA',
    category: TECH_CATEGORIES.SECURITY_WAF,
    website: 'https://www.google.com/recaptcha',
    description: 'Fraud and bot protection service by Google.',
    icon: 'ShieldCheck',
    globals: ['grecaptcha'],
    scripts: [/recaptcha\/api\.js/i, /google\.com\/recaptcha/i],
    domSelectors: ['.g-recaptcha'],
  },
];
