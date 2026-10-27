"use client";

import dynamic from "next/dynamic";
import type { Reminders } from "@/lib/reminders";
import type { ExerciseOption, WorkoutDraft } from "@/lib/workout-types";

// The workout reads its in-progress draft from localStorage, so it only renders in the browser.
const ActiveWorkout = dynamic(() => import("./active-workout"), {
  ssr: false,
  loading: () => <div className="p-6 text-muted">Loading workout…</div>,
});

export function WorkoutClient(props: {
  plan: WorkoutDraft;
  exerciseOptions: ExerciseOption[];
  intent: "start" | "resume";
  reminders: Reminders;
}) {
  return <ActiveWorkout {...props} />;
}
