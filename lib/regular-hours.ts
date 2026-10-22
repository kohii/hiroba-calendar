import type {
  Center,
  ClosedRule,
  Event,
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
  const keptByDay = new Map<string, Event[]>();
  for (const event of kept) {
    const key = `${event.centerId}\t${event.date}`;
    const bucket = keptByDay.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      keptByDay.set(key, [event]);
    }
  }

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
        const existing = keptByDay.get(`${center.id}\t${date}`) ?? [];
        if (hasHirobaOrSuppressedTitle(existing, policy.suppressTitleIncludes)) continue;
        generated.push(regularHoursEvent(center.id, document.id, date, policy));
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

function isOpeningDay(date: string, policy: FillPolicy, holidays: ReadonlySet<string>): boolean {
  if (!policy.openWeekdays.includes(weekdayOf(date))) return false;
  if (policy.closed.some((rule) => closedRuleMatches(rule, date, holidays))) return false;
  if (policy.pdfClosedDates.some((closed) => closed.date === date)) return false;
  return true;
}

function hasHirobaOrSuppressedTitle(
  events: readonly Event[],
  suppressTitleIncludes: readonly string[] | undefined,
): boolean {
  return events.some((event) => {
    if (event.kind === "hiroba") return true;
    return suppressTitleIncludes?.some((part) => event.title.includes(part)) ?? false;
  });
}

function regularHoursEvent(
  centerId: string,
  sourceDocumentId: string,
  date: string,
  policy: FillPolicy,
): Event {
  const event: Event = {
    id: `${centerId}-${date}-regular-hiroba`,
    centerId,
    sourceDocumentId,
    date,
    title: policy.title,
    description: policy.hoursQuote,
    reservationRequired: false,
    kind: "hiroba",
    origin: "regular-hours",
  };
  if (policy.targetAge !== undefined) {
    event.targetAge = policy.targetAge;
  }
  return event;
}
