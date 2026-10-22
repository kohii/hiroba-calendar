export type ClassifyConfidence = "high" | "low";

const HIROBA_PATTERNS: readonly string[] = [
  "ひろば",
  "広場",
  "フリー",
  "自由遊び",
  "ももちゃんタイム",
];

const EVENT_PATTERNS: readonly string[] = [
  "講座",
  "測定",
  "教室",
  "マッサージ",
  "セミナー",
  "コンサート",
  "パーティー",
  "パーティ",
];

export function classifyTitle(title: string): {
  kind: "hiroba" | "event";
  confidence: ClassifyConfidence;
} {
  const hiroba = HIROBA_PATTERNS.some((pattern) => title.includes(pattern));
  const event = EVENT_PATTERNS.some((pattern) => title.includes(pattern));
  if (hiroba && !event) {
    return { kind: "hiroba", confidence: "high" };
  }
  return { kind: "event", confidence: "high" };
}
