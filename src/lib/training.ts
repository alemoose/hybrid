// Pure training math: no database, no React. Tested in training.test.ts.

export type SetKind = "warmup" | "working" | "drop" | "failure";
export type LoggedSet = { kind: SetKind; weight: number; reps: number };

/** Sets that count toward progress: warm-ups and drop sets don't. */
export function countedSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => (s.kind === "working" || s.kind === "failure") && s.reps > 0);
}

/** Epley estimate of a one-rep max, rounded to the nearest pound. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
}

export type SessionMetrics = {
  estMax: number;
  heaviest: number;
  bestSet: { weight: number; reps: number; volume: number };
  volume: number;
  maxReps: number;
  totalReps: number;
};

export function sessionMetrics(sets: LoggedSet[]): SessionMetrics | null {
  const counted = countedSets(sets);
  if (counted.length === 0) return null;
  let estMax = 0;
  let heaviest = 0;
  let volume = 0;
  let maxReps = 0;
  let totalReps = 0;
  let bestSet = { weight: 0, reps: 0, volume: -1 };
  for (const s of counted) {
    estMax = Math.max(estMax, estimateOneRepMax(s.weight, s.reps));
    heaviest = Math.max(heaviest, s.weight);
    maxReps = Math.max(maxReps, s.reps);
    totalReps += s.reps;
    const v = s.weight * s.reps;
    volume += v;
    if (v > bestSet.volume) bestSet = { weight: s.weight, reps: s.reps, volume: v };
  }
  return { estMax, heaviest, bestSet, volume, maxReps, totalReps };
}

export type SuggestionChange = "up" | "reps" | "repeat" | "deload";

export type Suggestion = {
  weight: number;
  reps: number;
  sets: number;
  change: SuggestionChange;
  /** Short pill text: "+5 lb", "Repeat", "+1 rep", "−10%". */
  label: string;
  /** One line explaining why. */
  reason: string;
};

export type SuggestInput = {
  /** Past sessions for this exercise, most recent first. */
  history: LoggedSet[][];
  targetSets: number;
  targetReps: number;
  /** Pounds to add after hitting every rep. 0 means progress by reps. */
  increment: number;
};

const STALL_SESSIONS = 3;

/**
 * Double progression: hit every target rep at a weight, then add weight.
 * Otherwise keep the weight and add a rep. Three misses in a row at the
 * same weight suggests a 10% deload.
 */
export function suggestNext({ history, targetSets, targetReps, increment }: SuggestInput): Suggestion | null {
  const sessions = history.map(countedSets).filter((s) => s.length > 0);
  if (sessions.length === 0) return null;

  const last = sessions[0];
  const top = Math.max(...last.map((s) => s.weight));
  const topSets = last.filter((s) => s.weight === top);
  const minReps = Math.min(...topSets.map((s) => s.reps));

  // Bodyweight (or no increment): progress by one rep at a time.
  if (top === 0 || increment <= 0) {
    return {
      weight: top,
      reps: minReps + 1,
      sets: targetSets,
      change: "reps",
      label: "+1 rep",
      reason: `Beat last time: ${repList(topSets)}`,
    };
  }

  const hitAll = (s: LoggedSet[]) => {
    const t = Math.max(...s.map((x) => x.weight));
    const atTop = s.filter((x) => x.weight === t);
    return atTop.length >= targetSets && atTop.every((x) => x.reps >= targetReps);
  };

  if (hitAll(last)) {
    return {
      weight: top + increment,
      reps: targetReps,
      sets: targetSets,
      change: "up",
      label: `+${formatWeight(increment)} lb`,
      reason: "You hit every rep last time",
    };
  }

  let stalled = 0;
  for (const s of sessions) {
    if (Math.max(...s.map((x) => x.weight)) !== top || hitAll(s)) break;
    stalled++;
  }
  if (stalled >= STALL_SESSIONS) {
    const step = increment >= 5 ? 5 : increment;
    return {
      weight: roundTo(top * 0.9, step),
      reps: targetReps,
      sets: targetSets,
      change: "deload",
      label: "−10%",
      reason: `Stuck at ${formatWeight(top)} for ${stalled} sessions. Drop 10% and build back up`,
    };
  }

  const reps = Math.min(targetReps, minReps + 1);
  return {
    weight: top,
    reps,
    sets: targetSets,
    change: reps < targetReps ? "reps" : "repeat",
    label: reps < targetReps ? "+1 rep" : "Repeat",
    reason:
      reps < targetReps
        ? `Last time: ${repList(topSets)}. Add a rep before adding weight`
        : `Last time: ${repList(topSets)}. Aim for ${targetReps} on every set`,
  };
}

function repList(sets: LoggedSet[]): string {
  return sets.map((s) => s.reps).join(", ");
}

/** Routines run in order; the next one follows whichever was done last. */
export function nextRoutineId(orderedIds: number[], lastDoneId: number | null): number | null {
  if (orderedIds.length === 0) return null;
  const i = lastDoneId == null ? -1 : orderedIds.indexOf(lastDoneId);
  return orderedIds[(i + 1) % orderedIds.length];
}

/** A YouTube search for form videos, e.g. "Lateral Raise (Dumbbell)" → "dumbbell lateral raise proper form". */
export function formVideoUrl(name: string): string {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const query = (m ? `${m[2]} ${m[1]}` : name).toLowerCase();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} proper form`)}`;
}
