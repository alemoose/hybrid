import { notFound } from "next/navigation";
import { listExerciseOptions, getWorkoutPlan } from "@/lib/queries";
import { WorkoutClient } from "./workout-client";

export default async function WorkoutPage({ searchParams }: PageProps<"/workout">) {
  const params = await searchParams;
  const routineParam = typeof params.routine === "string" ? Number(params.routine) : null;
  const starting = routineParam != null || params.empty !== undefined;
  const routineId = routineParam != null && Number.isInteger(routineParam) ? routineParam : null;

  const [plan, exerciseOptions] = await Promise.all([getWorkoutPlan(routineId), listExerciseOptions()]);
  if (!plan) notFound();

  return <WorkoutClient plan={plan} exerciseOptions={exerciseOptions} intent={starting ? "start" : "resume"} />;
}
