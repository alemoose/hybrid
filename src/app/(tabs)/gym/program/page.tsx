import { PageHeader } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/estimate";
import { getProgramDraft } from "@/lib/program-queries";
import { getPhysique } from "@/lib/settings";
import { ProgramDesigner } from "./program-designer";

export const dynamic = "force-dynamic";
// Designing takes a while: the model studies the photo and plans the week.
export const maxDuration = 120;

export default async function ProgramPage() {
  const [physique, draft] = await Promise.all([getPhysique(), getProgramDraft()]);
  return (
    <>
      <PageHeader back="/gym" eyebrow="Gym" title={physique?.title ? `A program for your ${physique.title}` : "Design my program"} />
      <ProgramDesigner
        aiReady={aiConfigured()}
        hasGoal={Boolean(physique?.title || physique?.photoId)}
        photoId={physique?.photoId ?? null}
        draft={draft && !draft.usedAt ? draft : null}
        defaults={{ daysPerWeek: draft?.daysPerWeek ?? 4, minutes: draft?.minutes ?? 60, note: draft?.note ?? "" }}
      />
    </>
  );
}
