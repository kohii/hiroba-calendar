/**
 * Print one line per day of a source document from public/data/dataset.json,
 * to compare the published rows with the PDF calendar cell by cell.
 *
 * Usage: node --experimental-strip-types scripts/day-summary.ts <sourceDocumentId>
 */
import { readFileSync } from "node:fs";
import type { DataSet, Event } from "../lib/schema.ts";

const documentId = process.argv[2];
if (!documentId) {
  console.error("Usage: day-summary.ts <sourceDocumentId>");
  process.exit(1);
}

const dataset: DataSet = JSON.parse(readFileSync("public/data/dataset.json", "utf8"));
const document = dataset.sourceDocuments.find((doc) => doc.id === documentId);
if (!document) {
  console.error(`source document ${documentId} not found`);
  process.exit(1);
}

function label(event: Event): string {
  const time = [event.startTime, event.endTime].filter(Boolean).join("-");
  if (event.origin === "regular-hours") return `[通常 ${event.description}]`;
  return `${event.kind === "hiroba" ? "[ひろば] " : ""}${event.title}${time ? ` ${time}` : ""}`;
}

const month = /^\d{6}$/.test(document.month)
  ? `${document.month.slice(0, 4)}-${document.month.slice(4)}`
  : document.month;
const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
for (let day = 1; day <= lastDay; day += 1) {
  const date = `${month}-${String(day).padStart(2, "0")}`;
  const closures = (document.closures ?? [])
    .filter((closure) => closure.date === date)
    .map((closure) => `休(${closure.scope}:${closure.quote})`);
  const events = dataset.events
    .filter((event) => event.sourceDocumentId === documentId && event.date === date)
    .map(label);
  console.log([date.slice(5), ...closures, ...events].join("  "));
}
