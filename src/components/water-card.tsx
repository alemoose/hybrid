"use client";

import { useOptimistic, useTransition } from "react";
import { addWater, undoWater } from "@/app/food-actions";
import { formatNumber } from "@/lib/format";

const AMOUNTS = [
  { oz: 8, label: "+8 oz", hint: "glass" },
  { oz: 16.9, label: "+16.9", hint: "bottle" },
  { oz: 32, label: "+32 oz", hint: "big bottle" },
];

export function WaterCard({ ounces, goal, why, day }: { ounces: number; goal: number; why: string; day?: string }) {
  const [shown, addShown] = useOptimistic(ounces, (cur: number, delta: number) => Math.max(0, cur + delta));
  const [pending, start] = useTransition();
  const pct = goal > 0 ? Math.min(100, (shown / goal) * 100) : 0;
  const done = shown >= goal;

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Water</h2>
        <span className="tabular text-sm text-muted">
          <b className={done ? "text-good" : "text-ink"}>{formatNumber(shown)}</b> / {formatNumber(goal)} oz
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-[#6fb6ff] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] text-muted">{done ? "Goal reached. Nice." : why}</p>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
        {AMOUNTS.map((a) => (
          <button
            key={a.oz}
            type="button"
            aria-label={`Add ${a.oz} ounces (${a.hint})`}
            onClick={() =>
              start(async () => {
                addShown(a.oz);
                await addWater(a.oz, day);
              })
            }
            className="flex h-12 flex-col items-center justify-center rounded-xl bg-inner leading-tight"
          >
            <span className="text-sm font-bold">{a.label}</span>
            <span className="text-[10px] text-muted">{a.hint}</span>
          </button>
        ))}
        <button
          type="button"
          disabled={pending || shown <= 0}
          onClick={() => start(() => undoWater(day))}
          className="h-12 rounded-xl px-3 text-sm font-semibold text-muted disabled:opacity-40"
        >
          Undo
        </button>
      </div>
    </section>
  );
}
