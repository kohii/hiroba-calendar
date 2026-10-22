import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyTitle } from "../lib/classify-event.ts";

const cases = [
  ["みんなのひろば", "hiroba", "high"],
  ["ぴよぴよ広場", "hiroba", "high"],
  ["フリータイム", "hiroba", "high"],
  ["自由遊び", "hiroba", "high"],
  ["ももちゃんタイム", "hiroba", "high"],
  ["お芋掘り", "event", "high"],
  ["むし歯予防教室", "event", "high"],
  ["うたのコンサート", "event", "high"],
  ["ハロウィンパーティー（午前の部）", "event", "high"],
  ["学びのひろば 防災講座（地震）", "hiroba", "low"],
  ["親子ふれあいひろば（ベビーマッサージ）", "hiroba", "low"],
  ["みんなのひろば・身体測定", "hiroba", "low"],
  ["ひろば教室", "hiroba", "low"],
  ["広場セミナー", "hiroba", "low"],
  ["ひろばコンサート", "hiroba", "low"],
  ["ひろばパーティー", "hiroba", "low"],
  ["ひろばパーティ", "hiroba", "low"],
] as const;

describe("classifyTitle", () => {
  for (const [title, kind, confidence] of cases) {
    it(`${title} is ${kind} (${confidence})`, () => {
      assert.deepStrictEqual(classifyTitle(title), { kind, confidence });
    });
  }
});
