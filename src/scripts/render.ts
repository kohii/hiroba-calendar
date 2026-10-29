import type { Center, Event, SourceDocument } from "../../lib/schema.ts";
import {
  addDays,
  calendarWeeks,
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
  /** Centers shown in the schedule view, in display order. */
  centers: Center[];
  allCenters: Center[];
  favorites: ReadonlySet<string>;
  documents: SourceDocument[];
  holidays: ReadonlyMap<string, string>;
  today: string;
  all: boolean;
}

/** The schedule shows at least this many days, and runs on to the end of the published months. */
const MIN_DAYS = 7;

// ---- Views ----

export function renderSchedule(ctx: RenderContext, start: string): string {
  const months = visibleMonths(ctx, start);
  const lastDay = daysInMonth(months[months.length - 1] ?? start.slice(0, 7)).at(-1) ?? start;
  const dates: string[] = [];
  for (let date = start; date <= lastDay || dates.length < MIN_DAYS; date = addDays(date, 1)) {
    dates.push(date);
  }
  const head = dates
    .map(
      (date) =>
        `<div class="matrix-date ${dayTone(ctx, date)}${date === ctx.today ? " is-today" : ""}">
          <span class="matrix-day">${monthNumber(date)}/${Number(date.slice(8, 10))}</span>
          <span class="matrix-weekday">${weekdayLabel(date)}${ctx.holidays.has(date) ? "・祝" : ""}</span>
        </div>`,
    )
    .join("");
  const rows = ctx.centers
    .map(
      (center) =>
        `<a class="matrix-center" href="${centerHref(ctx, center.id, start)}" data-nav>${escapeHtml(center.nameJa)}</a>${dates
          .map((date) => matrixCell(ctx, center, date))
          .join("")}`,
    )
    .join("");
  return `
    ${onboarding(ctx)}
    <div class="schedule-toolbar">
      <label class="date-jump">
        ${icon("calendar")}<span>${start === ctx.today ? "日付を選ぶ" : `${dateText(start)}から`}</span>
        <input type="date" id="date-jump" value="${start}" aria-label="表示を始める日">
      </label>
      ${start === ctx.today ? "" : `<a class="today-link" href="${href(ctx, { view: "schedule", date: null })}" data-nav="replace">今日から</a>`}
      <ul class="legend" aria-label="凡例">
        <li><span class="legend-hiroba"></span>ひろば</li>
        <li><span class="legend-event"></span>イベント</li>
        <li><i class="cell-reserve">予</i>要予約</li>
      </ul>
    </div>
    <div class="matrix" style="--days: ${dates.length}">
      <div class="matrix-corner"></div>${head}${rows}
    </div>`;
}

/** Details of one center on one day, shown in a sheet over the schedule. */
export function renderDayDetail(ctx: RenderContext, center: Center, date: string): string {
  return `
    <div class="sheet-head">
      <h2 class="detail-title">${escapeHtml(center.nameJa)}<span class="detail-date">${dayHeading(ctx, date)}</span></h2>
      <button class="round-button" value="close" aria-label="閉じる">${icon("close")}</button>
    </div>
    <div class="detail-body">${renderCenterDayBody(ctx, center, ctx.schedule.centerDay(center.id, date))}</div>
    <a class="detail-link" href="${centerHref(ctx, center.id, date)}" data-nav>${escapeHtml(center.nameJa)}の1か月を見る${icon("chevron-right")}</a>`;
}

export function renderCenter(
  ctx: RenderContext,
  center: Center,
  month: string,
  selectedDate: string,
): string {
  const months = visibleMonths(ctx);
  const first = months[0] ?? month;
  const last = months[months.length - 1] ?? month;
  const document = documentFor(ctx, center.id, month);
  const imported = ctx.documents.some((item) => item.centerId === center.id);
  const monthLink = (target: string, enabled: boolean, label: string, name: string) =>
    enabled
      ? `<a class="round-button" href="${href(ctx, { view: "center", center: center.id, month: target, date: null })}" data-nav="replace" aria-label="${label}">${icon(name)}</a>`
      : `<span class="round-button" aria-disabled="true">${icon(name)}</span>`;

  const monthEvents = daysInMonth(month).flatMap((date) => {
    const day = ctx.schedule.centerDay(center.id, date);
    return day.status === "open" ? day.events : [];
  });
  const upcoming = monthEvents.filter((event) => event.date >= ctx.today);
  const past = monthEvents.filter((event) => event.date < ctx.today);
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

    ${
      imported
        ? `
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
      </ul>
    </section>

    ${
      selected
        ? `<section class="selected-day" id="selected-day">
            <h3 class="section-title">${dayHeading(ctx, selected)}</h3>
            ${renderCenterDayBody(ctx, center, ctx.schedule.centerDay(center.id, selected))}
          </section>`
        : ""
    }

    <section class="month-events">
      <h3 class="section-title">${monthNumber(month)}月のイベント <span class="count">${monthEvents.length}件</span></h3>
      ${
        !document
          ? `<p class="muted">この月の予定表はまだありません</p>`
          : monthEvents.length === 0
            ? `<p class="muted">この月のイベントはありません</p>`
            : `${eventList(ctx, upcoming, true)}${
                past.length > 0
                  ? `<details class="past-events"><summary>過去のイベント（${past.length}件）</summary>${eventList(ctx, past, true)}</details>`
                  : ""
              }`
      }
    </section>`
        : `<p class="notice">このサイトではこの施設の予定表を取り込めていません。予定は<a href="${escapeHtml(center.websiteUrl)}" target="_blank" rel="noopener noreferrer">公式サイト</a>で確認してください</p>`
    }`;
}

// ---- Day contents ----

function matrixCell(ctx: RenderContext, center: Center, date: string): string {
  const day = ctx.schedule.centerDay(center.id, date);
  let body = "";
  if (day.status === "unpublished") body = `<span class="cell-none">—</span>`;
  else if (day.status === "closed") body = `<span class="cell-closed">休</span>`;
  else {
    const hiroba = day.hiroba.map((event) => {
      const hours = hirobaHours(center, event, "short");
      const title = isRegularHiroba(center, event)
        ? ""
        : `<small>${escapeHtml(event.title)}</small>`;
      return `<span class="cell-hiroba">${hours ? escapeHtml(hours) : "ひろば"}${title}</span>`;
    });
    if (day.hiroba.length === 0) {
      hiroba.push(
        `<span class="cell-note">${day.hirobaKnown ? "ひろば休" : "ひろば情報なし"}</span>`,
      );
    }
    const events = day.events.map(
      (event) =>
        `<span class="cell-event">${event.startTime ? `<b>${event.startTime.replace(/^0/, "")}</b>` : ""}${event.reservationRequired ? `<i class="cell-reserve" title="要予約">予</i>` : ""}${escapeHtml(event.title)}</span>`,
    );
    body = [...hiroba, ...events].join("");
  }
  return `<button type="button" class="cell${date === ctx.today ? " is-today" : ""}" data-cell="${center.id}|${date}" aria-label="${escapeHtml(center.nameJa)} ${dateText(date)}">${body}</button>`;
}

function renderCenterDayBody(ctx: RenderContext, center: Center, day: CenterDay): string {
  switch (day.status) {
    case "unpublished":
      return `<p class="muted">この日の予定表がありません。<a href="${escapeHtml(center.websiteUrl)}" target="_blank" rel="noopener noreferrer">公式サイト</a>で確認してください</p>`;
    case "closed":
      return `<p class="closed-note">${icon("moon")}お休みです</p>`;
    case "open": {
      const hiroba = hirobaGroup(ctx, center, day);
      if (!hiroba && day.events.length === 0) {
        return `<p class="muted">この日のイベントはありません</p>`;
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

/** The center's usual hiroba needs no name; special ones such as "0歳さんの広場" do. */
function isRegularHiroba(center: Center, event: Event): boolean {
  const policy = center.regularHours;
  return policy.decision === "fill" && policy.title === event.title;
}

/** Hours of a hiroba, falling back to the center's usual hours for its usual hiroba. */
function hirobaHours(center: Center, event: Event, style: "full" | "short"): string {
  const policy = center.regularHours;
  const usual =
    policy.decision === "fill" && isRegularHiroba(center, event)
      ? hoursLabel({ description: policy.hoursQuote }, style)
      : "";
  return hoursLabel(event, style) || usual;
}

function hirobaChip(ctx: RenderContext, center: Center, event: Event): string {
  const hours = hirobaHours(center, event, "full");
  const special = !isRegularHiroba(center, event);
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
  const phone = ctx.allCenters.find((center) => center.id === event.centerId)?.phone;
  const start = event.startTime ? event.startTime.replace(/^0/, "") : "";
  const end = event.endTime ? event.endTime.replace(/^0/, "") : "";
  const tags = (event.tags ?? []).filter((tag) => tag !== "予約制");
  const details = [
    event.description ? `<p>${escapeHtml(event.description)}</p>` : "",
    event.targetAge ? fact("対象", event.targetAge) : "",
    event.location ? fact("場所", event.location) : "",
    event.capacity ? fact("定員", `${event.capacity}組`) : "",
    event.reservationRequired && phone
      ? `<p class="fact"><span class="fact-label">予約</span><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></p>`
      : "",
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
        ${icon("chevron-down")}
      </summary>
      <div class="entry-details">${details}</div>
    </details>`;
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
      <p>よく行く施設を選ぶと、その施設だけを表示します</p>
      <button type="button" class="primary-button" data-open-centers>施設を選ぶ</button>
    </aside>`;
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
      return `<a class="${classes}" href="${href(ctx, { view: "center", center: center.id, month, date })}" data-nav="replace" data-scroll="selected-day" aria-label="${dateText(date)}">
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

/** Months with schedules plus the months of the given dates, without gaps. */
function visibleMonths(ctx: RenderContext, ...dates: string[]): string[] {
  const wanted = [
    ...ctx.schedule.months,
    ctx.today.slice(0, 7),
    ...dates.map((date) => date.slice(0, 7)),
  ].sort();
  const months: string[] = [];
  for (
    let month = wanted[0] ?? "";
    month && month <= (wanted[wanted.length - 1] ?? "");
    month = shiftMonth(month, 1)
  ) {
    months.push(month);
  }
  return months;
}

function centerHref(ctx: RenderContext, centerId: string, date: string): string {
  return href(ctx, { view: "center", center: centerId, month: date.slice(0, 7), date });
}

function href(ctx: Pick<RenderContext, "all">, route: ViewState): string {
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
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

function icon(name: string): string {
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
