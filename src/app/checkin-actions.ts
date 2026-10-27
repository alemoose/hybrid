"use server";

import { revalidatePath } from "next/cache";
import { getTimeZone, requireAuth } from "@/lib/auth";
import { carbsFor } from "@/lib/checkin";
import { getCheckin, type CalorieChange } from "@/lib/checkin-queries";
import { todayKey } from "@/lib/dates";
import { saveGoals } from "@/lib/food-queries";
import { setSetting } from "@/lib/settings";

/** Applies the check-in's suggested change, recomputed on the server so the client can't pick the number. */
export async function applyCalorieChange(): Promise<void> {
  await requireAuth();
  const tz = await getTimeZone();
  const checkin = await getCheckin(tz);
  if (checkin.adjustment.kind !== "change") return;
  const { goals } = checkin;
  const { calories, delta } = checkin.adjustment;
  await saveGoals({ ...goals, calories, carbs: carbsFor(goals.carbs, delta) });
  await setSetting("calorieChange", { day: todayKey(tz), from: goals.calories, to: calories } satisfies CalorieChange);
  revalidatePath("/", "layout");
}

/** "Not now": hide the suggestion from Today for a week. */
export async function dismissCheckin(): Promise<void> {
  await requireAuth();
  const tz = await getTimeZone();
  await setSetting("checkinDismissed", todayKey(tz));
  revalidatePath("/");
}
