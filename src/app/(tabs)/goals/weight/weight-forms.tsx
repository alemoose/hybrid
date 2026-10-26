"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMeasurement, deleteWeight, saveBodyGoal } from "@/app/goal-actions";
import { CloseIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { defaultPace, pacesFor } from "@/lib/body";

export function GoalWeightForm({
  goalWeight,
  pace,
  currentWeight,
}: {
  goalWeight: number | null;
  pace: number;
  currentWeight: number | null;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState(goalWeight != null ? String(goalWeight) : "");
  const [p, setP] = useState(pace);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await saveBodyGoal({ goalWeight: Number.parseFloat(weight), pace: p });
            router.push("/goals");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <label className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold">Goal weight</span>
        <span className="flex items-center gap-2 rounded-xl border border-line-strong bg-inner px-3">
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              const next = Number.parseFloat(e.target.value);
              const goal = Number.isFinite(next) ? next : null;
              if (!pacesFor(currentWeight, goal).some((o) => o.value === p)) setP(defaultPace(currentWeight, goal));
            }}
            className="tabular h-11 w-20 bg-transparent text-right text-[17px] font-semibold outline-none"
          />
          <span className="text-sm text-muted">lb</span>
        </span>
      </label>
      <div role="group" aria-label="Pace" className="grid grid-cols-2 gap-2">
        {pacesFor(currentWeight, Number.isFinite(Number.parseFloat(weight)) ? Number.parseFloat(weight) : null).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={p === option.value}
            onClick={() => setP(option.value)}
            className={cx(
              "flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left",
              p === option.value ? "border-ink bg-ink text-dark" : "border-line-strong bg-inner",
            )}
          >
            <span className="text-sm font-bold">{option.label}</span>
            <span className={cx("text-xs", p === option.value ? "text-dark/70" : "text-muted")}>{option.detail}</span>
          </button>
        ))}
      </div>
      {error ? <p className="text-sm font-semibold text-warn">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save goal"}
      </button>
    </form>
  );
}

export function DeleteButton({ id, kind }: { id: number; kind: "weight" | "measurement" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Delete entry"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this entry?")) return;
        start(() => (kind === "weight" ? deleteWeight(id) : deleteMeasurement(id)));
      }}
      className="flex size-9 items-center justify-center rounded-full text-muted disabled:opacity-40"
    >
      <CloseIcon size={16} />
    </button>
  );
}
