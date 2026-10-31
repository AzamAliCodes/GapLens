import * as cheerio from 'cheerio';

export interface ExtractedDates {
  publishedAt?: string;
  updatedAt?: string;
  cycleMention?: string;
}

/**
 * Extracts published and modified dates from HTML using meta tags, JSON-LD, time elements, and text regex.
 */
export function findDatesFromHtml(html: string, plainText?: string): ExtractedDates {
  const dates: ExtractedDates = {};

  try {
    const $ = cheerio.load(html);

    // 1. Meta tags
    const metaPublished = 
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="article:published_time"]').attr('content') ||
      $('meta[name="publication_date"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('meta[property="og:published_time"]').attr('content');

    const metaModified = 
      $('meta[property="article:modified_time"]').attr('content') ||
      $('meta[name="article:modified_time"]').attr('content') ||
      $('meta[property="og:updated_time"]').attr('content') ||
      $('meta[name="last-modified"]').attr('content');

    if (metaPublished && isValidDate(metaPublished)) {
      dates.publishedAt = new Date(metaPublished).toISOString();
    }
    if (metaModified && isValidDate(metaModified)) {
      dates.updatedAt = new Date(metaModified).toISOString();
    }

    // 2. JSON-LD scripts
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText) return;
        const parsed = JSON.parse(jsonText);
        const dataArr = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of dataArr) {
          if (item?.datePublished && isValidDate(item.datePublished) && !dates.publishedAt) {
            dates.publishedAt = new Date(item.datePublished).toISOString();
          }
          if (item?.dateModified && isValidDate(item.dateModified) && !dates.updatedAt) {
            dates.updatedAt = new Date(item.dateModified).toISOString();
          }
        }
      } catch {
        // Ignore JSON-LD parse errors
      }
    });

    // 3. <time> elements
    if (!dates.publishedAt) {
      $('time').each((_, el) => {
        const datetime = $(el).attr('datetime') || $(el).text().trim();
        if (isValidDate(datetime) && !dates.publishedAt) {
          dates.publishedAt = new Date(datetime).toISOString();
        }
      });
    }

    // 4. Regex detection in text for cycles and dates
    const textToSearch = (plainText || $('body').text() || '').slice(0, 8000);

    // Match cycle patterns like "2024-25", "2024-2025", "AY 2023-24", "Batch of 2025"
    const cycleRegex = /\b(AY\s*20\d\d[-/]\d\d|20\d\d[-/]\d\d|Batch of 20\d\d|Academic Year 20\d\d[-/]\d\d)\b/i;
    const cycleMatch = textToSearch.match(cycleRegex);
    if (cycleMatch) {
      dates.cycleMention = cycleMatch[0];
    }

    // Regex for updated strings like "Last updated: October 15, 2024" or "Updated on 12/04/2023"
    if (!dates.updatedAt) {
      const updateRegex = /(?:last\s+updated|updated\s+on|modified\s+on)[:\s]+([A-Za-z0-9,\s/-]{4,30})/i;
      const match = textToSearch.match(updateRegex);
      if (match && match[1] && isValidDate(match[1].trim())) {
        dates.updatedAt = new Date(match[1].trim()).toISOString();
      }
    }
  } catch (err) {
    console.error('Date extraction error:', err);
  }

  return dates;
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 4) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2050;
}
