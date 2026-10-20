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
});
