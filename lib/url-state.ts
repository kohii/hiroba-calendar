/**
 * URL state management utilities
 */

export interface URLState {
  centers: string[];
  month: string | null;
  view: "list" | "calendar";
  type: "all" | "hiroba" | "event";
}

export function encodeURLState(state: URLState): string {
  const params = new URLSearchParams();

  if (state.centers.length > 0) {
    params.set("centers", state.centers.join(","));
  }

  if (state.month) {
    params.set("month", state.month);
  }

  if (state.view !== "list") {
    params.set("view", state.view);
  }

  if (state.type !== "all") {
    params.set("type", state.type);
  }

  return params.toString();
}

export function decodeURLState(searchParams: URLSearchParams): URLState {
  const centersParam = searchParams.get("centers");
  const monthParam = searchParams.get("month");
  const viewParam = searchParams.get("view");
  const typeParam = searchParams.get("type");

  return {
    centers: centersParam ? centersParam.split(",").filter(Boolean) : [],
    month: monthParam,
    view: viewParam === "calendar" ? "calendar" : "list",
    type: typeParam === "hiroba" || typeParam === "event" ? typeParam : "all",
  };
}
