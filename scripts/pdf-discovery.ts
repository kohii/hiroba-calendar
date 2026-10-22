import type { Center } from '../lib/schema.ts';
import { CENTERS } from '../lib/schema.ts';

export interface PDFLink {
  centerId: string;
  month: string;
  url: string;
  discoveredAt: string;
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
    
    for (const url of pdfUrls) {
      const filename = url.split("/").pop() || "";
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const links = await discoverAll();
  
  console.log(`\n✅ Discovered ${links.length} PDF links:`);
  
  for (const link of links.sort((a, b) => a.centerId.localeCompare(b.centerId) || a.month.localeCompare(b.month))) {
    console.log(`  ${link.centerId} ${link.month}: ${link.url}`);
  }
  
  console.log(`\nJSON output:`);
  console.log(JSON.stringify(links, null, 2));
}
