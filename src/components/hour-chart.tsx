"use client";

import { useRef, useState, type PointerEvent } from "react";
import { busyLevel, formatHour, type Busy, type HourStat } from "@/lib/rec";
import { cx } from "./ui";

const BAR: Record<Busy, string> = { quiet: "bg-good", moderate: "bg-gold", busy: "bg-warn" };
const TEXT: Record<Busy, string> = { quiet: "text-good", moderate: "text-gold", busy: "text-warn" };
const LEGEND: { level: Busy; label: string }[] = [
  { level: "quiet", label: "Under 25%" },
  { level: "moderate", label: "25–50%" },
  { level: "busy", label: "50%+ full" },
];

function hourRange(hour: number): string {
  const from = formatHour(hour);
  const to = formatHour((hour + 1) % 24);
  // "5–6 PM" when both ends share AM/PM, else "11 AM–12 PM".
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

/**
 * Usual busyness by hour. Tap a bar, or drag across them, to read how full
 * the room usually is then and how many people that is.
 */
export function HourChart({ stats, firstHour, title }: { stats: (HourStat | null)[]; firstHour: number; title: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const bars = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const max = Math.max(50, ...stats.map((s) => s?.pct ?? 0));

  const indexAt = (clientX: number) => {
    const box = bars.current?.getBoundingClientRect();
    if (!box) return null;
    const i = Math.floor(((clientX - box.left) / box.width) * stats.length);
    return Math.min(stats.length - 1, Math.max(0, i));
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    const i = indexAt(e.clientX);
    // Tapping the bar that's already showing hides the numbers again.
    setPicked((p) => (i === p && e.pointerType !== "mouse" ? null : i));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current && e.pointerType !== "mouse") return;
    setPicked(indexAt(e.clientX));
  };
  const stop = () => {
    dragging.current = false;
  };

  const stat = picked == null ? null : stats[picked];
  const level = stat ? busyLevel(stat.pct) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-10 flex-col justify-center" aria-live="polite">
        {picked == null ? (
          <span className="text-[13px] text-faint">Tap or drag across the bars to see the numbers</span>
        ) : stat ? (
          <>
            <span className="text-[15px] leading-tight">
              <span className="font-semibold text-muted">{hourRange(firstHour + picked)}</span>
              {" · "}
              <span className={cx("font-bold", level && TEXT[level])}>{stat.pct}% full</span>
            </span>
            <span className="text-xs text-muted">
              About {stat.people} of {stat.capacity} people · average of {stat.n} {stat.n === 1 ? "count" : "counts"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[15px] leading-tight font-semibold text-muted">{hourRange(firstHour + picked)}</span>
            <span className="text-xs text-faint">No counts saved for this hour yet</span>
          </>
        )}
      </div>

      <div
        ref={bars}
        className="flex h-20 cursor-pointer touch-pan-y items-end gap-[3px] select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={(e) => {
          stop();
          if (e.pointerType === "mouse") setPicked(null);
        }}
        role="group"
        aria-label={`${title} by hour`}
      >
        {stats.map((s, i) => {
          const lvl = busyLevel(s?.pct ?? null);
          return (
            <button
              key={i}
              type="button"
              tabIndex={0}
              aria-label={`${hourRange(firstHour + i)}: ${s ? `${s.pct}% full, about ${s.people} people` : "no counts yet"}`}
              aria-pressed={picked === i}
              onFocus={() => setPicked(i)}
              className={cx(
                "flex-1 rounded-t-[3px] transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-accent",
                lvl ? BAR[lvl] : "bg-line",
                picked != null && picked !== i && "opacity-35",
              )}
              style={{ height: s == null ? "3px" : `${Math.max(6, (s.pct / max) * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-faint">
        {[5, 8, 11, 14, 17, 20, 23].map((h) => (
          <span key={h}>{formatHour(h).replace(" ", "").toLowerCase()}</span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-muted">
        {LEGEND.map(({ level: l, label }) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={cx("size-2 rounded-full", BAR[l])} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
