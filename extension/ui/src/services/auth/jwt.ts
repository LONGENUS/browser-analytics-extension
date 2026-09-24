/**
 * WebIntel JWT Utilities
 * Lightweight, safe JWT parser and expiry validator without external dependencies.
 */

export interface JwtPayload {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
  role?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * Decodes a base64url-encoded string with Unicode and padding support.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    // Decode base64 to percent-encoded string for UTF-8 compatibility
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return atob(base64);
  }
}

/**
 * Safely parses the JSON payload from a JWT token string.
 */
export function parseJwt<T = JwtPayload>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoded = base64UrlDecode(parts[1]);
    return JSON.parse(decoded) as T;
  } catch (err) {
    console.warn('Failed to parse JWT payload:', err);
    return null;
  }
}

/**
 * Checks if a JWT token is expired, with an optional safety margin in seconds.
 * @param token JWT token string
 * @param bufferSeconds Number of seconds before expiration to consider expired (default 60s)
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + bufferSeconds;
}

/**
 * Returns token expiration time in epoch milliseconds.
 */
export function getTokenExpiryMs(token: string): number | null {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return null;
  return payload.exp * 1000;
}

/**
 * Extracts user ID (subject) from JWT claims.
 */
export function extractUserId(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.sub || null;
}

/**
 * Extracts user email from JWT claims.
 */
export function extractUserEmail(token: string): string | null {
  const payload = parseJwt(token);
  return payload?.email || payload?.user_metadata?.email || null;
}
