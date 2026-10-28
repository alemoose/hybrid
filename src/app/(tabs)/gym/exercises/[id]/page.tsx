import { notFound } from "next/navigation";
import { ExerciseGuide } from "@/components/exercise-guide";
import { PageHeader, TextLink } from "@/components/ui";
import { guideFor } from "@/lib/exercise-guide";
import { getExercise } from "@/lib/queries";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ExerciseGuidePage({ params }: PageProps<"/gym/exercises/[id]">) {
  const { id } = await params;
  const exercise = await getExercise(Number(id));
  if (!exercise) notFound();
  return (
    <>
      <PageHeader back="/gym/exercises" eyebrow={`${label(exercise.equipment)} · ${exercise.primaryMuscle}`} title={exercise.name} />
      <ExerciseGuide name={exercise.name} guide={guideFor({ slug: exercise.slug })} />
      <div className="px-1">
        <TextLink href={`/progress/exercises/${exercise.id}`}>Your history with this exercise</TextLink>
      </div>
    </>
  );
}
