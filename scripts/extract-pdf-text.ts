/**
 * Extract text from PDF using pdfjs-dist
 */
import { readFileSync, writeFileSync } from 'fs';

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = process.argv[2];
const outputPath = process.argv[3];

if (!pdfPath || !outputPath) {
  console.error('Usage: tsx extract-pdf-text.ts <pdf-path> <output-path>');
  process.exit(1);
}

async function extractText() {
  const dataBuffer = readFileSync(pdfPath);
  const data = new Uint8Array(dataBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  
  writeFileSync(outputPath, fullText, 'utf-8');
  console.log(`Extracted ${pdf.numPages} pages, ${fullText.length} characters`);
}

extractText().catch((err: any) => {
  console.error('Error:', err);
  process.exit(1);
});
