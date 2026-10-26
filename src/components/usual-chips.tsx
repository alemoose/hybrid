"use client";

import { useState, useTransition } from "react";
import { logUsual } from "@/app/food-actions";
import type { UsualOption } from "@/lib/food-types";
import { formatNumber } from "@/lib/format";
import { defaultMeal, formatMoney } from "@/lib/nutrition";

/** One tap logs a saved order to the meal that fits the current time. */
export function UsualChips({ usuals, day }: { usuals: UsualOption[]; day?: string }) {
  const [pending, start] = useTransition();
  const [logged, setLogged] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {usuals.map((u) => (
        <button
          key={u.id}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await logUsual(u.id, day ? "lunch" : defaultMeal(new Date().getHours()), day);
              setLogged(u.id);
            })
          }
          className="flex flex-col items-start gap-0.5 rounded-[18px] border border-line bg-card p-3.5 text-left disabled:opacity-60"
        >
          <span className="text-[15px] font-bold">{u.restaurant || "Usual"}</span>
          <span className="line-clamp-1 text-[13px] text-muted">
            {u.title} · {formatNumber(u.calories)}
          </span>
          <span className="pt-1 text-[13px] font-bold text-accent">
            {logged === u.id ? "Logged ✓" : `Log again${u.priceCents != null ? ` · ${formatMoney(u.priceCents)}` : ""}`}
          </span>
        </button>
      ))}
    </div>
  );
}
