// Daily habit streaks. No database, no React. Tested in habits.test.ts.
import { addDays, daysBetween } from "./dates";

/**
 * Days in a row up to today. A streak isn't broken until today ends, so if
 * today isn't done yet it counts back from yesterday.
 */
export function streak(done: Set<string>, today: string): number {
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/** Share of the last `days` days (including today) that were done. */
export function consistency(done: Set<string>, today: string, days: number): number {
  let n = 0;
  for (let i = 0; i < days; i++) if (done.has(addDays(today, -i))) n += 1;
  return n / days;
}

/** A break this long means the next dose starts a fresh loading phase. */
const RESTART_GAP = 14;
/** Muscles take about 3–4 weeks of daily 5 g to fill up, holding 1–3 lb of extra water. */
export const CREATINE_LOADING_DAYS = 28;

/** The first day of the current run of creatine (gaps under two weeks don't restart it), or null. */
export function creatineStart(done: Set<string>, today: string): string | null {
  const days = [...done].filter((d) => d <= today).sort();
  if (days.length === 0) return null;
  let i = days.length - 1;
  while (i > 0 && daysBetween(days[i - 1], days[i]) <= RESTART_GAP) i -= 1;
  return days[i];
}

/** Days left in the loading phase, or 0 once it's over (or creatine stopped two weeks ago). */
export function creatineLoadingDaysLeft(done: Set<string>, today: string): number {
  const start = creatineStart(done, today);
  if (!start) return 0;
  const last = [...done].filter((d) => d <= today).sort().pop()!;
  if (daysBetween(last, today) > RESTART_GAP) return 0;
  return Math.max(0, CREATINE_LOADING_DAYS - daysBetween(start, today));
}
