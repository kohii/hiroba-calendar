/**
 * Download PDFs and maintain a cache with SHA256 hashing for change detection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { PDFLink } from './pdf-discovery.ts';
import type { SourceDocument } from '../lib/schema.ts';

const CACHE_DIR = path.join(process.cwd(), 'data', 'pdf-cache');
const METADATA_FILE = path.join(process.cwd(), 'data', 'source-documents.json');

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
}

/**
 * Calculate SHA256 hash of a buffer
 */
function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Load existing source documents metadata
 */
async function loadSourceDocuments(): Promise<SourceDocument[]> {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save source documents metadata
 */
async function saveSourceDocuments(docs: SourceDocument[]) {
  await fs.writeFile(METADATA_FILE, JSON.stringify(docs, null, 2), 'utf-8');
}

/**
 * Download a PDF and save to cache
 */
export async function downloadPDF(link: PDFLink): Promise<SourceDocument | null> {
  console.log(`Downloading ${link.centerId} ${link.month}...`);
  
  try {
    const response = await fetch(link.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaitamaCityScheduleApp/1.0)',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to download ${link.url}: ${response.status}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const sha256 = calculateSHA256(buffer);
    
    // Check if we already have this exact file
    const existing = (await loadSourceDocuments()).find(
      doc => doc.centerId === link.centerId && 
             doc.month === link.month && 
             doc.sha256 === sha256
    );
    
    if (existing) {
      console.log(`  Skipped (unchanged): ${link.centerId} ${link.month}`);
      return existing;
    }
    
    // Save to cache
    const filename = `${link.centerId}-${link.month}.pdf`;
    const cachePath = path.join(CACHE_DIR, filename);
    await fs.writeFile(cachePath, buffer);
    
    const doc: SourceDocument = {
      id: `${link.centerId}-${link.month}`,
      centerId: link.centerId,
      month: link.month,
      pdfUrl: link.url,
      fetchedAt: new Date().toISOString(),
      sha256,
    };
    
    console.log(`  Downloaded: ${filename} (${sha256.slice(0, 8)}...)`);
    return doc;
  } catch (error) {
    console.error(`Error downloading ${link.url}:`, error);
    return null;
  }
}

/**
 * Download all PDFs and update metadata
 */
export async function downloadAllPDFs(links: PDFLink[]): Promise<SourceDocument[]> {
  await ensureCacheDir();
  const existing = await loadSourceDocuments();
  const newDocs: SourceDocument[] = [];
  
  for (const link of links) {
    const doc = await downloadPDF(link);
    if (doc) {
      // Remove old version if exists
      const idx = existing.findIndex(d => d.id === doc.id);
      if (idx >= 0) {
        existing[idx] = doc;
      } else {
        existing.push(doc);
      }
      newDocs.push(doc);
    }
  }
  
  await saveSourceDocuments(existing);
  return newDocs;
}

/**
 * Get path to cached PDF
 */
export function getCachedPDFPath(doc: SourceDocument): string {
  return path.join(CACHE_DIR, `${doc.centerId}-${doc.month}.pdf`);
}

/**
 * Check if a source document needs AI extraction
 * (has been downloaded but not yet extracted)
 */
export function needsExtraction(doc: SourceDocument): boolean {
  return !doc.extractedAt;
}

// CLI interface
if (import.meta.main) {
  const links = JSON.parse(process.argv[2] || '[]') as PDFLink[];
  downloadAllPDFs(links).then(docs => {
    console.log('\nDownloaded documents:');
    console.log(JSON.stringify(docs, null, 2));
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
