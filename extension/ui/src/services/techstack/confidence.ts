/**
 * Tech Stack Confidence Scoring Engine
 * Combines multiple independent detection signals into an authoritative confidence score (0–100%).
 */

export interface SignalMatch {
  method: 'global' | 'dom' | 'script' | 'meta' | 'cookie' | 'header' | 'html';
  detail: string;
}

const BASE_WEIGHTS: Record<SignalMatch['method'], number> = {
  global: 55, // Strongest signal (running in-memory instance)
  header: 45, // Authoritative server response header
  meta: 45,   // Explicit framework generator tag
  dom: 35,    // Definite root or framework attribute
  script: 35, // Script source loaded by browser
  cookie: 30, // Domain session cookie signature
  html: 25,   // Inline HTML string marker
};

/**
 * Calculates a consolidated confidence score (60 - 99%) based on matching signals.
 * Never relies on a single selector; multiple signals increase score.
 */
export function calculateConfidence(signals: SignalMatch[]): number {
  if (!signals || signals.length === 0) return 0;

  // Base score from highest weighted signal
  let maxWeight = 0;
  let secondaryBonus = 0;

  for (const s of signals) {
    const weight = BASE_WEIGHTS[s.method] || 30;
    if (weight > maxWeight) {
      maxWeight = weight;
    } else {
      secondaryBonus += Math.round(weight * 0.4);
    }
  }

  // Combined score, baseline at least 65 if matched, max out at 99
  const total = Math.min(99, Math.max(65, maxWeight + secondaryBonus));
  return total;
}

/**
 * Formats signal matches into readable detection method tags for the UI.
 */
export function formatDetectedBy(signals: SignalMatch[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const s of signals) {
    let label = '';
    switch (s.method) {
      case 'global':
        label = `Global Object (${s.detail})`;
        break;
      case 'dom':
        label = `DOM Element (${s.detail})`;
        break;
      case 'script':
        label = `Script Resource (${s.detail})`;
        break;
      case 'meta':
        label = `Meta Tag (${s.detail})`;
        break;
      case 'header':
        label = `HTTP Header (${s.detail})`;
        break;
      case 'cookie':
        label = `Cookie Signature (${s.detail})`;
        break;
      case 'html':
        label = `HTML Marker (${s.detail})`;
        break;
    }

    if (label && !seen.has(label)) {
      seen.add(label);
      results.push(label);
    }
  }

  return results.length > 0 ? results : ['Pattern Signature'];
}
