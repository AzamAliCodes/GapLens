import dns from 'dns/promises';

/**
 * Checks if an IPv4 or IPv6 address is in a private, loopback, link-local, or cloud metadata range.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv6 checks
  if (ip === '::1' || ip === '::') return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true; // fc00::/7
  if (ip.toLowerCase().startsWith('fe80:')) return true; // link-local
  if (ip.includes(':::ffff:')) {
    const parts = ip.split(':::ffff:');
    if (parts[1]) ip = parts[1];
  }

  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local / AWS & GCP Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;

  return false;
}

/**
 * Validates a URL against SSRF vulnerabilities before any fetch is initiated.
 */
export async function validateUrlForSsrf(inputUrl: string): Promise<{ valid: boolean; error?: string; url?: URL }> {
  try {
    const parsed = new URL(inputUrl);

    // Protocol validation
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http and https protocols are supported' };
    }

    const hostname = parsed.hostname;

    // Direct IP literal check
    if (isPrivateIp(hostname)) {
      return { valid: false, error: `Direct access to private or loopback IP (${hostname}) is blocked` };
    }

    // Resolve DNS to verify the resolved address
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return { valid: false, error: `Could not resolve hostname: ${hostname}` };
      }

      for (const record of records) {
        if (isPrivateIp(record.address)) {
          return {
            valid: false,
            error: `Resolved IP (${record.address}) is in a private, loopback, or internal cloud metadata range`,
          };
        }
      }
    } catch (dnsErr: unknown) {
      const msg = dnsErr instanceof Error ? dnsErr.message : String(dnsErr);
      return { valid: false, error: `DNS resolution failed for ${hostname}: ${msg}` };
    }

    return { valid: true, url: parsed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Invalid URL format: ${msg}` };
  }
}
