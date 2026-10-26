"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT, MUSCLES, defaultIncrement } from "@/lib/db/exercise-library";
import { SET_KINDS, exercises, routineExercises, routines, workoutSets, workouts } from "@/lib/db/schema";
import { getExercisePlan } from "@/lib/queries";
import type { DraftExercise, ExerciseOption, SaveWorkoutInput } from "@/lib/workout-types";

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

// ---------- Workouts ----------

export async function saveWorkout(input: SaveWorkoutInput): Promise<{ id: number }> {
  await requireAuth();
  const name = String(input.name ?? "").trim().slice(0, 80) || "Workout";
  const startedAt = new Date(num(input.startedAt, 0, Date.now() + 60_000));
  const finishedAt = new Date(Math.max(startedAt.getTime(), num(input.finishedAt, 0, Date.now() + 60_000)));
  const routineId = input.routineId == null ? null : num(input.routineId, 1, Number.MAX_SAFE_INTEGER);

  const sets = (input.exercises ?? []).flatMap((ex, exerciseOrder) =>
    (ex.sets ?? [])
      .filter((s) => SET_KINDS.includes(s.kind) && Number(s.reps) > 0)
      .map((s, setIndex) => ({
        exerciseId: num(ex.exerciseId, 1, Number.MAX_SAFE_INTEGER),
        exerciseOrder,
        setIndex,
        kind: s.kind,
        weight: num(s.weight, 0, 5000),
        reps: Math.round(num(s.reps, 0, 1000)),
      })),
  );
  if (sets.length === 0) throw new Error("Finish at least one set before saving.");

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workouts)
      .values({ name, routineId, startedAt, finishedAt })
      .returning({ id: workouts.id });
    await tx.insert(workoutSets).values(sets.map((s) => ({ ...s, workoutId: row.id })));
    return row.id;
  });
  revalidatePath("/", "layout");
  return { id };
}

export async function deleteWorkout(id: number): Promise<void> {
  await requireAuth();
  await db.transaction(async (tx) => {
    await tx.delete(workoutSets).where(eq(workoutSets.workoutId, id));
    await tx.delete(workouts).where(eq(workouts.id, id));
  });
  revalidatePath("/", "layout");
  redirect("/gym");
}

export async function loadExercisePlan(exerciseId: number): Promise<DraftExercise | null> {
  await requireAuth();
  return getExercisePlan(exerciseId);
}

// ---------- Exercises ----------

export async function createExercise(input: {
  name: string;
  equipment: string;
  primaryMuscle: string;
}): Promise<ExerciseOption> {
  await requireAuth();
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Give the exercise a name.");
  const equipment = (EQUIPMENT as readonly string[]).includes(input.equipment) ? input.equipment : "barbell";
  const primaryMuscle = (MUSCLES as readonly string[]).includes(input.primaryMuscle) ? input.primaryMuscle : "full body";
  const slug = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const [row] = await db
    .insert(exercises)
    .values({ slug, name, equipment, primaryMuscle, isCustom: true })
    .returning({ id: exercises.id, name: exercises.name, equipment: exercises.equipment, primaryMuscle: exercises.primaryMuscle });
  revalidatePath("/", "layout");
  return row;
}

// ---------- Routines ----------

export type RoutineInput = {
  id: number | null;
  name: string;
  exercises: {
    exerciseId: number;
    targetSets: number;
    targetReps: number;
    increment: number;
    restSeconds: number;
  }[];
};

export async function saveRoutine(input: RoutineInput): Promise<void> {
  await requireAuth();
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Give the routine a name.");
  const items = (input.exercises ?? []).map((e, position) => ({
    exerciseId: num(e.exerciseId, 1, Number.MAX_SAFE_INTEGER),
    position,
    targetSets: Math.round(num(e.targetSets, 1, 12)),
    targetReps: Math.round(num(e.targetReps, 1, 100)),
    increment: num(e.increment, 0, 100),
    restSeconds: Math.round(num(e.restSeconds, 0, 900)),
  }));

  await db.transaction(async (tx) => {
    let id = input.id;
    if (id == null) {
      const existing = await tx.select({ id: routines.id }).from(routines);
      const [row] = await tx
        .insert(routines)
        .values({ name, position: existing.length })
        .returning({ id: routines.id });
      id = row.id;
    } else {
      await tx.update(routines).set({ name }).where(eq(routines.id, id));
      await tx.delete(routineExercises).where(eq(routineExercises.routineId, id));
    }
    if (items.length) {
      await tx.insert(routineExercises).values(items.map((i) => ({ ...i, routineId: id! })));
    }
  });
  revalidatePath("/", "layout");
}

export async function deleteRoutine(id: number): Promise<void> {
  await requireAuth();
  // Archive instead of deleting so past workouts keep their routine link.
  await db.update(routines).set({ archived: true }).where(eq(routines.id, id));
  revalidatePath("/", "layout");
}

export async function moveRoutine(id: number, direction: -1 | 1): Promise<void> {
  await requireAuth();
  const list = await db
    .select({ id: routines.id })
    .from(routines)
    .where(eq(routines.archived, false))
    .orderBy(routines.position, routines.id);
  const ids = list.map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await db.transaction(async (tx) => {
    for (const [position, rid] of ids.entries()) {
      await tx.update(routines).set({ position }).where(eq(routines.id, rid));
    }
  });
  revalidatePath("/", "layout");
}

/** Quick start: make Push / Pull / Legs routines from the library. */
export async function createStarterRoutines(): Promise<void> {
  await requireAuth();
  const plan: [string, [string, number, number][]][] = [
    ["Push Day", [["bench-press-barbell", 3, 8], ["overhead-press-barbell", 3, 8], ["incline-bench-press-dumbbell", 3, 10], ["lateral-raise-dumbbell", 3, 12], ["triceps-pushdown", 3, 12]]],
    ["Pull Day", [["pull-up", 3, 8], ["bent-over-row-barbell", 3, 8], ["lat-pulldown", 3, 10], ["face-pull", 3, 15], ["hammer-curl", 3, 10]]],
    ["Leg Day", [["squat-barbell", 3, 6], ["romanian-deadlift-barbell", 3, 8], ["leg-press", 3, 10], ["lying-leg-curl", 3, 12], ["standing-calf-raise", 3, 12]]],
  ];
  const slugs = plan.flatMap(([, items]) => items.map(([slug]) => slug));
  const found = await db
    .select({ id: exercises.id, slug: exercises.slug, equipment: exercises.equipment })
    .from(exercises)
    .where(inArray(exercises.slug, slugs));
  const bySlug = new Map(found.map((f) => [f.slug, f]));
  const existing = await db.select({ id: routines.id }).from(routines);

  await db.transaction(async (tx) => {
    for (const [i, [name, items]] of plan.entries()) {
      const [row] = await tx
        .insert(routines)
        .values({ name, position: existing.length + i })
        .returning({ id: routines.id });
      const values = items
        .filter(([slug]) => bySlug.has(slug))
        .map(([slug, targetSets, targetReps], position) => {
          const ex = bySlug.get(slug)!;
          return {
            routineId: row.id,
            exerciseId: ex.id,
            position,
            targetSets,
            targetReps,
            increment: defaultIncrement(ex.equipment),
            restSeconds: position < 2 ? 150 : 90,
          };
        });
      if (values.length) await tx.insert(routineExercises).values(values);
    }
  });
  revalidatePath("/", "layout");
}
