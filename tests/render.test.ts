import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildSchedule } from "../lib/schedule.ts";
import type { DataSet } from "../lib/schema.ts";
import { renderCenter, renderDay, renderWeek } from "../src/scripts/render.ts";
import type { RenderContext } from "../src/scripts/render.ts";

const dataset = JSON.parse(
  readFileSync(new URL("../public/data/dataset.json", import.meta.url), "utf8"),
) as DataSet;

function context(favorites: string[], overrides: Partial<RenderContext> = {}): RenderContext {
  const mine = new Set(favorites);
  return {
    schedule: buildSchedule(dataset),
    centers: mine.size > 0 ? dataset.centers.filter((center) => mine.has(center.id)) : dataset.centers,
    allCenters: dataset.centers,
    favorites: mine,
    documents: dataset.sourceDocuments,
    holidays: new Map([["2026-11-03", "文化の日"]]),
    today: "2026-10-25",
    all: false,
    ...overrides,
  };
}

function centerNames(html: string): string[] {
  return [...html.matchAll(/class="center-row-name"[^>]*>([^<]+)</g)].map((match) => match[1] ?? "");
}

describe("week view", () => {
  it("shows seven days from today", () => {
    const html = renderWeek(context(["omiya"]));
    assert.equal(html.match(/class="day-section"/g)?.length, 7);
    assert.ok(html.includes("10月25日"));
    assert.ok(html.includes("10月31日"));
    assert.ok(html.includes('href="?view=day&date=2026-11-01"'));
  });

  it("only lists the user's centers", () => {
    const html = renderWeek(context(["omiya", "yono"]));
    assert.deepEqual([...new Set(centerNames(html))].sort(), ["おおみや", "よの"]);
  });

  it("asks for centers until some are chosen", () => {
    assert.ok(renderWeek(context([])).includes("data-open-centers"));
    assert.ok(!renderWeek(context(["omiya"])).includes("data-open-centers"));
  });
});

describe("day view", () => {
  it("renders hiroba and events with distinct markup", () => {
    // 2026-10-27: omiya has the regular hiroba and nishi has events.
    const html = renderDay(context(["omiya", "nishi", "minami"]), "2026-10-27");
    assert.match(html, /<details class="hiroba">[\s\S]*?class="kind kind-hiroba">ひろば</);
    assert.match(html, /<details class="event">[\s\S]*?class="kind kind-event">イベント</);
  });

  it("collapses closed and unpublished centers into summary lines", () => {
    // kita has no schedule document.
    const html = renderDay(context(["kita", "omiya"]), "2026-10-27");
    assert.match(html, /summary-unpublished[\s\S]*きた/);
    assert.deepEqual(centerNames(html), ["おおみや"]);
  });
});

describe("center view", () => {
  it("shows the month calendar and that month's events", () => {
    const omiya = dataset.centers.find((center) => center.id === "omiya")!;
    const html = renderCenter(context(["omiya"]), omiya, "2026-10", "2026-10-25");
    assert.equal(html.match(/<a class="grid-cell /g)?.length, 31);
    const count = dataset.events.filter(
      (event) => event.centerId === "omiya" && event.kind === "event" && event.date.startsWith("2026-10"),
    ).length;
    assert.ok(html.includes(`${count}件`));
    assert.match(html, /grid-cell is-closed/);
  });
});
