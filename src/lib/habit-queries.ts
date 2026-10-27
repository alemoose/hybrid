import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { habitLogs, type Habit } from "./db/schema";
import { addDays } from "./dates";

/** Local days the habit was done between two day keys (inclusive). */
export async function habitDays(habit: Habit, first: string, last: string): Promise<Set<string>> {
  const rows = await db
    .select({ day: habitLogs.day })
    .from(habitLogs)
    .where(and(eq(habitLogs.habit, habit), gte(habitLogs.day, first), lte(habitLogs.day, last)));
  return new Set(rows.map((r) => r.day));
}

/** Enough history for a streak (a year back) plus today. */
export const habitHistory = (habit: Habit, today: string) => habitDays(habit, addDays(today, -366), today);
