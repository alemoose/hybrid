import "server-only";
import { sql } from "drizzle-orm";
import type { Program } from "./ai/program";
import { db } from "./db";
import { workouts } from "./db/schema";
import { getSetting } from "./settings";
import { defaultPrefs, type TrainingPrefs } from "./training-prefs";

export type ProgramDraft = { program: Program; daysPerWeek: number; minutes: number; note: string; createdAt: number; usedAt?: number };

export const getProgramDraft = () => getSetting<ProgramDraft | null>("programDraft", null);

/** Saved designer preferences, or defaults based on how many workouts are logged. */
export async function getTrainingPrefs(): Promise<TrainingPrefs> {
  const saved = await getSetting<TrainingPrefs | null>("trainingPrefs", null);
  if (saved) return saved;
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(workouts);
  return defaultPrefs(Number(row?.n ?? 0));
}
