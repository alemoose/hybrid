import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWorkout } from "@/app/actions";
import { Card, PageHeader, Pill } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatDuration, formatInstant } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { getWorkoutDetail } from "@/lib/queries";
import { formatWeight } from "@/lib/training";

export default async function WorkoutDetailPage({ params, searchParams }: PageProps<"/gym/history/[id]">) {
  const [{ id }, sp, tz] = await Promise.all([params, searchParams, getTimeZone()]);
  const detail = await getWorkoutDetail(Number(id));
  if (!detail) notFound();
  const { workout, exercises, volume } = detail;
  const prCount = exercises.reduce((n, e) => n + e.prs.length, 0);
  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <>
      <PageHeader
        back="/gym"
        eyebrow={formatInstant(workout.startedAt, tz, { weekday: "long", month: "long", day: "numeric" })}
        title={workout.name}
      />

      {sp.finished ? (
        <div className="rounded-[18px] bg-p-green px-4 py-3.5 text-tile-ink">
          <p className="text-[15px] font-bold">Saved. Nice work.</p>
          <p className="text-[13px]">
            {prCount > 0 ? `${prCount} new personal record${prCount === 1 ? "" : "s"} today.` : "Your next targets are ready."}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5">
        {[
          ["Time", formatDuration(workout.finishedAt.getTime() - workout.startedAt.getTime())],
          ["Volume", `${formatNumber(volume)} lb`],
          ["Sets", String(setCount)],
        ].map(([label, value]) => (
          <Card key={label} className="flex flex-col gap-1 rounded-[20px] p-3.5">
            <span className="text-[13px] text-muted">{label}</span>
            <span className="tabular font-display text-lg font-semibold">{value}</span>
          </Card>
        ))}
      </div>

      {exercises.map((ex) => {
        let working = 0;
        return (
          <Card key={ex.exerciseId} className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-2">
              <Link href={`/progress/exercises/${ex.exerciseId}`} className="flex-1 text-[17px] font-bold">
                {ex.name}
              </Link>
              {ex.prs.map((pr) => (
                <Pill key={pr} tone="yellow">
                  PR · {pr}
                </Pill>
              ))}
            </div>
            <ul className="flex flex-col">
              {ex.sets.map((s, i) => {
                if (s.kind === "working") working++;
                const label = s.kind === "warmup" ? "W" : s.kind === "drop" ? "D" : s.kind === "failure" ? "F" : String(working);
                return (
                  <li key={i} className="flex h-9 items-center gap-3 border-b border-line text-[15px] last:border-b-0">
                    <span className={`w-6 font-bold ${s.kind === "warmup" ? "text-gold" : "text-muted"}`}>{label}</span>
                    <span className="tabular flex-1 font-display font-semibold">
                      {s.weight > 0 ? `${formatWeight(s.weight)} lb × ${s.reps}` : `${s.reps} reps`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {ex.metrics ? (
              <span className="text-[13px] text-muted">
                Est. max {ex.metrics.estMax || "—"} lb · {formatNumber(ex.metrics.volume)} lb volume
              </span>
            ) : null}
          </Card>
        );
      })}

      <form action={deleteWorkout.bind(null, workout.id)}>
        <button type="submit" className="h-11 w-full text-sm font-semibold text-warn">
          Delete this workout
        </button>
      </form>
    </>
  );
}
