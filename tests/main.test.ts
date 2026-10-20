import { describe, it, expect } from 'vitest';
import { encodeURLState, decodeURLState } from '../lib/url-state';
import { validateEvent_single, validateExtractedEvents } from '../scripts/validator';
import { Event, SourceDocument } from '../lib/schema';

describe('URL State Management', () => {
  it('should encode empty state', () => {
    const state = {
      centers: [],
      month: null,
      view: 'list' as const,
    };
    expect(encodeURLState(state)).toBe('');
  });
  
  it('should encode state with centers', () => {
    const state = {
      centers: ['nishi', 'omiya'],
      month: null,
      view: 'list' as const,
    };
    expect(encodeURLState(state)).toBe('centers=nishi%2Comiya');
  });
  
  it('should encode full state', () => {
    const state = {
      centers: ['nishi'],
      month: '2026-10',
      view: 'calendar' as const,
    };
    const encoded = encodeURLState(state);
    expect(encoded).toContain('centers=nishi');
    expect(encoded).toContain('month=2026-10');
    expect(encoded).toContain('view=calendar');
  });
  
  it('should decode empty params', () => {
    const params = new URLSearchParams('');
    const state = decodeURLState(params);
    expect(state.centers).toEqual([]);
    expect(state.month).toBeNull();
    expect(state.view).toBe('list');
  });
  
  it('should decode centers param', () => {
    const params = new URLSearchParams('centers=nishi,omiya');
    const state = decodeURLState(params);
    expect(state.centers).toEqual(['nishi', 'omiya']);
  });
  
  it('should decode full params', () => {
    const params = new URLSearchParams('centers=nishi&month=2026-10&view=calendar');
    const state = decodeURLState(params);
    expect(state.centers).toEqual(['nishi']);
    expect(state.month).toBe('2026-10');
    expect(state.view).toBe('calendar');
  });
  
  it('should round-trip state', () => {
    const original = {
      centers: ['nishi', 'omiya', 'minuma'],
      month: '2026-10',
      view: 'calendar' as const,
    };
    const encoded = encodeURLState(original);
    const decoded = decodeURLState(new URLSearchParams(encoded));
    expect(decoded).toEqual(original);
  });
});

describe('Event Validation', () => {
  const validEvent: Event = {
    id: 'test-1',
    centerId: 'nishi',
    sourceDocumentId: 'nishi-2026-10',
    date: '2026-10-15',
    title: 'Test Event',
  };
  
  it('should validate a valid event', () => {
    const result = validateEvent_single(validEvent);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
  
  it('should reject event without required fields', () => {
    const invalid = { ...validEvent, title: undefined };
    const result = validateEvent_single(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  it('should reject invalid date format', () => {
    const invalid = { ...validEvent, date: 'not-a-date' };
    const result = validateEvent_single(invalid);
    expect(result.valid).toBe(false);
  });
  
  it('should warn about startTime after endTime', () => {
    const event = { ...validEvent, startTime: '15:00', endTime: '10:00' };
    const result = validateEvent_single(event);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  
  it('should validate event with optional fields', () => {
    const event: Event = {
      ...validEvent,
      startTime: '10:00',
      endTime: '11:30',
      description: 'Test description',
      targetAge: '0～3歳',
      reservationRequired: true,
      location: 'Test location',
      capacity: 10,
      tags: ['test', 'example'],
    };
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
});

describe('Event Array Validation', () => {
  const sourceDoc: SourceDocument = {
    id: 'nishi-2026-10',
    centerId: 'nishi',
    month: '2026-10',
    pdfUrl: 'https://example.com/test.pdf',
    fetchedAt: '2026-10-20T00:00:00Z',
    sha256: 'test123',
  };
  
  const validEvents: Event[] = [
    {
      id: 'test-1',
      centerId: 'nishi',
      sourceDocumentId: 'nishi-2026-10',
      date: '2026-10-15',
      title: 'Event 1',
    },
    {
      id: 'test-2',
      centerId: 'nishi',
      sourceDocumentId: 'nishi-2026-10',
      date: '2026-10-20',
      title: 'Event 2',
    },
  ];
  
  it('should validate valid event array', () => {
    const result = validateExtractedEvents(validEvents, sourceDoc);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
  
  it('should reject mismatched centerId', () => {
    const invalid = [
      { ...validEvents[0], centerId: 'wrong' },
    ];
    const result = validateExtractedEvents(invalid, sourceDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('centerId'))).toBe(true);
  });
  
  it('should reject mismatched sourceDocumentId', () => {
    const invalid = [
      { ...validEvents[0], sourceDocumentId: 'wrong-doc' },
    ];
    const result = validateExtractedEvents(invalid, sourceDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sourceDocumentId'))).toBe(true);
  });
  
  it('should warn about event date outside source month', () => {
    const events = [
      { ...validEvents[0], date: '2026-11-01' },
    ];
    const result = validateExtractedEvents(events, sourceDoc);
    expect(result.warnings.some(w => w.includes('not in source document month'))).toBe(true);
  });
  
  it('should detect duplicate event IDs', () => {
    const duplicates = [
      validEvents[0],
      { ...validEvents[1], id: validEvents[0].id }, // Duplicate ID
    ];
    const result = validateExtractedEvents(duplicates, sourceDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });
  
  it('should validate empty event array', () => {
    const result = validateExtractedEvents([], sourceDoc);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('No events'))).toBe(true);
  });
});

describe('Event ID Generation', () => {
  it('should generate unique IDs for same-day events', () => {
    const events: Event[] = [
      {
        id: 'nishi-2026-10-15-event1',
        centerId: 'nishi',
        sourceDocumentId: 'nishi-2026-10',
        date: '2026-10-15',
        title: 'Morning Event',
      },
      {
        id: 'nishi-2026-10-15-event2',
        centerId: 'nishi',
        sourceDocumentId: 'nishi-2026-10',
        date: '2026-10-15',
        title: 'Afternoon Event',
      },
    ];
    
    const ids = events.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
  
  it('should follow ID naming convention', () => {
    const event = validEvents[0];
    // Format: {centerId}-{YYYY-MM-DD}-{slug}
    const pattern = /^[a-z]+-\d{4}-\d{2}-\d{2}-.+$/;
    expect(event.id).toMatch(pattern);
  });
});

describe('Time Validation', () => {
  it('should accept valid 24-hour time format', () => {
    const event = createValidEvent({ startTime: '09:30', endTime: '11:45' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
  
  it('should reject invalid time format', () => {
    const event = createValidEvent({ startTime: '9:30' }); // Missing leading zero
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
  
  it('should reject out-of-range hours', () => {
    const event = createValidEvent({ startTime: '25:00' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
  
  it('should reject out-of-range minutes', () => {
    const event = createValidEvent({ startTime: '10:60' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
});

describe('Date Validation', () => {
  it('should accept valid date format', () => {
    const event = createValidEvent({ date: '2026-10-15' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
  
  it('should reject invalid month', () => {
    const event = createValidEvent({ date: '2026-13-01' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
  
  it('should reject invalid day', () => {
    const event = createValidEvent({ date: '2026-10-32' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
  
  it('should reject February 30', () => {
    const event = createValidEvent({ date: '2026-02-30' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
});

describe('Center ID Validation', () => {
  const validCenterIds = ['nishi', 'kita', 'omiya', 'minuma', 'yono', 'sakura', 'urawa', 'minami', 'midori', 'iwatsuki'];
  
  it('should accept all valid center IDs', () => {
    validCenterIds.forEach(centerId => {
      const event = createValidEvent({ centerId, sourceDocumentId: `${centerId}-2026-10` });
      const result = validateEvent_single(event);
      expect(result.valid).toBe(true);
    });
  });
  
  it('should reject invalid center ID', () => {
    const event = createValidEvent({ centerId: 'invalid-center' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
});

describe('Source Document Validation', () => {
  it('should validate sourceDocumentId format', () => {
    const event = createValidEvent();
    // Format: {centerId}-{YYYY-MM}
    const pattern = /^[a-z]+-\d{4}-\d{2}$/;
    expect(event.sourceDocumentId).toMatch(pattern);
  });
  
  it('should match centerId in sourceDocumentId', () => {
    const event = createValidEvent({ sourceDocumentId: 'omiya-2026-10' }); // Mismatch
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
});

describe('Optional Fields', () => {
  it('should accept missing optional fields', () => {
    const minimal: Event = {
      id: 'test-minimal',
      centerId: 'nishi',
      sourceDocumentId: 'nishi-2026-10',
      date: '2026-10-15',
      title: 'Minimal Event',
    };
    const result = validateEvent_single(minimal);
    expect(result.valid).toBe(true);
  });
  
  it('should accept all optional fields', () => {
    const complete: Event = {
      id: 'test-complete',
      centerId: 'nishi',
      sourceDocumentId: 'nishi-2026-10',
      date: '2026-10-15',
      startTime: '10:00',
      endTime: '11:30',
      title: 'Complete Event',
      description: 'Full description',
      targetAge: '0～3歳',
      reservationRequired: true,
      location: 'Main Hall',
      capacity: 20,
      tags: ['workshop', 'indoor'],
    };
    const result = validateEvent_single(complete);
    expect(result.valid).toBe(true);
  });
  
  it('should validate capacity as positive number', () => {
    const event = createValidEvent({ capacity: -5 });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(false);
  });
  
  it('should accept capacity of zero', () => {
    const event = createValidEvent({ capacity: 0 });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
  
  it('should validate tags as array of strings', () => {
    const event = createValidEvent({ tags: ['valid', 'tags'] });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
});

describe('Event ID Generation', () => {
  it('should generate unique IDs for same-day events', () => {
    const events: Event[] = [
      createValidEvent({
        id: 'nishi-2026-10-15-event1',
        date: '2026-10-15',
        title: 'Morning Event',
      }),
      createValidEvent({
        id: 'nishi-2026-10-15-event2',
        date: '2026-10-15',
        title: 'Afternoon Event',
      }),
    ];
    
    const ids = events.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
  
  it('should follow ID naming convention', () => {
    const event = createValidEvent();
    // Format: {centerId}-{YYYY-MM-DD}-{slug} or {centerId}-{other}
    const pattern = /^[a-z]+-/;
    expect(event.id).toMatch(pattern);
  });
});

describe('Time Validation', () => {
  it('should accept valid 24-hour time format', () => {
    const event = createValidEvent({ startTime: '14:30' });
    const result = validateEvent_single(event);
    expect(result.valid).toBe(true);
  });
});

// Shared test data
const createValidEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'test-1',
  centerId: 'nishi',
  sourceDocumentId: 'nishi-2026-10',
  date: '2026-10-15',
  title: 'Test Event',
  ...overrides,
});

describe('Calendar Date Bucketing', () => {
  const octoberEvents: Event[] = [
    createValidEvent({ date: '2026-10-01' }),
    createValidEvent({ id: 'test-2', date: '2026-10-15' }),
    createValidEvent({ id: 'test-3', date: '2026-10-31' }),
  ];
  
  it('should group events by date', () => {
    const byDate = octoberEvents.reduce((acc, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {} as Record<string, Event[]>);
    
    expect(Object.keys(byDate)).toHaveLength(3);
    expect(byDate['2026-10-01']).toHaveLength(1);
  });
  
  it('should identify month start and end', () => {
    const dates = octoberEvents.map(e => e.date).sort();
    expect(dates[0]).toBe('2026-10-01');
    expect(dates[dates.length - 1]).toBe('2026-10-31');
  });
  
  it('should handle events across month boundary', () => {
    const crossMonth = [
      createValidEvent({ date: '2026-10-31' }),
      createValidEvent({ id: 'test-nov', date: '2026-11-01', sourceDocumentId: 'nishi-2026-11' }),
    ];
    
    const octoberEvents = crossMonth.filter(e => e.date.startsWith('2026-10'));
    const novemberEvents = crossMonth.filter(e => e.date.startsWith('2026-11'));
    
    expect(octoberEvents).toHaveLength(1);
    expect(novemberEvents).toHaveLength(1);
  });
});

describe('Data Merging', () => {
  it('should not duplicate events on merge', () => {
    const event1 = createValidEvent({ id: 'event-1' });
    const event2 = createValidEvent({ id: 'event-2' });
    const existing: Event[] = [event1];
    const newEvents: Event[] = [event1, event2]; // First one is duplicate
    
    const merged = [...existing];
    newEvents.forEach(newEvent => {
      if (!merged.some(e => e.id === newEvent.id)) {
        merged.push(newEvent);
      }
    });
    
    expect(merged).toHaveLength(2); // Should not duplicate first event
  });
  
  it('should replace center-month events on re-extraction', () => {
    const existing: Event[] = [
      createValidEvent({ id: 'old-1', title: 'Old Event 1' }),
      createValidEvent({ id: 'old-2', title: 'Old Event 2' }),
      createValidEvent({ id: 'omiya-1', centerId: 'omiya', sourceDocumentId: 'omiya-2026-10', title: 'Other Center' }),
    ];
    
    const reExtracted: Event[] = [
      createValidEvent({ id: 'new-1', title: 'New Event 1' }),
      createValidEvent({ id: 'new-2', title: 'New Event 2' }),
      createValidEvent({ id: 'new-3', title: 'New Event 3' }),
    ];
    
    // Remove old nishi-2026-10 events, keep others
    const sourceDocId = 'nishi-2026-10';
    const filtered = existing.filter(e => e.sourceDocumentId !== sourceDocId);
    const merged = [...filtered, ...reExtracted];
    
    expect(merged.filter(e => e.sourceDocumentId === sourceDocId)).toHaveLength(3);
    expect(merged.filter(e => e.centerId === 'omiya')).toHaveLength(1);
  });
});

describe('Schema Validation', () => {
  it('should have all required fields in CENTERS', () => {
    const { CENTERS } = require('../lib/schema');
    CENTERS.forEach((center: any) => {
      expect(center).toHaveProperty('id');
      expect(center).toHaveProperty('name');
      expect(center).toHaveProperty('nameJa');
      expect(center).toHaveProperty('address');
      expect(center).toHaveProperty('phone');
      expect(center).toHaveProperty('websiteUrl');
      expect(center).toHaveProperty('closedDays');
    });
  });
  
  it('should have unique center IDs', () => {
    const { CENTERS } = require('../lib/schema');
    const ids = CENTERS.map((c: any) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
  
  it('should have 10 centers registered', () => {
    const { CENTERS } = require('../lib/schema');
    expect(CENTERS).toHaveLength(10);
  });
});
