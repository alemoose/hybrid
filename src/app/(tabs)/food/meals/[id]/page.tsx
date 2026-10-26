import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MealActions } from "./meal-actions";
import { Card, PageHeader, Pill } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { db } from "@/lib/db";
import { mealItems, mealLogs } from "@/lib/db/schema";
import { dayKey, formatInstant } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/nutrition";

const SOURCE = {
  official: { text: "Official nutrition", tone: "green" },
  estimate: { text: "AI estimate", tone: "yellow" },
  label: { text: "From the label", tone: "blue" },
  manual: { text: "Entered by hand", tone: "pink" },
} as const;

export default async function MealPage({ params }: PageProps<"/food/meals/[id]">) {
  const [{ id }, tz] = await Promise.all([params, getTimeZone()]);
  const [log] = await db.select().from(mealLogs).where(eq(mealLogs.id, Number(id)));
  if (!log) notFound();
  const items = await db.select().from(mealItems).where(eq(mealItems.mealLogId, log.id)).orderBy(mealItems.position);
  const day = dayKey(log.eatenAt, tz);

  return (
    <>
      <PageHeader
        back={`/food?d=${day}`}
        eyebrow={`${log.meal.charAt(0).toUpperCase()}${log.meal.slice(1)} · ${formatInstant(log.eatenAt, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
        title={log.title}
      />
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">{log.restaurant || "No restaurant"}</span>
          <Pill tone={SOURCE[log.source].tone}>{SOURCE[log.source].text}</Pill>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-line pt-3">
          {[
            ["Calories", formatNumber(log.calories)],
            ["Sodium", `${formatNumber(log.sodium)} mg`],
            ["Cost", log.priceCents != null ? formatMoney(log.priceCents) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted">{label}</span>
              <span className="tabular font-display text-lg font-semibold">{value}</span>
            </div>
          ))}
        </div>
        <span className="tabular text-sm text-muted">
          Protein {formatNumber(log.protein)} g · Carbs {formatNumber(log.carbs)} g · Fat {formatNumber(log.fat)} g
        </span>
      </Card>

      <Card className="flex flex-col px-4 py-1">
        {items.map((i, idx) => (
          <div key={i.id} className={`flex min-h-14 items-center gap-3 py-2 ${idx > 0 ? "border-t border-line" : ""}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {i.quantity !== 1 ? `${Number.isInteger(i.quantity) ? i.quantity : i.quantity.toFixed(1)} × ` : ""}
                {i.name}
              </span>
              <span className="tabular text-xs text-muted">
                P {formatNumber(i.protein * i.quantity)} · C {formatNumber(i.carbs * i.quantity)} · F {formatNumber(i.fat * i.quantity)} ·{" "}
                {formatNumber(i.sodium * i.quantity)} mg sodium
              </span>
            </span>
            <span className="tabular text-[15px] font-bold">{formatNumber(i.calories * i.quantity)}</span>
          </div>
        ))}
      </Card>

      <MealActions id={log.id} day={day} isUsual={log.usualId != null} />
    </>
  );
}
