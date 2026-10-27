import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./db/schema";
import type { Profile } from "./body";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await db.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } });
}

/** Target change in lb per week: negative to lose, 0 to maintain. */
export type Pace = number;

export type BodyGoal = { goalWeight: number; pace: Pace; startWeight: number | null; startedAt: number };
export type Physique = { title: string; subtitle: string; photoId: number | null };

export const getProfile = () => getSetting<Profile | null>("profile", null);
export const getBodyGoal = () => getSetting<BodyGoal | null>("bodyGoal", null);
export const getPhysique = () => getSetting<Physique | null>("physique", null);
export const isOnboarded = () => getSetting<boolean>("onboarded", false);

export type HerSettings = { name: string; notes: string[] };
export const getHer = () => getSetting<HerSettings>("her", { name: "", notes: [] });
