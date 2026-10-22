import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fillRegularHours } from "../lib/regular-hours.ts";
import { CENTERS } from "../lib/schema.ts";
import type { Center, Event, RegularHoursPolicy, SourceDocument, Weekday } from "../lib/schema.ts";

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

type FillPolicy = Extract<RegularHoursPolicy, { decision: "fill" }>;

function fillPolicy(overrides: Partial<FillPolicy> = {}): FillPolicy {
  return {
    decision: "fill",
    sourceUrl: "https://example.test/fixture",
    quote: "fixture quote",
    decisionNote: "fixture note",
    title: "fixtureひろば",
    hoursQuote: "09:00-12:00",
    windows: [{ start: "09:00", end: "12:00" }],
    openWeekdays: EVERY_DAY,
    closed: [],
    pdfClosedDates: [],
    ...overrides,
  };
}

function fixtureCenter(policy: RegularHoursPolicy, id = "fixture"): Center {
  return {
    id,
    name: "Fixture",
    nameJa: "ふぃくすちゃ",
    address: "fixture",
    phone: "000",
    websiteUrl: "https://example.test/fixture",
    closedDays: "none",
    regularHours: policy,
  };
}

function fixtureDoc(month: string, centerId = "fixture"): SourceDocument {
  return {
    id: `${centerId}-${month}`,
    centerId,
    month,
    pdfUrl: "https://example.test/fixture.pdf",
    fetchedAt: "2026-10-01T00:00:00Z",
    sha256: "abc",
  };
}

function fixtureEvent(overrides: Partial<Event> & Pick<Event, "id" | "date">): Event {
  return {
    centerId: "fixture",
    sourceDocumentId: "fixture-2026-10",
    title: "extracted",
    kind: "event",
    origin: "extracted",
    ...overrides,
  };
}

function regularId(date: string, centerId = "fixture"): string {
  return `${centerId}-${date}-regular-hiroba`;
}

function hasRegular(events: readonly Event[], date: string): boolean {
  return events.some((event) => event.id === regularId(date));
}

function fillMonth(
  policy: RegularHoursPolicy,
  month: string,
  events: Event[] = [],
  holidayDates: readonly string[] = [],
  documents = [fixtureDoc(month)],
): Event[] {
  return fillRegularHours({
    events,
    centers: [fixtureCenter(policy)],
    sourceDocuments: documents,
    holidayDates,
  });
}

describe("fillRegularHours", () => {
  it("skips a public holiday and fills the next opening day", () => {
    const events = fillMonth(
      fillPolicy({ closed: [{ kind: "public-holiday" }], targetAge: "0-2" }),
      "2026-10",
      [],
      ["2026-10-12"],
    );
    assert.equal(hasRegular(events, "2026-10-12"), false);
    const generated = events.find((event) => event.id === regularId("2026-10-13"));
    assert.ok(generated);
    assert.equal(generated.kind, "hiroba");
    assert.equal(generated.origin, "regular-hours");
    assert.equal(generated.title, "fixtureひろば");
    assert.equal(generated.description, "09:00-12:00");
    assert.equal(generated.reservationRequired, false);
    assert.equal(generated.targetAge, "0-2");
    assert.equal(generated.sourceDocumentId, "fixture-2026-10");
    assert.equal(generated.startTime, undefined);
    assert.equal(generated.endTime, undefined);
  });

  it("skips the 1st Thursday and fills the next day", () => {
    const events = fillMonth(
      fillPolicy({ closed: [{ kind: "nth-weekday", nth: [1], weekday: 4 }] }),
      "2026-10",
    );
    assert.equal(hasRegular(events, "2026-10-01"), false);
    const generated = events.find((event) => event.id === regularId("2026-10-02"));
    assert.ok(generated);
    assert.equal(generated.targetAge, undefined);
  });

  it("skips the 5th Sunday and fills the 4th Sunday", () => {
    const events = fillMonth(fillPolicy({ closed: [{ kind: "sunday-from", nth: 5 }] }), "2026-11");
    assert.equal(hasRegular(events, "2026-11-29"), false);
    assert.equal(hasRegular(events, "2026-11-22"), true);
  });

  it("skips a PDF closed Monday and fills the next day", () => {
    const events = fillMonth(
      fillPolicy({ pdfClosedDates: [{ date: "2026-10-05", quote: "休館日" }] }),
      "2026-10",
    );
    assert.equal(hasRegular(events, "2026-10-05"), false);
    assert.equal(hasRegular(events, "2026-10-06"), true);
  });

  it("does not add a second row on a day that already has a hiroba event", () => {
    const existing = fixtureEvent({
      id: "extracted-hiroba",
      date: "2026-10-06",
      kind: "hiroba",
      title: "ひろば",
    });
    const events = fillMonth(fillPolicy(), "2026-10", [existing]);
    assert.equal(hasRegular(events, "2026-10-06"), false);
    assert.ok(events.some((event) => event.id === "extracted-hiroba"));
    assert.equal(hasRegular(events, "2026-10-07"), true);
  });

  it("adds a regular-hours row on a day that only has an event", () => {
    const existing = fixtureEvent({
      id: "extracted-event",
      date: "2026-10-06",
      kind: "event",
      title: "講座",
    });
    const events = fillMonth(fillPolicy(), "2026-10", [existing]);
    assert.equal(hasRegular(events, "2026-10-06"), true);
    assert.ok(events.some((event) => event.id === "extracted-event"));
  });

  it("generates nothing for an unknown policy", () => {
    const existing = fixtureEvent({ id: "extracted-1", date: "2026-10-06" });
    const events = fillMonth(
      {
        decision: "unknown",
        sourceUrl: "https://example.test/unknown",
        quote: "",
        decisionNote: "do not fill",
      },
      "2026-10",
      [existing],
    );
    assert.deepStrictEqual(
      events.map((event) => event.id),
      ["extracted-1"],
    );
  });

  it("skips a day whose title contains a suppressed substring", () => {
    const existing = fixtureEvent({
      id: "measure",
      date: "2026-10-06",
      kind: "event",
      title: "0歳身体測定",
    });
    const events = fillMonth(fillPolicy({ suppressTitleIncludes: ["身体測定"] }), "2026-10", [
      existing,
    ]);
    assert.equal(hasRegular(events, "2026-10-06"), false);
    assert.equal(hasRegular(events, "2026-10-07"), true);
  });

  it("closes the year-end range across the year boundary", () => {
    const events = fillRegularHours({
      events: [],
      centers: [
        fixtureCenter(
          fillPolicy({ closed: [{ kind: "month-day-range", from: "12-29", to: "01-03" }] }),
        ),
      ],
      sourceDocuments: [fixtureDoc("2026-12"), fixtureDoc("2027-01")],
      holidayDates: [],
    });
    assert.equal(hasRegular(events, "2026-12-28"), true);
    assert.equal(hasRegular(events, "2026-12-29"), false);
    assert.equal(hasRegular(events, "2027-01-03"), false);
    assert.equal(hasRegular(events, "2027-01-04"), true);
  });

  it("treats 202610 as October 2026 and ignores a month it cannot canonicalize", () => {
    const events = fillRegularHours({
      events: [],
      centers: [
        fixtureCenter(fillPolicy({ closed: [{ kind: "nth-weekday", nth: [1], weekday: 4 }] })),
      ],
      sourceDocuments: [fixtureDoc("202610"), fixtureDoc("not-a-month")],
      holidayDates: [],
    });
    assert.equal(hasRegular(events, "2026-10-01"), false);
    assert.equal(hasRegular(events, "2026-10-02"), true);
    assert.ok(events.every((event) => event.date.startsWith("2026-10")));
  });

  it("returns the same ids when filling its own output", () => {
    const input = {
      events: [] as Event[],
      centers: [fixtureCenter(fillPolicy())],
      sourceDocuments: [fixtureDoc("2026-10")],
      holidayDates: [] as string[],
    };
    const once = fillRegularHours(input);
    const twice = fillRegularHours({ ...input, events: once });
    assert.ok(once.some((event) => event.origin === "regular-hours"));
    assert.deepStrictEqual(
      twice.map((event) => event.id),
      once.map((event) => event.id),
    );
  });
});

describe("published center policies", () => {
  it("fills only the centers whose source text supports regular hours", () => {
    const decisions = Object.fromEntries(
      CENTERS.map((center) => [center.id, center.regularHours.decision]),
    );
    assert.deepStrictEqual(decisions, {
      nishi: "fill",
      kita: "unknown",
      omiya: "fill",
      minuma: "unknown",
      yono: "fill",
      sakura: "unknown",
      urawa: "fill",
      minami: "fill",
      midori: "unknown",
      iwatsuki: "unknown",
    });
    for (const center of CENTERS) {
      if (center.regularHours.decision === "unknown") {
        assert.equal("windows" in center.regularHours, false);
        assert.equal("closed" in center.regularHours, false);
      } else {
        assert.ok(center.regularHours.quote.length > 0);
      }
    }
  });
});

function readHolidayRows(value: unknown): { date: string; name: string }[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("holidays" in value) ||
    !Array.isArray(value.holidays)
  ) {
    throw new Error("holiday file is missing holidays");
  }
  return value.holidays.map((row: unknown) => {
    if (typeof row !== "object" || row === null || !("date" in row) || !("name" in row)) {
      throw new Error("holiday row is missing date");
    }
    if (typeof row.date !== "string" || typeof row.name !== "string") {
      throw new Error("holiday row is missing date");
    }
    return { date: row.date, name: row.name };
  });
}

describe("holiday file", () => {
  it("has 35 Cabinet Office rows for 2026 and 2027, including Sports Day and Culture Day", () => {
    const path = join(dirname(fileURLToPath(import.meta.url)), "../data/holidays-2026-2027.json");
    const holidays = readHolidayRows(JSON.parse(readFileSync(path, "utf8")));
    assert.equal(holidays.length, 35);
    const byDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
    assert.equal(byDate.get("2026-10-12"), "スポーツの日");
    assert.equal(byDate.get("2026-11-03"), "文化の日");
    assert.ok(holidays.some((holiday) => holiday.name === "休日"));
  });
});
