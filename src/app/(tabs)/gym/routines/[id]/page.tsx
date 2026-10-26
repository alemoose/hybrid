import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getRoutine, listExerciseOptions } from "@/lib/queries";
import { RoutineEditor } from "./routine-editor";

export default async function RoutinePage({ params }: PageProps<"/gym/routines/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const routineId = Number(id);
  if (!isNew && !Number.isInteger(routineId)) notFound();

  const [routine, options] = await Promise.all([isNew ? null : getRoutine(routineId), listExerciseOptions()]);
  if (!isNew && !routine) notFound();

  return (
    <>
      <PageHeader back="/gym" eyebrow={isNew ? "New routine" : "Edit routine"} title={routine?.name ?? "Routine"} />
      <RoutineEditor
        routineId={routine?.id ?? null}
        initialName={routine?.name ?? ""}
        initialExercises={routine?.exercises ?? []}
        options={options}
      />
    </>
  );
}
