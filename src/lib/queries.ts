import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { defaultIncrement } from "./db/exercise-library";
import { exercises, routineExercises, routines, workoutSets, workouts } from "./db/schema";
import { addDays, dayKey, daysBetween, todayKey, utcWindow } from "./dates";
import {
  formatWeight,
  nextRoutineId,
  sessionMetrics,
  suggestNext,
  type LoggedSet,
  type SessionMetrics,
  type Suggestion,
} from "./training";
import type { DraftExercise, DraftSet, ExerciseOption, WorkoutDraft } from "./workout-types";

// ---------- Exercises & routines ----------

export async function listExerciseOptions(): Promise<ExerciseOption[]> {
  return db
    .select({
      id: exercises.id,
      name: exercises.name,
      equipment: exercises.equipment,
      primaryMuscle: exercises.primaryMuscle,
    })
    .from(exercises)
    .orderBy(asc(exercises.name));
}

export type RoutineSummary = {
  id: number;
  name: string;
  exerciseNames: string[];
};

export async function listRoutines(): Promise<RoutineSummary[]> {
  const rs = await db
    .select({ id: routines.id, name: routines.name })
    .from(routines)
    .where(eq(routines.archived, false))
    .orderBy(asc(routines.position), asc(routines.id));
  if (rs.length === 0) return [];
  const items = await db
    .select({ routineId: routineExercises.routineId, name: exercises.name })
    .from(routineExercises)
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(
      inArray(
        routineExercises.routineId,
        rs.map((r) => r.id),
      ),
    )
    .orderBy(asc(routineExercises.position), asc(routineExercises.id));
  return rs.map((r) => ({
    ...r,
    exerciseNames: items.filter((i) => i.routineId === r.id).map((i) => i.name),
  }));
}

export type RoutineExerciseDetail = {
  exerciseId: number;
  name: string;
  equipment: string;
  targetSets: number;
  targetReps: number;
  increment: number;
  restSeconds: number;
};

export async function getRoutine(id: number) {
  const [routine] = await db.select().from(routines).where(eq(routines.id, id));
  if (!routine || routine.archived) return null;
  const items: RoutineExerciseDetail[] = await db
    .select({
      exerciseId: routineExercises.exerciseId,
      name: exercises.name,
      equipment: exercises.equipment,
      targetSets: routineExercises.targetSets,
      targetReps: routineExercises.targetReps,
      increment: routineExercises.increment,
      restSeconds: routineExercises.restSeconds,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routineExercises.routineId, id))
    .orderBy(asc(routineExercises.position), asc(routineExercises.id));
  return { ...routine, exercises: items };
}

// ---------- History per exercise ----------

export type Session = { workoutId: number; startedAt: Date; sets: LoggedSet[] };

/** Past sessions per exercise, most recent first. */
export async function exerciseSessions(
  exerciseIds: number[],
  options: { perExercise?: number; before?: Date } = {},
): Promise<Map<number, Session[]>> {
  const result = new Map<number, Session[]>();
  if (exerciseIds.length === 0) return result;
  const rows = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      workoutId: workoutSets.workoutId,
      startedAt: workouts.startedAt,
      kind: workoutSets.kind,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        inArray(workoutSets.exerciseId, exerciseIds),
        options.before ? lt(workouts.startedAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(workouts.startedAt), asc(workoutSets.exerciseOrder), asc(workoutSets.setIndex));

  for (const row of rows) {
    let list = result.get(row.exerciseId);
    if (!list) result.set(row.exerciseId, (list = []));
    let session = list[list.length - 1];
    if (!session || session.workoutId !== row.workoutId) {
      if (options.perExercise && list.length >= options.perExercise) continue;
      session = { workoutId: row.workoutId, startedAt: row.startedAt, sets: [] };
      list.push(session);
    }
    session.sets.push({ kind: row.kind, weight: row.weight, reps: row.reps });
  }
  return result;
}

// ---------- Building a workout ----------

type PlanInput = {
  exerciseId: number;
  name: string;
  equipment: string;
  targetSets: number;
  targetReps: number;
  increment: number;
  restSeconds: number;
};

function draftSet(kind: DraftSet["kind"], weight: number | null, reps: number | null): DraftSet {
  return {
    id: randomUUID(),
    kind,
    // Blank weight means bodyweight (0).
    weight: weight == null || weight === 0 ? "" : formatWeight(weight),
    reps: reps == null ? "" : String(reps),
    done: false,
  };
}

function planExercise(input: PlanInput, sessions: Session[]): DraftExercise {
  const suggestion = suggestNext({
    history: sessions.map((s) => s.sets),
    targetSets: input.targetSets,
    targetReps: input.targetReps,
    increment: input.increment,
  });
  const prevSets = sessions[0]?.sets ?? [];
  const prevWarmups = prevSets.filter((s) => s.kind === "warmup");
  const prevWorking = prevSets.filter((s) => s.kind !== "warmup");
  const sets: DraftSet[] = [
    ...prevWarmups.map((s) => draftSet("warmup", s.weight, s.reps)),
    ...Array.from({ length: input.targetSets }, (_, i) => {
      if (suggestion) return draftSet("working", suggestion.weight, suggestion.reps);
      const prev = prevWorking[i];
      return prev ? draftSet("working", prev.weight, prev.reps) : draftSet("working", null, null);
    }),
  ];
  return {
    key: randomUUID(),
    exerciseId: input.exerciseId,
    name: input.name,
    equipment: input.equipment,
    restSeconds: input.restSeconds,
    suggestion,
    prevSets,
    sets,
  };
}

export async function getWorkoutPlan(routineId: number | null): Promise<WorkoutDraft | null> {
  if (routineId == null) {
    return { version: 1, routineId: null, name: "Workout", startedAt: Date.now(), exercises: [] };
  }
  const routine = await getRoutine(routineId);
  if (!routine) return null;
  const sessions = await exerciseSessions(
    routine.exercises.map((e) => e.exerciseId),
    { perExercise: 6 },
  );
  return {
    version: 1,
    routineId: routine.id,
    name: routine.name,
    startedAt: Date.now(),
    exercises: routine.exercises.map((e) => planExercise(e, sessions.get(e.exerciseId) ?? [])),
  };
}

/** Plan for one exercise added during a workout, using routine settings if it has them. */
export async function getExercisePlan(exerciseId: number): Promise<DraftExercise | null> {
  const [ex] = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
  if (!ex) return null;
  const [inRoutine] = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.exerciseId, exerciseId))
    .limit(1);
  const sessions = (await exerciseSessions([exerciseId], { perExercise: 6 })).get(exerciseId) ?? [];
  return planExercise(
    {
      exerciseId,
      name: ex.name,
      equipment: ex.equipment,
      targetSets: inRoutine?.targetSets ?? 3,
      targetReps: inRoutine?.targetReps ?? 8,
      increment: inRoutine?.increment ?? defaultIncrement(ex.equipment),
      restSeconds: inRoutine?.restSeconds ?? 120,
    },
    sessions,
  );
}

// ---------- Up next ----------

export type TargetLine = { name: string; target: string; label: string; change: Suggestion["change"] | "new" };

export type UpNext = {
  next: {
    id: number;
    name: string;
    daysSince: number | null;
    minutes: number;
    targets: TargetLine[];
    moreCount: number;
  };
  upcoming: { id: number; name: string; daysSince: number | null }[];
};

export async function getUpNext(tz: string): Promise<UpNext | null> {
  const list = await listRoutines();
  if (list.length === 0) return null;

  const lastByRoutine = await db
    .select({ routineId: workouts.routineId, last: sql<number>`max(${workouts.startedAt})` })
    .from(workouts)
    .where(isNotNull(workouts.routineId))
    .groupBy(workouts.routineId);
  const lastMap = new Map(lastByRoutine.map((r) => [r.routineId!, Number(r.last)]));
  let lastDoneId: number | null = null;
  let lastTime = -1;
  for (const [id, t] of lastMap) {
    if (t > lastTime) {
      lastTime = t;
      lastDoneId = id;
    }
  }

  const ids = list.map((r) => r.id);
  const nextId = nextRoutineId(ids, lastDoneId)!;
  const today = todayKey(tz);
  const since = (id: number) => {
    const t = lastMap.get(id);
    return t == null ? null : daysBetween(dayKey(t, tz), today);
  };

  const plan = await getWorkoutPlan(nextId);
  const routine = list.find((r) => r.id === nextId)!;
  const targets: TargetLine[] = (plan?.exercises ?? []).map((e) => {
    const s = e.suggestion;
    if (!s) return { name: e.name, target: "First time", label: "New", change: "new" };
    const weight = s.weight > 0 ? `${formatWeight(s.weight)} × ${s.reps}` : `${s.reps} reps`;
    return { name: e.name, target: weight, label: s.label, change: s.change };
  });

  const durations = await db
    .select({ avg: sql<number>`avg(${workouts.finishedAt} - ${workouts.startedAt})` })
    .from(workouts)
    .where(eq(workouts.routineId, nextId));
  const totalSets = (plan?.exercises ?? []).reduce((n, e) => n + e.sets.length, 0);
  const avgMs = Number(durations[0]?.avg ?? 0);
  const minutes = avgMs > 0 ? Math.round(avgMs / 60_000) : Math.max(15, Math.round(totalSets * 2.5));

  const start = ids.indexOf(nextId);
  const upcoming = ids
    .slice(start + 1)
    .concat(ids.slice(0, start))
    .slice(0, 2)
    .map((id) => ({ id, name: list.find((r) => r.id === id)!.name, daysSince: since(id) }));

  return {
    next: {
      id: nextId,
      name: routine.name,
      daysSince: since(nextId),
      minutes,
      targets: targets.slice(0, 4),
      moreCount: Math.max(0, targets.length - 4),
    },
    upcoming,
  };
}

// ---------- Workout summaries ----------

export type WorkoutSummary = {
  id: number;
  name: string;
  startedAt: Date;
  finishedAt: Date;
  volume: number;
  sets: number;
  exercises: number;
};

const countedKinds = sql`${workoutSets.kind} in ('working', 'failure')`;

async function summarize(where: ReturnType<typeof and> | undefined, limit?: number): Promise<WorkoutSummary[]> {
  const q = db
    .select({
      id: workouts.id,
      name: workouts.name,
      startedAt: workouts.startedAt,
      finishedAt: workouts.finishedAt,
      volume: sql<number>`coalesce(sum(case when ${countedKinds} then ${workoutSets.weight} * ${workoutSets.reps} else 0 end), 0)`,
      sets: sql<number>`count(${workoutSets.id})`,
      exercises: sql<number>`count(distinct ${workoutSets.exerciseId})`,
    })
    .from(workouts)
    .leftJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
    .where(where)
    .groupBy(workouts.id)
    .orderBy(desc(workouts.startedAt));
  const rows = limit ? await q.limit(limit) : await q;
  return rows.map((r) => ({
    ...r,
    volume: Math.round(Number(r.volume)),
    sets: Number(r.sets),
    exercises: Number(r.exercises),
  }));
}

export function recentWorkouts(limit: number) {
  return summarize(undefined, limit);
}

/** Workouts grouped by local day for a run of days (inclusive). */
export async function workoutsByDay(firstKey: string, lastKey: string, tz: string) {
  const { from, to } = utcWindow(firstKey, lastKey);
  const rows = await summarize(and(gte(workouts.startedAt, from), lt(workouts.startedAt, to)));
  const map = new Map<string, WorkoutSummary[]>();
  for (const w of rows.reverse()) {
    const key = dayKey(w.startedAt, tz);
    if (key < firstKey || key > lastKey) continue;
    const list = map.get(key) ?? [];
    list.push(w);
    map.set(key, list);
  }
  return map;
}

export async function lastSevenDays(tz: string) {
  const today = todayKey(tz);
  const first = addDays(today, -6);
  const byDay = await workoutsByDay(first, today, tz);
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(first, i);
    return { key, isToday: key === today, workouts: byDay.get(key) ?? [] };
  });
}

// ---------- One workout ----------

export async function getWorkoutDetail(id: number) {
  const [workout] = await db.select().from(workouts).where(eq(workouts.id, id));
  if (!workout) return null;
  const rows = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      name: exercises.name,
      exerciseOrder: workoutSets.exerciseOrder,
      kind: workoutSets.kind,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
    })
    .from(workoutSets)
    .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
    .where(eq(workoutSets.workoutId, id))
    .orderBy(asc(workoutSets.exerciseOrder), asc(workoutSets.setIndex));

  const groups: { exerciseId: number; name: string; sets: LoggedSet[] }[] = [];
  for (const r of rows) {
    let g = groups.find((x) => x.exerciseId === r.exerciseId);
    if (!g) groups.push((g = { exerciseId: r.exerciseId, name: r.name, sets: [] }));
    g.sets.push({ kind: r.kind, weight: r.weight, reps: r.reps });
  }

  // A PR is beating every earlier session on estimated max or heaviest weight.
  const prior = await exerciseSessions(
    groups.map((g) => g.exerciseId),
    { before: workout.startedAt },
  );
  const result = groups.map((g) => {
    const m = sessionMetrics(g.sets);
    const past = (prior.get(g.exerciseId) ?? []).map((s) => sessionMetrics(s.sets)).filter(Boolean) as SessionMetrics[];
    const prs: string[] = [];
    if (m && past.length > 0) {
      if (m.estMax > Math.max(...past.map((p) => p.estMax))) prs.push("Est. max");
      if (m.heaviest > Math.max(...past.map((p) => p.heaviest))) prs.push("Heaviest");
    }
    return { ...g, metrics: m, prs };
  });
  const volume = result.reduce((t, g) => t + (g.metrics?.volume ?? 0), 0);
  return { workout, exercises: result, volume: Math.round(volume) };
}

// ---------- Progress ----------

export type ExercisePoint = { workoutId: number; date: Date; metrics: SessionMetrics; sets: LoggedSet[] };

export async function getExerciseProgress(exerciseId: number) {
  const [exercise] = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
  if (!exercise) return null;
  const sessions = (await exerciseSessions([exerciseId])).get(exerciseId) ?? [];
  const points: ExercisePoint[] = sessions
    .map((s) => ({ workoutId: s.workoutId, date: s.startedAt, metrics: sessionMetrics(s.sets)!, sets: s.sets }))
    .filter((p) => p.metrics)
    .reverse();

  const [inRoutine] = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.exerciseId, exerciseId))
    .limit(1);
  const suggestion = suggestNext({
    history: sessions.map((s) => s.sets),
    targetSets: inRoutine?.targetSets ?? 3,
    targetReps: inRoutine?.targetReps ?? 8,
    increment: inRoutine?.increment ?? defaultIncrement(exercise.equipment),
  });

  const best = <T,>(pick: (p: ExercisePoint) => number, map: (p: ExercisePoint) => T) => {
    let top: ExercisePoint | null = null;
    for (const p of points) if (!top || pick(p) > pick(top)) top = p;
    return top ? { date: top.date, value: map(top) } : null;
  };

  return {
    exercise,
    points,
    suggestion,
    records: {
      estMax: best((p) => p.metrics.estMax, (p) => `${p.metrics.estMax} lb`),
      heaviest: best(
        (p) => p.metrics.heaviest,
        (p) => {
          const reps = Math.max(...p.sets.filter((s) => s.weight === p.metrics.heaviest).map((s) => s.reps));
          return `${formatWeight(p.metrics.heaviest)} lb × ${reps}`;
        },
      ),
      bestSet: best(
        (p) => p.metrics.bestSet.volume,
        (p) => `${formatWeight(p.metrics.bestSet.weight)} lb × ${p.metrics.bestSet.reps}`,
      ),
      maxReps: best((p) => p.metrics.maxReps, (p) => `${p.metrics.maxReps} reps`),
    },
  };
}

export type LiftTrend = {
  exerciseId: number;
  name: string;
  estMax: number;
  heaviest: number;
  delta: number | null;
  sessions: number;
  bodyweight: boolean;
  maxReps: number;
};

/** Your most-trained lifts lately, with est. max now vs. a month ago. */
export async function getLiftTrends(limit = 6): Promise<LiftTrend[]> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const frequent = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      name: exercises.name,
      sessions: sql<number>`count(distinct ${workoutSets.workoutId})`,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
    .where(gte(workouts.startedAt, since))
    .groupBy(workoutSets.exerciseId)
    .orderBy(desc(sql`count(distinct ${workoutSets.workoutId})`), asc(exercises.name))
    .limit(limit);
  if (frequent.length === 0) return [];

  const sessions = await exerciseSessions(frequent.map((f) => f.exerciseId));
  const monthAgo = Date.now() - 30 * 86_400_000;
  return frequent.map((f) => {
    const list = (sessions.get(f.exerciseId) ?? [])
      .map((s) => ({ t: s.startedAt.getTime(), m: sessionMetrics(s.sets) }))
      .filter((x): x is { t: number; m: SessionMetrics } => x.m != null);
    const all = Math.max(0, ...list.map((x) => x.m.estMax));
    const before = list.filter((x) => x.t < monthAgo);
    const beforeMax = before.length ? Math.max(...before.map((x) => x.m.estMax)) : null;
    return {
      exerciseId: f.exerciseId,
      name: f.name,
      estMax: all,
      heaviest: Math.max(0, ...list.map((x) => x.m.heaviest)),
      delta: beforeMax == null ? null : all - beforeMax,
      sessions: Number(f.sessions),
      bodyweight: all === 0,
      maxReps: Math.max(0, ...list.map((x) => x.m.maxReps)),
    };
  });
}

export async function exercisesDone(): Promise<{ id: number; name: string; sessions: number; last: Date }[]> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      sessions: sql<number>`count(distinct ${workoutSets.workoutId})`,
      last: sql<number>`max(${workouts.startedAt})`,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
    .groupBy(exercises.id)
    .orderBy(desc(sql`max(${workouts.startedAt})`));
  return rows.map((r) => ({ ...r, sessions: Number(r.sessions), last: new Date(Number(r.last)) }));
}
