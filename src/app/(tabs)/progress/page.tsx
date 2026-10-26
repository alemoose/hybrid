import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { Card, EmptyState, PageHeader, SectionLabel } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { addDays, formatDayKey, formatInstant, todayKey } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { exercisesDone, getLiftTrends, workoutsByDay } from "@/lib/queries";

export default async function ProgressPage() {
  const tz = await getTimeZone();
  const today = todayKey(tz);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addDays(today, -6);
  const [lifts, done, month, week] = await Promise.all([
    getLiftTrends(4),
    exercisesDone(),
    workoutsByDay(monthStart, today, tz),
    workoutsByDay(weekStart, today, tz),
  ]);
  const monthCount = [...month.values()].reduce((n, l) => n + l.length, 0);
  const weekVolume = [...week.values()].flat().reduce((t, w) => t + w.volume, 0);

  return (
    <>
      <PageHeader
        eyebrow={formatDayKey(today, { month: "long" })}
        title="Progress"
        right={
          <Link href="/progress/calendar" aria-label="Open calendar" className="circle-btn">
            <CalendarIcon size={18} />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-1 rounded-[20px] p-4">
          <span className="text-sm font-medium text-muted">Workouts</span>
          <span className="tabular font-display text-[30px] font-semibold tracking-[-1px]">{monthCount}</span>
          <span className="text-[13px] text-muted">this month</span>
        </Card>
        <Card className="flex flex-col gap-1 rounded-[20px] p-4">
          <span className="text-sm font-medium text-muted">Volume</span>
          <span className="tabular font-display text-[30px] font-semibold tracking-[-1px]">
            {weekVolume >= 10_000 ? `${(weekVolume / 1000).toFixed(1)}k` : formatNumber(weekVolume)}
          </span>
          <span className="text-[13px] text-muted">lb, last 7 days</span>
        </Card>
      </div>

      {lifts.length === 0 ? (
        <EmptyState title="Your charts start after your first workout">
          <p className="text-sm text-ink-2">Every exercise you log gets its own progress chart and records.</p>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          <SectionLabel>Strength · est. max</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {lifts.map((l) => (
              <Link
                key={l.exerciseId}
                href={`/progress/exercises/${l.exerciseId}`}
                className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-card p-3.5"
              >
                <span className="line-clamp-2 text-[15px] leading-snug font-bold">{l.name}</span>
                <span className="tabular text-[13px] text-muted">
                  {l.bodyweight ? `${l.maxReps} reps best` : `${l.estMax} lb`}
                </span>
                <span
                  className={`pt-1 text-[13px] font-bold ${
                    l.delta == null ? "text-muted" : l.delta > 0 ? "text-accent" : "text-warn"
                  }`}
                >
                  {l.delta == null ? "New this month" : l.delta > 0 ? `+${l.delta} this month` : "No gain this month"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 ? (
        <section className="flex flex-col pt-1">
          <SectionLabel>All exercises</SectionLabel>
          <ul className="flex flex-col px-1 pt-1">
            {done.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/progress/exercises/${e.id}`}
                  className={`flex h-14 items-center gap-3 ${i < done.length - 1 ? "border-b border-line" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{e.name}</span>
                  <span className="text-[13px] text-muted">
                    {e.sessions} {e.sessions === 1 ? "session" : "sessions"} · {formatInstant(e.last, tz, { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
