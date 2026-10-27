"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createStarterRoutines } from "@/app/actions";
import { getTimeZone, requireAuth } from "@/lib/auth";
import { ACTIVITY, MEASUREMENTS, type Profile } from "@/lib/body";
import { db } from "@/lib/db";
import { POSES, bodyWeights, exercises, goalTargets, measurements, photos, routines, type PhotoKind } from "@/lib/db/schema";
import { todayKey, zonedTime } from "@/lib/dates";
import { getGoals, saveGoals } from "@/lib/food-queries";
import { currentTargetValue, exerciseName, liftKey } from "@/lib/goal-queries";
import { getBodyGoal, getPhysique, setSetting, type BodyGoal, type HerSettings, type Physique } from "@/lib/settings";

const MAX_PHOTO_BYTES = 4_000_000;
const MEASUREMENT_KEYS: readonly string[] = MEASUREMENTS.map((m) => m.key);

const clamp = (v: unknown, min: number, max: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : null;
};

async function loggedAt(day?: string): Promise<Date> {
  const tz = await getTimeZone();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day === todayKey(tz)) return new Date();
  return zonedTime(day, 8, tz);
}

// ---------- Weight ----------

export async function logWeight(weight: number, day?: string): Promise<void> {
  await requireAuth();
  const w = clamp(weight, 50, 800);
  if (w == null) throw new Error("Enter your weight in pounds.");
  await db.insert(bodyWeights).values({ weight: Math.round(w * 10) / 10, loggedAt: await loggedAt(day) });
  // Keep the water baseline in step with your weight.
  const goals = await getGoals();
  await saveGoals({ ...goals, bodyWeight: Math.round(w) });
  revalidatePath("/", "layout");
}

export async function deleteWeight(id: number): Promise<void> {
  await requireAuth();
  await db.delete(bodyWeights).where(eq(bodyWeights.id, id));
  revalidatePath("/", "layout");
}

export async function saveBodyGoal(input: { goalWeight: number; pace: number; startWeight?: number | null }): Promise<void> {
  await requireAuth();
  const goalWeight = clamp(input.goalWeight, 50, 800);
  if (goalWeight == null) throw new Error("Enter a goal weight.");
  const prev = await getBodyGoal();
  const goal: BodyGoal = {
    goalWeight,
    pace: clamp(input.pace, -2, 1) ?? 0,
    startWeight: input.startWeight ?? prev?.startWeight ?? null,
    startedAt: prev?.startedAt ?? Date.now(),
  };
  await setSetting("bodyGoal", goal);
  revalidatePath("/", "layout");
}

// ---------- Measurements ----------

export async function logMeasurements(values: Record<string, number | null>, day?: string): Promise<void> {
  await requireAuth();
  const at = await loggedAt(day);
  const rows = Object.entries(values)
    .filter(([k, v]) => MEASUREMENT_KEYS.includes(k) && v != null && clamp(v, 1, 120) != null)
    .map(([kind, v]) => ({ kind, value: Math.round(clamp(v, 1, 120)! * 10) / 10, loggedAt: at }));
  if (rows.length === 0) throw new Error("Enter at least one measurement.");
  await db.insert(measurements).values(rows);
  revalidatePath("/", "layout");
}

export async function deleteMeasurement(id: number): Promise<void> {
  await requireAuth();
  await db.delete(measurements).where(eq(measurements.id, id));
  revalidatePath("/", "layout");
}

// ---------- Photos ----------

type PhotoUpload = { data: string; mime: string; width: number; height: number };

async function insertPhoto(kind: PhotoKind, pose: string, photo: PhotoUpload): Promise<number> {
  if (!["image/jpeg", "image/webp", "image/png"].includes(photo.mime)) throw new Error("Unsupported image type.");
  const data = Buffer.from(photo.data, "base64");
  if (data.length === 0 || data.length > MAX_PHOTO_BYTES) throw new Error("That photo is too large.");
  const [row] = await db
    .insert(photos)
    .values({
      kind,
      pose: kind === "progress" && (POSES as readonly string[]).includes(pose) ? pose : "",
      takenAt: new Date(),
      mime: photo.mime,
      width: Math.round(clamp(photo.width, 0, 10000) ?? 0),
      height: Math.round(clamp(photo.height, 0, 10000) ?? 0),
      data,
    })
    .returning({ id: photos.id });
  return row.id;
}

export async function uploadProgressPhoto(pose: string, photo: PhotoUpload): Promise<{ id: number }> {
  await requireAuth();
  const id = await insertPhoto("progress", pose, photo);
  revalidatePath("/", "layout");
  return { id };
}

export async function deletePhoto(id: number): Promise<void> {
  await requireAuth();
  await db.delete(photos).where(eq(photos.id, id));
  const physique = await getPhysique();
  if (physique?.photoId === id) await setSetting("physique", { ...physique, photoId: null });
  revalidatePath("/", "layout");
}

// ---------- Physique ----------

export async function savePhysique(input: { title: string; subtitle: string; photo?: PhotoUpload | null; removePhoto?: boolean }): Promise<void> {
  await requireAuth();
  const prev = await getPhysique();
  let photoId = input.removePhoto ? null : (prev?.photoId ?? null);
  if (input.photo) {
    if (prev?.photoId) await db.delete(photos).where(eq(photos.id, prev.photoId));
    photoId = await insertPhoto("inspiration", "", input.photo);
  } else if (input.removePhoto && prev?.photoId) {
    await db.delete(photos).where(eq(photos.id, prev.photoId));
  }
  const physique: Physique = {
    title: String(input.title ?? "").trim().slice(0, 60),
    subtitle: String(input.subtitle ?? "").trim().slice(0, 120),
    photoId,
  };
  await setSetting("physique", physique);
  revalidatePath("/", "layout");
}

// ---------- Targets ----------

export type TargetInput = {
  group: "physique" | "strength";
  kind: "measurement" | "ratio" | "lift";
  key: string;
  targetValue: number;
};

async function targetLabel(t: TargetInput): Promise<string> {
  if (t.kind === "ratio") return "V-taper (shoulders ÷ waist)";
  if (t.kind === "measurement") return MEASUREMENTS.find((m) => m.key === t.key)?.label ?? t.key;
  const { exerciseId, metric } = liftKey(t.key);
  const name = (await exerciseName(exerciseId)) ?? "Lift";
  return metric === "maxReps" ? `${name}: reps in one set` : name;
}

async function insertTarget(t: TargetInput): Promise<void> {
  const target = clamp(t.targetValue, 0, 5000);
  if (target == null) throw new Error("Enter a target.");
  if (t.kind === "measurement" && !MEASUREMENT_KEYS.includes(t.key)) throw new Error("Unknown measurement.");
  if (t.kind === "ratio" && t.key !== "shoulders/waist") throw new Error("Unknown ratio.");
  if (t.kind === "lift" && !Number.isInteger(liftKey(t.key).exerciseId)) throw new Error("Pick an exercise.");
  const existing = await db.select({ id: goalTargets.id }).from(goalTargets).where(eq(goalTargets.group, t.group));
  await db.insert(goalTargets).values({
    group: t.group,
    kind: t.kind,
    key: t.key,
    label: await targetLabel(t),
    startValue: await currentTargetValue(t.kind, t.key),
    targetValue: target,
    position: existing.length,
  });
}

export async function addTarget(t: TargetInput): Promise<void> {
  await requireAuth();
  await insertTarget(t);
  revalidatePath("/", "layout");
}

export async function removeTarget(id: number): Promise<void> {
  await requireAuth();
  await db.delete(goalTargets).where(eq(goalTargets.id, id));
  revalidatePath("/", "layout");
}

// ---------- Onboarding ----------

export async function skipOnboarding(): Promise<void> {
  await requireAuth();
  await setSetting("onboarded", true);
  revalidatePath("/", "layout");
}

export type OnboardingInput = {
  profile: Profile;
  weight: number;
  goalWeight: number;
  pace: number;
  food: { calories: number; protein: number; carbs: number; fat: number };
  sodium: number;
  waterOverride: number;
  homeArea: string;
  starterRoutines: boolean;
  physique: { title: string; subtitle: string; photo: PhotoUpload | null } | null;
  measurements: { shoulders: number | null; waist: number | null };
  targets: { waist: number | null; ratio: number | null; pullUps: number | null };
};

export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  await requireAuth();
  const weight = clamp(input.weight, 50, 800);
  const goalWeight = clamp(input.goalWeight, 50, 800);
  if (weight == null || goalWeight == null) throw new Error("Enter your current and goal weight.");
  const p = input.profile;
  const profile: Profile = {
    sex: p.sex === "female" ? "female" : "male",
    age: Math.round(clamp(p.age, 13, 100) ?? 30),
    heightIn: clamp(p.heightIn, 48, 96) ?? 68,
    activity: p.activity in ACTIVITY ? p.activity : "moderate",
  };
  await setSetting("profile", profile);

  const goals = await getGoals();
  await saveGoals({
    ...goals,
    calories: Math.round(clamp(input.food.calories, 1000, 6000) ?? goals.calories),
    protein: Math.round(clamp(input.food.protein, 0, 500) ?? goals.protein),
    carbs: Math.round(clamp(input.food.carbs, 0, 1000) ?? goals.carbs),
    fat: Math.round(clamp(input.food.fat, 0, 400) ?? goals.fat),
    sodium: Math.round(clamp(input.sodium, 500, 10000) ?? goals.sodium),
    bodyWeight: Math.round(weight),
    waterOverride: Math.round(clamp(input.waterOverride, 0, 400) ?? 0),
    homeArea: String(input.homeArea ?? "").trim().slice(0, 60),
  });

  await setSetting("bodyGoal", {
    goalWeight,
    pace: clamp(input.pace, -2, 1) ?? 0,
    startWeight: weight,
    startedAt: Date.now(),
  } satisfies BodyGoal);
  await db.insert(bodyWeights).values({ weight, loggedAt: new Date() });

  const m = Object.fromEntries(
    Object.entries(input.measurements ?? {}).filter(([, v]) => v != null && clamp(v, 1, 120) != null),
  ) as Record<string, number>;
  if (Object.keys(m).length) {
    await db.insert(measurements).values(Object.entries(m).map(([kind, value]) => ({ kind, value, loggedAt: new Date() })));
  }

  if (input.physique && (input.physique.title.trim() || input.physique.photo)) {
    const prev = await getPhysique();
    let photoId = prev?.photoId ?? null;
    if (input.physique.photo) {
      if (prev?.photoId) await db.delete(photos).where(eq(photos.id, prev.photoId));
      photoId = await insertPhoto("inspiration", "", input.physique.photo);
    }
    await setSetting("physique", {
      title: input.physique.title.trim().slice(0, 60),
      subtitle: input.physique.subtitle.trim().slice(0, 120),
      photoId,
    } satisfies Physique);
  }

  // Re-running setup replaces the physique targets it made last time.
  const t = input.targets ?? { waist: null, ratio: null, pullUps: null };
  if (t.waist != null || t.ratio != null || t.pullUps != null) {
    await db.delete(goalTargets).where(eq(goalTargets.group, "physique"));
  }
  if (t.ratio != null) await insertTarget({ group: "physique", kind: "ratio", key: "shoulders/waist", targetValue: t.ratio });
  if (t.waist != null) await insertTarget({ group: "physique", kind: "measurement", key: "waist", targetValue: t.waist });
  if (t.pullUps != null) {
    const [pullUp] = await db.select({ id: exercises.id }).from(exercises).where(inArray(exercises.slug, ["pull-up"]));
    if (pullUp) await insertTarget({ group: "physique", kind: "lift", key: `${pullUp.id}:maxReps`, targetValue: t.pullUps });
  }

  if (input.starterRoutines) {
    const existing = await db.select({ id: routines.id }).from(routines).where(eq(routines.archived, false));
    if (existing.length === 0) await createStarterRoutines();
  }

  await setSetting("onboarded", true);
  revalidatePath("/", "layout");
}

// ---------- Reminders of her ----------

const MAX_NOTES = 40;

export async function saveHer(input: { name: string; notes: string[] }): Promise<void> {
  await requireAuth();
  const notes = (input.notes ?? [])
    .map((n) => String(n).trim().slice(0, 280))
    .filter(Boolean)
    .slice(0, MAX_NOTES);
  await setSetting("her", { name: String(input.name ?? "").trim().slice(0, 40), notes } satisfies HerSettings);
  revalidatePath("/", "layout");
}

export async function uploadReminderPhoto(photo: PhotoUpload): Promise<{ id: number }> {
  await requireAuth();
  const id = await insertPhoto("reminder", "", photo);
  revalidatePath("/", "layout");
  return { id };
}
