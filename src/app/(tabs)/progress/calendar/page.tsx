import Link from "next/link";
import { BackIcon, ForwardIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { addDays, dayKey, formatDayKey, keyToUtc, todayKey, utcWindow } from "@/lib/dates";
import { foodByDay, getGoals } from "@/lib/food-queries";
import { listWeights } from "@/lib/goal-queries";
import { habitDays } from "@/lib/habit-queries";
import { calorieStatus, sodiumGoalFor } from "@/lib/nutrition";
import { workoutsByDay } from "@/lib/queries";
import { CalendarView, type CalendarDay } from "./calendar-view";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarPage({ searchParams }: PageProps<"/progress/calendar">) {
  const [sp, tz] = await Promise.all([searchParams, getTimeZone()]);
  const today = todayKey(tz);
  const month = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const [byDay, food, goals, weights, creatine] = await Promise.all([
    workoutsByDay(first, last, tz),
    foodByDay(first, last, tz),
    getGoals(),
    listWeights(utcWindow(first, last).from.getTime()),
    habitDays("creatine", first, last),
  ]);
  const weightByDay = new Map(weights.map((w) => [dayKey(w.at, tz), w.weight]));

  const days: CalendarDay[] = [];
  for (let key = first; key <= last; key = addDays(key, 1)) {
    days.push({
      key,
      label: formatDayKey(key, { weekday: "long", month: "short", day: "numeric" }),
      future: key > today,
      isToday: key === today,
      workouts: (byDay.get(key) ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        minutes: Math.round((w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000),
        volume: w.volume,
        sets: w.sets,
      })),
      weight: weightByDay.get(key) ?? null,
      creatine: creatine.has(key),
      food: (() => {
        const f = food.get(key);
        if (!f) return null;
        const trained = (byDay.get(key) ?? []).length > 0;
        return {
          calories: Math.round(f.nutrients.calories),
          protein: Math.round(f.nutrients.protein),
          sodium: Math.round(f.nutrients.sodium),
          sodiumGoal: sodiumGoalFor(goals, trained),
          water: Math.round(f.water),
          spentCents: f.spentCents,
          meals: f.meals,
          status: key === today ? ("none" as const) : calorieStatus(f.nutrients.calories, goals.calories),
        };
      })(),
    });
  }
  const lead = keyToUtc(first).getUTCDay();
  const initial =
    month === today.slice(0, 7) ? today : ([...days].reverse().find((d) => d.workouts.length || d.food)?.key ?? first);
  const isCurrentOrFuture = month >= today.slice(0, 7);

  return (
    <>
      <PageHeader
        back="/progress"
        title={formatDayKey(first, { month: "long", year: "numeric" })}
        right={
          <div className="flex gap-2">
            <Link href={`/progress/calendar?m=${shiftMonth(month, -1)}`} aria-label="Previous month" className="circle-btn size-9">
              <BackIcon size={16} />
            </Link>
            {isCurrentOrFuture ? (
              <span className="circle-btn size-9 opacity-30" aria-hidden="true">
                <ForwardIcon size={16} />
              </span>
            ) : (
              <Link href={`/progress/calendar?m=${shiftMonth(month, 1)}`} aria-label="Next month" className="circle-btn size-9">
                <ForwardIcon size={16} />
              </Link>
            )}
          </div>
        }
      />
      <CalendarView key={month} days={days} lead={lead} initial={initial} calorieGoal={goals.calories} />
    </>
  );
}
