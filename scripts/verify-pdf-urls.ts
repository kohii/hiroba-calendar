/**
 * Script to verify that all source document PDF URLs resolve (HTTP 200)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SourceDocument } from '../lib/schema';

const SOURCE_DOCS_FILE = path.join(process.cwd(), 'data', 'source-documents.json');

interface VerificationResult {
  url: string;
  status: number;
  ok: boolean;
  error?: string;
}

/**
 * Check if a URL resolves with HTTP 200
 */
async function verifyURL(url: string): Promise<VerificationResult> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SaitamaCityScheduleApp/1.0)',
      },
    });
    
    return {
      url,
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify all source documents have accessible PDFs
 */
export async function verifyAllSourceDocuments(): Promise<{
  total: number;
  valid: number;
  invalid: VerificationResult[];
}> {
  try {
    const data = await fs.readFile(SOURCE_DOCS_FILE, 'utf-8');
    const sourceDocs: SourceDocument[] = JSON.parse(data);
    
    console.log(`Verifying ${sourceDocs.length} source documents...\n`);
    
    const results: VerificationResult[] = [];
    const invalid: VerificationResult[] = [];
    
    for (const doc of sourceDocs) {
      const result = await verifyURL(doc.pdfUrl);
      results.push(result);
      
      if (result.ok) {
        console.log(`✓ ${doc.id}: ${result.status}`);
      } else {
        console.log(`✗ ${doc.id}: ${result.status} ${result.error || ''}`);
        invalid.push(result);
      }
    }
    
    return {
      total: sourceDocs.length,
      valid: results.filter(r => r.ok).length,
      invalid,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No source documents file found.');
      return { total: 0, valid: 0, invalid: [] };
    }
    throw error;
  }
}

/**
 * Remove source documents with invalid URLs from the file
 */
export async function removeInvalidSourceDocuments(): Promise<number> {
  try {
    const data = await fs.readFile(SOURCE_DOCS_FILE, 'utf-8');
    const sourceDocs: SourceDocument[] = JSON.parse(data);
    
    const validDocs: SourceDocument[] = [];
    let removed = 0;
    
    for (const doc of sourceDocs) {
      const result = await verifyURL(doc.pdfUrl);
      if (result.ok) {
        validDocs.push(doc);
      } else {
        console.log(`Removing ${doc.id} (${result.status})`);
        removed++;
      }
    }
    
    await fs.writeFile(SOURCE_DOCS_FILE, JSON.stringify(validDocs, null, 2), 'utf-8');
    console.log(`\nRemoved ${removed} invalid source documents.`);
    console.log(`${validDocs.length} valid documents remaining.`);
    
    return removed;
  } catch (error) {
    console.error('Error:', error);
    return 0;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'remove') {
    removeInvalidSourceDocuments().then(count => {
      process.exit(count > 0 ? 0 : 1);
    }).catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
  } else {
    verifyAllSourceDocuments().then(result => {
      console.log(`\n=== Summary ===`);
      console.log(`Total: ${result.total}`);
      console.log(`Valid: ${result.valid}`);
      console.log(`Invalid: ${result.invalid.length}`);
      
      if (result.invalid.length > 0) {
        console.log(`\nInvalid URLs:`);
        result.invalid.forEach(r => {
          console.log(`  ${r.url} (${r.status}${r.error ? `: ${r.error}` : ''})`);
        });
        console.log(`\nTo remove invalid documents, run: npm run verify-pdfs -- remove`);
      }
      
      process.exit(result.invalid.length > 0 ? 1 : 0);
    }).catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
  }
}
