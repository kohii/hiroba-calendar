import { readFileSync, writeFileSync } from "node:fs";
import { classifyTitle } from "../lib/classify-event.ts";
import { fillRegularHours } from "../lib/regular-hours.ts";
import { CENTERS } from "../lib/schema.ts";
import type { Center, DataSet, Event, RegularHoursPolicy, SourceDocument } from "../lib/schema.ts";

const DATASET_PATH = "public/data/dataset.json";
const HOLIDAY_PATH = "data/holidays-2026-2027.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isRegularHours(value: unknown): value is RegularHoursPolicy {
  if (!isRecord(value)) return false;
  if (
    typeof value.sourceUrl !== "string" ||
    typeof value.quote !== "string" ||
    typeof value.decisionNote !== "string"
  ) {
    return false;
  }
  if (value.decision === "unknown") return true;
  if (value.decision !== "fill") return false;
  return (
    typeof value.title === "string" &&
    typeof value.hoursQuote === "string" &&
    Array.isArray(value.windows) &&
    Array.isArray(value.openWeekdays) &&
    Array.isArray(value.closed)
  );
}

function isCenter(value: unknown): value is Center {
  if (!isRecord(value)) return false;
  const scheduleType = value.scheduleType;
  const scheduleTypeOk =
    scheduleType === undefined ||
    scheduleType === "pdf" ||
    scheduleType === "html" ||
    scheduleType === "image" ||
    scheduleType === "instagram" ||
    scheduleType === "not_found";
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.nameJa === "string" &&
    typeof value.address === "string" &&
    typeof value.phone === "string" &&
    typeof value.websiteUrl === "string" &&
    typeof value.closedDays === "string" &&
    scheduleTypeOk &&
    isOptionalString(value.scheduleUrlPattern) &&
    isOptionalString(value.scheduleNotes) &&
    isRegularHours(value.regularHours)
  );
}

function isClosure(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.date === "string" &&
    (value.scope === "all-day" || value.scope === "am" || value.scope === "pm") &&
    typeof value.quote === "string" &&
    value.quote.length > 0
  );
}

function isSourceDocument(value: unknown): value is SourceDocument {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.centerId === "string" &&
    typeof value.month === "string" &&
    typeof value.pdfUrl === "string" &&
    typeof value.fetchedAt === "string" &&
    typeof value.sha256 === "string" &&
    isOptionalString(value.extractedAt) &&
    (value.closures === undefined ||
      (Array.isArray(value.closures) && value.closures.every(isClosure)))
  );
}

function isEvent(value: unknown): value is Event {
  if (!isRecord(value)) return false;
  const tagsOk =
    value.tags === undefined ||
    (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string"));
  return (
    typeof value.id === "string" &&
    typeof value.centerId === "string" &&
    typeof value.sourceDocumentId === "string" &&
    typeof value.date === "string" &&
    typeof value.title === "string" &&
    (value.kind === "hiroba" || value.kind === "event") &&
    (value.origin === "extracted" || value.origin === "regular-hours") &&
    isOptionalString(value.startTime) &&
    isOptionalString(value.endTime) &&
    isOptionalString(value.description) &&
    isOptionalString(value.targetAge) &&
    isOptionalString(value.location) &&
    (value.reservationRequired === undefined || typeof value.reservationRequired === "boolean") &&
    (value.capacity === undefined || typeof value.capacity === "number") &&
    tagsOk
  );
}

function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function classifyEvent(value: unknown): Event {
  if (!isRecord(value)) throw new Error("event must be an object");
  const title = readString(value, "title");
  const id = readString(value, "id");
  readString(value, "centerId");
  readString(value, "sourceDocumentId");
  readString(value, "date");
  if (value.origin !== "regular-hours") {
    if (value.origin !== "extracted") value.origin = "extracted";
    value.kind = classifyTitle(title).kind;
  } else if (value.kind !== "hiroba" && value.kind !== "event") {
    throw new Error(`regular-hours event ${id} is missing kind`);
  }
  if (!isEvent(value)) throw new Error(`event ${id} does not match the schedule model`);
  return value;
}

function attachPolicy(value: unknown): Center {
  if (!isRecord(value)) throw new Error("center must be an object");
  const id = readString(value, "id");
  const source = CENTERS.find((center) => center.id === id);
  if (!source) throw new Error(`no regularHours for ${id}`);
  value.regularHours = source.regularHours;
  if (!isCenter(value)) throw new Error(`center ${id} does not match the schedule model`);
  return value;
}

function readSourceDocument(value: unknown): SourceDocument {
  if (!isSourceDocument(value)) {
    throw new Error("source document does not match the schedule model");
  }
  return value;
}

function readHolidayDates(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.holidays)) {
    throw new Error("holiday file is missing holidays");
  }
  return value.holidays.map((row) => {
    if (!isRecord(row) || typeof row.date !== "string") {
      throw new Error("holiday row is missing date");
    }
    return row.date;
  });
}

const datasetRaw: unknown = JSON.parse(readFileSync(DATASET_PATH, "utf8"));
if (!isRecord(datasetRaw)) throw new Error("dataset must be an object");

const centers = readArray(datasetRaw.centers, "centers").map(attachPolicy);
const sourceDocuments = readArray(datasetRaw.sourceDocuments, "sourceDocuments").map(
  readSourceDocument,
);
const events = readArray(datasetRaw.events, "events").map(classifyEvent);
const holidayDates = readHolidayDates(JSON.parse(readFileSync(HOLIDAY_PATH, "utf8")));
const filled = fillRegularHours({ events, centers, sourceDocuments, holidayDates });

const output: DataSet = {
  centers,
  sourceDocuments,
  events: filled,
  generatedAt: new Date().toISOString(),
  version: readString(datasetRaw, "version"),
};

writeFileSync(DATASET_PATH, `${JSON.stringify(output, null, 2)}\n`);

for (const center of centers) {
  const octoberRegularHours = filled.filter(
    (event) =>
      event.origin === "regular-hours" &&
      event.centerId === center.id &&
      event.date.startsWith("2026-10"),
  ).length;
  console.log(
    JSON.stringify({
      centerId: center.id,
      decision: center.regularHours.decision,
      octoberRegularHours,
    }),
  );
}

const lowConfidence = [
  ...new Set(
    filled
      .filter(
        (event) => event.origin === "extracted" && classifyTitle(event.title).confidence === "low",
      )
      .map((event) => event.title),
  ),
].sort();
console.log(JSON.stringify({ lowConfidence }));
