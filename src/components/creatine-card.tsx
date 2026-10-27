"use client";

import { useOptimistic, useTransition } from "react";
import { setHabit } from "@/app/habit-actions";
import { CheckIcon } from "./icons";
import { cx } from "./ui";

/** One tap a day. The dots are the last 7 days, today on the right. */
export function CreatineCard({ done, week, streak }: { done: boolean; week: { key: string; label: string; done: boolean }[]; streak: number }) {
  const [shown, setShown] = useOptimistic(done);
  const [, start] = useTransition();
  // Today's tap moves the streak and the last dot right away.
  const shownStreak = shown === done ? streak : shown ? streak + 1 : Math.max(0, streak - 1);

  return (
    <section className="flex items-center gap-4 rounded-3xl border border-line bg-card px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-semibold">Creatine</h2>
          <span className="text-[13px] text-muted">5 g</span>
        </div>
        <div className="flex items-center gap-1.5" aria-label="Last 7 days">
          {week.map((d, i) => {
            const on = i === week.length - 1 ? shown : d.done;
            return (
              <span key={d.key} className="flex flex-col items-center gap-1">
                <span className={cx("size-2.5 rounded-full", on ? "bg-good" : "bg-line-strong")} title={`${d.label}: ${on ? "taken" : "missed"}`} />
                <span className="text-[10px] text-faint">{d.label}</span>
              </span>
            );
          })}
          <span className="ml-2 text-[13px] font-semibold text-muted">
            {shownStreak > 1 ? `${shownStreak}-day streak` : shown ? "Done today" : "Any time of day works"}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? "Undo creatine for today" : "Took my creatine today"}
        onClick={() =>
          start(async () => {
            setShown(!shown);
            await setHabit("creatine", !shown);
          })
        }
        className={cx(
          "flex size-14 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          shown ? "border-good bg-good text-dark" : "border-line-strong text-muted",
        )}
      >
        <CheckIcon size={24} />
      </button>
    </section>
  );
}
