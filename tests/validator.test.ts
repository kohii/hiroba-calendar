import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateExtractedEvents } from "../scripts/validator.ts";
import type { Event, SourceDocument } from "../lib/schema.ts";

describe("validateExtractedEvents", () => {
  const baseSourceDoc: SourceDocument = {
    id: "minami-2026-12",
    centerId: "minami",
    month: "2026-12",
    pdfUrl: "https://example.com/test.pdf",
    fetchedAt: "2026-11-21T13:00:00Z",
    sha256: "abc123",
    closures: [],
  };

  const baseEvent: Event = {
    id: "test-event",
    centerId: "minami",
    sourceDocumentId: "minami-2026-12",
    date: "2026-12-01",
    title: "にこにこ広場",
    kind: "hiroba",
    origin: "extracted",
  };

  describe("regular hiroba validation with closures", () => {
    it("rejects regular hiroba on a normal day (would duplicate apply-schedule-model)", () => {
      const event: Event = {
        ...baseEvent,
        startTime: "09:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.includes("にこにこ広場 is filled by apply-schedule-model"),
        ),
      );
    });

    it("allows regular hiroba on an AM-closure day", () => {
      const sourceDoc: SourceDocument = {
        ...baseSourceDoc,
        closures: [
          {
            date: "2026-12-03",
            scope: "am",
            quote: "11:00～にこにこ広場",
          },
        ],
      };
      const event: Event = {
        ...baseEvent,
        id: "minami-2026-12-03-hiroba",
        date: "2026-12-03",
        startTime: "11:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], sourceDoc);
      assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(", ")}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it("allows regular hiroba on a PM-closure day", () => {
      const sourceDoc: SourceDocument = {
        ...baseSourceDoc,
        closures: [
          {
            date: "2026-12-04",
            scope: "pm",
            quote: "午後行事のみ",
          },
        ],
      };
      const event: Event = {
        ...baseEvent,
        id: "minami-2026-12-04-hiroba",
        date: "2026-12-04",
        startTime: "09:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], sourceDoc);
      assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(", ")}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it("rejects regular hiroba on all-day closure", () => {
      const sourceDoc: SourceDocument = {
        ...baseSourceDoc,
        closures: [
          {
            date: "2026-12-14",
            scope: "all-day",
            quote: "休館",
          },
        ],
      };
      const event: Event = {
        ...baseEvent,
        id: "minami-2026-12-14-hiroba",
        date: "2026-12-14",
        startTime: "09:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], sourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) =>
          e.includes("にこにこ広場 should not be open on an all-day closure"),
        ),
      );
    });

    it("rejects hiroba spanning the lunch break (12:00-13:00)", () => {
      const event: Event = {
        ...baseEvent,
        title: "にこにこ広場（特別）",
        startTime: "11:30",
        endTime: "13:30",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.includes("spans the closed break 12:00-13:00")),
      );
    });

    it("allows hiroba ending exactly at lunch break start", () => {
      const sourceDoc: SourceDocument = {
        ...baseSourceDoc,
        closures: [
          {
            date: "2026-12-03",
            scope: "am",
            quote: "11:00～にこにこ広場",
          },
        ],
      };
      const event: Event = {
        ...baseEvent,
        id: "minami-2026-12-03-hiroba",
        date: "2026-12-03",
        startTime: "11:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], sourceDoc);
      assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(", ")}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it("allows special hiroba (different title) on any day", () => {
      const event: Event = {
        ...baseEvent,
        title: "0歳さんの広場",
        startTime: "09:00",
        endTime: "12:00",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(", ")}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it("allows event (not hiroba) with regular title", () => {
      const event: Event = {
        ...baseEvent,
        title: "にこにこ広場測定",
        kind: "event",
        startTime: "09:00",
        endTime: "11:00",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(", ")}`);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe("basic validation", () => {
    it("validates a well-formed event", () => {
      const event: Event = {
        ...baseEvent,
        title: "はじめのいっぽ",
        kind: "event",
        startTime: "10:00",
        endTime: "11:00",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it("rejects duplicate event IDs", () => {
      const event1: Event = { ...baseEvent, id: "duplicate-id" };
      const event2: Event = { ...baseEvent, id: "duplicate-id" };
      const result = validateExtractedEvents([event1, event2], baseSourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("duplicate event ID")));
    });

    it("rejects invalid date format", () => {
      const event: Event = { ...baseEvent, date: "2026/12/01" };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("invalid format")));
    });

    it("rejects invalid time format", () => {
      const event: Event = {
        ...baseEvent,
        title: "test event",
        kind: "event",
        startTime: "9:00",
        endTime: "11:00",
      };
      const result = validateExtractedEvents([event], baseSourceDoc);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("invalid format")));
    });
  });
});
