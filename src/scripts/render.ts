import type { Center, Event, SourceDocument } from "../../lib/schema.ts";
import {
  addDays,
  calendarWeeks,
  dateRange,
  daysInMonth,
  hoursLabel,
  shiftMonth,
  weekdayLabel,
  weekdayOf,
} from "../../lib/schedule.ts";
import type { CenterDay, Schedule } from "../../lib/schedule.ts";
import { encodeURLState } from "../../lib/url-state.ts";
import type { URLState, ViewState } from "../../lib/url-state.ts";

export interface RenderContext {
  schedule: Schedule;
  /** Centers shown in the week and day views, in display order. */
  centers: Center[];
  allCenters: Center[];
  favorites: ReadonlySet<string>;
  documents: SourceDocument[];
  holidays: ReadonlyMap<string, string>;
  today: string;
  all: boolean;
}

export const WEEK_LENGTH = 7;

// ---- Views ----

export function renderWeek(ctx: RenderContext): string {
  const days = dateRange(ctx.today, WEEK_LENGTH)
    .map(
      (date) => `
      <section class="day-section">
        <h2 class="day-heading">${dayHeading(ctx, date)}</h2>
        ${renderCentersOnDay(ctx, date)}
      </section>`,
    )
    .join("");
  const next = addDays(ctx.today, WEEK_LENGTH);
  return `${onboarding(ctx)}<div class="week">${days}</div>
    <a class="more-link" href="${href(ctx, { view: "day", date: next })}" data-nav>${dateText(next)}以降の予定を見る${icon("chevron-right")}</a>`;
}

export function renderDay(ctx: RenderContext, date: string): string {
  const prev = href(ctx, { view: "day", date: addDays(date, -1) });
  const next = href(ctx, { view: "day", date: addDays(date, 1) });
  return `
    ${onboarding(ctx)}
    ${dateStrip(ctx, date)}
    <div class="day-toolbar">
      <a class="round-button" href="${prev}" data-nav="replace" aria-label="前の日">${icon("chevron-left")}</a>
      <h2 class="day-title">${dayHeading(ctx, date, true)}</h2>
      <a class="round-button" href="${next}" data-nav="replace" aria-label="次の日">${icon("chevron-right")}</a>
    </div>
    ${renderCentersOnDay(ctx, date)}`;
}

export function renderCenter(
  ctx: RenderContext,
  center: Center,
  month: string,
  selectedDate: string,
): string {
  const months = ctx.schedule.months;
  const first = months[0] ?? month;
  const last = months[months.length - 1] ?? month;
  const document = documentFor(ctx, center.id, month);
  const monthLink = (target: string, enabled: boolean, label: string, name: string) =>
    enabled
      ? `<a class="round-button" href="${href(ctx, { view: "center", center: center.id, month: target, date: null })}" data-nav="replace" aria-label="${label}">${icon(name)}</a>`
      : `<span class="round-button" aria-disabled="true">${icon(name)}</span>`;

  const monthEvents = daysInMonth(month).flatMap((date) => {
    const day = ctx.schedule.centerDay(center.id, date);
    return day.status === "open" ? day.events : [];
  });
  const selected = selectedDate.startsWith(month) ? selectedDate : null;

  return `
    ${centerPicker(ctx, center)}
    <section class="center-card">
      <div class="center-card-head">
        <h2 class="center-card-name">${escapeHtml(center.nameJa)}</h2>
        <button type="button" class="star-toggle" data-favorite="${center.id}" aria-pressed="${ctx.favorites.has(center.id)}">
          ${icon("star")}<span>${ctx.favorites.has(center.id) ? "マイ施設" : "マイ施設に追加"}</span>
        </button>
      </div>
      <dl class="center-facts">
        <div><dt>休館</dt><dd>${escapeHtml(center.closedDays)}</dd></div>
        <div><dt>住所</dt><dd>${escapeHtml(center.address)}</dd></div>
        <div><dt>電話</dt><dd><a href="tel:${escapeHtml(center.phone)}">${escapeHtml(center.phone)}</a></dd></div>
      </dl>
      <div class="center-links">
        <a href="${escapeHtml(center.websiteUrl)}" target="_blank" rel="noopener noreferrer">公式サイト ${icon("external")}</a>
        ${document ? `<a href="${escapeHtml(document.pdfUrl)}" target="_blank" rel="noopener noreferrer">${monthNumber(month)}月の予定表PDF ${icon("external")}</a>` : ""}
      </div>
    </section>

    <section class="month">
      <div class="month-toolbar">
        ${monthLink(shiftMonth(month, -1), month > first, "前の月", "chevron-left")}
        <h2 class="month-title">${month.slice(0, 4)}年${monthNumber(month)}月</h2>
        ${monthLink(shiftMonth(month, 1), month < last, "次の月", "chevron-right")}
      </div>
      ${monthGrid(ctx, center, month, selected)}
      <ul class="legend" aria-label="凡例">
        <li><span class="legend-hiroba"></span>ひろば</li>
        <li><span class="legend-event"></span>イベント</li>
        <li><span class="legend-closed">休</span>休館</li>
      </ul>
    </section>

    ${
      selected
        ? `<section class="selected-day">
            <h3 class="section-title">${dayHeading(ctx, selected)}</h3>
            ${renderCenterDayBody(ctx, center, ctx.schedule.centerDay(center.id, selected))}
          </section>`
        : ""
    }

    <section class="month-events">
      <h3 class="section-title">${monthNumber(month)}月のイベント <span class="count">${monthEvents.length}件</span></h3>
      ${
        monthEvents.length > 0
          ? eventList(ctx, monthEvents, true)
          : `<p class="muted">${ctx.schedule.centerDay(center.id, `${month}-01`).status === "unpublished" ? "この月の予定表はまだ掲載されていません" : "この月のイベントはありません"}</p>`
      }
    </section>`;
}

// ---- Day contents ----

function renderCentersOnDay(ctx: RenderContext, date: string): string {
  if (ctx.centers.length === 0) return "";
  const active: string[] = [];
  const closed: Center[] = [];
  const quiet: Center[] = [];
  const unpublished: Center[] = [];
  for (const center of ctx.centers) {
    const day = ctx.schedule.centerDay(center.id, date);
    if (day.status === "closed") closed.push(center);
    else if (day.status === "unpublished") unpublished.push(center);
    else if (day.hiroba.length === 0 && day.events.length === 0) quiet.push(center);
    else active.push(centerRow(ctx, center, date, day));
  }
  const summary = [
    summaryLine(ctx, "休館", closed, date, "closed"),
    summaryLine(ctx, "予定なし", quiet, date, "quiet"),
    summaryLine(ctx, "予定表未掲載", unpublished, date, "unpublished"),
  ].join("");
  const empty =
    closed.length > 0 && quiet.length === 0
      ? `<p class="empty-day">${icon("moon")}開いている施設はありません</p>`
      : "";
  return `
    ${active.length > 0 ? `<ul class="center-rows">${active.join("")}</ul>` : empty}
    ${summary ? `<ul class="summary-lines">${summary}</ul>` : ""}`;
}

function centerRow(
  ctx: RenderContext,
  center: Center,
  date: string,
  day: Extract<CenterDay, { status: "open" }>,
): string {
  return `
    <li class="center-row">
      <div class="center-row-head">
        <a class="center-row-name" href="${centerHref(ctx, center.id, date)}" data-nav>${escapeHtml(center.nameJa)}${icon("chevron-right")}</a>
        ${hirobaGroup(ctx, center, day)}
      </div>
      ${eventList(ctx, day.events, false)}
    </li>`;
}

function renderCenterDayBody(ctx: RenderContext, center: Center, day: CenterDay): string {
  switch (day.status) {
    case "unpublished":
      return `<p class="muted">予定表がまだ掲載されていません。<a href="${escapeHtml(center.websiteUrl)}" target="_blank" rel="noopener noreferrer">公式サイト</a>で確認してください</p>`;
    case "closed":
      return `<p class="closed-note">${icon("moon")}休館日です</p>`;
    case "open": {
      const hiroba = hirobaGroup(ctx, center, day);
      if (!hiroba && day.events.length === 0) {
        return `<p class="muted">この日の予定はありません</p>`;
      }
      return `${hiroba}${eventList(ctx, day.events, false)}`;
    }
  }
}

function hirobaGroup(
  ctx: RenderContext,
  center: Center,
  day: Extract<CenterDay, { status: "open" }>,
): string {
  if (day.hiroba.length === 0) {
    return day.hirobaKnown ? `<span class="hiroba-off">ひろば休み</span>` : "";
  }
  return `<div class="hiroba-group">${day.hiroba.map((event) => hirobaChip(ctx, center, event)).join("")}</div>`;
}

function hirobaChip(ctx: RenderContext, center: Center, event: Event): string {
  const hours = hoursLabel(event);
  const policy = center.regularHours;
  // The center's usual hiroba needs no name; special ones such as "0歳さんの広場" do.
  const special = !(policy.decision === "fill" && policy.title === event.title);
  // Regular-hours entries carry only the quoted hours, which the chip already shows.
  const note =
    event.description && hoursLabel({ description: event.description }) === ""
      ? `<p>${escapeHtml(event.description)}</p>`
      : "";
  const details = [
    `<p class="hiroba-name">${escapeHtml(event.title)}</p>`,
    event.targetAge ? fact("対象", event.targetAge) : "",
    note,
    sourceLink(ctx, event),
  ].join("");
  return `
    <details class="hiroba">
      <summary>
        <span class="kind kind-hiroba">ひろば</span>
        ${hours ? `<span class="hiroba-hours">${escapeHtml(hours)}</span>` : ""}
        ${special ? `<span class="hiroba-title">${escapeHtml(event.title)}</span>` : ""}
      </summary>
      <div class="entry-details">${details}</div>
    </details>`;
}

function eventList(ctx: RenderContext, events: Event[], showDate: boolean): string {
  if (events.length === 0) return "";
  return `<ul class="entry-list">${events
    .map(
      (event) =>
        `<li${event.date < ctx.today ? ' class="is-past"' : ""}>${eventCard(ctx, event, { showDate })}</li>`,
    )
    .join("")}</ul>`;
}

function eventCard(ctx: RenderContext, event: Event, opts: { showDate: boolean }): string {
  const start = event.startTime ? event.startTime.replace(/^0/, "") : "";
  const end = event.endTime ? event.endTime.replace(/^0/, "") : "";
  const tags = (event.tags ?? []).filter((tag) => tag !== "予約制");
  const details = [
    event.description ? `<p>${escapeHtml(event.description)}</p>` : "",
    event.targetAge ? fact("対象", event.targetAge) : "",
    event.location ? fact("場所", event.location) : "",
    event.capacity ? fact("定員", `${event.capacity}組`) : "",
    tags.length > 0
      ? `<div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
      : "",
    sourceLink(ctx, event),
  ].join("");
  return `
    <details class="event${opts.showDate ? " with-date" : ""}">
      <summary>
        <span class="event-time">
          ${opts.showDate ? `<span class="event-date">${monthNumber(event.date)}/${Number(event.date.slice(8, 10))}<small>(${weekdayLabel(event.date)})</small></span>` : ""}
          ${start ? `<span class="event-start">${start}</span>` : `<span class="muted">時間未定</span>`}
          ${end ? `<span class="event-end">${end}</span>` : ""}
        </span>
        <span class="event-main">
          <span class="event-title">${escapeHtml(event.title)}</span>
          <span class="event-meta">
            <span class="kind kind-event">イベント</span>
            ${event.reservationRequired ? `<span class="badge-reserve">要予約</span>` : ""}
            ${event.targetAge ? `<span class="event-age">${escapeHtml(event.targetAge)}</span>` : ""}
          </span>
        </span>
      </summary>
      <div class="entry-details">${details}</div>
    </details>`;
}

function summaryLine(
  ctx: RenderContext,
  label: string,
  centers: Center[],
  date: string,
  tone: string,
): string {
  if (centers.length === 0) return "";
  const names = centers
    .map(
      (center) =>
        `<a href="${centerHref(ctx, center.id, date)}" data-nav>${escapeHtml(center.nameJa)}</a>`,
    )
    .join("、");
  return `<li class="summary-line summary-${tone}"><span class="summary-label">${label}</span><span>${names}</span></li>`;
}

function fact(label: string, value: string): string {
  return `<p class="fact"><span class="fact-label">${label}</span>${escapeHtml(value)}</p>`;
}

function sourceLink(ctx: RenderContext, event: Event): string {
  const document = ctx.documents.find((item) => item.id === event.sourceDocumentId);
  if (!document) return "";
  return `<a class="source-link" href="${escapeHtml(document.pdfUrl)}" target="_blank" rel="noopener noreferrer">元の予定表PDFを見る ${icon("external")}</a>`;
}

// ---- Navigation pieces ----

function onboarding(ctx: RenderContext): string {
  if (ctx.favorites.size > 0) return "";
  return `
    <aside class="onboarding">
      <p><strong>よく行く施設を選びましょう</strong><br>選んだ施設の予定だけを表示します</p>
      <button type="button" class="primary-button" data-open-centers>施設を選ぶ</button>
    </aside>`;
}

function dateStrip(ctx: RenderContext, selected: string): string {
  const months = ctx.schedule.months.length > 0 ? ctx.schedule.months : [selected.slice(0, 7)];
  const items = months
    .flatMap((month) => daysInMonth(month))
    .map((date) => {
      const hasEvent = ctx.centers.some((center) => {
        const day = ctx.schedule.centerDay(center.id, date);
        return day.status === "open" && day.events.length > 0;
      });
      const classes = [
        "strip-day",
        date === selected ? "is-selected" : "",
        date === ctx.today ? "is-today" : "",
        dayTone(ctx, date),
      ]
        .filter(Boolean)
        .join(" ");
      const monthMark = date.endsWith("-01")
        ? `<span class="strip-month">${monthNumber(date)}月</span>`
        : "";
      return `${monthMark}<a class="${classes}" href="${href(ctx, { view: "day", date })}" data-nav="replace"${date === selected ? ' aria-current="date"' : ""}>
          <span class="strip-weekday">${weekdayLabel(date)}</span>
          <span class="strip-number">${Number(date.slice(8, 10))}</span>
          <span class="strip-dot${hasEvent ? " has-event" : ""}"></span>
        </a>`;
    })
    .join("");
  return `<nav class="date-strip" aria-label="日付を選ぶ"><div class="date-strip-track">${items}</div></nav>`;
}

function centerPicker(ctx: RenderContext, current: Center): string {
  const mine = ctx.allCenters.filter((center) => ctx.favorites.has(center.id));
  const others = ctx.allCenters.filter((center) => !ctx.favorites.has(center.id));
  const chip = (center: Center) =>
    `<a class="chip${center.id === current.id ? " is-selected" : ""}" href="${href(ctx, { view: "center", center: center.id, month: null, date: null })}" data-nav="replace"${center.id === current.id ? ' aria-current="page"' : ""}>${ctx.favorites.has(center.id) ? icon("star") : ""}${escapeHtml(center.nameJa)}</a>`;
  return `
    <nav class="chip-scroller" aria-label="施設を選ぶ">
      ${mine.map(chip).join("")}
      ${mine.length > 0 && others.length > 0 ? `<span class="chip-divider" aria-hidden="true"></span>` : ""}
      ${others.map(chip).join("")}
    </nav>`;
}

function monthGrid(
  ctx: RenderContext,
  center: Center,
  month: string,
  selected: string | null,
): string {
  const head = ["日", "月", "火", "水", "木", "金", "土"]
    .map((label, index) => `<span class="grid-weekday wd-${index}">${label}</span>`)
    .join("");
  const cells = calendarWeeks(month)
    .flat()
    .map((date) => {
      if (!date) return `<span class="grid-cell is-blank"></span>`;
      const day = ctx.schedule.centerDay(center.id, date);
      const classes = [
        "grid-cell",
        `is-${day.status}`,
        date === selected ? "is-selected" : "",
        date === ctx.today ? "is-today" : "",
        date < ctx.today ? "is-past" : "",
        dayTone(ctx, date),
      ]
        .filter(Boolean)
        .join(" ");
      const marks =
        day.status === "closed"
          ? `<span class="mark-closed">休</span>`
          : day.status === "open"
            ? `${day.hiroba.length > 0 ? `<span class="mark-hiroba"></span>` : ""}${day.events.length > 0 ? `<span class="mark-events">${day.events.map(() => "<i></i>").join("")}</span>` : ""}`
            : "";
      return `<a class="${classes}" href="${href(ctx, { view: "center", center: center.id, month, date })}" data-nav="replace" aria-label="${dateText(date)}">
          <span class="grid-number">${Number(date.slice(8, 10))}</span>
          <span class="grid-marks">${marks}</span>
        </a>`;
    })
    .join("");
  return `<div class="month-grid">${head}${cells}</div>`;
}

// ---- Helpers ----

function dateText(date: string): string {
  return `${monthNumber(date)}月${Number(date.slice(8, 10))}日(${weekdayLabel(date)})`;
}

function dayHeading(ctx: RenderContext, date: string, long = false): string {
  const relative = date === ctx.today ? "今日" : date === addDays(ctx.today, 1) ? "明日" : "";
  const holiday = ctx.holidays.get(date);
  const label = `${long ? `${Number(date.slice(0, 4))}年` : ""}${monthNumber(date)}月${Number(date.slice(8, 10))}日`;
  return `<span class="${dayTone(ctx, date)}">${label}<small>(${weekdayLabel(date)})</small></span>${
    relative ? `<span class="relative-tag">${relative}</span>` : ""
  }${holiday ? `<span class="holiday-tag">${escapeHtml(holiday)}</span>` : ""}`;
}

function dayTone(ctx: RenderContext, date: string): string {
  if (ctx.holidays.has(date) || weekdayOf(date) === 0) return "tone-sun";
  if (weekdayOf(date) === 6) return "tone-sat";
  return "";
}

function centerHref(ctx: RenderContext, centerId: string, date: string): string {
  return href(ctx, { view: "center", center: centerId, month: date.slice(0, 7), date });
}

export function href(ctx: Pick<RenderContext, "all">, route: ViewState): string {
  const state: URLState = { route, all: ctx.all };
  const query = encodeURLState(state);
  return query ? `?${query}` : "./";
}

function documentFor(
  ctx: RenderContext,
  centerId: string,
  month: string,
): SourceDocument | undefined {
  return ctx.documents.find(
    (document) =>
      document.centerId === centerId && document.month.replace("-", "") === month.replace("-", ""),
  );
}

function monthNumber(date: string): number {
  return Number(date.slice(5, 7));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ICONS: Record<string, string> = {
  "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
  "chevron-right": '<path d="M9 18l6-6-6-6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};

export function icon(name: string): string {
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
