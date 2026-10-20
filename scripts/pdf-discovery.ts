/**
 * Deterministic script to discover PDF links for each center
 * This script scrapes each center's website to find current and next month PDF links
 */

import * as cheerio from 'cheerio';
import { CENTERS, Center } from '../lib/schema';

export interface PDFLink {
  centerId: string;
  month: string; // YYYY-MM
  url: string;
  discoveredAt: string;
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
    const $ = cheerio.load(html);
    const links: PDFLink[] = [];
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const discoveredAt = now.toISOString();
    
    // Find all PDF links
    $('a[href$=".pdf"], a[href$=".PDF"]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      // Make absolute URL
      let url = href;
      if (href.startsWith('/')) {
        const baseUrl = new URL(center.websiteUrl).origin;
        url = baseUrl + href;
      } else if (!href.startsWith('http')) {
        url = new URL(href, center.websiteUrl).href;
      }
      
      // Try to extract month from filename or link text
      const text = $(element).text().trim();
      const filename = url.split('/').pop() || '';
      const combined = text + ' ' + filename;
      
      // Look for patterns like "10月", "2026年10月", "202610", etc.
      const monthMatch = combined.match(/(\d{4})[-年]?(\d{1,2})/);
      const monthOnlyMatch = combined.match(/(\d{1,2})月/);
      
      let month = currentMonth;
      if (monthMatch) {
        const year = monthMatch[1];
        const monthNum = monthMatch[2].padStart(2, '0');
        month = `${year}-${monthNum}`;
      } else if (monthOnlyMatch) {
        // Use current year
        const monthNum = monthOnlyMatch[1].padStart(2, '0');
        month = `${now.getFullYear()}-${monthNum}`;
      }
      
      links.push({
        centerId: center.id,
        month,
        url,
        discoveredAt,
      });
    });
    
    return links;
  } catch (error) {
    console.error(`Error discovering PDFs for ${center.nameJa}:`, error);
    return [];
  }
}

/**
 * Discover all PDF links across all centers
 */
export async function discoverAllPDFs(): Promise<PDFLink[]> {
  const allLinks: PDFLink[] = [];
  
  for (const center of CENTERS) {
    const links = await discoverPDFsForCenter(center);
    allLinks.push(...links);
  }
  
  return allLinks;
}

/**
 * Filter PDFs to only include current and next month
 */
export function filterRelevantPDFs(links: PDFLink[]): PDFLink[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  return links.filter(link => 
    link.month === currentMonth || link.month === nextMonth
  );
}

// CLI interface
if (require.main === module) {
  discoverAllPDFs().then(links => {
    console.log('\nDiscovered PDFs:');
    console.log(JSON.stringify(filterRelevantPDFs(links), null, 2));
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
