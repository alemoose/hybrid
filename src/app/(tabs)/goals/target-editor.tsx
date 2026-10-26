"use client";

import { useState, useTransition } from "react";
import { addTarget, removeTarget, type TargetInput } from "@/app/goal-actions";
import { ExercisePicker } from "@/components/exercise-picker";
import { CloseIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { MEASUREMENTS } from "@/lib/body";
import type { ExerciseOption } from "@/lib/workout-types";

export type TargetView = { id: number; label: string; now: string; goal: string };

type Kind = TargetInput["kind"];

export function TargetEditor({
  group,
  targets,
  options,
  kinds,
}: {
  group: TargetInput["group"];
  targets: TargetView[];
  options: ExerciseOption[];
  kinds: Kind[];
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [measure, setMeasure] = useState<string>("waist");
  const [exercise, setExercise] = useState<ExerciseOption | null>(null);
  const [metric, setMetric] = useState<"estMax" | "maxReps">("estMax");
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setKind(null);
    setExercise(null);
    setValue("");
    setError(null);
  };

  const submit = () => {
    const targetValue = Number.parseFloat(value);
    if (!Number.isFinite(targetValue) || !kind) {
      setError("Enter a target number.");
      return;
    }
    let key = "";
    if (kind === "measurement") key = measure;
    else if (kind === "ratio") key = "shoulders/waist";
    else if (exercise) key = `${exercise.id}:${metric}`;
    else {
      setError("Pick an exercise.");
      return;
    }
    start(async () => {
      try {
        await addTarget({ group, kind, key, targetValue });
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add that.");
      }
    });
  };

  const unit = kind === "measurement" ? "in" : kind === "ratio" ? "ratio" : metric === "maxReps" ? "reps" : "lb";
  const KIND_LABEL: Record<Kind, string> = { ratio: "V-taper", measurement: "Measurement", lift: "Lift" };

  return (
    <section className="flex flex-col gap-3">
      {targets.length > 0 ? (
        <ul className="flex flex-col rounded-3xl border border-line bg-card px-4">
          {targets.map((t, i) => (
            <li key={t.id} className={cx("flex min-h-14 items-center gap-3 py-2", i > 0 && "border-t border-line")}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{t.label}</span>
                <span className="tabular text-[13px] text-muted">
                  Now {t.now} → goal {t.goal}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${t.label}`}
                disabled={pending}
                onClick={() => start(() => removeTarget(t.id))}
                className="flex size-9 items-center justify-center rounded-full text-muted"
              >
                <CloseIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {kind == null ? (
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button key={k} type="button" className="chip" onClick={() => (k === "lift" ? setPicking(true) : setKind(k))}>
              + {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">
              {kind === "ratio"
                ? "V-taper (shoulders ÷ waist)"
                : kind === "measurement"
                  ? "Measurement goal"
                  : (exercise?.name ?? "Lift")}
            </span>
            <button type="button" onClick={reset} className="text-sm font-semibold text-muted">
              Cancel
            </button>
          </div>
          {kind === "ratio" ? (
            <p className="text-[13px] leading-relaxed text-muted">
              Broad shoulders over a narrow waist. Around 1.6 is the classic “V” look. Needs shoulder and waist measurements.
            </p>
          ) : null}
          {kind === "measurement" ? (
            <div className="flex flex-wrap gap-2">
              {MEASUREMENTS.map((m) => (
                <button key={m.key} type="button" className="chip" aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}
          {kind === "lift" ? (
            <div role="group" aria-label="Measure by" className="grid grid-cols-2 gap-1.5">
              {(["estMax", "maxReps"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                  className={cx("h-10 rounded-xl text-[13px] font-semibold", metric === m ? "bg-ink text-dark" : "bg-inner")}
                >
                  {m === "estMax" ? "Est. 1-rep max" : "Reps in one set"}
                </button>
              ))}
            </div>
          ) : null}
          <label className="flex items-center justify-between gap-3">
            <span className="text-[15px]">Target</span>
            <span className="flex items-center gap-2 rounded-xl border border-line-strong bg-inner px-3">
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kind === "ratio" ? "1.60" : "0"}
                className="tabular h-11 w-20 bg-transparent text-right text-[17px] font-semibold outline-none placeholder:text-faint"
              />
              <span className="text-sm text-muted">{unit}</span>
            </span>
          </label>
          {error ? <p className="text-sm font-semibold text-warn">{error}</p> : null}
          <button type="button" disabled={pending} onClick={submit} className="btn-primary">
            {pending ? "Adding…" : "Add goal"}
          </button>
        </div>
      )}

      {picking ? (
        <ExercisePicker
          options={options}
          onClose={() => setPicking(false)}
          onPick={(o) => {
            setPicking(false);
            setExercise(o);
            setMetric(o.equipment === "bodyweight" ? "maxReps" : "estMax");
            setKind("lift");
          }}
        />
      ) : null}
    </section>
  );
}
