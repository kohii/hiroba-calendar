/**
 * Deterministic script to discover PDF links for each center
 * Uses regex-based extraction to avoid cheerio dependency
 */

import type { Center } from '../lib/schema.ts';
import { CENTERS } from '../lib/schema.ts';

export interface PDFLink {
  centerId: string;
  month: string; // YYYY-MM
  url: string;
  discoveredAt: string;
}

/**
 * Extract PDF links from HTML using regex
 */
function extractPDFLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  // Match href="..." or href='...' ending in .pdf
  const hrefPattern = /href\s*=\s*["']([^"']*\.(?:pdf|PDF))["']/gi;
  let match;
  
  while ((match = hrefPattern.exec(html)) !== null) {
    let url = match[1];
    
    // Make absolute URL
    if (url.startsWith('/')) {
      const origin = new URL(baseUrl).origin;
      url = origin + url;
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href;
    }
    
    links.push(url);
  }
  
  return Array.from(new Set(links)); // deduplicate
}

/**
 * Fetch and parse a center's website to find PDF links
 */
async function discoverPDFsForCenter(center: Center): Promise<PDFLink[]> {
  console.log(`Discovering PDFs for ${center.nameJa}...`);
  
  try {
    const response = await fetch(center.websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaitamaCityScheduleApp/1.0)',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${center.nameJa}: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const pdfUrls = extractPDFLinks(html, center.websiteUrl);
    const discoveredAt = new Date().toISOString();
    const links: PDFLink[] = [];
    
    // Try to extract month from URL
    for (const url of pdfUrls) {
      const filename = url.split('/').pop() || '';
      
      // Look for patterns: 202610, 2026-10, 10月 in URL
      const monthPatterns = [
        /(\d{4})(\d{2})/,           // 202610
        /(\d{4})-(\d{2})/,          // 2026-10
        /(\d{4})年(\d{1,2})月/,     // 2026年10月
      ];
      
      let month: string | null = null;
      for (const pattern of monthPatterns) {
        const match = filename.match(pattern);
        if (match) {
          const year = match[1];
          const monthNum = match[2].padStart(2, '0');
          month = `${year}-${monthNum}`;
          break;
        }
      }
      
      if (month) {
        links.push({
          centerId: center.id,
          month,
          url,
          discoveredAt,
        });
      }
    }
    
    return links;
  } catch (error) {
    console.error(`Error discovering PDFs for ${center.nameJa}:`, error);
    return [];
  }
}

/**
 * Discover PDFs for all centers
 */
async function discoverAll(): Promise<PDFLink[]> {
  const allLinks: PDFLink[] = [];
  
  for (const center of CENTERS) {
    const links = await discoverPDFsForCenter(center);
    allLinks.push(...links);
  }
  
  return allLinks;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const links = await discoverAll();
  
  console.log(`\n✅ Discovered ${links.length} PDF links:`);
  
  for (const link of links.sort((a, b) => a.centerId.localeCompare(b.centerId) || a.month.localeCompare(b.month))) {
    console.log(`  ${link.centerId} ${link.month}: ${link.url}`);
  }
  
  console.log(`\nJSON output:`);
  console.log(JSON.stringify(links, null, 2));
}
