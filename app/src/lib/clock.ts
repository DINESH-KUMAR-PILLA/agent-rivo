import { getServerEnv } from "@/lib/env";

/**
 * The demo clock. When DEMO_CLOCK is set (handbook default:
 * 2026-09-07T10:00:00+02:00, a Monday), relative phrases like "this Friday"
 * resolve against it so the seeded scenarios are reproducible. In live
 * operation leave DEMO_CLOCK empty to use the real message timestamp.
 */
export function now(): Date {
  const env = getServerEnv();
  return env.demoClock ? new Date(env.demoClock) : new Date();
}

export const PARIS_TZ = "Europe/Paris";

/** e.g. "11 September 2026" in Europe/Paris. */
export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PARIS_TZ,
  }).format(d);
}

/** ISO local calendar date (YYYY-MM-DD) in Europe/Paris. */
export function localDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: PARIS_TZ,
  }).format(new Date(iso));
  return parts;
}

/**
 * Resolve a weekday name relative to `base` (the demo clock), returning the
 * next occurrence including today. Used to turn "this Friday" into an explicit
 * date the draft can show.
 */
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export function resolveWeekday(name: string, base: Date = now()): Date | null {
  const idx = WEEKDAYS.indexOf(name.trim().toLowerCase());
  if (idx === -1) return null;
  const baseName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: PARIS_TZ })
    .format(base)
    .toLowerCase();
  const baseDow = WEEKDAYS.indexOf(baseName);
  const delta = (idx - baseDow + 7) % 7; // next occurrence, including today
  const result = new Date(base);
  result.setDate(result.getDate() + delta);
  return result;
}
