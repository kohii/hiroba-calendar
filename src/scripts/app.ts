import holidayData from "../../data/holidays-2026-2027.json";
import type { DataSet } from "../../lib/schema.ts";
import { buildSchedule, todayIn } from "../../lib/schedule.ts";
import { decodeURLState, encodeURLState } from "../../lib/url-state.ts";
import type { URLState } from "../../lib/url-state.ts";
import { escapeHtml, renderCenter, renderSchedule } from "./render.ts";
import type { RenderContext } from "./render.ts";

const FAVORITES_KEY = "favorites";

const main = document.getElementById("main")!;
const dialog = document.getElementById("centers-dialog") as HTMLDialogElement;
const holidays = new Map(holidayData.holidays.map((holiday) => [holiday.date, holiday.name]));

let dataset: DataSet | null = null;
let schedule = buildSchedule({ centers: [], sourceDocuments: [], events: [] });
let favorites = loadFavorites();
let state: URLState = decodeURLState(new URLSearchParams(location.search));
/** The center tab reopens the center seen last. */
let lastCenter: string | null = null;

async function init() {
  bindEvents();
  try {
    const response = await fetch("/data/dataset.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dataset = (await response.json()) as DataSet;
    schedule = buildSchedule(dataset);
  } catch (error) {
    console.error("Failed to load dataset:", error);
    main.innerHTML = `<p class="load-error">予定を読み込めませんでした。時間をおいて再読み込みしてください。</p>`;
    return;
  }
  render();
}

function context(): RenderContext {
  const centers = dataset?.centers ?? [];
  const scoped =
    state.all || favorites.size === 0
      ? centers
      : centers.filter((center) => favorites.has(center.id));
  return {
    schedule,
    centers: scoped,
    allCenters: centers,
    favorites,
    documents: dataset?.sourceDocuments ?? [],
    holidays,
    today: todayIn("Asia/Tokyo"),
    all: state.all,
  };
}

function render() {
  if (!dataset) return;
  const ctx = context();
  const { route } = state;
  switch (route.view) {
    case "schedule":
      main.innerHTML = renderSchedule(ctx, route.date ?? ctx.today);
      centerInScroller(".strip-day.is-selected", ".date-strip");
      break;
    case "center": {
      const center =
        ctx.allCenters.find((item) => item.id === route.center) ??
        ctx.allCenters.find((item) => favorites.has(item.id)) ??
        ctx.allCenters[0];
      if (!center) break;
      lastCenter = center.id;
      const date = route.date ?? ctx.today;
      main.innerHTML = renderCenter(ctx, center, route.month ?? date.slice(0, 7), date);
      centerInScroller(".chip.is-selected", ".chip-scroller");
      break;
    }
  }
  renderChrome();
}

/** Scrolls a horizontal list so the item is centered, without moving the page. */
function centerInScroller(itemSelector: string, scrollerSelector: string) {
  const scroller = main.querySelector<HTMLElement>(scrollerSelector);
  const item = scroller?.querySelector<HTMLElement>(itemSelector);
  if (!scroller || !item) return;
  const box = scroller.getBoundingClientRect();
  const target = item.getBoundingClientRect();
  scroller.scrollLeft += target.left - box.left - (box.width - target.width) / 2;
}

/** Header scope switch and tab bar, which live outside #main. */
function renderChrome() {
  const scope = document.getElementById("scope")!;
  const showScope = favorites.size > 0 && state.route.view !== "center";
  scope.hidden = !showScope;
  if (showScope) {
    scope.innerHTML = `
      <a href="${link({ ...state, all: false })}" data-nav="replace" aria-pressed="${!state.all}">マイ施設</a>
      <a href="${link({ ...state, all: true })}" data-nav="replace" aria-pressed="${state.all}">すべて</a>`;
  }
  for (const tab of document.querySelectorAll<HTMLAnchorElement>(".tab")) {
    const view = tab.dataset.view;
    tab.setAttribute("aria-current", String(view === state.route.view));
    tab.href =
      view === "center"
        ? link({ ...state, route: { view: "center", center: lastCenter, month: null, date: null } })
        : link({ ...state, route: { view: "schedule", date: null } });
  }
}

function link(next: URLState): string {
  const query = encodeURLState(next);
  return query ? `?${query}` : location.pathname;
}

function navigate(url: string, mode: "push" | "replace", scrollTarget?: string) {
  const target = new URL(url, location.href);
  const previousView = state.route.view;
  state = decodeURLState(target.searchParams);
  const push = mode === "push" && target.href !== location.href;
  history[push ? "pushState" : "replaceState"](null, "", target);
  render();
  const anchor = scrollTarget ? document.getElementById(scrollTarget) : null;
  if (anchor) anchor.scrollIntoView({ block: "nearest", behavior: "smooth" });
  else if (mode === "push" || previousView !== state.route.view) window.scrollTo({ top: 0 });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[data-nav], a.tab");
    if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      navigate(
        anchor.href,
        anchor.dataset.nav === "replace" ? "replace" : "push",
        anchor.dataset.scroll,
      );
      return;
    }
    const favorite = event.target.closest<HTMLElement>("[data-favorite]");
    if (favorite?.dataset.favorite) {
      toggleFavorite(favorite.dataset.favorite);
      return;
    }
    if (event.target.closest("[data-open-centers]")) openCentersDialog();
  });

  window.addEventListener("popstate", () => {
    if (dialog.open) dialog.close();
    state = decodeURLState(new URLSearchParams(location.search));
    render();
  });

  dialog.addEventListener("change", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.dataset.center)
      toggleFavorite(input.dataset.center);
  });
  dialog.addEventListener("close", () => render());
  dialog.addEventListener("click", (event) => {
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === dialog) dialog.close();
  });
}

function openCentersDialog() {
  const list = dialog.querySelector(".dialog-list")!;
  list.innerHTML = (dataset?.centers ?? [])
    .map(
      (center) => `
      <li>
        <label class="center-option">
          <input type="checkbox" data-center="${center.id}" ${favorites.has(center.id) ? "checked" : ""}>
          <span class="center-option-text">
            <span class="center-option-name">${escapeHtml(center.nameJa)}</span>
            <span class="center-option-address">${escapeHtml(center.address)}</span>
          </span>
        </label>
      </li>`,
    )
    .join("");
  dialog.showModal();
}

function toggleFavorite(centerId: string) {
  if (favorites.has(centerId)) favorites.delete(centerId);
  else favorites.add(centerId);
  saveFavorites();
  if (!dialog.open) render();
}

function loadFavorites(): Set<string> {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return new Set(saved ? (JSON.parse(saved) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    // Private browsing can refuse storage; the choice still applies to this visit.
  }
}

document.getElementById("edit-centers")?.addEventListener("click", openCentersDialog);

init();
