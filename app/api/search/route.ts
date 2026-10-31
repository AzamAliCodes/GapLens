import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { SearchRequestSchema } from '@/lib/schemas';

export interface SearchCandidate {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

/**
 * Strips conversational fluff so search engines focus on the actual subject/entity.
 */
function cleanSearchQuery(rawQuery: string): string {
  const cleanStr = rawQuery.replace(/[?.,!;:'"(){}\[\]]/g, ' ').trim();
  const stopwords = new Set([
    'what', 'should', 'i', 'we', 'you', 'verify', 'before', 'applying', 'for',
    'this', 'that', 'these', 'those', 'the', 'a', 'an', 'and', 'or', 'to',
    'how', 'can', 'check', 'find', 'out', 'tell', 'me', 'about', 'is', 'are',
    'in', 'on', 'at', 'of', 'with', 'from', 'by', 'do', 'does', 'need', 'know',
    'want', 'would', 'could', 'please', 'help', 'guidance', 'advice'
  ]);

  const words = cleanStr.split(/\s+/).filter(Boolean);
  if (words.length <= 3) {
    return cleanStr;
  }

  const meaningful = words.filter(w => !stopwords.has(w.toLowerCase()));
  return meaningful.length >= 1 ? meaningful.join(' ') : cleanStr;
}

/**
 * Live search via DuckDuckGo HTML for real, unhallucinated web results.
 */
async function searchDuckDuckGo(query: string): Promise<SearchCandidate[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const candidates: SearchCandidate[] = [];

  $('.result__body').each((_, el) => {
    if (candidates.length >= 6) return;
    const title = $(el).find('.result__title a').text().trim();
    let href = $(el).find('.result__title a').attr('href') || '';
    
    // Resolve DuckDuckGo redirect wrapper
    if (href.startsWith('//duckduckgo.com/l/?uddg=')) {
      const match = href.match(/uddg=([^&]+)/);
      if (match) href = decodeURIComponent(match[1]);
    }

    const snippet = $(el).find('.result__snippet').text().trim();

    if (title && href && href.startsWith('http')) {
      try {
        const parsed = new URL(href);
        const domain = parsed.hostname.replace(/^www\./, '');
        if (!domain.includes('duckduckgo.com')) {
          candidates.push({
            title,
            url: href,
            snippet: snippet || `Online resource from ${domain}`,
            domain,
          });
        }
      } catch {
        // Skip invalid URL
      }
    }
  });

  return candidates;
}

/**
 * Live search via Wikipedia Full-Text Search API for real, authenticated encyclopedia and topic references.
 */
async function searchWikipedia(query: string): Promise<SearchCandidate[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=6`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const items = data.query?.search;
    if (Array.isArray(items) && items.length > 0) {
      return items.map((item: { title: string; snippet: string }) => ({
        title: `${item.title} - Wikipedia`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        snippet: (item.snippet || `Wikipedia reference article covering ${item.title}`).replace(/<[^>]+>/g, '').slice(0, 180),
        domain: 'en.wikipedia.org',
      }));
    }
  } catch (err) {
    console.warn('Wikipedia full-text search error:', err);
  }

  return [];
}

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new NextResponse(JSON.stringify({ error: 'Goal is required' }), {
        status: 400,
        headers: NO_CACHE_HEADERS,
      });
    }

    const { goal } = parsed.data;
    const rawQuery = goal.trim();
    if (!rawQuery) {
      return new NextResponse(JSON.stringify({ results: [] }), {
        status: 200,
        headers: NO_CACHE_HEADERS,
      });
    }

    const query = cleanSearchQuery(rawQuery);
    const apiKey = process.env.SEARCH_API_KEY || process.env.TAVILY_API_KEY;

    // 1. Tavily API Search if key is present
    if (apiKey) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'basic',
            max_results: 6,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results) && data.results.length > 0) {
            const results: SearchCandidate[] = data.results.map((r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 200) || '',
              domain: new URL(r.url).hostname.replace(/^www\./, ''),
            }));
            return new NextResponse(JSON.stringify({ results }), {
              status: 200,
              headers: NO_CACHE_HEADERS,
            });
          }
        }
      } catch (err) {
        console.warn('Tavily search failed, falling back to DuckDuckGo:', err);
      }
    }

    // 2. Real Live Web Search via DuckDuckGo
    try {
      const ddgResults = await searchDuckDuckGo(query);
      if (ddgResults.length > 0) {
        return new NextResponse(JSON.stringify({ results: ddgResults }), {
          status: 200,
          headers: NO_CACHE_HEADERS,
        });
      }
    } catch (err) {
      console.warn('DuckDuckGo search error, falling back to Wikipedia:', err);
    }

    // 3. Real Live Entity Search via Wikipedia Full-Text Search API
    try {
      const wikiResults = await searchWikipedia(query);
      if (wikiResults.length > 0) {
        return new NextResponse(JSON.stringify({ results: wikiResults }), {
          status: 200,
          headers: NO_CACHE_HEADERS,
        });
      }
    } catch (err) {
      console.warn('Wikipedia search error:', err);
    }

    // 4. Zero hallucination fallback: return empty array rather than fake portals
    return new NextResponse(JSON.stringify({ results: [] }), {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
