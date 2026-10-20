/**
 * Validate AI-extracted events against the schema
 */

import { Event, SourceDocument } from '../lib/schema';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const eventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    centerId: { type: 'string' },
    sourceDocumentId: { type: 'string' },
    date: { type: 'string', format: 'date' },
    startTime: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' },
    endTime: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    targetAge: { type: 'string' },
    reservationRequired: { type: 'boolean' },
    location: { type: 'string' },
    capacity: { type: 'number', minimum: 0 },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'centerId', 'sourceDocumentId', 'date', 'title'],
  additionalProperties: false,
};

const eventsArraySchema = {
  type: 'array',
  items: eventSchema,
};

const validateEvent: ValidateFunction = ajv.compile(eventSchema);
const validateEventsArray: ValidateFunction = ajv.compile(eventsArraySchema);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single event
 */
export function validateEvent_single(event: any): ValidationResult {
  const valid = validateEvent(event);
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!valid && validateEvent.errors) {
    for (const error of validateEvent.errors) {
      errors.push(`${error.instancePath} ${error.message}`);
    }
  }
  
  // Additional validation rules
  if (event.startTime && event.endTime) {
    if (event.startTime >= event.endTime) {
      warnings.push('startTime should be before endTime');
    }
  }
  
  // Check date is in the correct month
  if (event.date) {
    const eventDate = new Date(event.date);
    if (isNaN(eventDate.getTime())) {
      errors.push('Invalid date format');
    }
  }
  
  return {
    valid: valid && errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an array of events extracted from a source document
 */
export function validateExtractedEvents(
  events: any[],
  sourceDoc: SourceDocument
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };
  
  // Validate array structure
  if (!validateEventsArray(events)) {
    result.valid = false;
    if (validateEventsArray.errors) {
      for (const error of validateEventsArray.errors) {
        result.errors.push(`${error.instancePath} ${error.message}`);
      }
    }
    return result;
  }
  
  // Validate each event
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventResult = validateEvent_single(event);
    
    // Check event belongs to correct source document
    if (event.sourceDocumentId !== sourceDoc.id) {
      eventResult.errors.push(
        `sourceDocumentId mismatch: expected ${sourceDoc.id}, got ${event.sourceDocumentId}`
      );
      eventResult.valid = false;
    }
    
    if (event.centerId !== sourceDoc.centerId) {
      eventResult.errors.push(
        `centerId mismatch: expected ${sourceDoc.centerId}, got ${event.centerId}`
      );
      eventResult.valid = false;
    }
    
    // Check event date is in the source document's month
    if (event.date) {
      const eventMonth = event.date.slice(0, 7);
      if (eventMonth !== sourceDoc.month) {
        eventResult.warnings.push(
          `Event date ${event.date} is not in source document month ${sourceDoc.month}`
        );
      }
    }
    
    if (!eventResult.valid) {
      result.valid = false;
    }
    
    result.errors.push(
      ...eventResult.errors.map(e => `Event [${i}] (${event.title || 'untitled'}): ${e}`)
    );
    result.warnings.push(
      ...eventResult.warnings.map(w => `Event [${i}] (${event.title || 'untitled'}): ${w}`)
    );
  }
  
  return result;
}

/**
 * CLI interface for testing validation
 */
if (require.main === module) {
  const testEvents = JSON.parse(process.argv[2] || '[]');
  const testSourceDoc = JSON.parse(process.argv[3] || '{}');
  
  const result = validateExtractedEvents(testEvents, testSourceDoc);
  
  console.log('Validation Result:');
  console.log(`Valid: ${result.valid}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log(`  - ${e}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  process.exit(result.valid ? 0 : 1);
}
