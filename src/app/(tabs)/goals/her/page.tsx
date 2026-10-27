import { PageHeader } from "@/components/ui";
import { getReminders } from "@/lib/reminder-queries";
import { HerEditor } from "./her-editor";

export const dynamic = "force-dynamic";

export default async function HerPage() {
  const r = await getReminders();
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title={r.name ? `Why ${r.name}` : "Reminders of her"} />
      <p className="-mt-1 px-1 text-[13px] leading-relaxed text-muted">
        Write down why you love her and add a few photos. They turn up when you start a workout, between sets, when the rec is
        busy, and every few days on Today. Only you can see them.
      </p>
      <HerEditor name={r.name} notes={r.notes} photoIds={r.photoIds} />
    </>
  );
}
