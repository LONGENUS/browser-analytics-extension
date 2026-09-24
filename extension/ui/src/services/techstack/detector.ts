import { FINGERPRINTS, DetectionContext, Fingerprint } from './fingerprints';
import { calculateConfidence, formatDetectedBy, SignalMatch } from './confidence';
import { TechItem } from '../../types';

/**
 * Core Tech Stack Detector
 * Evaluates live context against all technology fingerprints using multiple detection strategies.
 */
export function detectTechnologiesFromContext(context: DetectionContext): TechItem[] {
  const results: TechItem[] = [];
  const seenNames = new Set<string>();

  for (const fp of FINGERPRINTS) {
    const signals: SignalMatch[] = [];

    // 1. Global JS Objects
    if (fp.globals && fp.globals.length > 0) {
      for (const g of fp.globals) {
        if (context.globalsFound && context.globalsFound.has(g)) {
          signals.push({ method: 'global', detail: `window.${g}` });
          break;
        } else if (context.windowObj && g in context.windowObj) {
          signals.push({ method: 'global', detail: `window.${g}` });
          break;
        }
      }
    }

    // 2. DOM Selectors
    if (fp.domSelectors && fp.domSelectors.length > 0) {
      for (const sel of fp.domSelectors) {
        if (context.domSelectorsFound && context.domSelectorsFound.has(sel)) {
          signals.push({ method: 'dom', detail: sel });
          break;
        }
      }
    }

    // 3. Script URLs
    if (fp.scripts && fp.scripts.length > 0 && context.scripts && context.scripts.length > 0) {
      for (const rx of fp.scripts) {
        const matched = context.scripts.find((src) => rx.test(src));
        if (matched) {
          const shortUrl = matched.split('?')[0].split('/').slice(-2).join('/');
          signals.push({ method: 'script', detail: shortUrl || matched });
          break;
        }
      }
    }

    // 4. Meta Tags
    if (fp.meta && fp.meta.length > 0 && context.meta) {
      for (const m of fp.meta) {
        const val = context.meta[m.key.toLowerCase()];
        if (val && m.regex.test(val)) {
          signals.push({ method: 'meta', detail: `${m.key}="${val.slice(0, 30)}"` });
          break;
        }
      }
    }

    // 5. HTTP Response Headers
    if (fp.headers && fp.headers.length > 0 && context.headers) {
      for (const h of fp.headers) {
        const val = context.headers[h.name.toLowerCase()];
        if (val && h.regex.test(val)) {
          signals.push({ method: 'header', detail: `${h.name}: ${val.slice(0, 30)}` });
          break;
        }
      }
    }

    // 6. Cookies
    if (fp.cookies && fp.cookies.length > 0 && context.cookies && context.cookies.length > 0) {
      for (const rx of fp.cookies) {
        const matched = context.cookies.find((c) => rx.test(c));
        if (matched) {
          signals.push({ method: 'cookie', detail: matched.split('=')[0] });
          break;
        }
      }
    }

    // 7. HTML string patterns
    if (fp.htmlPatterns && fp.htmlPatterns.length > 0 && context.html) {
      for (const rx of fp.htmlPatterns) {
        if (rx.test(context.html)) {
          signals.push({ method: 'html', detail: 'Pattern Match' });
          break;
        }
      }
    }

    // If any signals matched, register the detected technology
    if (signals.length > 0 && !seenNames.has(fp.name)) {
      seenNames.add(fp.name);

      const confidence = calculateConfidence(signals);
      const detectedBy = formatDetectedBy(signals);
      const version = fp.extractVersion ? fp.extractVersion(context) : undefined;

      results.push({
        name: fp.name,
        category: fp.category,
        confidence,
        version,
        detectedBy,
        icon: fp.icon,
        website: fp.website,
        description: fp.description,
      });
    }
  }

  // Sort: highest confidence first, then alphabetical
  results.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
  return results;
}
