import { TechStackData, TechItem } from '../../types';

export interface TechStackSummary {
  total: number;
  frontendCount: number;
  cmsCount: number;
  analyticsCount: number;
  cdnCount: number;
}

/**
 * Normalizes raw technology detections into the structured TechStackData contract.
 */
export function mapTechStackData(technologies: TechItem[]): TechStackData {
  const safeList = Array.isArray(technologies) ? technologies : [];

  // Group by category
  const categories: Record<string, TechItem[]> = {};

  for (const tech of safeList) {
    const cat = tech.category || 'Other';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(tech);
  }

  return {
    total_detected: safeList.length,
    categories,
    technologies: safeList,
  };
}

/**
 * Computes high-level summary KPIs from detected technologies.
 */
export function getTechStackSummary(technologies: TechItem[]): TechStackSummary {
  const safeList = Array.isArray(technologies) ? technologies : [];

  let frontendCount = 0;
  let cmsCount = 0;
  let analyticsCount = 0;
  let cdnCount = 0;

  for (const t of safeList) {
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('frontend') || cat.includes('ui') || cat.includes('css')) {
      frontendCount++;
    } else if (cat.includes('cms') || cat.includes('ecommerce')) {
      cmsCount++;
    } else if (cat.includes('analytics') || cat.includes('tag')) {
      analyticsCount++;
    } else if (cat.includes('cdn') || cat.includes('hosting')) {
      cdnCount++;
    }
  }

  return {
    total: safeList.length,
    frontendCount,
    cmsCount,
    analyticsCount,
    cdnCount,
  };
}
