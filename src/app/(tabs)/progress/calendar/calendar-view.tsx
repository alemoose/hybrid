"use client";

import Link from "next/link";
import { useState } from "react";
import { DumbbellIcon, ForkIcon } from "@/components/icons";
import { Pill, cx } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/nutrition";

export type CalendarDay = {
  key: string;
  label: string;
  future: boolean;
  isToday: boolean;
  workouts: { id: number; name: string; minutes: number; volume: number; sets: number }[];
  food: {
    calories: number;
    protein: number;
    sodium: number;
    sodiumGoal: number;
    water: number;
    spentCents: number;
    meals: number;
    status: "none" | "hit" | "miss";
  } | null;
};

export function CalendarView({
  days,
  lead,
  initial,
  calorieGoal,
}: {
  days: CalendarDay[];
  lead: number;
  initial: string;
  calorieGoal: number;
}) {
  const [selected, setSelected] = useState(initial);
  const day = days.find((d) => d.key === selected) ?? days[0];
  const f = day.food;
  const diff = f ? f.calories - calorieGoal : 0;

  return (
    <>
      <div className="flex gap-4 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" />
          Workout
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-good" />
          Hit calories
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warn" />
          Missed
        </span>
      </div>

      <section className="flex flex-col gap-1 rounded-3xl border border-line bg-card px-2.5 py-3">
        <div aria-hidden="true" className="grid grid-cols-7 pb-1 text-center text-[11px] font-bold tracking-[0.06em] text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {days.map((d) => {
            const isSel = d.key === selected;
            const foodStatus = d.food?.status ?? "none";
            return (
              <button
                key={d.key}
                type="button"
                disabled={d.future}
                aria-pressed={isSel}
                aria-label={`${d.label}${d.workouts.length ? ", workout" : ""}${foodStatus === "hit" ? ", calories on target" : foodStatus === "miss" ? ", calories off target" : ""}`}
                onClick={() => setSelected(d.key)}
                className={cx(
                  "flex h-[46px] flex-col items-center justify-center gap-1 rounded-xl text-[15px] font-semibold",
                  isSel ? "bg-ink text-dark" : d.future ? "text-[#5e5d57]" : "text-ink",
                  d.isToday && !isSel && "border-[1.5px] border-accent",
                )}
              >
                <span className="tabular">{Number(d.key.slice(8))}</span>
                <span className="flex h-[5px] gap-[3px]">
                  <span
                    className={cx(
                      "size-[5px] rounded-full",
                      d.workouts.length ? (isSel ? "bg-cobalt" : "bg-accent") : "bg-transparent",
                    )}
                  />
                  <span
                    className={cx(
                      "size-[5px] rounded-full",
                      foodStatus === "hit" ? "bg-good" : foodStatus === "miss" ? "bg-warn" : "bg-transparent",
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-live="polite" className="flex flex-col gap-3 rounded-3xl border border-line bg-card px-[18px] py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{day.label}</h2>
          {f && f.status !== "none" ? (
            <Pill tone={f.status === "hit" ? "green" : diff > 0 ? "pink" : "yellow"}>
              {f.status === "hit" ? "On target" : diff > 0 ? `Over by ${formatNumber(diff)}` : `Under by ${formatNumber(-diff)}`}
            </Pill>
          ) : null}
        </div>

        <Link href={`/food?d=${day.key}`} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-p-yellow text-tile-ink">
            <ForkIcon size={18} />
          </span>
          {f ? (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="tabular text-base font-bold">
                {formatNumber(f.calories)} kcal · {formatNumber(f.protein)} g protein
              </span>
              <span className="tabular text-[13px] text-muted">
                <span className={f.sodium > f.sodiumGoal ? "font-semibold text-warn" : ""}>
                  {formatNumber(f.sodium)} mg sodium
                </span>
                {` · ${formatNumber(f.water)} oz water`}
                {f.spentCents > 0 ? ` · ${formatMoney(f.spentCents)}` : ""}
              </span>
            </span>
          ) : (
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-base font-bold">No food logged</span>
              <span className="text-[13px] text-muted">{day.future ? "Coming up" : "Tap to add it"}</span>
            </span>
          )}
          <span className="text-sm font-bold text-accent">Open</span>
        </Link>

        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {day.workouts.length === 0 ? (
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-p-blue text-tile-ink">
                <DumbbellIcon size={18} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-bold">{day.future ? "Coming up" : "Rest day"}</span>
                <span className="text-[13px] text-muted">No workout logged</span>
              </span>
            </div>
          ) : (
            day.workouts.map((w) => (
              <Link key={w.id} href={`/gym/history/${w.id}`} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-p-blue text-tile-ink">
                  <DumbbellIcon size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-bold">{w.name}</span>
                  <span className="text-[13px] text-muted">
                    {w.minutes} min · {formatNumber(w.volume)} lb · {w.sets} sets
                  </span>
                </span>
                <span className="text-sm font-bold text-accent">Open</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
