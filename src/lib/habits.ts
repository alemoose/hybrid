// Daily habit streaks. No database, no React. Tested in habits.test.ts.
import { addDays } from "./dates";

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
