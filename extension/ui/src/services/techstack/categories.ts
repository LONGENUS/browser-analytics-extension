/**
 * Tech Stack Categories
 * Standard taxonomy for classifying detected web technologies.
 */

export const TECH_CATEGORIES = {
  FRONTEND_FRAMEWORKS: 'Frontend Frameworks',
  BACKEND_FRAMEWORKS: 'Backend Frameworks',
  CMS: 'CMS',
  ECOMMERCE: 'Ecommerce Platform',
  ANALYTICS: 'Analytics',
  TAG_MANAGERS: 'Tag Managers',
  UI_LIBRARIES: 'UI Libraries',
  CSS_FRAMEWORKS: 'CSS Frameworks',
  PAYMENT_PROVIDERS: 'Payment Providers',
  CDN: 'CDN',
  HOSTING: 'Hosting',
  JAVASCRIPT_LIBRARIES: 'JavaScript Libraries',
  FONTS: 'Fonts',
  SECURITY_WAF: 'Security / WAF',
} as const;

export type TechCategory = typeof TECH_CATEGORIES[keyof typeof TECH_CATEGORIES];

export const CATEGORY_ICONS: Record<string, string> = {
  'Frontend Frameworks': 'Layout',
  'Backend Frameworks': 'Server',
  CMS: 'FileText',
  'Ecommerce Platform': 'ShoppingBag',
  Analytics: 'BarChart2',
  'Tag Managers': 'Tag',
  'UI Libraries': 'Component',
  'CSS Frameworks': 'Palette',
  'Payment Providers': 'CreditCard',
  CDN: 'Globe',
  Hosting: 'HardDrive',
  'JavaScript Libraries': 'Code2',
  Fonts: 'Type',
  'Security / WAF': 'Shield',
};
