"use client";

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import { formatNumber } from "@/lib/format";

export type ChartPoint = {
  label: string;
  estMax: number;
  heaviest: number;
  bestSet: number;
  volume: number;
  maxReps: number;
  totalReps: number;
};

const METRICS = {
  estMax: { chip: "Est. max", title: "Estimated 1-rep max", unit: " lb" },
  heaviest: { chip: "Heaviest", title: "Heaviest weight", unit: " lb" },
  bestSet: { chip: "Best set", title: "Best set (weight × reps)", unit: " lb" },
  volume: { chip: "Volume", title: "Session volume", unit: " lb" },
  maxReps: { chip: "Best set", title: "Most reps in a set", unit: " reps" },
  totalReps: { chip: "Total reps", title: "Total reps in a session", unit: " reps" },
} as const;

type Metric = keyof typeof METRICS;

export function ExerciseChart({ points, bodyweight }: { points: ChartPoint[]; bodyweight: boolean }) {
  const available: Metric[] = bodyweight ? ["maxReps", "totalReps"] : ["estMax", "heaviest", "bestSet", "volume"];
  const [metric, setMetric] = useState<Metric>(available[0]);
  const m = METRICS[metric];
  const values = points.map((p) => p[metric]);
  const last = values[values.length - 1];
  const first = values[0];
  const delta = last - first;
  const labels =
    points.length >= 3
      ? [points[0].label, points[Math.floor(points.length / 2)].label, points[points.length - 1].label]
      : points.map((p) => p.label);

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-muted">{m.title}</span>
          <span className="tabular font-display text-5xl leading-[1.05] font-semibold tracking-[-2px]">
            {formatNumber(last)}
            <span className="font-sans text-lg font-semibold tracking-normal text-muted">{m.unit}</span>
          </span>
          {points.length > 1 ? (
            <span className={`text-[13px] font-bold ${delta > 0 ? "text-good" : delta < 0 ? "text-warn" : "text-muted"}`}>
              {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
              {formatNumber(Math.abs(delta))}
              {m.unit} since {points[0].label}
            </span>
          ) : (
            <span className="text-[13px] text-muted">Your first session. The line starts here.</span>
          )}
        </div>
        <span className="pt-1 text-[13px] text-muted">{points.length} sessions</span>
      </div>
      <LineChart values={values} labels={labels} ariaLabel={`${m.title} over ${points.length} sessions, from ${formatNumber(first)} to ${formatNumber(last)}`} />
      <div role="group" aria-label="What to chart" className={`grid gap-1.5 ${available.length === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
        {available.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={metric === k}
            onClick={() => setMetric(k)}
            className={`h-9 rounded-[10px] text-[13px] font-semibold ${metric === k ? "bg-ink text-dark" : "bg-inner text-ink"}`}
          >
            {METRICS[k].chip}
          </button>
        ))}
      </div>
    </section>
  );
}
