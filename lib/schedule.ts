import type { Center, DataSet, Event } from "./schema.ts";

/**
 * What a family can expect at one center on one day.
 *
 * - unpublished: no schedule document covers the month, so nothing is known
 * - closed: the center is closed all day
 * - open: hiroba (drop-in play) and events for the day; either list may be empty
 */
export type CenterDay =
  | { status: "unpublished" }
  | { status: "closed" }
  | { status: "open"; hiroba: Event[]; events: Event[]; hirobaKnown: boolean };

export interface Schedule {
  centerDay(centerId: string, date: string): CenterDay;
  /** Months (YYYY-MM) for which at least one center has a schedule document. */
  months: string[];
}

export function buildSchedule(dataset: Pick<DataSet, "centers" | "sourceDocuments" | "events">): Schedule {
  const eventsByDay = new Map<string, Event[]>();
  for (const event of dataset.events) {
    const key = dayKey(event.centerId, event.date);
    const bucket = eventsByDay.get(key);
    if (bucket) bucket.push(event);
    else eventsByDay.set(key, [event]);
  }

  const coveredMonths = new Set<string>();
  const closedDays = new Set<string>();
  for (const document of dataset.sourceDocuments) {
    const month = canonicalMonth(document.month);
    if (!month) continue;
    coveredMonths.add(`${document.centerId}|${month}`);
    for (const closure of document.closures ?? []) {
      if (closure.scope === "all-day") closedDays.add(dayKey(document.centerId, closure.date));
    }
  }

  const centers = new Map<string, Center>(dataset.centers.map((center) => [center.id, center]));

  return {
    months: [...new Set([...coveredMonths].map((key) => key.split("|")[1] ?? ""))].sort(),
    centerDay(centerId, date) {
      if (!coveredMonths.has(`${centerId}|${date.slice(0, 7)}`)) return { status: "unpublished" };
      const key = dayKey(centerId, date);
      const all = eventsByDay.get(key) ?? [];
      const hiroba = sortByTime(all.filter((event) => event.kind === "hiroba"));
      const events = sortByTime(all.filter((event) => event.kind === "event"));
      const hirobaKnown = centers.get(centerId)?.regularHours.decision === "fill";
      if (closedDays.has(key) && events.length === 0) return { status: "closed" };
      // Regular hours are filled on every opening day, so a fill center without
      // any entry on a covered day is closed.
      if (hirobaKnown && hiroba.length === 0 && events.length === 0) return { status: "closed" };
      return { status: "open", hiroba, events, hirobaKnown };
    },
  };
}

function dayKey(centerId: string, date: string): string {
  return `${centerId}|${date}`;
}

function canonicalMonth(month: string): string | null {
  const compact = /^(\d{4})(\d{2})$/.exec(month);
  if (compact) return `${compact[1]}-${compact[2]}`;
  return /^\d{4}-\d{2}$/.test(month) ? month : null;
}

function sortByTime(events: Event[]): Event[] {
  return events.sort(
    (a, b) =>
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") || a.id.localeCompare(b.id),
  );
}

/**
 * Opening hours as a short label such as "9:00–12:00 / 13:00–16:00".
 * Uses the structured times first, then time ranges quoted in the description.
 */
export function hoursLabel(event: Pick<Event, "startTime" | "endTime" | "description">): string {
  if (event.startTime) {
    const start = trimHour(event.startTime);
    return event.endTime ? `${start}–${trimHour(event.endTime)}` : `${start}〜`;
  }
  const text = toHalfWidth(event.description ?? "").replace(/\s+/g, "");
  const ranges = [...text.matchAll(/(\d{1,2}:\d{2})[~～〜\-–ー](\d{1,2}:\d{2})/g)].map(
    (match) => `${trimHour(match[1] ?? "")}–${trimHour(match[2] ?? "")}`,
  );
  return ranges.join(" / ");
}

function trimHour(time: string): string {
  return time.replace(/^0(\d)/, "$1");
}

function toHalfWidth(text: string): string {
  return text.replace(/[０-９：]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

// ---- Calendar dates (YYYY-MM-DD strings, timezone free) ----

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function addDays(date: string, days: number): string {
  const value = toUTC(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUTC(value);
}

export function weekdayOf(date: string): number {
  return toUTC(date).getUTCDay();
}

export function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[weekdayOf(date)] ?? "";
}

export function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function shiftMonth(month: string, delta: number): string {
  const value = toUTC(`${month}-01`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return fromUTC(value).slice(0, 7);
}

export function daysInMonth(month: string): string[] {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const count = Math.round((toUTC(next).getTime() - toUTC(first).getTime()) / 86_400_000);
  return dateRange(first, count);
}

/** Weeks of the month starting on Sunday; days outside the month are null. */
export function calendarWeeks(month: string): (string | null)[][] {
  const days = daysInMonth(month);
  const cells: (string | null)[] = [
    ...Array.from({ length: weekdayOf(days[0] ?? `${month}-01`) }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}
