import { filterEvents } from "../../lib/filter-events.ts";
import type { DataSet, Event } from "../../lib/schema.ts";
import { decodeURLState, encodeURLState } from "../../lib/url-state.ts";
import type { URLState } from "../../lib/url-state.ts";

let dataset: DataSet = {
  centers: [],
  sourceDocuments: [],
  events: [],
  generatedAt: "",
  version: "1.0.0",
};
let selectedCenters = new Set<string>();
let favorites = new Set<string>();
let selectedMonth = "";
let viewMode: "list" | "calendar" = "list";
let selectedType: URLState["type"] = "all";
let showFilters = false;

const centerColors: Record<string, string> = {
  nishi: "#3b82f6",
  kita: "#10b981",
  omiya: "#f59e0b",
  minuma: "#ec4899",
  yono: "#8b5cf6",
  sakura: "#f43f5e",
  urawa: "#06b6d4",
  minami: "#84cc16",
  midori: "#14b8a6",
  iwatsuki: "#a855f7",
};

async function init() {
  try {
    const response = await fetch("/data/dataset.json");
    dataset = await response.json();
  } catch (err) {
    console.error("Failed to load dataset:", err);
  }

  const savedFavorites = localStorage.getItem("favorites");
  if (savedFavorites) {
    favorites = new Set(JSON.parse(savedFavorites));
  }

  const urlState = decodeURLState(new URLSearchParams(window.location.search));

  if (urlState.centers.length > 0) {
    selectedCenters = new Set(urlState.centers);
  } else if (favorites.size > 0) {
    selectedCenters = new Set(favorites);
  }

  if (urlState.month) {
    selectedMonth = urlState.month;
  } else {
    const now = new Date();
    selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  viewMode = urlState.view;
  selectedType = urlState.type;

  setupEventListeners();
  renderCenterGrid();
  updateUI();
}

function setupEventListeners() {
  document.getElementById("filter-toggle")?.addEventListener("click", () => {
    showFilters = !showFilters;
    updateFilterVisibility();
  });

  document.getElementById("view-list")?.addEventListener("click", () => {
    viewMode = "list";
    updateViewButtons();
    updateURL();
    renderEvents();
  });

  document.getElementById("view-calendar")?.addEventListener("click", () => {
    viewMode = "calendar";
    updateViewButtons();
    updateURL();
    renderEvents();
  });

  document.getElementById("type-all")?.addEventListener("click", () => {
    selectedType = "all";
    updateTypeButtons();
    updateURL();
    renderEvents();
  });

  document.getElementById("type-hiroba")?.addEventListener("click", () => {
    selectedType = "hiroba";
    updateTypeButtons();
    updateURL();
    renderEvents();
  });

  document.getElementById("type-event")?.addEventListener("click", () => {
    selectedType = "event";
    updateTypeButtons();
    updateURL();
    renderEvents();
  });

  document.getElementById("month-select")?.addEventListener("change", (e) => {
    selectedMonth = (e.target as HTMLInputElement).value;
    updateURL();
    renderEvents();
  });

  document.getElementById("select-all")?.addEventListener("click", () => {
    selectedCenters = new Set(dataset.centers.map((c) => c.id));
    renderCenterGrid();
    updateFilterCount();
    updateURL();
    renderEvents();
  });

  document.getElementById("clear-all")?.addEventListener("click", () => {
    selectedCenters.clear();
    renderCenterGrid();
    updateFilterCount();
    updateURL();
    renderEvents();
  });

  document.getElementById("favorites-only")?.addEventListener("click", () => {
    selectedCenters = new Set(favorites);
    renderCenterGrid();
    updateFilterCount();
    updateURL();
    renderEvents();
  });
}

function updateURL() {
  const query = encodeURLState({
    centers: Array.from(selectedCenters),
    month: selectedMonth || null,
    view: viewMode,
    type: selectedType,
  });
  const newUrl = query ? `/?${query}` : "/";
  history.replaceState(null, "", newUrl);
}

function updateUI() {
  updateFilterVisibility();
  updateViewButtons();
  updateTypeButtons();
  updateMonthInput();
  updateFilterCount();
  renderEvents();
  updateStats();
}

function updateFilterVisibility() {
  const content = document.getElementById("filter-content");
  if (content) {
    content.classList.toggle("hidden", !showFilters);
  }
}

function updateViewButtons() {
  document.getElementById("view-list")?.classList.toggle("active", viewMode === "list");
  document.getElementById("view-calendar")?.classList.toggle("active", viewMode === "calendar");
}

function updateTypeButtons() {
  document.getElementById("type-all")?.classList.toggle("active", selectedType === "all");
  document.getElementById("type-hiroba")?.classList.toggle("active", selectedType === "hiroba");
  document.getElementById("type-event")?.classList.toggle("active", selectedType === "event");
}

function updateMonthInput() {
  const input = document.getElementById("month-select") as HTMLInputElement;
  if (input) {
    input.value = selectedMonth;
  }
}

function updateFilterCount() {
  const badge = document.getElementById("filter-count");
  if (badge) {
    if (selectedCenters.size > 0) {
      badge.textContent = String(selectedCenters.size);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

function renderCenterGrid() {
  const grid = document.getElementById("center-grid");
  if (!grid) return;

  const sortedCenters = [...dataset.centers].sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.nameJa.localeCompare(b.nameJa, "ja");
  });

  grid.innerHTML = sortedCenters
    .map(
      (center) => `
    <div class="center-item">
      <button 
        class="star-button ${favorites.has(center.id) ? "favorite" : ""}" 
        data-center-id="${center.id}"
        data-action="favorite"
        title="${favorites.has(center.id) ? "お気に入りから削除" : "お気に入りに追加"}"
      >
        <svg class="star-icon ${favorites.has(center.id) ? "filled" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
      <label class="checkbox-label">
        <input 
          type="checkbox" 
          ${selectedCenters.has(center.id) ? "checked" : ""}
          data-center-id="${center.id}"
          data-action="toggle"
        >
        <span>${center.nameJa}</span>
      </label>
    </div>
  `,
    )
    .join("");

  grid.querySelectorAll('[data-action="favorite"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const centerId = (e.currentTarget as HTMLElement).dataset.centerId!;
      toggleFavorite(centerId);
    });
  });

  grid.querySelectorAll('[data-action="toggle"]').forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const centerId = (e.target as HTMLElement).dataset.centerId!;
      toggleCenter(centerId);
    });
  });
}

function toggleFavorite(centerId: string) {
  if (favorites.has(centerId)) {
    favorites.delete(centerId);
  } else {
    favorites.add(centerId);
  }
  localStorage.setItem("favorites", JSON.stringify(Array.from(favorites)));
  renderCenterGrid();
}

function toggleCenter(centerId: string) {
  if (selectedCenters.has(centerId)) {
    selectedCenters.delete(centerId);
  } else {
    selectedCenters.add(centerId);
  }
  updateFilterCount();
  updateURL();
  renderEvents();
}

function getFilteredEvents(): Event[] {
  return filterEvents(dataset.events, {
    centers: Array.from(selectedCenters),
    month: selectedMonth || null,
    type: selectedType,
  });
}

function renderEvents() {
  const container = document.getElementById("events-container");
  if (!container) return;

  const events = getFilteredEvents();

  if (events.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        <p>表示するイベントがありません</p>
        <p>センターと月を選択してください</p>
      </div>
    `;
    updateStats();
    return;
  }

  if (viewMode === "calendar") {
    renderCalendarView(container, events);
  } else {
    renderListView(container, events);
  }
  updateStats();
}

function renderListView(container: HTMLElement, events: Event[]) {
  const eventsByDate = new Map<string, Event[]>();
  events.forEach((event) => {
    if (!eventsByDate.has(event.date)) {
      eventsByDate.set(event.date, []);
    }
    eventsByDate.get(event.date)!.push(event);
  });

  const sortedDates = Array.from(eventsByDate.keys()).sort();

  container.innerHTML = sortedDates
    .map((date) => {
      const dayEvents = eventsByDate.get(date)!;
      const dateObj = new Date(date + "T00:00:00");
      const formatted = formatDate(dateObj);

      return `
      <div class="date-section">
        <div class="date-header">
          <h2>${formatted}</h2>
        </div>
        <div class="event-list">
          ${dayEvents.map((event) => renderEventItem(event)).join("")}
        </div>
      </div>
    `;
    })
    .join("");
}

function renderEventItem(event: Event): string {
  const center = dataset.centers.find((c) => c.id === event.centerId);
  const pdfUrl = dataset.sourceDocuments.find((d) => d.id === event.sourceDocumentId)?.pdfUrl;

  const regular = event.origin === "regular-hours";
  return `
    <div class="event-item${regular ? " regular-hours" : ""}">
      <div class="event-content">
        <div class="event-main">
          <div class="event-tags-row">
            <span class="event-center-tag">${center?.nameJa || event.centerId}</span>
            ${regular ? '<span class="event-regular-tag">通常開室</span>' : ""}
            ${event.reservationRequired ? '<span class="event-reservation-tag">要予約</span>' : ""}
          </div>
          
          <h3 class="event-title">${escapeHtml(event.title)}</h3>
          
          <div class="event-details">
            ${
              event.startTime || event.endTime
                ? `
              <span class="event-detail">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${event.startTime || ""}${event.startTime && event.endTime ? "〜" : ""}${event.endTime || ""}
              </span>
            `
                : ""
            }
            
            ${
              event.targetAge
                ? `
              <span class="event-detail">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                ${escapeHtml(event.targetAge)}
              </span>
            `
                : ""
            }
            
            ${
              event.location
                ? `
              <span class="event-detail">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${escapeHtml(event.location)}
              </span>
            `
                : ""
            }
          </div>
          
          ${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ""}
          
          ${
            event.tags && event.tags.length > 0
              ? `
            <div class="event-tag-list">
              ${event.tags.map((tag) => `<span class="event-tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
          `
              : ""
          }
        </div>
        
        ${
          pdfUrl
            ? `
          <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer" class="event-pdf-link" title="元のPDFを確認">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            PDF
          </a>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function renderCalendarEvent(event: Event): string {
  const center = dataset.centers.find((item) => item.id === event.centerId);
  const pdfUrl = dataset.sourceDocuments.find(
    (document) => document.id === event.sourceDocumentId,
  )?.pdfUrl;
  const color = centerColors[event.centerId] || "#6b7280";
  const regular = event.origin === "regular-hours";
  const classes = regular ? "calendar-event regular-hours" : "calendar-event";
  const title = `${center?.nameJa || event.centerId}: ${event.title}${event.startTime ? ` ${event.startTime}` : ""}`;
  const body = `
    <div class="calendar-event-center">${center?.nameJa || event.centerId}</div>
    ${regular ? '<div class="calendar-event-regular">通常開室</div>' : ""}
    <div class="calendar-event-title">${escapeHtml(event.title)}</div>
    ${event.startTime ? `<div class="calendar-event-time">${event.startTime}</div>` : ""}
  `;
  if (regular && pdfUrl) {
    return `<a class="${classes}" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer" style="background-color: ${color}" title="${escapeHtml(title)}">${body}</a>`;
  }
  return `<div class="${classes}" style="background-color: ${color}" title="${escapeHtml(title)}">${body}</div>`;
}

function renderCalendarView(container: HTMLElement, events: Event[]) {
  if (!selectedMonth) return;

  const [year, month] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDay = monthStart.getDay();

  const days: (Date | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }

  const eventsByDate = new Map<string, Event[]>();
  events.forEach((event) => {
    if (!eventsByDate.has(event.date)) {
      eventsByDate.set(event.date, []);
    }
    eventsByDate.get(event.date)!.push(event);
  });

  const monthName = monthStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });

  container.innerHTML = `
    <div class="card">
      <div class="calendar-header">
        <button id="prev-month" class="calendar-nav-button">← 前月</button>
        <h2 class="calendar-title">${monthName}</h2>
        <button id="next-month" class="calendar-nav-button">次月 →</button>
      </div>
      
      <div class="calendar-grid-container">
        <div class="day-headers">
          <div class="day-header sunday">日</div>
          <div class="day-header">月</div>
          <div class="day-header">火</div>
          <div class="day-header">水</div>
          <div class="day-header">木</div>
          <div class="day-header">金</div>
          <div class="day-header saturday">土</div>
        </div>
        
        <div class="calendar-grid">
          ${days
            .map((day) => {
              if (!day) return "<div></div>";

              const dateStr = formatDateISO(day);
              const dayEvents = eventsByDate.get(dateStr) || [];
              const dayOfWeek = day.getDay();
              const isToday = formatDateISO(new Date()) === dateStr;

              return `
              <div class="calendar-day ${isToday ? "today" : ""} ${dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : ""}">
                <div class="calendar-day-number ${dayOfWeek === 0 ? "sunday" : dayOfWeek === 6 ? "saturday" : ""}">
                  ${day.getDate()}
                </div>
                <div class="calendar-events">
                  ${dayEvents.map((event) => renderCalendarEvent(event)).join("")}
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
      
      <div class="calendar-legend">
        <h3>センター凡例</h3>
        <div class="legend-grid">
          ${dataset.centers
            .filter((c) => selectedCenters.size === 0 || selectedCenters.has(c.id))
            .map(
              (center) => `
              <div class="legend-item">
                <div class="legend-color" style="background-color: ${centerColors[center.id] || "#6b7280"}"></div>
                <span class="legend-name">${center.nameJa}</span>
              </div>
            `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  document.getElementById("prev-month")?.addEventListener("click", () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    selectedMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    updateMonthInput();
    updateURL();
    renderEvents();
  });

  document.getElementById("next-month")?.addEventListener("click", () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    selectedMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    updateMonthInput();
    updateURL();
    renderEvents();
  });
}

function updateStats() {
  const events = getFilteredEvents();
  const countEl = document.getElementById("event-count");
  if (countEl) {
    let countLabel = `${events.length} 件`;
    if (selectedType === "hiroba") countLabel = `${events.length} 件のひろば`;
    if (selectedType === "event") countLabel = `${events.length} 件のイベント`;
    countEl.textContent = countLabel;
  }

  const updatedEl = document.getElementById("data-updated");
  if (updatedEl && dataset.generatedAt) {
    const date = new Date(dataset.generatedAt);
    updatedEl.textContent = `データ更新: ${date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    updatedEl.classList.remove("hidden");
  }
}

function formatDate(date: Date): string {
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日(${dayOfWeek})`;
}

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

init();
