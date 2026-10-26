"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logMeasurements } from "@/app/goal-actions";
import { MEASUREMENTS } from "@/lib/body";

export function MeasurementForm({ last }: { last: Record<string, number | null> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const parsed = Object.fromEntries(
          Object.entries(values)
            .map(([k, v]) => [k, Number.parseFloat(v)] as const)
            .filter(([, v]) => Number.isFinite(v) && v > 0),
        );
        start(async () => {
          try {
            await logMeasurements(parsed);
            router.push("/goals");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <section className="flex flex-col divide-y divide-line rounded-3xl border border-line bg-card">
        {MEASUREMENTS.map((m) => (
          <label key={m.key} className="flex items-center gap-3 px-5 py-2.5">
            <span className="flex-1 text-[15px]">{m.label}</span>
            <input
              inputMode="decimal"
              value={values[m.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
              placeholder={last[m.key] != null ? last[m.key]!.toFixed(1) : "—"}
              className="tabular h-10 w-20 rounded-xl border border-line-strong bg-inner px-2 text-right text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-faint focus:border-accent"
            />
            <span className="w-5 text-sm text-muted">in</span>
          </label>
        ))}
      </section>
      {error ? <p className="text-sm font-semibold text-warn">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save measurements"}
      </button>
    </form>
  );
}
