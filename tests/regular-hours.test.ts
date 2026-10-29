import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fillRegularHours } from "../lib/regular-hours.ts";
import { validateExtractedEvents } from "../scripts/validator.ts";
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

  it("skips a Monday the source document marks closed and fills the next day", () => {
    const events = fillMonth(fillPolicy(), "2026-10", [], [], [
      {
        ...fixtureDoc("2026-10"),
        closures: [{ date: "2026-10-05", scope: "all-day", quote: "休館日" }],
      },
    ]);
    assert.equal(hasRegular(events, "2026-10-05"), false);
    assert.equal(hasRegular(events, "2026-10-06"), true);
  });

  it("fills the open half next to an age-limited hiroba row in the closed half", () => {
    const policy = fillPolicy({
      hoursQuote: "9：00～ 12：00 13： 00～ 16：00",
      windows: [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "16:00" },
      ],
    });
    const existing = fixtureEvent({
      id: "zero-age",
      date: "2026-11-10",
      kind: "hiroba",
      title: "0歳さんの広場",
    });
    const events = fillMonth(policy, "2026-11", [existing], [], [
      {
        ...fixtureDoc("2026-11"),
        closures: [{ date: "2026-11-10", scope: "am", quote: "午前0歳専用" }],
      },
    ]);
    assert.ok(events.some((event) => event.id === "zero-age"));
    assert.equal(
      events.find((event) => event.id === regularId("2026-11-10"))?.description,
      "13： 00～ 16：00",
    );
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

  it("fills a day whose only extracted row is a measurement", () => {
    const existing = fixtureEvent({
      id: "measure",
      date: "2026-10-06",
      kind: "event",
      title: "0歳身体測定",
    });
    const events = fillMonth(fillPolicy(), "2026-10", [existing]);
    assert.equal(hasRegular(events, "2026-10-06"), true);
    assert.equal(hasRegular(events, "2026-10-07"), true);
  });

  it("fills an opening day whose only extracted row is a hiroba title with an event word", () => {
    const existing = fixtureEvent({
      id: "mixed",
      date: "2026-10-05",
      kind: "event",
      title: "みんなのひろば・身体測定",
    });
    const events = fillMonth(fillPolicy(), "2026-10", [existing]);
    assert.equal(hasRegular(events, "2026-10-05"), true);
  });

  it("does not fill a measurement day the document marks closed all day", () => {
    const existing = fixtureEvent({
      id: "mixed",
      date: "2026-10-05",
      kind: "event",
      title: "みんなのひろば・身体測定",
    });
    const events = fillMonth(fillPolicy(), "2026-10", [existing], [], [
      {
        ...fixtureDoc("2026-10"),
        closures: [{ date: "2026-10-05", scope: "all-day", quote: "終日測定のみ" }],
      },
    ]);
    assert.equal(hasRegular(events, "2026-10-05"), false);
    assert.ok(events.some((event) => event.id === "mixed"));
  });

  it("quotes only the open half when the document closes one half", () => {
    const policy = fillPolicy({
      hoursQuote: "午前9:00～１２:００ 午後13:00～１６:００",
      windows: [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "16:00" },
      ],
    });
    const events = fillMonth(policy, "2026-10", [], [], [
      {
        ...fixtureDoc("2026-10"),
        closures: [
          { date: "2026-10-15", scope: "am", quote: "午前 にこにこ広場 お休み" },
          { date: "2026-10-18", scope: "pm", quote: "午後 にこにこ広場 お休み" },
          { date: "2026-10-21", scope: "am", quote: "午前" },
          { date: "2026-10-21", scope: "pm", quote: "午後" },
        ],
      },
    ]);
    assert.equal(
      events.find((event) => event.id === regularId("2026-10-15"))?.description,
      "午後13:00～１６:００",
    );
    assert.equal(
      events.find((event) => event.id === regularId("2026-10-18"))?.description,
      "午前9:00～１２:００",
    );
    assert.equal(hasRegular(events, "2026-10-21"), false);
  });

  it("splits a hours quote that has no 午後 marker", () => {
    const policy = fillPolicy({
      hoursQuote: "９：００～１２：００ / １３：００～１６：００",
      windows: [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "16:00" },
      ],
    });
    const events = fillMonth(policy, "2026-10", [], [], [
      {
        ...fixtureDoc("2026-10"),
        closures: [{ date: "2026-10-16", scope: "am", quote: "午前閉館" }],
      },
    ]);
    assert.equal(
      events.find((event) => event.id === regularId("2026-10-16"))?.description,
      "１３：００～１６：００",
    );
  });

  it("keeps an age-limited hiroba row on a day the regular hiroba is closed in both halves", () => {
    const events = fillMonth(
      fillPolicy(),
      "2026-11",
      [
        fixtureEvent({
          id: "momo-time",
          date: "2026-11-06",
          kind: "hiroba",
          title: "ももちゃんタイム",
        }),
      ],
      [],
      [
        {
          ...fixtureDoc("2026-11"),
          closures: [
            { date: "2026-11-06", scope: "am", quote: "作って遊ぼう！" },
            { date: "2026-11-06", scope: "pm", quote: "ももちゃんタイム" },
          ],
        },
      ],
    );
    assert.ok(events.some((event) => event.id === "momo-time"));
    assert.equal(hasRegular(events, "2026-11-06"), false);
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

  it("does not fill urawa 2026-10-06 when the document says the plaza is closed all day", () => {
    const urawa = CENTERS.find((center) => center.id === "urawa");
    assert.ok(urawa);
    const events = fillRegularHours({
      events: [],
      centers: [urawa],
      sourceDocuments: [
        {
          id: "urawa-2026-10",
          centerId: "urawa",
          month: "2026-10",
          pdfUrl: "https://example.test/urawa.pdf",
          fetchedAt: "2026-10-01T00:00:00Z",
          sha256: "abc",
          closures: [
            {
              date: "2026-10-06",
              scope: "all-day",
              quote: "終日 にこにこ広場 お休み",
            },
          ],
        },
      ],
      holidayDates: ["2026-10-12"],
    });
    assert.equal(
      events.some((event) => event.date === "2026-10-06"),
      false,
    );
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

describe("published schedule", () => {
  const datasetPath = join(dirname(fileURLToPath(import.meta.url)), "../public/data/dataset.json");
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as {
    sourceDocuments: {
      id: string;
      closures?: { date: string; scope: string; quote: string }[];
    }[];
    events: Event[];
  };

  it("has no regular-hours row on urawa 2026-10-06", () => {
    const closure = dataset.sourceDocuments
      .find((document) => document.id === "urawa-2026-10")
      ?.closures?.find((row) => row.date === "2026-10-06");
    assert.deepStrictEqual(closure, {
      date: "2026-10-06",
      scope: "all-day",
      quote: "終日 にこにこ広場 お休み",
    });
    assert.equal(
      dataset.events.some(
        (event) => event.centerId === "urawa" && event.date === "2026-10-06",
      ),
      false,
    );
  });

  it("keeps marked open days for seiga and hinadori without filling blanks", () => {
    const rows = (centerId: string, month: string) =>
      dataset.events.filter(
        (event) => event.centerId === centerId && event.date.startsWith(month),
      );
    assert.equal(rows("seiga", "2026-10").length, 25);
    assert.equal(rows("hinadori", "2026-10").length, 13);
    assert.equal(rows("seiga", "2026-11").length, 21);
    assert.equal(rows("hinadori", "2026-11").length, 0);
    for (const [centerId, month] of [
      ["seiga", "2026-10"],
      ["seiga", "2026-11"],
      ["hinadori", "2026-10"],
    ]) {
      assert.equal(
        rows(centerId, month).some((event) => event.origin === "regular-hours"),
        false,
      );
    }
    assert.equal(
      dataset.events.some((event) => event.centerId === "hinadori" && event.title.includes("ひばり")),
      false,
    );
    assert.equal(
      dataset.events.some(
        (event) => event.id === "hinadori-2026-10-09-hiroba" && event.title === "子育て広場",
      ),
      true,
    );
  });

  it("has no hiroba row that runs through the lunch break", () => {
    const spanning = dataset.events.filter(
      (event) =>
        event.kind === "hiroba" &&
        event.startTime !== undefined &&
        event.endTime !== undefined &&
        event.startTime < "13:00" &&
        event.endTime > "12:00" &&
        CENTERS.find((center) => center.id === event.centerId)?.regularHours.decision === "fill",
    );
    assert.deepStrictEqual(spanning, []);
  });

  it("closes yono on the cleaning day and splits its regular hours", () => {
    const yono = (date: string) =>
      dataset.events.filter((event) => event.centerId === "yono" && event.date === date);
    assert.deepStrictEqual(yono("2026-11-02"), []);
    assert.equal(yono("2026-11-01")[0]?.description, "９：００～１２：００ １３：００～１６：００");
  });

  it("publishes urawa November", () => {
    assert.ok(
      dataset.events.some((event) => event.centerId === "urawa" && event.date.startsWith("2026-11")),
    );
  });

  it("keeps only the open half of urawa regular hours", () => {
    const description = (date: string) =>
      dataset.events.find((event) => event.id === `urawa-${date}-regular-hiroba`)?.description;
    assert.equal(description("2026-10-15"), "午後13:00～１６:００");
    assert.equal(description("2026-10-18"), "午前9:00～１２:００");
    assert.equal(description("2026-10-30"), "午前9:00～１２:００");
  });
});

describe("closure validation", () => {
  it("rejects a closure outside the source document month", () => {
    const result = validateExtractedEvents([], {
      id: "urawa-2026-10",
      centerId: "urawa",
      month: "2026-10",
      pdfUrl: "https://example.test/urawa.pdf",
      fetchedAt: "2026-10-01T00:00:00Z",
      sha256: "abc",
      closures: [{ date: "2026-11-01", scope: "all-day", quote: "休館" }],
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /2026-11-01/);
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
      seiga: "unknown",
      hinadori: "unknown",
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
