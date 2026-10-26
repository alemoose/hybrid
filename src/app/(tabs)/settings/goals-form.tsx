"use client";

import { useActionState } from "react";
import { updateGoals } from "@/app/food-actions";
import type { Goals } from "@/lib/nutrition";

const FIELDS: { name: keyof Goals; label: string; unit: string; hint?: string }[] = [
  { name: "calories", label: "Calories", unit: "kcal" },
  { name: "protein", label: "Protein", unit: "g" },
  { name: "carbs", label: "Carbs", unit: "g" },
  { name: "fat", label: "Fat", unit: "g" },
  { name: "sodium", label: "Sodium", unit: "mg", hint: "US guideline is 2,300" },
  { name: "sodiumWorkoutBonus", label: "Extra sodium on training days", unit: "mg", hint: "For what you sweat out" },
  { name: "bodyWeight", label: "Body weight", unit: "lb", hint: "Sets your water baseline" },
  { name: "waterOverride", label: "Fixed water goal", unit: "oz", hint: "0 = work it out for me" },
];

export function GoalsForm({ goals }: { goals: Goals }) {
  const [state, action, pending] = useActionState(updateGoals, { saved: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <section className="flex flex-col divide-y divide-line rounded-3xl border border-line bg-card">
        {FIELDS.map((f) => (
          <label key={f.name} className="flex items-center gap-3 px-5 py-3">
            <span className="flex flex-1 flex-col">
              <span className="text-[15px]">{f.label}</span>
              {f.hint ? <span className="text-xs text-muted">{f.hint}</span> : null}
            </span>
            <input
              name={f.name}
              inputMode="numeric"
              defaultValue={String(goals[f.name])}
              className="tabular h-10 w-20 rounded-xl border border-line-strong bg-inner px-2 text-right text-[15px] font-semibold outline-none focus:border-accent"
            />
            <span className="w-8 text-sm text-muted">{f.unit}</span>
          </label>
        ))}
        <label className="flex items-center gap-3 px-5 py-3">
          <span className="flex flex-1 flex-col">
            <span className="text-[15px]">Where you eat</span>
            <span className="text-xs text-muted">Helps identify local restaurants</span>
          </span>
          <input
            name="homeArea"
            defaultValue={goals.homeArea}
            placeholder="City, State"
            className="h-10 w-40 rounded-xl border border-line-strong bg-inner px-2 text-right text-[15px] font-semibold outline-none focus:border-accent"
          />
        </label>
      </section>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : state.saved ? "Saved ✓" : "Save goals"}
      </button>
    </form>
  );
}
