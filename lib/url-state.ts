/**
 * Which screen is shown, kept in the URL so it can be shared and restored.
 * Dates left out of the URL fall back to today at render time.
 */
export type ViewState =
  | { view: "schedule"; date: string | null }
  | { view: "center"; center: string | null; month: string | null; date: string | null };

export interface URLState {
  route: ViewState;
  /** Show every center instead of only the user's centers. */
  all: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export function encodeURLState(state: URLState): string {
  const params = new URLSearchParams();
  const { route } = state;
  if (route.view === "center") {
    params.set("view", "center");
    if (route.center) params.set("center", route.center);
    if (route.month) params.set("month", route.month);
  }
  if (route.date) params.set("date", route.date);
  if (state.all) params.set("all", "1");
  return params.toString();
}

export function decodeURLState(params: URLSearchParams): URLState {
  const all = params.get("all") === "1";
  const date = matchOrNull(params.get("date"), DATE);
  if (params.get("view") === "center") {
    return {
      route: {
        view: "center",
        center: params.get("center") || null,
        month: matchOrNull(params.get("month"), MONTH),
        date,
      },
      all,
    };
  }
  return { route: { view: "schedule", date }, all };
}

function matchOrNull(value: string | null, pattern: RegExp): string | null {
  return value && pattern.test(value) ? value : null;
}
