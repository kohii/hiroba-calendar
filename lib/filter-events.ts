import type { Event } from "./schema.ts";

export function filterEvents(
  events: readonly Event[],
  opts: { centers: readonly string[]; month: string | null; type: "all" | "hiroba" | "event" },
): Event[] {
  const centers = new Set(opts.centers);
  return events.filter((event) => {
    if (centers.size > 0 && !centers.has(event.centerId)) return false;
    if (opts.month && !event.date.startsWith(opts.month)) return false;
    if (opts.type !== "all" && event.kind !== opts.type) return false;
    return true;
  });
}
