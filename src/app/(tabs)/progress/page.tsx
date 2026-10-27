import Link from "next/link";
import { verdict } from "@/components/checkin-verdict";
import { CalendarIcon } from "@/components/icons";
import { Card, EmptyState, PageHeader, SectionLabel } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { getCheckin } from "@/lib/checkin-queries";
import { addDays, formatDayKey, formatInstant, todayKey } from "@/lib/dates";
import { foodByDay, getGoals, spendingByRestaurant } from "@/lib/food-queries";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/nutrition";
import { exercisesDone, getLiftTrends, workoutsByDay } from "@/lib/queries";

export default async function ProgressPage() {
  const tz = await getTimeZone();
  const today = todayKey(tz);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addDays(today, -6);
  const [lifts, done, month, week, weekFood, monthFood, spending, goals, checkin] = await Promise.all([
    getLiftTrends(4),
    exercisesDone(),
    workoutsByDay(monthStart, today, tz),
    workoutsByDay(weekStart, today, tz),
    // Last 7 full days: today is still in progress.
    foodByDay(addDays(today, -7), addDays(today, -1), tz),
    foodByDay(monthStart, today, tz),
    spendingByRestaurant(monthStart, today, tz),
    getGoals(),
    getCheckin(tz),
  ]);
  const monthCount = [...month.values()].reduce((n, l) => n + l.length, 0);
  const weekVolume = [...week.values()].flat().reduce((t, w) => t + w.volume, 0);
  const loggedDays = [...weekFood.values()].filter((d) => d.meals > 0);
  const avg = (pick: (d: (typeof loggedDays)[number]) => number) =>
    loggedDays.length ? loggedDays.reduce((t, d) => t + pick(d), 0) / loggedDays.length : 0;
  const avgCalories = avg((d) => d.nutrients.calories);
  const avgSodium = avg((d) => d.nutrients.sodium);
  const saltyDays = loggedDays.filter((d) => d.nutrients.sodium > goals.sodium).length;
  const monthSpent = [...monthFood.values()].reduce((t, d) => t + d.spentCents, 0);
  // Spending "this week" = the last 6 full days plus today.
  const weekSpent =
    [...weekFood.entries()].filter(([k]) => k >= weekStart).reduce((t, [, d]) => t + d.spentCents, 0) +
    (monthFood.get(today)?.spentCents ?? 0);

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

      <Link href="/progress/week" className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">Weekly check-in</span>
          <span className="text-[13px] text-muted">{verdict(checkin.adjustment, { pace: checkin.pace, calorieGoal: goals.calories }).title}</span>
        </span>
        <span className="text-lg text-muted" aria-hidden="true">›</span>
      </Link>

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

      {loggedDays.length > 0 || monthSpent > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Food · last 7 days</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="flex flex-col gap-1 rounded-[20px] p-4">
              <span className="text-sm font-medium text-muted">Avg calories</span>
              <span className="tabular font-display text-[30px] font-semibold tracking-[-1px]">
                {loggedDays.length ? formatNumber(avgCalories) : "—"}
              </span>
              <span className="text-[13px] text-muted">goal {formatNumber(goals.calories)}</span>
            </Card>
            <Card className="flex flex-col gap-1 rounded-[20px] p-4">
              <span className="text-sm font-medium text-muted">Avg sodium</span>
              <span
                className={`tabular font-display text-[30px] font-semibold tracking-[-1px] ${avgSodium > goals.sodium ? "text-warn" : ""}`}
              >
                {loggedDays.length ? formatNumber(avgSodium) : "—"}
              </span>
              <span className="text-[13px] text-muted">
                mg · {saltyDays} of {loggedDays.length} days over
              </span>
            </Card>
          </div>
        </div>
      ) : null}

      {monthSpent > 0 ? (
        <Card className="flex flex-col gap-0.5 px-5 py-4">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="font-display text-lg font-semibold">Food spending</h2>
            <span className="tabular text-sm text-muted">{formatMoney(weekSpent)} this week</span>
          </div>
          <span className="tabular font-display text-[34px] leading-none font-semibold tracking-[-1px]">
            {formatMoney(monthSpent)}
          </span>
          <span className="pb-2 text-[13px] text-muted">this month</span>
          {spending.slice(0, 6).map((r) => (
            <div key={r.restaurant} className="flex flex-col justify-center gap-1.5 border-t border-line py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">{r.restaurant}</span>
                <span className="tabular text-sm">
                  <b>{formatMoney(r.cents)}</b> <span className="text-muted">· {r.visits}×</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(r.cents / spending[0].cents) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
      ) : null}

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
