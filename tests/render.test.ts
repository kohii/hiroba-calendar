import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildSchedule } from "../lib/schedule.ts";
import type { DataSet } from "../lib/schema.ts";
import { renderCenter, renderDayDetail, renderSchedule } from "../src/scripts/render.ts";
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

function columns(html: string): string[] {
  return [...html.matchAll(/class="matrix-day">([^<]+)</g)].map((match) => match[1] ?? "");
}

function rowNames(html: string): string[] {
  return [...html.matchAll(/class="matrix-center"[^>]*>([^<]+)</g)].map((match) => match[1] ?? "");
}

function cell(html: string, centerId: string, date: string): string {
  const match = new RegExp(`data-cell="${centerId}\\|${date}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
  assert.ok(match, `${centerId} ${date}`);
  return match[1] ?? "";
}

describe("schedule view", () => {
  it("starts at the chosen date and runs to the end of the published months", () => {
    const fromToday = columns(renderSchedule(context(["omiya"]), "2026-10-25"));
    assert.equal(fromToday[0], "10/25");
    assert.equal(fromToday.at(-1), "11/30");
    assert.equal(fromToday.length, 37);
    const nearTheEnd = columns(renderSchedule(context(["omiya"]), "2026-11-28"));
    assert.deepEqual(nearTheEnd, ["11/28", "11/29", "11/30", "12/1", "12/2", "12/3", "12/4"]);
  });

  it("has a row for each of the user's centers", () => {
    const html = renderSchedule(context(["omiya", "yono"]), "2026-10-25");
    assert.deepEqual(rowNames(html), ["おおみや", "よの"]);
  });

  it("asks for centers until some are chosen", () => {
    assert.ok(renderSchedule(context([]), "2026-10-25").includes("data-open-centers"));
    assert.ok(!renderSchedule(context(["omiya"]), "2026-10-25").includes("data-open-centers"));
  });

  it("summarizes hiroba as short hours and events as time and title", () => {
    const html = renderSchedule(context(["nishi"]), "2026-10-27");
    const nishi = cell(html, "nishi", "2026-10-27");
    assert.match(nishi, /class="cell-hiroba">9–12・13–16</);
    assert.match(
      nishi,
      /class="cell-event"><b>10:00<\/b><i class="cell-reserve" title="要予約">予<\/i>英語で楽しくリトミック♪</,
    );
  });

  it("fills in usual hours when an extracted hiroba has none", () => {
    // omiya's extracted "わくわくひろば" entries carry no times.
    const html = renderSchedule(context(["omiya"]), "2026-10-25");
    assert.match(cell(html, "omiya", "2026-10-25"), /class="cell-hiroba">9–12・13–16</);
  });

  it("says when a center's hiroba hours are unknown", () => {
    // minuma does not fill regular hours and has no event on 2026-10-03.
    const html = renderSchedule(context(["minuma"]), "2026-10-03");
    assert.match(cell(html, "minuma", "2026-10-03"), /class="cell-note">ひろば情報なし</);
  });

  it("marks closed days and days without a schedule", () => {
    // 2026-11-03 is a holiday; kita has no schedule document.
    const html = renderSchedule(context(["omiya", "kita"]), "2026-11-01");
    assert.match(cell(html, "omiya", "2026-11-03"), /class="cell-closed">休</);
    assert.match(cell(html, "kita", "2026-11-03"), /class="cell-none">—</);
  });
});

describe("day detail", () => {
  it("shows the hiroba and expandable events of the day", () => {
    const html = renderDayDetail(context(["nishi"]), center("nishi"), "2026-10-27");
    assert.match(html, /<details class="hiroba">[\s\S]*?class="kind kind-hiroba">ひろば</);
    assert.match(html, /<details class="event">[\s\S]*?class="kind kind-event">イベント</);
    assert.ok(html.includes('href="?view=center&center=nishi&month=2026-10&date=2026-10-27"'));
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
