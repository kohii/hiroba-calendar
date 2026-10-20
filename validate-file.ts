import { readFileSync } from 'fs';
import { validateExtractedEvents } from './scripts/validator';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: tsx validate-file.ts <path-to-json>');
  process.exit(1);
}

// Extract centerId and month from filename
const filename = filePath.split('/').pop()!;
const match = filename.match(/^(\w+)-(\d{6})\.json$/);
if (!match) {
  console.error('Invalid filename format. Expected: {centerId}-{YYYYMM}.json');
  process.exit(1);
}

const [, centerId, yyyymm] = match;
const month = `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;

const sourceDoc = {
  id: `${centerId}-${yyyymm}`,
  centerId,
  month,
  url: '',
  downloadedAt: new Date().toISOString()
};

try {
  const events = JSON.parse(readFileSync(filePath, 'utf-8'));
  const result = validateExtractedEvents(events, sourceDoc);
  
  console.log(`\nValidating: ${filename}`);
  console.log(`Events count: ${events.length}`);
  console.log(`Valid: ${result.valid ? '✓' : '✗'}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }
  
  process.exit(result.valid ? 0 : 1);
} catch (err: any) {
  console.error('Error:', err.message);
  process.exit(1);
}
