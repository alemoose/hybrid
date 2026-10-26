"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRoutine, saveRoutine } from "@/app/actions";
import { ExercisePicker } from "@/components/exercise-picker";
import { DownIcon, TrashIcon, UpIcon } from "@/components/icons";
import { defaultIncrement } from "@/lib/db/exercise-library";
import { newId } from "@/lib/draft-storage";
import { formatWeight } from "@/lib/training";
import type { RoutineExerciseDetail } from "@/lib/queries";
import type { ExerciseOption } from "@/lib/workout-types";

type Item = RoutineExerciseDetail & { key: string };

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  format = String,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">{label}</span>
      <div className="flex items-center rounded-xl border border-line-strong">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
          className="size-9 text-lg font-semibold"
        >
          −
        </button>
        <span className="tabular min-w-9 text-center text-[15px] font-bold">{format(value)}</span>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
          className="size-9 text-lg font-semibold"
        >
          +
        </button>
      </div>
    </div>
  );
}

const restText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);

export function RoutineEditor({
  routineId,
  initialName,
  initialExercises,
  options,
}: {
  routineId: number | null;
  initialName: string;
  initialExercises: RoutineExerciseDetail[];
  options: ExerciseOption[];
}) {
  const [name, setName] = useState(initialName);
  const [items, setItems] = useState<Item[]>(() => initialExercises.map((e) => ({ ...e, key: newId() })));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const j = index + dir;
      if (j < 0 || j >= next.length) return list;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await saveRoutine({
          id: routineId,
          name,
          exercises: items.map(({ exerciseId, targetSets, targetReps, increment, restSeconds }) => ({
            exerciseId,
            targetSets,
            targetReps,
            increment,
            restSeconds,
          })),
        });
        router.push("/gym");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the routine.");
      }
    });
  };

  return (
    <>
      <label className="flex flex-col gap-2 px-1">
        <span className="text-sm font-semibold text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Push Day"
          className="h-13 rounded-2xl border border-line-strong bg-card px-4 text-[17px] font-semibold outline-none focus:border-accent"
        />
      </label>

      {items.map((item, i) => (
        <section key={item.key} className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-base font-bold">{item.name}</span>
            <button
              type="button"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="flex size-9 items-center justify-center rounded-full border border-line-strong disabled:opacity-30"
            >
              <UpIcon size={16} />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
              className="flex size-9 items-center justify-center rounded-full border border-line-strong disabled:opacity-30"
            >
              <DownIcon size={16} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))}
              className="flex size-9 items-center justify-center rounded-full border border-line-strong text-warn"
            >
              <TrashIcon size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-3">
            <Stepper label="Sets" value={item.targetSets} step={1} min={1} max={12} onChange={(v) => patch(item.key, { targetSets: v })} />
            <Stepper label="Reps" value={item.targetReps} step={1} min={1} max={50} onChange={(v) => patch(item.key, { targetReps: v })} />
            <Stepper
              label="Add lb"
              value={item.increment}
              step={2.5}
              min={0}
              max={50}
              format={(v) => (v === 0 ? "reps" : formatWeight(v))}
              onChange={(v) => patch(item.key, { increment: v })}
            />
            <Stepper label="Rest" value={item.restSeconds} step={15} min={0} max={600} format={restText} onChange={(v) => patch(item.key, { restSeconds: v })} />
          </div>
        </section>
      ))}

      <button type="button" onClick={() => setPicking(true)} className="btn-outline h-12 border-dashed">
        + Add exercise
      </button>
      <p className="px-1 text-[13px] leading-relaxed text-muted">
        When you hit every rep on every set, the next workout suggests adding the “Add lb” amount. Set it to
        “reps” for bodyweight moves.
      </p>

      {error ? <p className="px-1 text-sm font-semibold text-warn">{error}</p> : null}
      <button type="button" onClick={save} disabled={pending} className="btn-primary h-14 text-base">
        {pending ? "Saving…" : "Save routine"}
      </button>
      {routineId != null ? (
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this routine? Past workouts stay in your history.")) {
              startTransition(async () => {
                await deleteRoutine(routineId);
                router.push("/gym");
              });
            }
          }}
          className="h-11 text-sm font-semibold text-warn"
        >
          Delete routine
        </button>
      ) : null}

      {picking ? (
        <ExercisePicker
          options={options}
          onClose={() => setPicking(false)}
          onPick={(o) => {
            setPicking(false);
            setItems((list) => [
              ...list,
              {
                key: newId(),
                exerciseId: o.id,
                name: o.name,
                equipment: o.equipment,
                targetSets: 3,
                targetReps: 8,
                increment: defaultIncrement(o.equipment),
                restSeconds: 120,
              },
            ]);
          }}
        />
      ) : null}
    </>
  );
}
