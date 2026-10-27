import Link from "next/link";
import { applyCalorieChange } from "@/app/checkin-actions";
import { verdict, formatRate, paceText } from "@/components/checkin-verdict";
import { Card, PageHeader, SectionLabel, cx } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { carbsFor } from "@/lib/checkin";
import { getCheckin } from "@/lib/checkin-queries";
import { formatDayKey } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/nutrition";

export const dynamic = "force-dynamic";

const TONE = { good: "text-good", gold: "text-gold", muted: "text-ink" } as const;

export default async function CheckinPage() {
  const tz = await getTimeZone();
  const c = await getCheckin(tz);
  const v = verdict(c.adjustment, { pace: c.pace, calorieGoal: c.goals.calories });
  const range = `${formatDayKey(c.range.first, { month: "short", day: "numeric" })} – ${formatDayKey(c.range.last, { month: "short", day: "numeric" })}`;
  const maxBar = Math.max(c.goals.calories * 1.3, ...c.week.map((d) => d.calories));

  return (
    <>
      <PageHeader back="/progress" eyebrow={range} title="Weekly check-in" />

      <Card className="flex flex-col gap-3 p-5">
        <span className="text-[13px] font-semibold text-muted">Calories</span>
        <h2 className={cx("font-display text-[22px] leading-tight font-semibold", TONE[v.tone])}>{v.title}</h2>
        <p className="text-sm leading-relaxed text-ink-2">{v.body}</p>
        {c.adjustment.kind === "change" ? (
          <>
            <p className="tabular text-[13px] text-muted">
              {formatNumber(c.goals.calories)} → {formatNumber(c.adjustment.calories)} kcal · carbs {c.goals.carbs} →{" "}
              {carbsFor(c.goals.carbs, c.adjustment.delta)} g
            </p>
            <form action={applyCalorieChange}>
              <button type="submit" className="btn-primary w-full">
                Update my goal
              </button>
            </form>
          </>
        ) : null}
        {c.adjustment.kind === "need-weights" ? (
          <Link href="/goals/weight" className="btn-outline">
            Log a weigh-in
          </Link>
        ) : null}
      </Card>

      <SectionLabel>Last 7 days</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat
          label="Avg calories"
          value={c.thisWeek.loggedDays ? formatNumber(c.thisWeek.avgCalories) : "—"}
          detail={`goal ${formatNumber(c.goals.calories)}`}
          change={c.lastWeek.loggedDays && c.thisWeek.loggedDays ? c.thisWeek.avgCalories - c.lastWeek.avgCalories : null}
        />
        <Stat
          label="Avg protein"
          value={c.thisWeek.loggedDays ? `${c.thisWeek.avgProtein} g` : "—"}
          detail={`goal ${c.goals.protein} g`}
          warn={c.thisWeek.loggedDays > 0 && c.thisWeek.avgProtein < c.goals.protein * 0.8}
        />
        <Stat
          label="Weight"
          value={c.weight.current != null ? `${c.weight.current.toFixed(1)}` : "—"}
          detail={c.weight.ratePerWeek != null ? `${formatRate(c.weight.ratePerWeek)} · pace ${paceText(c.pace)}` : "7-day average"}
        />
        <Stat
          label="Workouts"
          value={String(c.workouts.count)}
          detail={c.workouts.volume ? `${formatNumber(c.workouts.volume)} lb volume` : "this week"}
          change={c.workouts.count - c.prevWorkouts.count}
          unit=""
        />
        <Stat
          label="Salty days"
          value={`${c.thisWeek.saltyDays}`}
          detail={`over ${formatNumber(c.goals.sodium)} mg`}
          warn={c.thisWeek.saltyDays >= 3}
        />
        <Stat label="Spent" value={formatMoney(c.thisWeek.spentCents)} detail={c.lastWeek.spentCents ? `${formatMoney(c.lastWeek.spentCents)} the week before` : "on food"} />
      </div>

      <SectionLabel>Calories by day</SectionLabel>
      <Card className="flex flex-col gap-2 p-4">
        <div className="relative flex h-28 items-end gap-2">
          <div
            className="absolute inset-x-0 border-t border-dashed border-dash"
            style={{ bottom: `${(c.goals.calories / maxBar) * 100}%` }}
            aria-hidden="true"
          />
          {c.week.map((d) => (
            <div
              key={d.key}
              title={`${formatDayKey(d.key, { weekday: "short" })}: ${formatNumber(d.calories)}`}
              className={cx("flex-1 rounded-t-md", d.meals === 0 ? "bg-line" : d.calories >= c.goals.calories * 0.9 ? "bg-good" : "bg-gold")}
              style={{ height: d.meals === 0 ? "4px" : `${(d.calories / maxBar) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex gap-2 text-center text-[11px] text-faint">
          {c.week.map((d) => (
            <span key={d.key} className="flex-1">
              {formatDayKey(d.key, { weekday: "narrow" })}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">Dashed line is your goal. Green days were within 10% of it.</p>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  change,
  unit = "",
  warn,
}: {
  label: string;
  value: string;
  detail: string;
  change?: number | null;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 rounded-[20px] p-4">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={cx("tabular font-display text-[26px] leading-tight font-semibold tracking-[-0.8px]", warn && "text-warn")}>
        {value}
        {change ? (
          <span className={cx("ml-1.5 font-sans text-[13px] font-bold tracking-normal", change > 0 ? "text-good" : "text-muted")}>
            {change > 0 ? "↑" : "↓"}
            {formatNumber(Math.abs(change))}
            {unit}
          </span>
        ) : null}
      </span>
      <span className="text-[13px] text-muted">{detail}</span>
    </Card>
  );
}
