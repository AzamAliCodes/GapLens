import fs from 'fs';
import path from 'path';
import { Source, SourceInput, SourceRecord } from '../types';
import { validateUrlForSsrf } from '../security/ssrf';
import { extractTextFromHtml } from './extractText';
import { classifySource } from './classify';
import { chunkTextIntoPassages } from './chunk';
import { computeContentHash, computeProvenanceGroupId, assessSourceAuthority } from '../sources/sourceProvenance';

// Mapping for bundled sample reference documents (ensures 100% offline reliability for demo runs)
const SAMPLE_LOCAL_MAP: Record<string, string> = {
  'https://scholarships.gov.in/national-merit-2026': 'official-scholarship.html',
  'https://studentdesk.org/scholarships/national-merit-guide': 'student-portal.html',
  'https://edutips.net/articles/merit-scholarship-advice': 'blog-advice.html',
  'https://scholarshipforum.in/threads/national-merit-questions': 'undated-forum.html',
};

// In-memory cache: 10 minutes cache per URL to make repeat analyses instantaneous
interface CacheEntry {
  source: Source;
  cachedAt: number;
}
const fetchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function safeExtractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function toSourceRecord(source: Source): SourceRecord {
  const origin = source.kind === 'pasted' ? 'user_text' : 'user_url';
  const authority = assessSourceAuthority(source.url, source.domain, source.title);

  return {
    id: source.id,
    origin,
    url: source.url,
    canonicalUrl: source.url,
    title: source.title,
    domain: source.domain,
    publisher: source.domain,
    fetchedAt: new Date().toISOString(),
    publishedAt: source.publishedAt,
    modifiedAt: source.updatedAt,
    contentHash: source.contentHash || computeContentHash(source.rawText || ''),
    provenanceGroupId: source.provenanceGroupId || computeProvenanceGroupId(source.url, source.contentHash),
    authorityReason: authority.authorityReason,
    extractedText: source.rawText || '',
    fetchStatus: source.fetchStatus === 'ok' ? 'ok' : source.fetchStatus === 'pasted' ? 'ok' : 'error',
    passages: source.passages,
  };
}

export async function processSourceInput(
  input: SourceInput,
  index: number
): Promise<Source> {
  const sourceId = `S${index + 1}`;

  // 1. Handle Pasted Text
  if (input.text && input.text.trim()) {
    const rawText = input.text.trim();
    const title = input.label?.trim() || `User Text Source ${index + 1}`;
    const passages = chunkTextIntoPassages(sourceId, rawText);
    const contentHash = computeContentHash(rawText);
    const provenanceGroupId = computeProvenanceGroupId(undefined, contentHash);
    
    return {
      id: sourceId,
      title,
      domain: 'user-input',
      kind: 'pasted',
      publishedAt: input.date ? new Date(input.date).toISOString() : undefined,
      fetchStatus: 'pasted',
      passages,
      rawText,
      contentHash,
      provenanceGroupId,
    };
  }

  // 2. Handle URL Fetch
  const rawUrl = input.url?.trim() || '';
  if (!rawUrl) {
    return {
      id: sourceId,
      title: 'Empty Source',
      domain: 'unknown',
      kind: 'third_party',
      fetchStatus: 'failed',
      error: 'No URL or text provided',
      passages: [],
      contentHash: 'empty_content',
      provenanceGroupId: 'prov-empty',
    };
  }

  // Check if this matches a bundled local sample file for offline/demo reliability
  const sampleFileName = SAMPLE_LOCAL_MAP[rawUrl];
  if (sampleFileName) {
    try {
      const samplePath = path.join(process.cwd(), 'public', 'samples', sampleFileName);
      if (fs.existsSync(samplePath)) {
        const html = fs.readFileSync(samplePath, 'utf-8');
        const parsedUrl = new URL(rawUrl);
        const domain = parsedUrl.hostname.replace(/^www\./, '');
        const kind = classifySource(domain, false);
        const extracted = extractTextFromHtml(html, rawUrl);
        const passages = chunkTextIntoPassages(sourceId, extracted.textContent);
        const contentHash = computeContentHash(extracted.textContent);
        const provenanceGroupId = computeProvenanceGroupId(rawUrl, contentHash);

        return {
          id: sourceId,
          url: rawUrl,
          title: input.label || extracted.title || domain,
          domain,
          kind,
          publishedAt: extracted.publishedAt,
          updatedAt: extracted.updatedAt,
          fetchStatus: 'ok',
          passages,
          rawText: extracted.textContent,
          contentHash,
          provenanceGroupId,
        };
      }
    } catch (err) {
      console.warn('Failed reading sample file, falling back to network fetch:', err);
    }
  }

  // Check in-memory cache
  const cached = fetchCache.get(rawUrl);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      ...cached.source,
      id: sourceId,
      passages: cached.source.passages.map((p, idx) => ({
        ...p,
        id: `${sourceId}-P${idx + 1}`,
      })),
    };
  }

  // SSRF check
  const ssrf = await validateUrlForSsrf(rawUrl);
  if (!ssrf.valid || !ssrf.url) {
    return {
      id: sourceId,
      url: rawUrl,
      title: rawUrl,
      domain: 'blocked',
      kind: 'third_party',
      fetchStatus: 'failed',
      error: ssrf.error || 'Blocked by security policy (SSRF prevention)',
      passages: [],
      contentHash: 'blocked_content',
      provenanceGroupId: 'prov-blocked',
    };
  }

  // Fetch with timeout and redirect tracking
  let currentUrl = ssrf.url.toString();
  let redirects = 0;
  const maxRedirects = 3;

  try {
    while (redirects <= maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'manual', // Manual handling to enforce SSRF validation on every redirect
      });

      clearTimeout(timeoutId);

      // Check for redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirects++;
        const location = response.headers.get('location');
        if (!location) {
          throw new Error('Redirect returned with no Location header');
        }
        const nextUrl = new URL(location, currentUrl).toString();
        const nextSsrf = await validateUrlForSsrf(nextUrl);
        if (!nextSsrf.valid) {
          throw new Error(`Redirect target blocked: ${nextSsrf.error}`);
        }
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
        throw new Error(`Unsupported content-type: ${contentType}. Only text/html and plain text are supported.`);
      }

      // Check body length (cap at 2MB)
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 2 * 1024 * 1024) {
        throw new Error('Page size exceeds 2 MB limit');
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const html = decoder.decode(buffer);

      const parsedUrl = new URL(currentUrl);
      const domain = parsedUrl.hostname.replace(/^www\./, '');
      const kind = classifySource(domain, false);

      const extracted = extractTextFromHtml(html, currentUrl);
      const passages = chunkTextIntoPassages(sourceId, extracted.textContent);
      const contentHash = computeContentHash(extracted.textContent);
      const provenanceGroupId = computeProvenanceGroupId(currentUrl, contentHash);

      const resultSource: Source = {
        id: sourceId,
        url: currentUrl,
        title: extracted.title || domain,
        domain,
        kind,
        publishedAt: extracted.publishedAt,
        updatedAt: extracted.updatedAt,
        fetchStatus: 'ok',
        passages,
        rawText: extracted.textContent,
        contentHash,
        provenanceGroupId,
      };

      // Store in cache
      fetchCache.set(rawUrl, {
        source: resultSource,
        cachedAt: Date.now(),
      });

      return resultSource;
    }

    throw new Error('Too many redirects (exceeded limit of 3)');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const domain = safeExtractDomain(rawUrl);

    // Fall back to verified snippet text if provided from search index
    if (input.text && input.text.trim()) {
      const fallbackText = input.text.trim();
      const passages = chunkTextIntoPassages(sourceId, fallbackText);
      const contentHash = computeContentHash(fallbackText);
      const provenanceGroupId = computeProvenanceGroupId(rawUrl, contentHash);
      return {
        id: sourceId,
        url: rawUrl,
        title: input.label || domain,
        domain: domain || 'search-index',
        kind: classifySource(domain, false),
        fetchStatus: 'ok',
        passages,
        rawText: fallbackText,
        contentHash,
        provenanceGroupId,
      };
    }

    return {
      id: sourceId,
      url: rawUrl,
      title: domain || rawUrl,
      domain: domain || 'unknown',
      kind: classifySource(domain, false),
      fetchStatus: 'failed',
      error: errorMsg.includes('aborted') ? 'Request timed out after 10 seconds' : errorMsg,
      passages: [],
      contentHash: 'error_content',
      provenanceGroupId: 'prov-error',
    };
  }
}
