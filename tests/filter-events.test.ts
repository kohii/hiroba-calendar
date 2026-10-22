import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterEvents } from "../lib/filter-events.ts";
import type { Event } from "../lib/schema.ts";

function event(
  overrides: Partial<Event> & Pick<Event, "id" | "centerId" | "date" | "kind">,
): Event {
  return {
    sourceDocumentId: `${overrides.centerId}-2026-10`,
    title: overrides.kind === "hiroba" ? "ひろば" : "講座",
    origin: "extracted",
    ...overrides,
  };
}

const events: Event[] = [
  event({ id: "nishi-h", centerId: "nishi", date: "2026-10-01", kind: "hiroba" }),
  event({ id: "nishi-e", centerId: "nishi", date: "2026-10-02", kind: "event" }),
  event({ id: "omiya-h", centerId: "omiya", date: "2026-10-01", kind: "hiroba" }),
  event({
    id: "omiya-e",
    centerId: "omiya",
    date: "2026-11-01",
    kind: "event",
    sourceDocumentId: "omiya-2026-11",
  }),
];

describe("filterEvents", () => {
  it("keeps hiroba rows for one center in one month", () => {
    const result = filterEvents(events, { centers: ["nishi"], month: "2026-10", type: "hiroba" });
    assert.deepStrictEqual(
      result.map((item) => item.id),
      ["nishi-h"],
    );
  });

  it("keeps event rows for every center when centers is empty", () => {
    const result = filterEvents(events, { centers: [], month: "2026-10", type: "event" });
    assert.deepStrictEqual(
      result.map((item) => item.id),
      ["nishi-e"],
    );
  });

  it("keeps both kinds for a center when type is all and month is unset", () => {
    const result = filterEvents(events, { centers: ["omiya"], month: null, type: "all" });
    assert.deepStrictEqual(
      result.map((item) => item.id),
      ["omiya-h", "omiya-e"],
    );
  });

  it("returns no hiroba rows for a month that has none", () => {
    const result = filterEvents(events, { centers: [], month: "2026-11", type: "hiroba" });
    assert.deepStrictEqual(result, []);
  });
});
