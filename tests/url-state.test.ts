import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeURLState, encodeURLState } from "../lib/url-state.ts";
import type { URLState } from "../lib/url-state.ts";

describe("URL state", () => {
  it("keeps the default schedule from today out of the URL", () => {
    const state: URLState = { route: { view: "schedule", date: null }, all: false };
    assert.equal(encodeURLState(state), "");
    assert.deepEqual(decodeURLState(new URLSearchParams("")), state);
  });

  it("round-trips every view", () => {
    const states: URLState[] = [
      { route: { view: "schedule", date: null }, all: true },
      { route: { view: "schedule", date: "2026-10-27" }, all: false },
      {
        route: { view: "center", center: "omiya", month: "2026-11", date: "2026-11-03" },
        all: false,
      },
      { route: { view: "center", center: null, month: null, date: null }, all: true },
    ];
    for (const state of states) {
      assert.deepEqual(decodeURLState(new URLSearchParams(encodeURLState(state))), state);
    }
  });

  it("drops malformed dates and months", () => {
    assert.deepEqual(
      decodeURLState(new URLSearchParams("view=center&center=yono&month=11&date=tomorrow")),
      { route: { view: "center", center: "yono", month: null, date: null }, all: false },
    );
  });

  it("treats links from the old list and calendar views as the schedule", () => {
    assert.deepEqual(decodeURLState(new URLSearchParams("view=calendar&month=2026-10&all=1")), {
      route: { view: "schedule", date: null },
      all: true,
    });
  });
});
