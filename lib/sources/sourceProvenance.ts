import crypto from 'crypto';

export function computeContentHash(text: string): string {
  if (!text) return 'empty_content';
  return crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
}

export function extractRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) return hostname;
  // Handle two-part TLDs like gov.in, co.uk, edu.au
  const lastTwo = parts.slice(-2).join('.');
  if (['gov.in', 'nic.in', 'edu.in', 'co.uk', 'gov.uk', 'ac.uk', 'com.au', 'gov.au'].includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function computeProvenanceGroupId(url?: string, contentHash?: string): string {
  if (contentHash && contentHash !== 'empty_content') {
    // If two sources have identical text hash (syndicated wire clone), group by hash
    return `prov-hash-${contentHash.slice(0, 8)}`;
  }

  if (url) {
    try {
      const parsed = new URL(url);
      const root = extractRootDomain(parsed.hostname);
      return `prov-domain-${root.replace(/[^a-z0-9]/g, '_')}`;
    } catch {
      // Fallback
    }
  }

  return `prov-standalone-${crypto.randomBytes(4).toString('hex')}`;
}

export function assessSourceAuthority(url?: string, domain?: string, title?: string): {
  authorityReason: string;
  kind: 'official' | 'institutional' | 'news' | 'third_party' | 'pasted';
  weight: number;
} {
  const checkStr = `${url || ''} ${domain || ''} ${title || ''}`.toLowerCase();

  if (/\.gov(\.|$)|nic\.in|\.gov\.|\.mil\b|gazette|official/i.test(checkStr)) {
    return {
      authorityReason: 'Official statutory / government domain or gazette record',
      kind: 'official',
      weight: 1.0,
    };
  }

  if (/\.edu(\.|$)|ac\.in|\.ac\.uk|university|college|institute|polytechnic/i.test(checkStr)) {
    return {
      authorityReason: 'Accredited university or institutional educational body',
      kind: 'institutional',
      weight: 0.85,
    };
  }

  if (/reuters|apnews|bbc|thehindu|bloomberg|nytimes|wsj|timesofindia/i.test(checkStr)) {
    return {
      authorityReason: 'Major recognized independent news wire / journalism outlet',
      kind: 'news',
      weight: 0.75,
    };
  }

  if (/forum|reddit|quora|blog|medium\.com|studentdesk|edutips|guidance/i.test(checkStr)) {
    return {
      authorityReason: 'Community advisory portal or third-party aggregator',
      kind: 'third_party',
      weight: 0.5,
    };
  }

  return {
    authorityReason: 'User-provided document or general web reference',
    kind: 'third_party',
    weight: 0.6,
  };
}
