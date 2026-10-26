import "server-only";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { MEASUREMENTS, goalProgress, weightTrend, type WeighIn } from "./body";
import { db } from "./db";
import { bodyWeights, exercises, goalTargets, measurements, photos, type GoalTarget } from "./db/schema";
import { exerciseSessions } from "./queries";
import { sessionMetrics } from "./training";

// ---------- Weight ----------

export async function listWeights(sinceMs?: number): Promise<(WeighIn & { id: number })[]> {
  const rows = await db
    .select()
    .from(bodyWeights)
    .where(sinceMs ? gte(bodyWeights.loggedAt, new Date(sinceMs)) : undefined)
    .orderBy(asc(bodyWeights.loggedAt));
  return rows.map((r) => ({ id: r.id, at: r.loggedAt.getTime(), weight: r.weight }));
}

export async function currentWeight(now: number): Promise<number | null> {
  return weightTrend(await listWeights(now - 35 * 86_400_000), now).current;
}

// ---------- Measurements ----------

export type MeasurementSnapshot = Record<string, { value: number; at: number } | undefined>;

/** First and latest value for every measurement kind. */
export async function measurementSnapshots(): Promise<{ first: MeasurementSnapshot; latest: MeasurementSnapshot }> {
  const rows = await db.select().from(measurements).orderBy(asc(measurements.loggedAt));
  const first: MeasurementSnapshot = {};
  const latest: MeasurementSnapshot = {};
  for (const r of rows) {
    const v = { value: r.value, at: r.loggedAt.getTime() };
    first[r.kind] ??= v;
    latest[r.kind] = v;
  }
  return { first, latest };
}

export async function measurementHistory(limit = 60) {
  return db.select().from(measurements).orderBy(desc(measurements.loggedAt)).limit(limit);
}

// ---------- Photos ----------

export type PhotoMeta = { id: number; pose: string; takenAt: number; width: number; height: number };

export async function listPhotos(kind: "progress" | "inspiration", pose?: string): Promise<PhotoMeta[]> {
  const rows = await db
    .select({ id: photos.id, pose: photos.pose, takenAt: photos.takenAt, width: photos.width, height: photos.height })
    .from(photos)
    .where(and(eq(photos.kind, kind), pose ? eq(photos.pose, pose) : undefined))
    .orderBy(asc(photos.takenAt));
  return rows.map((r) => ({ ...r, takenAt: r.takenAt.getTime() }));
}

export async function getPhoto(id: number) {
  const [row] = await db.select().from(photos).where(eq(photos.id, id));
  return row ?? null;
}

// ---------- Targets ----------

export type TargetStatus = {
  target: GoalTarget;
  current: number | null;
  start: number | null;
  progress: number;
  unit: string;
};

/** "123:estMax" → exercise 123, estimated max; "123:maxReps" → most reps in a set. */
export function liftKey(key: string): { exerciseId: number; metric: "estMax" | "maxReps" } {
  const [id, metric] = key.split(":");
  return { exerciseId: Number(id), metric: metric === "maxReps" ? "maxReps" : "estMax" };
}

export async function targetStatuses(group: "physique" | "strength"): Promise<TargetStatus[]> {
  const targets = await db.select().from(goalTargets).where(eq(goalTargets.group, group)).orderBy(asc(goalTargets.position), asc(goalTargets.id));
  if (targets.length === 0) return [];
  const { first, latest } = await measurementSnapshots();
  const liftIds = targets.filter((t) => t.kind === "lift").map((t) => liftKey(t.key).exerciseId);
  const sessions = await exerciseSessions(liftIds);

  return targets.map((t) => {
    let current: number | null = null;
    let firstValue: number | null = null;
    let unit = "";
    if (t.kind === "measurement") {
      current = latest[t.key]?.value ?? null;
      firstValue = first[t.key]?.value ?? null;
      unit = " in";
    } else if (t.kind === "ratio") {
      const ratio = (s: MeasurementSnapshot) =>
        s.shoulders && s.waist && s.waist.value > 0 ? Math.round((s.shoulders.value / s.waist.value) * 100) / 100 : null;
      current = ratio(latest);
      firstValue = ratio(first);
    } else {
      const { exerciseId, metric } = liftKey(t.key);
      const values = (sessions.get(exerciseId) ?? [])
        .map((s) => sessionMetrics(s.sets))
        .filter((m) => m != null)
        .map((m) => m[metric]);
      // Best of the last three sessions: one off day shouldn't erase progress.
      current = values.length ? Math.max(...values.slice(0, 3)) : null;
      firstValue = values.length ? values[values.length - 1] : null;
      unit = metric === "maxReps" ? " reps" : " lb";
    }
    const start = t.startValue ?? firstValue;
    return {
      target: t,
      current,
      start,
      progress: current != null && start != null ? goalProgress(start, current, t.targetValue) : 0,
      unit,
    };
  });
}

/** Current value for a new target, saved as its starting point. */
export async function currentTargetValue(kind: "measurement" | "ratio" | "lift", key: string): Promise<number | null> {
  if (kind === "lift") {
    const { exerciseId, metric } = liftKey(key);
    const list = (await exerciseSessions([exerciseId], { perExercise: 3 })).get(exerciseId) ?? [];
    const values = list.map((s) => sessionMetrics(s.sets)?.[metric]).filter((v): v is number => v != null);
    return values.length ? Math.max(...values) : null;
  }
  const { latest } = await measurementSnapshots();
  if (kind === "measurement") return latest[key]?.value ?? null;
  return latest.shoulders && latest.waist ? Math.round((latest.shoulders.value / latest.waist.value) * 100) / 100 : null;
}

export async function exerciseName(id: number): Promise<string | null> {
  const [row] = await db.select({ name: exercises.name }).from(exercises).where(eq(exercises.id, id));
  return row?.name ?? null;
}

export const MEASUREMENT_LABEL: Record<string, string> = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, m.label]));
