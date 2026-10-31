import { SourceKind } from '../types';

/**
 * Classifies a source based on domain and context into official, institutional, news, or third_party.
 */
export function classifySource(domain: string, isPasted = false): SourceKind {
  if (isPasted) return 'pasted';

  const d = domain.toLowerCase();

  // Government & Official Domains
  if (
    d.endsWith('.gov.in') ||
    d.endsWith('.nic.in') ||
    d.endsWith('.gov') ||
    d.endsWith('.gov.uk') ||
    d.endsWith('.gov.au') ||
    d.includes('scholarships.gov.in') ||
    d.includes('ugc.ac.in') ||
    d.includes('nta.ac.in')
  ) {
    return 'official';
  }

  // Institutional (.edu, .ac.in, recognized universities & institutes)
  if (
    d.endsWith('.edu') ||
    d.endsWith('.ac.in') ||
    d.endsWith('.edu.in') ||
    d.includes('university') ||
    d.includes('institute')
  ) {
    return 'institutional';
  }

  // News domains
  const newsDomains = [
    'thehindu.com',
    'indianexpress.com',
    'timesofindia.indiatimes.com',
    'ndtv.com',
    'bbc.com',
    'reuters.com',
    'hindustantimes.com',
    'livemint.com',
    'economictimes.indiatimes.com',
  ];
  if (newsDomains.some(nd => d.includes(nd))) {
    return 'news';
  }

  return 'third_party';
}
