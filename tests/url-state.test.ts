import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeURLState, encodeURLState } from "../lib/url-state.ts";
import type { URLState } from "../lib/url-state.ts";

describe("URL state", () => {
  it("keeps the default week view out of the URL", () => {
    assert.equal(encodeURLState({ route: { view: "week" }, all: false }), "");
    assert.deepEqual(decodeURLState(new URLSearchParams("")), { route: { view: "week" }, all: false });
  });

  it("round-trips every view", () => {
    const states: URLState[] = [
      { route: { view: "week" }, all: true },
      { route: { view: "day", date: "2026-10-27" }, all: false },
      { route: { view: "day", date: null }, all: false },
      { route: { view: "center", center: "omiya", month: "2026-11", date: "2026-11-03" }, all: false },
      { route: { view: "center", center: null, month: null, date: null }, all: true },
    ];
    for (const state of states) {
      assert.deepEqual(decodeURLState(new URLSearchParams(encodeURLState(state))), state);
    }
  });

  it("drops malformed dates and months", () => {
    assert.deepEqual(decodeURLState(new URLSearchParams("view=center&center=yono&month=11&date=tomorrow")), {
      route: { view: "center", center: "yono", month: null, date: null },
      all: false,
    });
  });

  it("falls back to the week view for an unknown view", () => {
    assert.deepEqual(decodeURLState(new URLSearchParams("view=calendar&all=1")), {
      route: { view: "week" },
      all: true,
    });
  });
});
