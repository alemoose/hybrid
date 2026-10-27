import Link from "next/link";
import type { DaySummary } from "@/lib/food-queries";
import { formatNumber } from "@/lib/format";
import { formatMoney, type Goals } from "@/lib/nutrition";
import { cx } from "./ui";

type Row = { letter: string; name: string; value: number; goal: number; unit: string; tint: string; bar: string };

/** Calories left, macros and sodium for a day, in the RoomSync-style balance card. */
export function NutritionCard({
  summary,
  goals,
  sodiumGoal,
  trained,
  actions,
}: {
  summary: DaySummary;
  goals: Goals;
  sodiumGoal: number;
  trained: boolean;
  actions?: { logHref: string; secondary?: { href: string; label: string }; suggest?: boolean };
}) {
  const n = summary.nutrients;
  const left = Math.round(goals.calories - n.calories);
  const rows: Row[] = [
    { letter: "P", name: "Protein", value: n.protein, goal: goals.protein, unit: "g", tint: "bg-p-pink", bar: "bg-rose" },
    { letter: "C", name: "Carbs", value: n.carbs, goal: goals.carbs, unit: "g", tint: "bg-p-yellow", bar: "bg-gold" },
    { letter: "F", name: "Fat", value: n.fat, goal: goals.fat, unit: "g", tint: "bg-p-blue", bar: "bg-accent" },
    { letter: "Na", name: "Sodium", value: n.sodium, goal: sodiumGoal, unit: "mg", tint: "bg-p-green", bar: "bg-good" },
  ];

  return (
    <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-muted">{left >= 0 ? "Calories left" : "Calories over"}</span>
        <span
          className={cx(
            "tabular font-display text-[56px] leading-[1.05] font-semibold tracking-[-2.5px]",
            left < 0 && "text-warn",
          )}
        >
          {formatNumber(Math.abs(left))}
        </span>
        <span className="text-[13px] text-muted">
          {formatNumber(n.calories)} eaten of {formatNumber(goals.calories)}
          {summary.spentCents > 0 ? ` · ${formatMoney(summary.spentCents)} spent` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
        {rows.map((r) => {
          const over = r.value > r.goal;
          const isSodium = r.letter === "Na";
          return (
            <div key={r.name} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 text-[15px]">
                <span
                  className={cx(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-tile-ink",
                    r.tint,
                  )}
                >
                  {r.letter}
                </span>
                <span className="flex-1 text-ink-2">
                  {r.name}
                  {isSodium && trained ? <span className="text-xs text-muted"> · training day</span> : null}
                </span>
                <span className="tabular text-[13px] text-muted">
                  {formatNumber(r.value)} / {formatNumber(r.goal)} {r.unit}
                </span>
              </div>
              <div className="ml-10 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={cx("h-full rounded-full", over && isSodium ? "bg-warn" : r.bar)}
                  style={{ width: `${Math.min(100, r.goal > 0 ? (r.value / r.goal) * 100 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {actions ? (
        <div className="flex gap-2">
          <Link href={actions.logHref} className="btn-primary flex-1">
            Log food
          </Link>
          {actions.secondary ? (
            <Link href={actions.secondary.href} className="btn-outline flex-1">
              {actions.secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
      {actions?.suggest && left >= 150 ? (
        <Link href="/food/suggest" className="-mt-1 text-center text-sm font-semibold text-accent">
          What should I order?
        </Link>
      ) : null}
    </section>
  );
}
