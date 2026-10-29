import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  buildSchedule,
  calendarWeeks,
  daysInMonth,
  hoursLabel,
  shiftMonth,
  todayIn,
} from "../lib/schedule.ts";
import { CENTERS } from "../lib/schema.ts";
import type { Event, SourceDocument } from "../lib/schema.ts";

function event(overrides: Partial<Event> & Pick<Event, "id" | "centerId" | "date" | "kind">): Event {
  return {
    sourceDocumentId: `${overrides.centerId}-${overrides.date.slice(0, 7)}`,
    title: overrides.kind === "hiroba" ? "ひろば" : "講座",
    origin: "extracted",
    ...overrides,
  };
}

const documents: SourceDocument[] = [
  {
    id: "nishi-2026-10",
    centerId: "nishi",
    month: "2026-10",
    pdfUrl: "https://example.com/nishi.pdf",
    fetchedAt: "",
    sha256: "",
    closures: [{ date: "2026-10-15", scope: "all-day", quote: "閉室日" }],
  },
  // Compact month format is used by some documents.
  { id: "minuma-202610", centerId: "minuma", month: "202610", pdfUrl: "", fetchedAt: "", sha256: "" },
];

const schedule = buildSchedule({
  centers: CENTERS,
  sourceDocuments: documents,
  events: [
    event({ id: "n-h", centerId: "nishi", date: "2026-10-02", kind: "hiroba" }),
    event({ id: "n-e2", centerId: "nishi", date: "2026-10-02", kind: "event", startTime: "13:30" }),
    event({ id: "n-e1", centerId: "nishi", date: "2026-10-02", kind: "event", startTime: "10:00" }),
    event({ id: "n-e-closed", centerId: "nishi", date: "2026-10-20", kind: "event" }),
    event({ id: "m-e", centerId: "minuma", date: "2026-10-02", kind: "event" }),
  ],
});

describe("centerDay", () => {
  it("separates hiroba from events and orders events by start time", () => {
    const day = schedule.centerDay("nishi", "2026-10-02");
    assert.equal(day.status, "open");
    if (day.status !== "open") return;
    assert.deepEqual(day.hiroba.map((item) => item.id), ["n-h"]);
    assert.deepEqual(day.events.map((item) => item.id), ["n-e1", "n-e2"]);
    assert.equal(day.hirobaKnown, true);
  });

  it("is closed on a recorded all-day closure", () => {
    assert.deepEqual(schedule.centerDay("nishi", "2026-10-15"), { status: "closed" });
  });

  it("is closed when a center with filled regular hours has nothing that day", () => {
    assert.deepEqual(schedule.centerDay("nishi", "2026-10-03"), { status: "closed" });
  });

  it("stays open when only an event is listed at a filled center", () => {
    const day = schedule.centerDay("nishi", "2026-10-20");
    assert.equal(day.status, "open");
    if (day.status !== "open") return;
    assert.deepEqual(day.hiroba, []);
    assert.equal(day.events.length, 1);
  });

  it("does not guess closures for centers without regular hours", () => {
    assert.deepEqual(schedule.centerDay("minuma", "2026-10-03"), {
      status: "open",
      hiroba: [],
      events: [],
      hirobaKnown: false,
    });
  });

  it("is unpublished when no document covers the month", () => {
    assert.deepEqual(schedule.centerDay("nishi", "2026-11-02"), { status: "unpublished" });
    assert.deepEqual(schedule.centerDay("kita", "2026-10-02"), { status: "unpublished" });
  });

  it("lists covered months in order with a canonical format", () => {
    assert.deepEqual(schedule.months, ["2026-10"]);
  });
});

describe("hoursLabel", () => {
  it("uses structured times without leading zeros", () => {
    assert.equal(hoursLabel({ startTime: "09:00", endTime: "12:00" }), "9:00–12:00");
    assert.equal(hoursLabel({ startTime: "10:00" }), "10:00〜");
  });

  it("normalizes the hours quoted from the PDF", () => {
    for (const description of [
      "午前9:00～12:00 午後13:00～16:00",
      "9：00～ 12：00 13： 00～ 16：00",
      "９：００～１２：００ / １３：００～１６：００",
      "午前9:00～１２:００ 午後13:00～１６:００",
    ]) {
      assert.equal(hoursLabel({ description }), "9:00–12:00 / 13:00–16:00", description);
    }
  });

  it("drops whole-hour minutes in the short style", () => {
    assert.equal(
      hoursLabel({ description: "午前9:00～12:00 午後13:00～16:00" }, "short"),
      "9–12・13–16",
    );
    assert.equal(hoursLabel({ startTime: "09:30", endTime: "12:00" }, "short"), "9:30–12");
    assert.equal(hoursLabel({ startTime: "10:00" }, "short"), "10〜");
  });

  it("is empty when no time is given", () => {
    assert.equal(hoursLabel({ description: "午前のひろば" }), "");
    assert.equal(hoursLabel({}), "");
  });
});

describe("calendar dates", () => {
  it("steps across month and year boundaries", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-11-01", -1), "2026-10-31");
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(daysInMonth("2026-11").length, 30);
  });

  it("lays out weeks from Sunday", () => {
    const weeks = calendarWeeks("2026-10");
    // 2026-10-01 is a Thursday.
    assert.deepEqual(weeks[0], [null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.equal(weeks.length, 5);
    assert.ok(weeks.every((week) => week.length === 7));
  });

  it("takes today in the given time zone", () => {
    // 15:30 UTC on the 24th is 00:30 on the 25th in Tokyo.
    assert.equal(todayIn("Asia/Tokyo", new Date("2026-10-24T15:30:00Z")), "2026-10-25");
    assert.equal(todayIn("UTC", new Date("2026-10-24T15:30:00Z")), "2026-10-24");
  });
});
