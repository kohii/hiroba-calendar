import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildSchedule } from "../lib/schedule.ts";
import type { DataSet } from "../lib/schema.ts";
import { renderCenter, renderSchedule } from "../src/scripts/render.ts";
import type { RenderContext } from "../src/scripts/render.ts";

const dataset = JSON.parse(
  readFileSync(new URL("../public/data/dataset.json", import.meta.url), "utf8"),
) as DataSet;

function context(favorites: string[], overrides: Partial<RenderContext> = {}): RenderContext {
  const mine = new Set(favorites);
  return {
    schedule: buildSchedule(dataset),
    centers:
      mine.size > 0 ? dataset.centers.filter((center) => mine.has(center.id)) : dataset.centers,
    allCenters: dataset.centers,
    favorites: mine,
    documents: dataset.sourceDocuments,
    holidays: new Map([["2026-11-03", "文化の日"]]),
    today: "2026-10-25",
    all: false,
    ...overrides,
  };
}

function center(id: string) {
  const found = dataset.centers.find((item) => item.id === id);
  assert.ok(found);
  return found;
}

function centerNames(html: string): string[] {
  return [...html.matchAll(/class="center-row-name"[^>]*>([^<]+)</g)].map(
    (match) => match[1] ?? "",
  );
}

function headings(html: string): string[] {
  return [...html.matchAll(/class="day-heading"><span[^>]*>([^<]+)</g)].map(
    (match) => match[1] ?? "",
  );
}

describe("schedule view", () => {
  it("shows seven days from the chosen date", () => {
    const fromToday = renderSchedule(context(["omiya"]), "2026-10-25");
    assert.deepEqual(headings(fromToday), [
      "10月25日",
      "10月26日",
      "10月27日",
      "10月28日",
      "10月29日",
      "10月30日",
      "10月31日",
    ]);
    assert.ok(fromToday.includes('href="?date=2026-11-01"'));
    assert.equal(headings(renderSchedule(context(["omiya"]), "2026-11-03"))[0], "11月3日");
  });

  it("only lists the user's centers", () => {
    const html = renderSchedule(context(["omiya", "yono"]), "2026-10-25");
    assert.deepEqual([...new Set(centerNames(html))].sort(), ["おおみや", "よの"]);
  });

  it("asks for centers until some are chosen", () => {
    assert.ok(renderSchedule(context([]), "2026-10-25").includes("data-open-centers"));
    assert.ok(!renderSchedule(context(["omiya"]), "2026-10-25").includes("data-open-centers"));
  });

  it("renders hiroba and events with distinct markup", () => {
    const html = renderSchedule(context(["omiya", "nishi"]), "2026-10-27");
    assert.match(html, /<details class="hiroba">[\s\S]*?class="kind kind-hiroba">ひろば</);
    assert.match(html, /<details class="event">[\s\S]*?class="kind kind-event">イベント</);
  });

  it("fills in usual hours when an extracted hiroba has none", () => {
    // omiya's extracted "わくわくひろば" entries carry no times.
    const html = renderSchedule(context(["omiya"]), "2026-10-25");
    assert.match(html, /class="hiroba-hours">9:00–12:00 \/ 13:00–16:00</);
  });

  it("collapses closed and unpublished centers into summary lines", () => {
    // kita has no schedule document.
    const html = renderSchedule(context(["kita", "omiya"]), "2026-10-27");
    assert.match(html, /summary-unpublished[\s\S]*きた/);
    assert.deepEqual([...new Set(centerNames(html))], ["おおみや"]);
  });

  it("says everything is closed only when every center is known to be closed", () => {
    // 2026-11-03 is a holiday: omiya, yono and minami are closed, nishi has no November schedule.
    const known = renderSchedule(context(["omiya", "yono", "minami"]), "2026-11-03");
    assert.ok(known.includes("どの施設もお休みです"));
    const unknown = renderSchedule(context(["omiya", "yono", "minami", "nishi"]), "2026-11-03");
    assert.ok(!unknown.includes("どの施設もお休みです"));
  });
});

describe("center view", () => {
  it("shows the month calendar with upcoming events before past ones", () => {
    const html = renderCenter(context(["omiya"]), center("omiya"), "2026-10", "2026-10-25");
    assert.equal(html.match(/<a class="grid-cell /g)?.length, 31);
    assert.match(html, /grid-cell is-closed/);
    const events = dataset.events.filter(
      (event) =>
        event.centerId === "omiya" && event.kind === "event" && event.date.startsWith("2026-10"),
    );
    assert.ok(html.includes(`${events.length}件`));
    const past = events.filter((event) => event.date < "2026-10-25").length;
    assert.ok(html.includes(`過去のイベント（${past}件）`));
    assert.ok(html.indexOf("10/25") < html.indexOf("過去のイベント"));
  });

  it("explains instead of drawing an empty calendar when nothing was imported", () => {
    const html = renderCenter(context([]), center("kita"), "2026-10", "2026-10-25");
    assert.ok(!html.includes("grid-cell"));
    assert.ok(html.includes("取り込めていません"));
  });

  it("lets the month move to today's month even without schedules", () => {
    const html = renderCenter(
      context(["omiya"], { today: "2026-12-02" }),
      center("omiya"),
      "2026-11",
      "2026-11-01",
    );
    assert.ok(html.includes('href="?view=center&center=omiya&month=2026-12"'));
  });
});
