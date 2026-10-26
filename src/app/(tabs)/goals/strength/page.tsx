import { PageHeader } from "@/components/ui";
import { targetStatuses } from "@/lib/goal-queries";
import { listExerciseOptions } from "@/lib/queries";
import { toTargetView } from "@/lib/target-view";
import { TargetEditor } from "../target-editor";

export const dynamic = "force-dynamic";

export default async function StrengthGoalsPage() {
  const [statuses, options] = await Promise.all([targetStatuses("strength"), listExerciseOptions()]);
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title="Strength goals" />
      <p className="px-1 text-[13px] leading-relaxed text-muted">
        Progress uses your best estimated max over your last three sessions, or most reps in a set for bodyweight moves.
      </p>
      <TargetEditor group="strength" targets={statuses.map(toTargetView)} options={options} kinds={["lift"]} />
    </>
  );
}
