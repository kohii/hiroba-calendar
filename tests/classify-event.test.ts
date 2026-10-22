import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyTitle } from "../lib/classify-event.ts";

const cases = [
  ["みんなのひろば", "hiroba", "high"],
  ["ぴよぴよ広場", "hiroba", "high"],
  ["フリータイム", "hiroba", "high"],
  ["自由遊び", "hiroba", "high"],
  ["ももちゃんタイム", "hiroba", "high"],
  ["0歳さんの広場", "hiroba", "high"],
  ["0歳児限定ひろば", "hiroba", "high"],
  ["お芋掘り", "event", "high"],
  ["むし歯予防教室", "event", "high"],
  ["うたのコンサート", "event", "high"],
  ["ハロウィンパーティー（午前の部）", "event", "high"],
  ["学びのひろば 防災講座（地震）", "event", "high"],
  ["親子ふれあいひろば（ベビーマッサージ）", "event", "high"],
  ["みんなのひろば・身体測定", "event", "high"],
  ["ひろば教室", "event", "high"],
  ["広場セミナー", "event", "high"],
  ["ひろばコンサート", "event", "high"],
  ["ひろばパーティー", "event", "high"],
  ["ひろばパーティ", "event", "high"],
] as const;

describe("classifyTitle", () => {
  for (const [title, kind, confidence] of cases) {
    it(`${title} is ${kind} (${confidence})`, () => {
      assert.deepStrictEqual(classifyTitle(title), { kind, confidence });
    });
  }
});
