"use client";

import Link from "next/link";
import { useState } from "react";
import { DumbbellIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { formatNumber } from "@/lib/format";

export type CalendarDay = {
  key: string;
  label: string;
  future: boolean;
  isToday: boolean;
  workouts: { id: number; name: string; minutes: number; volume: number; sets: number }[];
};

export function CalendarView({ days, lead, initial }: { days: CalendarDay[]; lead: number; initial: string }) {
  const [selected, setSelected] = useState(initial);
  const day = days.find((d) => d.key === selected) ?? days[0];

  return (
    <>
      <div className="flex gap-4 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" />
          Workout
        </span>
        <span className="flex items-center gap-1.5 opacity-60">
          <span className="size-2 rounded-full bg-good" />
          Calories (with food logging)
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
            return (
              <button
                key={d.key}
                type="button"
                disabled={d.future}
                aria-pressed={isSel}
                aria-label={`${d.label}${d.workouts.length ? `, ${d.workouts.length} workout` : ""}`}
                onClick={() => setSelected(d.key)}
                className={cx(
                  "flex h-[46px] flex-col items-center justify-center gap-1 rounded-xl text-[15px] font-semibold",
                  isSel ? "bg-ink text-dark" : d.future ? "text-[#5e5d57]" : "text-ink",
                  d.isToday && !isSel && "border-[1.5px] border-accent",
                )}
              >
                <span className="tabular">{Number(d.key.slice(8))}</span>
                <span
                  className={cx(
                    "size-[5px] rounded-full",
                    d.workouts.length ? (isSel ? "bg-cobalt" : "bg-accent") : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-live="polite" className="flex flex-col gap-3 rounded-3xl border border-line bg-card px-[18px] py-4">
        <h2 className="font-display text-lg font-semibold">{day.label}</h2>
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
      </section>
    </>
  );
}
