// Shapes shared between the server (building a plan, saving) and the
// active-workout client screen.
import type { SetKind, Suggestion } from "./training";

export type PrevSet = { kind: SetKind; weight: number; reps: number };

export type DraftSet = {
  id: string;
  kind: SetKind;
  /** Kept as strings so half-typed inputs ("12.") survive. */
  weight: string;
  reps: string;
  done: boolean;
};

export type DraftExercise = {
  key: string;
  exerciseId: number;
  name: string;
  equipment: string;
  restSeconds: number;
  suggestion: Suggestion | null;
  prevSets: PrevSet[];
  sets: DraftSet[];
};

export type WorkoutDraft = {
  version: 1;
  routineId: number | null;
  name: string;
  startedAt: number;
  exercises: DraftExercise[];
};

export type ExerciseOption = {
  id: number;
  name: string;
  equipment: string;
  primaryMuscle: string;
};

export type SaveWorkoutInput = {
  routineId: number | null;
  name: string;
  startedAt: number;
  finishedAt: number;
  exercises: { exerciseId: number; sets: { kind: SetKind; weight: number; reps: number }[] }[];
};
