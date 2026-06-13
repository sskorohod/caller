/**
 * Returns a safe in-app redirect target derived from an untrusted ?return=
 * value. Accepts a same-origin relative path, or an absolute URL whose origin
 * matches the current origin (normalized to path+search+hash so e.g. the OAuth
 * consent flow can round-trip its full URL). Rejects cross-origin, protocol-
 * relative (//evil.com), and backslash (/\evil.com) targets — closing the
 * open-redirect phishing vector. Falls back to `fallback` (default /dashboard).
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/dashboard'): string {
  if (!target) return fallback;

  // Same-origin relative path: leading "/" but not "//" or "/\".
  const isRelativePath = (s: string) => /^\/(?![/\\])/.test(s);
  if (isRelativePath(target)) return target;

  // Absolute URL: allow only if it resolves to the current origin.
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(target, window.location.origin);
      if (u.origin === window.location.origin) {
        const rel = `${u.pathname}${u.search}${u.hash}`;
        if (isRelativePath(rel)) return rel;
      }
    } catch {
      /* malformed — fall through to fallback */
    }
  }

  return fallback;
}
