import type { Center } from '../lib/schema.ts';
import { CENTERS } from '../lib/schema.ts';

export interface PDFLink {
  centerId: string;
  month: string;
  url: string;
  discoveredAt: string;
}

export interface PDFLinkWithContext {
  url: string;
  linkText?: string;
  nearbyText?: string;
}

export function extractPDFLinks(html: string, baseUrl: string): string[] {
  const hrefPattern = /href\s*=\s*["']([^"']+?\.pdf(?:\?[^"'#]*)?)["']/gi;
  const links: string[] = [];
  let match;

  while ((match = hrefPattern.exec(html)) !== null) {
    links.push(new URL(match[1], baseUrl).href);
  }

  return Array.from(new Set(links));
}

export function extractPDFLinksWithContext(html: string, baseUrl: string): PDFLinkWithContext[] {
  // Extract links with surrounding context for better month detection
  const linkPattern = /<a[^>]*href\s*=\s*["']([^"']+?\.pdf(?:\?[^"'#]*)?)["'][^>]*>([^<]*)<\/a>/gi;
  const links: PDFLinkWithContext[] = [];
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = new URL(match[1], baseUrl).href;
    const linkText = match[2].trim();
    
    // Extract nearby text (up to 200 chars before and after)
    const startPos = Math.max(0, match.index - 200);
    const endPos = Math.min(html.length, match.index + match[0].length + 200);
    const nearbyText = html.slice(startPos, endPos).replace(/<[^>]*>/g, ' ').trim();
    
    links.push({ url, linkText, nearbyText });
  }

  return links;
}

export function monthFromFilename(filename: string): string | null {
  const patterns = [/(\d{4})-(\d{2})/, /(\d{4})年(\d{1,2})月/, /(\d{4})(\d{2})/];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (!match) continue;
    const monthNum = Number(match[2]);
    if (monthNum < 1 || monthNum > 12) continue;
    return `${match[1]}-${String(monthNum).padStart(2, "0")}`;
  }

  return null;
}

export function monthFromContext(context: string): string | null {
  // Try to extract year-month from surrounding text
  // Handles formats like: "2026年12月", "12月号", "令和8年度12月", "１２月" (full-width)
  
  // Normalize full-width digits to half-width
  const normalized = context.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  
  // Standard YYYY-MM or YYYY年M月 patterns
  const patterns = [
    /(\d{4})[年\-\/](\d{1,2})[月号]/,
    /(\d{1,2})月(?:の|号)?/,  // "12月の", "12月号", "12月"
    /(\d{4})(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    
    let year: string | undefined, month: number;
    if (match[1]?.length === 4) {
      year = match[1];
      month = Number(match[2]);
    } else {
      month = Number(match[1]);
      // Try to find year in the context
      const yearMatch = normalized.match(/(\d{4})[年度]/);
      if (yearMatch) {
        year = yearMatch[1];
      }
    }
    
    if (month < 1 || month > 12) continue;
    if (!year) {
      // Default to current year if we can't find it
      year = new Date().getFullYear().toString();
    }
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return null;
}

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
    const discoveredAt = new Date().toISOString();
    const links: PDFLink[] = [];
    
    // Try context-aware extraction first (handles hash names, Japanese filenames)
    const linksWithContext = extractPDFLinksWithContext(html, center.websiteUrl);
    
    for (const { url, linkText, nearbyText } of linksWithContext) {
      const filename = decodeURIComponent(url.split("/").pop() || "");
      let month = monthFromFilename(filename);
      
      // If filename doesn't have month, try link text and nearby context
      if (!month && linkText) {
        month = monthFromContext(linkText);
      }
      if (!month && nearbyText) {
        month = monthFromContext(nearbyText);
      }

      if (month) {
        links.push({
          centerId: center.id,
          month,
          url,
          discoveredAt,
        });
      } else {
        console.log(`  ⚠️  Could not extract month from: ${filename}`);
        console.log(`      Link text: "${linkText}"`);
      }
    }
    
    // Fallback to simple extraction if no context links found
    if (links.length === 0) {
      const pdfUrls = extractPDFLinks(html, center.websiteUrl);
      for (const url of pdfUrls) {
        const filename = decodeURIComponent(url.split("/").pop() || "");
        const month = monthFromFilename(filename);
        if (month) {
          links.push({
            centerId: center.id,
            month,
            url,
            discoveredAt,
          });
        }
      }
    }
    
    return links;
  } catch (error) {
    console.error(`Error discovering PDFs for ${center.nameJa}:`, error);
    return [];
  }
}

async function discoverAll(): Promise<PDFLink[]> {
  const allLinks: PDFLink[] = [];
  
  for (const center of CENTERS) {
    const links = await discoverPDFsForCenter(center);
    allLinks.push(...links);
  }
  
  return allLinks;
}

if (import.meta.main) {
  const links = await discoverAll();
  
  console.log(`\n✅ Discovered ${links.length} PDF links:`);
  
  for (const link of links.sort((a, b) => a.centerId.localeCompare(b.centerId) || a.month.localeCompare(b.month))) {
    console.log(`  ${link.centerId} ${link.month}: ${link.url}`);
  }
  
  console.log(`\nJSON output:`);
  console.log(JSON.stringify(links, null, 2));
}
