import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { findDatesFromHtml } from './findDates';

export interface ExtractedPage {
  title: string;
  textContent: string;
  canonicalUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  cycleMention?: string;
}

/**
 * Extracts readable article/body text, title, dates, and canonical URL from raw HTML.
 * Uses @mozilla/readability via JSDOM with a robust Cheerio fallback.
 */
export function extractTextFromHtml(html: string, fallbackUrl?: string): ExtractedPage {
  let title = 'Untitled Source';
  let textContent = '';
  let canonicalUrl = fallbackUrl;

  try {
    // 1. First pass with Cheerio to grab metadata and clean noise
    const $ = cheerio.load(html);

    // Get title
    const htmlTitle = $('title').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim();
    if (htmlTitle) {
      title = htmlTitle;
    }

    // Canonical link
    const canonical = $('link[rel="canonical"]').attr('href');
    if (canonical) {
      canonicalUrl = canonical;
    }

    // Find dates
    const dates = findDatesFromHtml(html);

    // Remove noise: script, style, noscript, nav, footer, iframe, svg, comments
    $('script, style, noscript, nav, footer, header, iframe, svg, aside, form').remove();
    $('[aria-hidden="true"], [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

    // 2. Try Mozilla Readability for article-focused main text
    try {
      const dom = new JSDOM(html, { url: fallbackUrl || 'https://example.com' });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 150) {
        if (article.title) title = article.title;
        textContent = article.textContent.trim();
      }
    } catch {
      // Fallback to Cheerio if Readability throws
    }

    // 3. Fallback to Cheerio text if Readability yielded too little or failed
    if (!textContent || textContent.length < 150) {
      const bodyText = $('main, article, #content, .content, #main, body')
        .first()
        .text();
      textContent = bodyText || $.text();
    }

    // 4. Clean up whitespace and empty lines
    textContent = textContent
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // 5. Cap text at ~6,000 tokens (~24,000 characters)
    const MAX_CHARS = 24000;
    if (textContent.length > MAX_CHARS) {
      textContent = textContent.slice(0, MAX_CHARS) + '\n... [content truncated for token limits]';
    }

    return {
      title,
      textContent,
      canonicalUrl,
      publishedAt: dates.publishedAt,
      updatedAt: dates.updatedAt,
      cycleMention: dates.cycleMention,
    };
  } catch (err) {
    console.error('Error extracting text from HTML:', err);
    return {
      title: 'Extracted Page',
      textContent: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24000),
      canonicalUrl: fallbackUrl,
    };
  }
}
