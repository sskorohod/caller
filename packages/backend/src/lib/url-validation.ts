import net from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * SSRF protection for outbound webhook delivery.
 *
 * Two layers:
 *  - isAllowedWebhookUrl(): cheap synchronous sanity check at create/update
 *    time (https-only, no creds, reject private IP *literals*).
 *  - assertPublicHost(): the real guard, called at FETCH time. It resolves the
 *    hostname via DNS and rejects if ANY resolved address is private/reserved.
 *    This is what defeats DNS-rebinding and alternate IP encodings that a
 *    string denylist cannot catch.
 */

function ipv4IsPrivateOrReserved(ip: string): boolean {
  const parts = ip.split('.').map((o) => Number(o));
  if (parts.length !== 4 || parts.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved (224.0.0.0+)
  return false;
}

/**
 * True if the given IP literal points at a private, loopback, link-local,
 * reserved, or metadata address. Handles IPv6 including IPv4-mapped forms
 * ([::ffff:127.0.0.1] and the hex [::ffff:7f00:1] variant).
 */
export function addressIsPrivateOrReserved(addr: string, family?: number): boolean {
  const fam = family ?? net.isIP(addr);
  if (fam === 4) return ipv4IsPrivateOrReserved(addr);

  const ip = addr.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified

  // IPv4-mapped IPv6: ::ffff:a.b.c.d  OR  ::ffff:hhhh:hhhh
  const mapped = ip.match(/^::ffff:(.+)$/i);
  if (mapped) {
    const rest = mapped[1];
    if (rest.includes('.')) return ipv4IsPrivateOrReserved(rest);
    const hextets = rest.split(':');
    if (hextets.length === 2) {
      const hi = parseInt(hextets[0], 16);
      const lo = parseInt(hextets[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const v4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
        return ipv4IsPrivateOrReserved(v4);
      }
    }
    return true; // unrecognized mapped form → unsafe
  }

  if (/^f[cd]/.test(ip)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return true; // fe80::/10 link-local
  return false;
}

export function isAllowedWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only HTTPS allowed
  if (parsed.protocol !== 'https:') return false;

  // No credentials in URL
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  // If the host is an IP literal, reject private/reserved ranges right away.
  // (Hostnames are accepted here and re-checked against resolved IPs at fetch
  // time by assertPublicHost — that is what stops DNS-rebinding.)
  const fam = net.isIP(host);
  if (fam) {
    return !addressIsPrivateOrReserved(host, fam);
  }

  return true;
}

/**
 * Resolve the hostname and throw if it maps to any private/reserved address.
 * Call this immediately before issuing an outbound request to a user-supplied
 * URL. Defeats DNS rebinding and alternate IP encodings.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');

  const fam = net.isIP(host);
  if (fam) {
    if (addressIsPrivateOrReserved(host, fam)) {
      throw new Error('Blocked outbound request to private/reserved address');
    }
    return;
  }

  const results = await lookup(host, { all: true });
  if (!results.length) throw new Error('Host did not resolve');
  for (const r of results) {
    if (addressIsPrivateOrReserved(r.address, r.family)) {
      throw new Error('Blocked outbound request to private/reserved address');
    }
  }
}
