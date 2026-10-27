"use client";

import { useMemo, useState, useTransition } from "react";
import { createExercise } from "@/app/actions";
import { EQUIPMENT, MUSCLES } from "@/lib/db/exercise-library";
import type { ExerciseOption } from "@/lib/workout-types";
import { SearchIcon } from "./icons";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Full-screen sheet for picking (or creating) an exercise. */
export function ExercisePicker({
  options,
  onPick,
  onClose,
}: {
  options: ExerciseOption[];
  onPick: (exercise: ExerciseOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [equipment, setEquipment] = useState<string>("barbell");
  const [primary, setPrimary] = useState<string>("chest");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => (!muscle || o.primaryMuscle === muscle) && (!q || o.name.toLowerCase().includes(q)),
    );
  }, [options, query, muscle]);

  const create = () => {
    setError(null);
    startTransition(async () => {
      try {
        onPick(await createExercise({ name: query, equipment, primaryMuscle: primary }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't create that exercise.");
      }
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Add exercise" className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-hidden px-[18px] pt-[max(calc(env(safe-area-inset-top)+28px),16px)]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="h-11 text-[15px] font-semibold text-accent">
            Cancel
          </button>
          <h2 className="font-display text-lg font-semibold">Add exercise</h2>
          <span className="w-14" />
        </div>

        <label className="flex h-12 items-center gap-2 rounded-2xl bg-inner px-3.5">
          <SearchIcon size={18} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCreating(false);
            }}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          />
        </label>

        <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1" role="group" aria-label="Muscle">
          <button type="button" className="chip" aria-pressed={muscle == null} onClick={() => setMuscle(null)}>
            All
          </button>
          {MUSCLES.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
              {label(m)}
            </button>
          ))}
        </div>

        <div className="-mx-[18px] flex-1 overflow-y-auto px-[18px] pb-[max(env(safe-area-inset-bottom),24px)]">
          {query.trim() && !creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mb-2 flex h-12 w-full items-center rounded-2xl border border-dashed border-dash px-4 text-left text-[15px] font-semibold text-accent"
            >
              + Create “{query.trim()}”
            </button>
          ) : null}

          {creating ? (
            <div className="mb-3 flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
              <span className="font-semibold">New exercise: {query.trim()}</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[13px] text-muted">
                  Equipment
                  <select
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                    className="h-11 rounded-xl border border-line-strong bg-inner px-2 text-[15px] text-ink"
                  >
                    {EQUIPMENT.map((e) => (
                      <option key={e} value={e}>
                        {label(e)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-muted">
                  Main muscle
                  <select
                    value={primary}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="h-11 rounded-xl border border-line-strong bg-inner px-2 text-[15px] text-ink"
                  >
                    {MUSCLES.map((m) => (
                      <option key={m} value={m}>
                        {label(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {error ? <p className="text-sm text-warn">{error}</p> : null}
              <button type="button" onClick={create} disabled={pending} className="btn-primary">
                {pending ? "Adding…" : "Add exercise"}
              </button>
            </div>
          ) : null}

          <ul>
            {results.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="flex min-h-14 w-full flex-col justify-center gap-0.5 border-b border-line py-2 text-left"
                >
                  <span className="text-[15px] font-semibold">{o.name}</span>
                  <span className="text-[13px] text-muted">
                    {label(o.primaryMuscle)} · {label(o.equipment)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {results.length === 0 && !query.trim() ? (
            <p className="py-6 text-center text-sm text-muted">Nothing here yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
