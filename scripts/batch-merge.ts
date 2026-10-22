/**
 * Batch merge all extracted and validated events into the dataset
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import type { Event, DataSet, SourceDocument } from '../lib/schema.ts';
import { CENTERS } from '../lib/schema.ts';

const extractedDir = 'data/extracted-events';
const datasetPath = 'public/data/dataset.json';

// Load or create dataset
let dataset: DataSet;
try {
  dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  console.log(`Loaded existing dataset with ${dataset.events.length} events`);
} catch {
  dataset = {
    centers: CENTERS,
    sourceDocuments: [],
    events: [],
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  console.log('Created new dataset');
}

// Get all JSON files in extracted-events directory
const files = readdirSync(extractedDir).filter(f => f.endsWith('.json'));

console.log(`\nFound ${files.length} extracted event files to merge\n`);

let totalAdded = 0;
const sourceDocIds = new Set<string>();

for (const file of files) {
  const filePath = `${extractedDir}/${file}`;
  const events: Event[] = JSON.parse(readFileSync(filePath, 'utf-8'));
  
  if (events.length === 0) {
    console.log(`⊘ ${file}: No events, skipping`);
    continue;
  }
  
  const sourceDocId = events[0].sourceDocumentId;
  sourceDocIds.add(sourceDocId);
  
  // Remove old events from this source document
  const beforeCount = dataset.events.length;
  dataset.events = dataset.events.filter(e => e.sourceDocumentId !== sourceDocId);
  const removed = beforeCount - dataset.events.length;
  
  // Add new events
  dataset.events.push(...events);
  totalAdded += events.length;
  
  console.log(`✓ ${file}: Merged ${events.length} events (replaced ${removed})`);
  
  // Add or update source document if not already present
  const [centerId, month] = sourceDocId.split('-');
  const center = CENTERS.find(c => c.id === centerId);
  if (!center) {
    console.warn(`  ⚠ Warning: Center ${centerId} not found in CENTERS array`);
    continue;
  }
  
  const existing = dataset.sourceDocuments.find(d => d.id === sourceDocId);
  if (!existing) {
    const sourceDoc: SourceDocument = {
      id: sourceDocId,
      centerId,
      month,
      pdfUrl: `${center.websiteUrl}`, // Placeholder, should be actual PDF URL
      fetchedAt: new Date().toISOString(),
      sha256: '',
      extractedAt: new Date().toISOString(),
    };
    dataset.sourceDocuments.push(sourceDoc);
  } else {
    existing.extractedAt = new Date().toISOString();
  }
}

// Sort events by date and time
dataset.events.sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
  return 0;
});

// Update timestamp
dataset.generatedAt = new Date().toISOString();

// Save
writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), 'utf-8');

console.log(`\n=== Merge Complete ===`);
console.log(`Total events in dataset: ${dataset.events.length}`);
console.log(`Total source documents: ${dataset.sourceDocuments.length}`);
console.log(`Unique source documents processed: ${sourceDocIds.size}`);

// Show stats by center
const eventsByCenter: Record<string, number> = {};
for (const event of dataset.events) {
  eventsByCenter[event.centerId] = (eventsByCenter[event.centerId] || 0) + 1;
}

console.log('\nEvents by center:');
for (const [centerId, count] of Object.entries(eventsByCenter).sort((a, b) => b[1] - a[1])) {
  const center = CENTERS.find(c => c.id === centerId);
  console.log(`  ${center?.nameJa || centerId}: ${count} events`);
}
