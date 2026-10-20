/**
 * Validate and merge extracted events into the dataset
 */
import { readFileSync, writeFileSync } from 'fs';
import { Event, SourceDocument, DataSet } from '../lib/schema';
import { validateExtractedEvents } from './validator';
import { CENTERS } from '../lib/schema';

const centerId = process.argv[2];
const month = process.argv[3];

if (!centerId || !month) {
  console.error('Usage: tsx validate-and-merge.ts <centerId> <month>');
  process.exit(1);
}

const sourceDocId = `${centerId}-${month}`;
const extractedPath = `data/extracted-events/${sourceDocId}.json`;
const sourceDocsPath = 'data/source-documents.json';
const datasetPath = 'public/data/dataset.json';

// Load extracted events
const extractedEvents: Event[] = JSON.parse(readFileSync(extractedPath, 'utf-8'));
console.log(`Loaded ${extractedEvents.length} events from ${extractedPath}`);

// Load source documents
const sourceDocs: SourceDocument[] = JSON.parse(readFileSync(sourceDocsPath, 'utf-8'));
const sourceDoc = sourceDocs.find(d => d.id === sourceDocId);

if (!sourceDoc) {
  console.error(`Source document ${sourceDocId} not found`);
  process.exit(1);
}

// Validate
const validation = validateExtractedEvents(extractedEvents, sourceDoc);

console.log('\nValidation Result:');
console.log(`Valid: ${validation.valid}`);

if (validation.errors.length > 0) {
  console.log('\nErrors:');
  validation.errors.forEach(e => console.log(`  - ${e}`));
}

if (validation.warnings.length > 0) {
  console.log('\nWarnings:');
  validation.warnings.forEach(w => console.log(`  - ${w}`));
}

if (!validation.valid) {
  console.error('\nValidation failed. Please fix errors before merging.');
  process.exit(1);
}

// Load or create dataset
let dataset: DataSet;
try {
  dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
} catch {
  dataset = {
    centers: CENTERS,
    sourceDocuments: [],
    events: [],
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

// Update source document extractedAt
sourceDoc.extractedAt = new Date().toISOString();
const idx = dataset.sourceDocuments.findIndex(d => d.id === sourceDoc.id);
if (idx >= 0) {
  dataset.sourceDocuments[idx] = sourceDoc;
} else {
  dataset.sourceDocuments.push(sourceDoc);
}

// Remove old events from this source
dataset.events = dataset.events.filter(e => e.sourceDocumentId !== sourceDocId);

// Add new events
dataset.events.push(...extractedEvents);

// Sort by date
dataset.events.sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
  return 0;
});

// Update timestamp
dataset.generatedAt = new Date().toISOString();

// Save
writeFileSync(sourceDocsPath, JSON.stringify(sourceDocs, null, 2), 'utf-8');
writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), 'utf-8');

console.log(`\nMerged ${extractedEvents.length} events into dataset`);
console.log(`Total events in dataset: ${dataset.events.length}`);
console.log(`Total source documents: ${dataset.sourceDocuments.length}`);
