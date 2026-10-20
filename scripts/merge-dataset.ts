/**
 * Merge validated events into the main dataset
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DataSet, Event, SourceDocument } from '../lib/schema';
import { CENTERS } from '../lib/schema';

const DATASET_FILE = path.join(process.cwd(), 'data', 'dataset.json');

/**
 * Load existing dataset or create a new one
 */
export async function loadDataSet(): Promise<DataSet> {
  try {
    const data = await fs.readFile(DATASET_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      centers: CENTERS,
      sourceDocuments: [],
      events: [],
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

/**
 * Save dataset to file
 */
export async function saveDataSet(dataset: DataSet) {
  await fs.mkdir(path.dirname(DATASET_FILE), { recursive: true });
  dataset.generatedAt = new Date().toISOString();
  await fs.writeFile(DATASET_FILE, JSON.stringify(dataset, null, 2), 'utf-8');
}

/**
 * Merge source document into dataset
 */
export function mergeSourceDocument(
  dataset: DataSet,
  sourceDoc: SourceDocument
): void {
  const idx = dataset.sourceDocuments.findIndex(d => d.id === sourceDoc.id);
  if (idx >= 0) {
    dataset.sourceDocuments[idx] = sourceDoc;
  } else {
    dataset.sourceDocuments.push(sourceDoc);
  }
}

/**
 * Merge events into dataset (replace events from the same source document)
 */
export function mergeEvents(
  dataset: DataSet,
  events: Event[],
  sourceDocId: string
): void {
  // Remove existing events from this source document
  dataset.events = dataset.events.filter(
    e => e.sourceDocumentId !== sourceDocId
  );
  
  // Add new events
  dataset.events.push(...events);
  
  // Sort by date
  dataset.events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    return 0;
  });
}

/**
 * Remove old events (older than 2 months)
 */
export function cleanupOldEvents(dataset: DataSet): void {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const cutoffDate = twoMonthsAgo.toISOString().slice(0, 10);
  
  const beforeCount = dataset.events.length;
  dataset.events = dataset.events.filter(e => e.date >= cutoffDate);
  const afterCount = dataset.events.length;
  
  if (beforeCount > afterCount) {
    console.log(`Cleaned up ${beforeCount - afterCount} old events`);
  }
}

/**
 * Get statistics about the dataset
 */
export function getDataSetStats(dataset: DataSet): {
  totalEvents: number;
  eventsByCenter: Record<string, number>;
  eventsByMonth: Record<string, number>;
  sourceDocuments: number;
} {
  const eventsByCenter: Record<string, number> = {};
  const eventsByMonth: Record<string, number> = {};
  
  for (const event of dataset.events) {
    eventsByCenter[event.centerId] = (eventsByCenter[event.centerId] || 0) + 1;
    const month = event.date.slice(0, 7);
    eventsByMonth[month] = (eventsByMonth[month] || 0) + 1;
  }
  
  return {
    totalEvents: dataset.events.length,
    eventsByCenter,
    eventsByMonth,
    sourceDocuments: dataset.sourceDocuments.length,
  };
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'stats') {
    loadDataSet().then(dataset => {
      const stats = getDataSetStats(dataset);
      console.log('Dataset Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    }).catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
  } else if (command === 'cleanup') {
    loadDataSet().then(dataset => {
      cleanupOldEvents(dataset);
      return saveDataSet(dataset);
    }).then(() => {
      console.log('Cleanup complete');
    }).catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
  } else {
    console.log('Usage: node merge-dataset.ts [stats|cleanup]');
    process.exit(1);
  }
}
