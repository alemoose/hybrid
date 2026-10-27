"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTimeZone, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HABITS, habitLogs, type Habit } from "@/lib/db/schema";
import { todayKey } from "@/lib/dates";

/** Marks a habit done (or not) for today, or for an earlier day when catching up. */
export async function setHabit(habit: Habit, done: boolean, day?: string): Promise<void> {
  await requireAuth();
  if (!HABITS.includes(habit)) return;
  const today = todayKey(await getTimeZone());
  const key = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today ? day : today;
  if (done) {
    await db.insert(habitLogs).values({ habit, day: key }).onConflictDoNothing();
  } else {
    await db.delete(habitLogs).where(and(eq(habitLogs.habit, habit), eq(habitLogs.day, key)));
  }
  revalidatePath("/", "layout");
}
