// Time-zone aware date helpers. Timestamps are stored in UTC milliseconds;
// days are grouped in the viewer's time zone.

const MS_DAY = 86_400_000;

/** "2026-10-26" for the calendar day this instant falls on in `tz`. */
export function dayKey(date: Date | number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's day key in `tz` (server components render once per request). */
export function todayKey(tz: string): string {
  return dayKey(Date.now(), tz);
}

/** Parse a day key as midnight UTC, for day arithmetic only. */
export function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  return utcToKey(new Date(keyToUtc(key).getTime() + days * MS_DAY));
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey).getTime() - keyToUtc(fromKey).getTime()) / MS_DAY);
}

/** Format a day key without time-zone drift ("Monday, October 26"). */
export function formatDayKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(keyToUtc(key));
}

export function formatInstant(date: Date | number, tz: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz }).format(date);
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** A wide UTC window that safely covers a run of local days. */
export function utcWindow(firstKey: string, lastKey: string): { from: Date; to: Date } {
  return {
    from: new Date(keyToUtc(firstKey).getTime() - MS_DAY),
    to: new Date(keyToUtc(lastKey).getTime() + 2 * MS_DAY),
  };
}
