/**
 * Validate AI-extracted events against the schema
 * Hand-written validator (no Ajv dependency)
 */

import type { Event, SourceDocument } from "../lib/schema.ts";
import { CENTERS } from "../lib/schema.ts";

const VALID_CENTER_IDS = new Set(CENTERS.map((c) => c.id));

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate date format YYYY-MM-DD
 */
function isValidDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;

  const [, year, month, day] = match;
  const y = parseInt(year);
  const m = parseInt(month);
  const d = parseInt(day);

  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // Check valid date (handles Feb, 30/31 days)
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Validate time format HH:MM
 */
function isValidTime(timeStr: string): boolean {
  const match = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.exec(timeStr);
  return match !== null;
}

/**
 * Validate a single event
 */
export function validateEvent_single(event: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!event.id || typeof event.id !== "string") {
    errors.push("id: required string field");
  }

  if (!event.centerId || typeof event.centerId !== "string") {
    errors.push("centerId: required string field");
  } else if (!VALID_CENTER_IDS.has(event.centerId)) {
    errors.push(`Invalid centerId: ${event.centerId} is not a registered center`);
  }

  if (!event.sourceDocumentId || typeof event.sourceDocumentId !== "string") {
    errors.push("sourceDocumentId: required string field");
  } else if (event.centerId && !event.sourceDocumentId.startsWith(event.centerId + "-")) {
    errors.push(
      `sourceDocumentId ${event.sourceDocumentId} does not match centerId ${event.centerId}`,
    );
  }

  if (!event.date || typeof event.date !== "string") {
    errors.push("date: required string field");
  } else if (!isValidDate(event.date)) {
    errors.push(`date: invalid format '${event.date}' (expected YYYY-MM-DD)`);
  }

  if (!event.title || typeof event.title !== "string" || event.title.length === 0) {
    errors.push("title: required non-empty string field");
  }

  if (event.kind !== "hiroba" && event.kind !== "event") {
    errors.push("kind: must be 'hiroba' or 'event'");
  }

  if (event.origin !== "extracted" && event.origin !== "regular-hours") {
    errors.push("origin: must be 'extracted' or 'regular-hours'");
  }

  // Optional fields
  if (event.startTime !== undefined) {
    if (typeof event.startTime !== "string" || !isValidTime(event.startTime)) {
      errors.push(`startTime: invalid format '${event.startTime}' (expected HH:MM)`);
    }
  }

  if (event.endTime !== undefined) {
    if (typeof event.endTime !== "string" || !isValidTime(event.endTime)) {
      errors.push(`endTime: invalid format '${event.endTime}' (expected HH:MM)`);
    }
  }

  if (
    event.startTime &&
    event.endTime &&
    isValidTime(event.startTime) &&
    isValidTime(event.endTime)
  ) {
    if (event.startTime >= event.endTime) {
      warnings.push("startTime should be before endTime");
    }
  }

  if (event.description !== undefined && typeof event.description !== "string") {
    errors.push("description: must be string");
  }

  if (event.targetAge !== undefined && typeof event.targetAge !== "string") {
    errors.push("targetAge: must be string");
  }

  if (event.reservationRequired !== undefined && typeof event.reservationRequired !== "boolean") {
    errors.push("reservationRequired: must be boolean");
  }

  if (event.location !== undefined && typeof event.location !== "string") {
    errors.push("location: must be string");
  }

  if (event.capacity !== undefined) {
    if (
      typeof event.capacity !== "number" ||
      event.capacity < 0 ||
      !Number.isInteger(event.capacity)
    ) {
      errors.push("capacity: must be non-negative integer");
    }
  }

  if (event.tags !== undefined) {
    if (!Array.isArray(event.tags)) {
      errors.push("tags: must be array");
    } else if (!event.tags.every((t: any) => typeof t === "string")) {
      errors.push("tags: must be array of strings");
    }
  }

  // Check for unknown properties
  const allowedKeys = new Set([
    "id",
    "centerId",
    "sourceDocumentId",
    "date",
    "startTime",
    "endTime",
    "title",
    "description",
    "targetAge",
    "reservationRequired",
    "location",
    "capacity",
    "tags",
    "kind",
    "origin",
  ]);

  for (const key of Object.keys(event)) {
    if (!allowedKeys.has(key)) {
      warnings.push(`unknown property: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an array of events extracted from a source document
 */
export function validateExtractedEvents(
  events: any[],
  sourceDoc: SourceDocument,
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check array
  if (!Array.isArray(events)) {
    result.errors.push("events must be an array");
    result.valid = false;
    return result;
  }

  // Check for empty events array
  if (events.length === 0) {
    result.warnings.push("No events found in source document");
  }

  // Check for duplicate event IDs
  const seenIds = new Set<string>();
  for (const event of events) {
    if (event.id && seenIds.has(event.id)) {
      result.errors.push(`duplicate event ID: ${event.id}`);
      result.valid = false;
    }
    if (event.id) {
      seenIds.add(event.id);
    }
  }

  // Validate each event
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventResult = validateEvent_single(event);

    // Check event belongs to correct source document
    if (event.sourceDocumentId !== sourceDoc.id) {
      eventResult.errors.push(
        `sourceDocumentId mismatch: expected ${sourceDoc.id}, got ${event.sourceDocumentId}`,
      );
      eventResult.valid = false;
    }

    if (event.centerId !== sourceDoc.centerId) {
      eventResult.errors.push(
        `centerId mismatch: expected ${sourceDoc.centerId}, got ${event.centerId}`,
      );
      eventResult.valid = false;
    }

    // Check event date is in the source document's month
    if (event.date && isValidDate(event.date)) {
      const eventMonth = event.date.slice(0, 7);
      if (eventMonth !== sourceDoc.month) {
        eventResult.warnings.push(
          `Event date ${event.date} is not in source document month ${sourceDoc.month}`,
        );
      }
    }

    if (!eventResult.valid) {
      result.valid = false;
    }

    result.errors.push(
      ...eventResult.errors.map((e) => `Event [${i}] (${event.title || "untitled"}): ${e}`),
    );
    result.warnings.push(
      ...eventResult.warnings.map((w) => `Event [${i}] (${event.title || "untitled"}): ${w}`),
    );
  }

  return result;
}

/**
 * CLI interface for testing validation
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const testEvents = JSON.parse(process.argv[2] || "[]");
  const testSourceDoc = JSON.parse(process.argv[3] || "{}");

  const result = validateExtractedEvents(testEvents, testSourceDoc);

  console.log("Validation Result:");
  console.log(`Valid: ${result.valid}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  process.exit(result.valid ? 0 : 1);
}
