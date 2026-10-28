import Link from "next/link";
import { Suspense } from "react";
import { createStarterRoutines, moveRoutine } from "@/app/actions";
import { DownIcon, UpIcon } from "@/components/icons";
import { RecCard, RecCardSkeleton } from "@/components/rec-card";
import { ResumeBanner } from "@/components/resume-banner";
import { Card, DateTile, PageHeader, SectionLabel, SectionTitle } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatDuration, formatInstant } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { listRoutines, recentWorkouts } from "@/lib/queries";
import { getPhysique } from "@/lib/settings";

export default async function GymPage() {
  const tz = await getTimeZone();
  const [routines, history, physique] = await Promise.all([listRoutines(), recentWorkouts(10), getPhysique()]);

  return (
    <>
      <PageHeader eyebrow="Train" title="Gym" />
      <ResumeBanner />
      <Suspense fallback={<RecCardSkeleton />}>
        <RecCard />
      </Suspense>

      <Link href="/workout?empty=1" className="btn-outline h-14 justify-start rounded-2xl px-4 text-base">
        <span className="text-xl text-accent">+</span> Start empty workout
      </Link>

      <Link href="/gym/exercises" className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">Exercise library</span>
          <span className="text-[13px] text-muted">How to do every movement, with photos and steps</span>
        </span>
        <span className="text-lg text-muted" aria-hidden="true">›</span>
      </Link>

      <Link href="/gym/program" className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">
            {physique?.title ? `Design a program for your ${physique.title}` : "Design a program for your goal"}
          </span>
          <span className="text-[13px] text-muted">Routines built around the physique you want</span>
        </span>
        <span className="text-lg text-muted" aria-hidden="true">›</span>
      </Link>

      <div className="flex items-center justify-between px-1 pt-1">
        <SectionLabel>Routines · run in this order</SectionLabel>
        <Link href="/gym/routines/new" className="text-sm font-semibold text-accent">
          New routine
        </Link>
      </div>

      {routines.length === 0 ? (
        <Card className="flex flex-col gap-3 p-5">
          <p className="text-sm leading-relaxed text-ink-2">
            No routines yet. Start with a classic Push / Pull / Legs split. You can edit every exercise after.
          </p>
          <form action={createStarterRoutines}>
            <button type="submit" className="btn-primary w-full">
              Add Push/Pull/Legs
            </button>
          </form>
        </Card>
      ) : (
        routines.map((r, i) => (
          <Card key={r.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2">
              <Link href={`/gym/routines/${r.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[17px] font-bold">
                  <span className="text-muted">{i + 1}.</span> {r.name}
                </span>
                <span className="line-clamp-2 text-[13px] text-muted">
                  {r.exerciseNames.length ? r.exerciseNames.join(", ") : "No exercises yet"}
                </span>
              </Link>
              <div className="flex gap-1">
                <form action={moveRoutine.bind(null, r.id, -1)}>
                  <button
                    type="submit"
                    aria-label={`Move ${r.name} earlier`}
                    disabled={i === 0}
                    className="flex size-9 items-center justify-center rounded-full border border-line-strong disabled:opacity-30"
                  >
                    <UpIcon size={16} />
                  </button>
                </form>
                <form action={moveRoutine.bind(null, r.id, 1)}>
                  <button
                    type="submit"
                    aria-label={`Move ${r.name} later`}
                    disabled={i === routines.length - 1}
                    className="flex size-9 items-center justify-center rounded-full border border-line-strong disabled:opacity-30"
                  >
                    <DownIcon size={16} />
                  </button>
                </form>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/workout?routine=${r.id}`} className="btn-primary flex-1">
                Start routine
              </Link>
              <Link href={`/gym/routines/${r.id}`} className="btn-outline px-5">
                Edit
              </Link>
            </div>
          </Card>
        ))
      )}

      {history.length > 0 ? (
        <section className="flex flex-col px-1 pt-2">
          <SectionTitle>History</SectionTitle>
          {history.map((w, i) => (
            <Link
              key={w.id}
              href={`/gym/history/${w.id}`}
              className={`flex h-[62px] items-center gap-3 ${i < history.length - 1 ? "border-b border-line" : ""}`}
            >
              <DateTile
                top={formatInstant(w.startedAt, tz, { month: "short" }).toUpperCase()}
                bottom={formatInstant(w.startedAt, tz, { day: "numeric" })}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-semibold">{w.name}</span>
                <span className="text-[13px] text-muted">
                  {formatDuration(w.finishedAt.getTime() - w.startedAt.getTime())} · {w.exercises} exercises
                </span>
              </div>
              <span className="tabular text-base font-bold">{formatNumber(w.volume)} lb</span>
            </Link>
          ))}
        </section>
      ) : null}
    </>
  );
}
