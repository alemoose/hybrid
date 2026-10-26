import { PageHeader, SectionLabel } from "@/components/ui";
import { targetStatuses } from "@/lib/goal-queries";
import { listExerciseOptions } from "@/lib/queries";
import { getPhysique } from "@/lib/settings";
import { toTargetView } from "@/lib/target-view";
import { TargetEditor } from "../target-editor";
import { PhysiqueForm } from "./physique-form";

export const dynamic = "force-dynamic";

export default async function PhysiquePage() {
  const [physique, statuses, options] = await Promise.all([getPhysique(), targetStatuses("physique"), listExerciseOptions()]);
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title="Physique goal" />
      <PhysiqueForm title={physique?.title ?? ""} subtitle={physique?.subtitle ?? ""} photoId={physique?.photoId ?? null} />
      <SectionLabel>Numbers that track it</SectionLabel>
      <p className="-mt-2 px-1 text-[13px] leading-relaxed text-muted">
        A picture is the motivation; these are how you know you&apos;re getting closer.
      </p>
      <TargetEditor group="physique" targets={statuses.map(toTargetView)} options={options} kinds={["ratio", "measurement", "lift"]} />
    </>
  );
}
