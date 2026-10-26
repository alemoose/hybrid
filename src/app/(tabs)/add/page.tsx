import Link from "next/link";
import { CloseIcon } from "@/components/icons";
import { ResumeBanner } from "@/components/resume-banner";
import { Card, SectionLabel } from "@/components/ui";
import { listRoutines } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const routines = await listRoutines();
  return (
    <>
      <div className="flex items-center gap-7">
        <Link href="/" aria-label="Close" className="circle-btn">
          <CloseIcon size={18} />
        </Link>
        <div role="group" aria-label="What are you logging" className="grid w-[210px] grid-cols-2 rounded-full bg-inner p-1">
          <span className="flex h-9 items-center justify-center rounded-full text-sm font-semibold text-faint">Food</span>
          <span className="flex h-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-dark">
            Workout
          </span>
        </div>
      </div>

      <ResumeBanner />

      <Link href="/workout?empty=1" className="btn-outline h-14 justify-start rounded-2xl px-4 text-base">
        <span className="text-xl text-accent">+</span> Start empty workout
      </Link>

      {routines.length > 0 ? <SectionLabel>Start a routine</SectionLabel> : null}
      {routines.map((r) => (
        <Link
          key={r.id}
          href={`/workout?routine=${r.id}`}
          className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-bold">{r.name}</span>
            <span className="truncate text-[13px] text-muted">{r.exerciseNames.join(", ")}</span>
          </span>
          <span className="text-sm font-bold text-accent">Start</span>
        </Link>
      ))}

      <Card className="flex flex-col gap-1.5 p-4">
        <span className="text-[15px] font-bold">Food logging is next</span>
        <span className="text-[13px] leading-relaxed text-muted">
          Type, say or snap what you ate, with chain restaurant data and AI estimates for local spots.
        </span>
      </Card>
    </>
  );
}
