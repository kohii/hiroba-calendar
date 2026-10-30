import type {
  Center,
  ClosedRule,
  DayClosure,
  Event,
  HoursWindow,
  RegularHoursPolicy,
  SourceDocument,
  Weekday,
} from "./schema.ts";

type FillPolicy = Extract<RegularHoursPolicy, { decision: "fill" }>;

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function fillRegularHours(input: {
  events: Event[];
  centers: Center[];
  sourceDocuments: SourceDocument[];
  holidayDates: readonly string[];
}): Event[] {
  const kept = input.events.filter((event) => event.origin !== "regular-hours");
  const holidays = new Set(input.holidayDates);
  const generated: Event[] = [];
  for (const center of input.centers) {
    const policy = center.regularHours;
    if (policy.decision !== "fill") continue;
    for (const document of input.sourceDocuments) {
      if (document.centerId !== center.id) continue;
      const month = canonicalizeMonth(document.month);
      if (!month) continue;
      for (const date of datesInMonth(month)) {
        if (!isOpeningDay(date, policy, holidays)) continue;
        const open = openWindows(policy.windows, closuresOn(document, date));
        if (open.length === 0) continue;
        const description = descriptionFor(policy, open);
        if (description === null) continue;
        generated.push(regularHoursEvent(center.id, document.id, date, policy, description));
      }
    }
  }

  return [...kept, ...generated].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}

function canonicalizeMonth(month: string): string | null {
  const compact = /^(\d{4})(\d{2})$/.exec(month);
  if (compact) return `${compact[1]}-${compact[2]}`;
  if (/^\d{4}-\d{2}$/.test(month)) return month;
  return null;
}

function datesInMonth(month: string): string[] {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

function weekdayOf(date: string): Weekday {
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (weekday === undefined) {
    throw new Error(`invalid weekday for ${date}`);
  }
  return weekday;
}

function nthOfMonth(date: string): number {
  const day = Number(date.slice(8, 10));
  return Math.floor((day - 1) / 7) + 1;
}

function monthDayInRange(monthDay: string, from: string, to: string): boolean {
  if (from <= to) return monthDay >= from && monthDay <= to;
  return monthDay >= from || monthDay <= to;
}

function closedRuleMatches(rule: ClosedRule, date: string, holidays: ReadonlySet<string>): boolean {
  switch (rule.kind) {
    case "nth-weekday":
      return weekdayOf(date) === rule.weekday && rule.nth.includes(nthOfMonth(date));
    case "sunday-from":
      return weekdayOf(date) === 0 && nthOfMonth(date) >= rule.nth;
    case "public-holiday":
      return holidays.has(date);
    case "month-day-range":
      return monthDayInRange(date.slice(5, 10), rule.from, rule.to);
    default: {
      const unreachable: never = rule;
      return unreachable;
    }
  }
}

function closuresOn(document: SourceDocument, date: string): DayClosure[] {
  return (document.closures ?? []).filter((closure) => closure.date === date);
}

function fullyClosed(closures: readonly DayClosure[]): boolean {
  if (closures.some((closure) => closure.scope === "all-day")) return true;
  const morning = closures.some((closure) => closure.scope === "am");
  const afternoon = closures.some((closure) => closure.scope === "pm");
  return morning && afternoon;
}

function isMorningWindow(window: HoursWindow): boolean {
  return window.end <= "12:00";
}

function isAfternoonWindow(window: HoursWindow): boolean {
  return window.start >= "13:00";
}

function openWindows(
  windows: readonly HoursWindow[],
  closures: readonly DayClosure[],
): HoursWindow[] {
  if (fullyClosed(closures)) return [];
  const closedMorning = closures.some((closure) => closure.scope === "am");
  const closedAfternoon = closures.some((closure) => closure.scope === "pm");
  return windows.filter((window) => {
    const morning = isMorningWindow(window);
    const afternoon = isAfternoonWindow(window);
    if (closedMorning && (morning || !afternoon)) return false;
    if (closedAfternoon && (afternoon || !morning)) return false;
    return true;
  });
}

function asciiHour(token: string): number {
  const digits = token.replace(/[０-９]/g, (char) => String("０１２３４５６７８９".indexOf(char)));
  const hour = /^(\d{1,2})/.exec(digits.replace(/\s/g, ""));
  return hour ? Number(hour[1]) : Number.NaN;
}

function splitHoursQuote(quote: string): { morning: string; afternoon: string } | null {
  const afternoonMark = quote.indexOf("午後");
  if (afternoonMark > 0) {
    const morning = quote.slice(0, afternoonMark).trim();
    const afternoon = quote.slice(afternoonMark).trim();
    if (morning.length === 0 || afternoon.length === 0) return null;
    return { morning, afternoon };
  }
  const times = /[0-9０-９]{1,2}\s*[:：]\s*[0-9０-９]{2}/g;
  let match: RegExpExecArray | null;
  while ((match = times.exec(quote))) {
    if (asciiHour(match[0]) < 13) continue;
    const morning = quote
      .slice(0, match.index)
      .replace(/[\s/／]+$/u, "")
      .trim();
    const afternoon = quote
      .slice(match.index)
      .replace(/^[\s/／]+/u, "")
      .trim();
    if (morning.length === 0 || afternoon.length === 0) return null;
    return { morning, afternoon };
  }
  return null;
}

function descriptionFor(policy: FillPolicy, open: readonly HoursWindow[]): string | null {
  if (open.length === policy.windows.length) return policy.hoursQuote;
  if (open.length !== 1) return null;
  const parts = splitHoursQuote(policy.hoursQuote);
  const window = open[0];
  if (!parts || !window) return null;
  if (isMorningWindow(window)) return parts.morning;
  if (isAfternoonWindow(window)) return parts.afternoon;
  return null;
}

function isOpeningDay(date: string, policy: FillPolicy, holidays: ReadonlySet<string>): boolean {
  if (!policy.openWeekdays.includes(weekdayOf(date))) return false;
  if (policy.closed.some((rule) => closedRuleMatches(rule, date, holidays))) return false;
  return true;
}

function regularHoursEvent(
  centerId: string,
  sourceDocumentId: string,
  date: string,
  policy: FillPolicy,
  description: string,
): Event {
  const event: Event = {
    id: `${centerId}-${date}-regular-hiroba`,
    centerId,
    sourceDocumentId,
    date,
    title: policy.title,
    description,
    reservationRequired: false,
    kind: "hiroba",
    origin: "regular-hours",
  };
  if (policy.targetAge !== undefined) {
    event.targetAge = policy.targetAge;
  }
  return event;
}
