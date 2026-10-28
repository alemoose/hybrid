import { PageHeader } from "@/components/ui";
import { guideFor } from "@/lib/exercise-guide";
import { listExerciseLibrary } from "@/lib/queries";
import { ExerciseLibrary } from "./exercise-library";

export default async function ExercisesPage() {
  const all = await listExerciseLibrary();
  const items = all.map((e) => ({ ...e, thumb: guideFor({ slug: e.slug })?.photos[1] ?? null }));
  return (
    <>
      <PageHeader back="/gym" eyebrow="Gym" title="Exercise library" />
      <ExerciseLibrary items={items} />
    </>
  );
}
