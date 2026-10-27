"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { aiConfigured, EstimateError } from "@/lib/ai/estimate";
import { designProgram, type Program } from "@/lib/ai/program";
import { db } from "@/lib/db";
import { defaultIncrement } from "@/lib/db/exercise-library";
import { exercises, routineExercises, routines } from "@/lib/db/schema";
import { currentWeight, getPhoto, targetStatuses } from "@/lib/goal-queries";
import { getLiftTrends, listExerciseOptions, listRoutines } from "@/lib/queries";
import { getBodyGoal, getPhysique, getProfile, setSetting } from "@/lib/settings";
import { formatTargetValue } from "@/lib/target-view";
import { getProgramDraft, type ProgramDraft } from "@/lib/program-queries";

export type DesignResult = { ok: true; program: Program } | { ok: false; error: string };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Asks Claude for a program aimed at the physique goal, and keeps it as a draft to review. */
export async function designMyProgram(input: { daysPerWeek: number; minutes: number; note: string }): Promise<DesignResult> {
  await requireAuth();
  if (!aiConfigured()) return { ok: false, error: "Program design needs an ANTHROPIC_API_KEY." };
  const daysPerWeek = Math.min(6, Math.max(2, Math.round(Number(input.daysPerWeek) || 4)));
  const minutes = Math.min(120, Math.max(30, Math.round(Number(input.minutes) || 60)));
  const note = String(input.note ?? "").trim().slice(0, 300);

  const now = Date.now();
  const [physique, targets, lifts, current, library, profile, bodyGoal, weight] = await Promise.all([
    getPhysique(),
    targetStatuses("physique"),
    getLiftTrends(12),
    listRoutines(),
    listExerciseOptions(),
    getProfile(),
    getBodyGoal(),
    currentWeight(now),
  ]);
  const photoRow = physique?.photoId ? await getPhoto(physique.photoId) : null;
  const photo =
    photoRow && (PHOTO_TYPES as readonly string[]).includes(photoRow.mime)
      ? { data: Buffer.from(photoRow.data).toString("base64"), mediaType: photoRow.mime as (typeof PHOTO_TYPES)[number] }
      : null;

  const about = [
    profile ? `${profile.sex}, ${profile.age}, ${Math.floor(profile.heightIn / 12)}'${Math.round(profile.heightIn % 12)}"` : null,
    weight != null ? `${weight.toFixed(0)} lb` : null,
    bodyGoal ? `goal ${bodyGoal.goalWeight} lb at ${bodyGoal.pace > 0 ? "+" : ""}${bodyGoal.pace} lb/week` : null,
  ]
    .filter(Boolean)
    .join(", ");

  try {
    const program = await designProgram({
      physique: { title: physique?.title ?? "", subtitle: physique?.subtitle ?? "", photo },
      targets: targets.map(
        (t) => `${t.target.label}: ${t.current != null ? formatTargetValue(t.current, t.unit) : "not measured yet"} now → ${formatTargetValue(t.target.targetValue, t.unit)}`,
      ),
      lifts: lifts.map((l) =>
        l.bodyweight
          ? `${l.name}: best ${l.maxReps} reps, ${l.sessions} sessions in 90 days`
          : `${l.name}: est. max ${Math.round(l.estMax)} lb, ${l.sessions} sessions in 90 days`,
      ),
      routines: current.map((r) => `${r.name}: ${r.exerciseNames.join(", ")}`),
      about: about || "not given",
      daysPerWeek,
      minutes,
      note,
      library,
    });
    await setSetting("programDraft", { program, daysPerWeek, minutes, note, createdAt: now } satisfies ProgramDraft);
    revalidatePath("/gym/program");
    return { ok: true, program };
  } catch (err) {
    if (err instanceof EstimateError) return { ok: false, error: err.message };
    console.error("designMyProgram failed", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** Swaps the current routines for the draft program. Old routines are archived, so history stays. */
export async function applyProgram(): Promise<void> {
  await requireAuth();
  const draft = await getProgramDraft();
  if (!draft?.program.days.length) return;
  const ids = draft.program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const rows = ids.length ? await db.select({ id: exercises.id, equipment: exercises.equipment }).from(exercises).where(inArray(exercises.id, ids)) : [];
  const equipment = new Map(rows.map((e) => [e.id, e.equipment]));

  await db.transaction(async (tx) => {
    await tx.update(routines).set({ archived: true }).where(eq(routines.archived, false));
    for (const [i, day] of draft.program.days.entries()) {
      const [row] = await tx.insert(routines).values({ name: day.name, position: i }).returning({ id: routines.id });
      const values = day.exercises
        .filter((e) => equipment.has(e.exerciseId))
        .map((e, position) => ({
          routineId: row.id,
          exerciseId: e.exerciseId,
          position,
          targetSets: e.sets,
          targetReps: e.reps,
          increment: defaultIncrement(equipment.get(e.exerciseId)!),
          restSeconds: e.restSeconds,
        }));
      if (values.length) await tx.insert(routineExercises).values(values);
    }
  });
  await setSetting("programDraft", { ...draft, usedAt: Date.now() } satisfies ProgramDraft);
  revalidatePath("/", "layout");
  redirect("/gym");
}
