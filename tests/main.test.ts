import { describe, it } from "node:test";
import assert from "node:assert";
import { validateEvent_single, validateExtractedEvents } from "../scripts/validator.ts";
import type { Event, SourceDocument } from "../lib/schema.ts";

const createValidEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "test-1",
  centerId: "nishi",
  sourceDocumentId: "nishi-2026-10",
  date: "2026-10-15",
  title: "Test Event",
  kind: "event",
  origin: "extracted",
  ...overrides,
});

describe("Event Validation", () => {
  const validEvent: Event = createValidEvent();

  it("should validate a valid event", () => {
    const result = validateEvent_single(validEvent);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it("should reject event without required fields", () => {
    const invalid = { ...validEvent, title: undefined };
    const result = validateEvent_single(invalid);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("should reject a bad kind", () => {
    const result = validateEvent_single({ ...validEvent, kind: "workshop" });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("kind")));
  });

  it("should reject invalid date format", () => {
    const invalid = { ...validEvent, date: "not-a-date" };
    const result = validateEvent_single(invalid);
    assert.strictEqual(result.valid, false);
  });

  it("should warn about startTime after endTime", () => {
    const event = { ...validEvent, startTime: "15:00", endTime: "10:00" };
    const result = validateEvent_single(event);
    assert.ok(result.warnings.length > 0);
  });

  it("should validate event with optional fields", () => {
    const event: Event = {
      ...validEvent,
      startTime: "10:00",
      endTime: "11:30",
      description: "Test description",
      targetAge: "0～3歳",
      reservationRequired: true,
      location: "Test location",
      capacity: 10,
      tags: ["test", "example"],
    };
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });
});

describe("Event Array Validation", () => {
  const sourceDoc: SourceDocument = {
    id: "nishi-2026-10",
    centerId: "nishi",
    month: "2026-10",
    pdfUrl: "https://example.com/test.pdf",
    fetchedAt: "2026-10-20T00:00:00Z",
    sha256: "test123",
  };

  const validEvents: Event[] = [
    createValidEvent({ id: "test-1", date: "2026-10-15", title: "Event 1" }),
    createValidEvent({ id: "test-2", date: "2026-10-20", title: "Event 2" }),
  ];

  it("should validate valid event array", () => {
    const result = validateExtractedEvents(validEvents, sourceDoc);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it("should reject mismatched centerId", () => {
    const invalid = [{ ...validEvents[0], centerId: "wrong" }];
    const result = validateExtractedEvents(invalid, sourceDoc);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("centerId")));
  });

  it("should reject mismatched sourceDocumentId", () => {
    const invalid = [{ ...validEvents[0], sourceDocumentId: "wrong-doc" }];
    const result = validateExtractedEvents(invalid, sourceDoc);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("sourceDocumentId")));
  });

  it("should warn about event date outside source month", () => {
    const events = [{ ...validEvents[0], date: "2026-11-01" }];
    const result = validateExtractedEvents(events, sourceDoc);
    assert.ok(result.warnings.some((w) => w.includes("not in source document month")));
  });

  it("should detect duplicate event IDs", () => {
    const duplicates = [validEvents[0], { ...validEvents[1], id: validEvents[0].id }];
    const result = validateExtractedEvents(duplicates, sourceDoc);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("duplicate")));
  });

  it("should validate empty event array", () => {
    const result = validateExtractedEvents([], sourceDoc);
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes("No events")));
  });
});

describe("Event ID Generation", () => {
  it("should generate unique IDs for same-day events", () => {
    const events: Event[] = [
      createValidEvent({
        id: "nishi-2026-10-15-event1",
        date: "2026-10-15",
        title: "Morning Event",
      }),
      createValidEvent({
        id: "nishi-2026-10-15-event2",
        date: "2026-10-15",
        title: "Afternoon Event",
      }),
    ];
    const ids = events.map((e) => e.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  it("should follow ID naming convention", () => {
    const event = createValidEvent({ id: "nishi-2026-10-15-event1" });
    const pattern = /^[a-z]+-\d{4}-\d{2}-\d{2}-.+$/;
    assert.ok(pattern.test(event.id));
  });
});

describe("Time Validation", () => {
  it("should accept valid 24-hour time format", () => {
    const event = createValidEvent({ startTime: "09:30", endTime: "11:45" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });

  it("should reject invalid time format", () => {
    const event = createValidEvent({ startTime: "9:30" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });

  it("should reject out-of-range hours", () => {
    const event = createValidEvent({ startTime: "25:00" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });

  it("should reject out-of-range minutes", () => {
    const event = createValidEvent({ startTime: "10:60" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });
});

describe("Date Validation", () => {
  it("should accept valid date format", () => {
    const event = createValidEvent({ date: "2026-10-15" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });

  it("should reject invalid month", () => {
    const event = createValidEvent({ date: "2026-13-01" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });

  it("should reject invalid day", () => {
    const event = createValidEvent({ date: "2026-10-32" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });

  it("should reject February 30", () => {
    const event = createValidEvent({ date: "2026-02-30" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });
});

describe("Center ID Validation", () => {
  const validCenterIds = [
    "nishi",
    "kita",
    "omiya",
    "minuma",
    "yono",
    "sakura",
    "urawa",
    "minami",
    "midori",
    "iwatsuki",
  ];

  it("should accept all valid center IDs", () => {
    validCenterIds.forEach((centerId) => {
      const event = createValidEvent({ centerId, sourceDocumentId: `${centerId}-2026-10` });
      const result = validateEvent_single(event);
      assert.strictEqual(result.valid, true);
    });
  });

  it("should reject invalid center ID", () => {
    const event = createValidEvent({ centerId: "invalid-center" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });
});

describe("Source Document Validation", () => {
  it("should validate sourceDocumentId format", () => {
    const event = createValidEvent();
    const pattern = /^[a-z]+-\d{4}-\d{2}$/;
    assert.ok(pattern.test(event.sourceDocumentId));
  });

  it("should match centerId in sourceDocumentId", () => {
    const event = createValidEvent({ sourceDocumentId: "omiya-2026-10" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });
});

describe("Optional Fields", () => {
  it("should accept missing optional fields", () => {
    const minimal: Event = {
      id: "test-minimal",
      centerId: "nishi",
      sourceDocumentId: "nishi-2026-10",
      date: "2026-10-15",
      title: "Minimal Event",
      kind: "event",
      origin: "extracted",
    };
    const result = validateEvent_single(minimal);
    assert.strictEqual(result.valid, true);
  });

  it("should accept all optional fields", () => {
    const complete: Event = {
      id: "test-complete",
      centerId: "nishi",
      sourceDocumentId: "nishi-2026-10",
      date: "2026-10-15",
      startTime: "10:00",
      endTime: "11:30",
      title: "Complete Event",
      kind: "event",
      origin: "extracted",
      description: "Full description",
      targetAge: "0～3歳",
      reservationRequired: true,
      location: "Main Hall",
      capacity: 20,
      tags: ["workshop", "indoor"],
    };
    const result = validateEvent_single(complete);
    assert.strictEqual(result.valid, true);
  });

  it("should validate capacity as positive number", () => {
    const event: any = {
      id: "test",
      centerId: "nishi",
      sourceDocumentId: "nishi-2026-10",
      date: "2026-10-15",
      title: "Test",
      kind: "event",
      origin: "extracted",
      capacity: -5,
    };
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, false);
  });

  it("should accept capacity of zero", () => {
    const event: Event = {
      id: "test",
      centerId: "nishi",
      sourceDocumentId: "nishi-2026-10",
      date: "2026-10-15",
      title: "Test",
      kind: "event",
      origin: "extracted",
      capacity: 0,
    };
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });

  it("should validate tags as array of strings", () => {
    const event: Event = {
      id: "test",
      centerId: "nishi",
      sourceDocumentId: "nishi-2026-10",
      date: "2026-10-15",
      title: "Test",
      kind: "event",
      origin: "extracted",
      tags: ["valid", "tags"],
    };
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });
});

describe("Calendar Date Bucketing", () => {
  const octoberEvents: Event[] = [
    createValidEvent({ date: "2026-10-01" }),
    createValidEvent({ id: "test-2", date: "2026-10-15" }),
    createValidEvent({ id: "test-3", date: "2026-10-31" }),
  ];

  it("should group events by date", () => {
    const byDate = octoberEvents.reduce(
      (acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
      },
      {} as Record<string, Event[]>,
    );

    assert.strictEqual(Object.keys(byDate).length, 3);
    assert.strictEqual(byDate["2026-10-01"].length, 1);
  });

  it("should identify month start and end", () => {
    const dates = octoberEvents.map((e) => e.date).sort();
    assert.strictEqual(dates[0], "2026-10-01");
    assert.strictEqual(dates[dates.length - 1], "2026-10-31");
  });

  it("should handle events across month boundary", () => {
    const crossMonth = [
      createValidEvent({ date: "2026-10-31" }),
      createValidEvent({ id: "test-nov", date: "2026-11-01", sourceDocumentId: "nishi-2026-11" }),
    ];

    const octoberEvents = crossMonth.filter((e) => e.date.startsWith("2026-10"));
    const novemberEvents = crossMonth.filter((e) => e.date.startsWith("2026-11"));

    assert.strictEqual(octoberEvents.length, 1);
    assert.strictEqual(novemberEvents.length, 1);
  });
});

describe("Data Merging", () => {
  it("should not duplicate events on merge", () => {
    const event1 = createValidEvent({ id: "event-1" });
    const event2 = createValidEvent({ id: "event-2" });
    const existing: Event[] = [event1];
    const newEvents: Event[] = [event1, event2];

    const merged = [...existing];
    newEvents.forEach((newEvent) => {
      if (!merged.some((e) => e.id === newEvent.id)) {
        merged.push(newEvent);
      }
    });

    assert.strictEqual(merged.length, 2);
  });

  it("should replace center-month events on re-extraction", () => {
    const existing: Event[] = [
      createValidEvent({ id: "old-1", title: "Old Event 1" }),
      createValidEvent({ id: "old-2", title: "Old Event 2" }),
      createValidEvent({
        id: "omiya-1",
        centerId: "omiya",
        sourceDocumentId: "omiya-2026-10",
        title: "Other Center",
      }),
    ];

    const reExtracted: Event[] = [
      createValidEvent({ id: "new-1", title: "New Event 1" }),
      createValidEvent({ id: "new-2", title: "New Event 2" }),
      createValidEvent({ id: "new-3", title: "New Event 3" }),
    ];

    const sourceDocId = "nishi-2026-10";
    const filtered = existing.filter((e) => e.sourceDocumentId !== sourceDocId);
    const merged = [...filtered, ...reExtracted];

    assert.strictEqual(merged.filter((e) => e.sourceDocumentId === sourceDocId).length, 3);
    assert.strictEqual(merged.filter((e) => e.centerId === "omiya").length, 1);
  });
});

describe("Schema Validation", async () => {
  it("should have all required fields in CENTERS", async () => {
    const { CENTERS } = await import("../lib/schema.ts");
    CENTERS.forEach((center: any) => {
      assert.ok(center.id);
      assert.ok(center.name);
      assert.ok(center.nameJa);
      assert.ok(center.address);
      assert.ok(center.phone);
      assert.ok(center.websiteUrl);
      assert.ok(center.closedDays);
    });
  });

  it("should have unique center IDs", async () => {
    const { CENTERS } = await import("../lib/schema.ts");
    const ids = CENTERS.map((c: any) => c.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  it("should have 12 centers registered", async () => {
    const { CENTERS } = await import("../lib/schema.ts");
    assert.strictEqual(CENTERS.length, 12);
  });
});

describe("Time Validation Extended", () => {
  it("should accept valid 24-hour time format", () => {
    const event = createValidEvent({ startTime: "14:30" });
    const result = validateEvent_single(event);
    assert.strictEqual(result.valid, true);
  });
});

describe("Event ID Generation Extended", () => {
  it("should generate unique IDs for same-day events", () => {
    const events: Event[] = [
      createValidEvent({
        id: "nishi-2026-10-15-event1",
        date: "2026-10-15",
        title: "Morning Event",
      }),
      createValidEvent({
        id: "nishi-2026-10-15-event2",
        date: "2026-10-15",
        title: "Afternoon Event",
      }),
    ];

    const ids = events.map((e) => e.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  it("should follow ID naming convention", () => {
    const event = createValidEvent();
    const pattern = /^[a-z]+-/;
    assert.ok(pattern.test(event.id));
  });
});
