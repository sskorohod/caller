/**
 * Validate webhook URLs to prevent SSRF attacks.
 * Only allows HTTPS to public IP addresses.
 */
export function isAllowedWebhookUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only HTTPS allowed
  if (parsed.protocol !== 'https:') return false;

  // No authentication in URL
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();

  // Reject localhost and loopback
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return false;
  }

  // Reject private IP ranges
  const privatePatterns = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // link-local
    /^fc00:/, // IPv6 unique local
    /^fe80:/, // IPv6 link-local
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(host)) return false;
  }

  // Reject AWS/GCP/Azure metadata endpoints
  const metadataHosts = ['169.254.169.254', 'metadata.google.internal'];
  if (metadataHosts.includes(host)) return false;

  return true;
}
