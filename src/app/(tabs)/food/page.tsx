import Link from "next/link";
import { BackIcon, ForwardIcon } from "@/components/icons";
import { NutritionCard } from "@/components/nutrition-card";
import { Pill, SectionLabel, cx } from "@/components/ui";
import { UsualChips } from "@/components/usual-chips";
import { WaterCard } from "@/components/water-card";
import { getTimeZone } from "@/lib/auth";
import { addDays, formatDayKey, formatInstant, todayKey } from "@/lib/dates";
import { getDayContext } from "@/lib/day-context";
import { listUsuals } from "@/lib/food-queries";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/nutrition";

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;
const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snacks", dinner: "Dinner" };

export default async function FoodPage({ searchParams }: PageProps<"/food">) {
  const [sp, tz] = await Promise.all([searchParams, getTimeZone()]);
  const today = todayKey(tz);
  const day = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d <= today ? sp.d : today;
  const isToday = day === today;
  const pastDay = isToday ? undefined : day;
  const [ctx, usuals] = await Promise.all([getDayContext(day, tz), listUsuals(6)]);
  const { food, goals } = ctx;
  const logHref = `/add?mode=food${pastDay ? `&d=${day}` : ""}`;

  return (
    <>
      <header className="flex items-center gap-3 px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-muted">
            {isToday ? formatDayKey(day, { weekday: "long", month: "long", day: "numeric" }) : "Looking back"}
          </span>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.6px]">
            {isToday ? "Food" : formatDayKey(day, { weekday: "short", month: "short", day: "numeric" })}
          </h1>
        </div>
        <Link href={`/food?d=${addDays(day, -1)}`} aria-label="Previous day" className="circle-btn size-9">
          <BackIcon size={16} />
        </Link>
        {isToday ? (
          <span className="circle-btn size-9 opacity-30" aria-hidden="true">
            <ForwardIcon size={16} />
          </span>
        ) : (
          <Link href={`/food?d=${addDays(day, 1)}`} aria-label="Next day" className="circle-btn size-9">
            <ForwardIcon size={16} />
          </Link>
        )}
      </header>

      <NutritionCard
        summary={food.summary}
        goals={goals}
        sodiumGoal={ctx.sodiumGoal}
        trained={ctx.trained}
        actions={{ logHref, secondary: { href: "/settings", label: "Goals" } }}
      />

      <WaterCard ounces={food.summary.water} goal={ctx.water.goal} why={ctx.water.why} day={pastDay} />

      {usuals.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Your usuals · tap to log</SectionLabel>
          <UsualChips usuals={usuals} day={pastDay} />
        </section>
      ) : null}

      {MEAL_ORDER.map((meal) => {
        const logs = food.meals.filter((m) => m.meal === meal);
        if (logs.length === 0) return null;
        const kcal = logs.reduce((t, l) => t + l.calories, 0);
        return (
          <section key={meal} className="flex flex-col rounded-3xl border border-line bg-card px-4 py-1">
            <div className="flex h-11 items-center justify-between">
              <h2 className="text-[15px] font-bold">{MEAL_LABEL[meal]}</h2>
              <span className="tabular text-sm font-semibold">{formatNumber(kcal)} kcal</span>
            </div>
            {logs.map((l) => (
              <Link key={l.id} href={`/food/meals/${l.id}`} className="flex min-h-[60px] items-center gap-3 border-t border-line py-2">
                <span className="flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-p-yellow text-base font-bold text-tile-ink">
                  {(l.restaurant || l.title).charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{l.title}</span>
                  <span className="truncate text-[13px] text-muted">
                    {[l.restaurant, formatInstant(l.eatenAt, tz, { hour: "numeric", minute: "2-digit" }), l.source === "estimate" ? "estimate" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="tabular text-[15px] font-bold">{formatNumber(l.calories)}</span>
                  <span className={cx("tabular text-xs", l.sodium > ctx.sodiumGoal / 2 ? "text-warn" : "text-muted")}>
                    {formatNumber(l.sodium)} mg{l.priceCents != null ? ` · ${formatMoney(l.priceCents)}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </section>
        );
      })}

      {food.meals.length === 0 ? (
        <Link href={logHref} className="flex h-14 items-center justify-between rounded-2xl border border-dashed border-dash px-4">
          <span className="text-[15px] font-semibold">Nothing logged {isToday ? "yet today" : "this day"}</span>
          <Pill tone="blue">Log food</Pill>
        </Link>
      ) : null}
    </>
  );
}
