"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { applyProgram, designMyProgram } from "@/app/program-actions";
import { cx } from "@/components/ui";
import type { Program } from "@/lib/ai/program";
import type { ProgramDraft } from "@/lib/program-queries";

const DAYS = [3, 4, 5, 6];
const MINUTES = [45, 60, 75, 90];

export function ProgramDesigner({
  aiReady,
  hasGoal,
  photoId,
  draft,
  defaults,
}: {
  aiReady: boolean;
  hasGoal: boolean;
  photoId: number | null;
  draft: ProgramDraft | null;
  defaults: { daysPerWeek: number; minutes: number; note: string };
}) {
  const [days, setDays] = useState(defaults.daysPerWeek);
  const [minutes, setMinutes] = useState(defaults.minutes);
  const [note, setNote] = useState(defaults.note);
  const [program, setProgram] = useState<Program | null>(draft?.program ?? null);
  const [error, setError] = useState<string | null>(null);
  const [designing, startDesign] = useTransition();
  const [applying, startApply] = useTransition();

  const design = () =>
    startDesign(async () => {
      setError(null);
      const res = await designMyProgram({ daysPerWeek: days, minutes, note });
      if (res.ok) setProgram(res.program);
      else setError(res.error);
    });

  return (
    <>
      <section className="flex items-center gap-3.5 rounded-3xl border border-line bg-card p-3.5">
        {photoId ? (
          // eslint-disable-next-line @next/next/no-img-element -- private photo route
          <img src={`/photos/${photoId}`} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
        ) : null}
        <p className="flex-1 text-[13px] leading-relaxed text-muted">
          {hasGoal
            ? "Claude studies your inspiration photo, description and goal numbers, then builds routines that bring up the muscles that make that look, using your recent lifts."
            : "Add your physique goal first (a photo and a few words), so the program has something to aim at."}{" "}
          {!hasGoal ? (
            <Link href="/goals/physique" className="font-semibold text-accent">
              Set it up
            </Link>
          ) : null}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
        <Choice label="Days a week" options={DAYS} value={days} onChange={setDays} />
        <Choice label="Minutes a session" options={MINUTES} value={minutes} onChange={setMinutes} />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? e.g. left shoulder is cranky"
          aria-label="Anything else"
          className="h-11 rounded-xl border border-line-strong bg-inner px-3 text-[15px] outline-none placeholder:text-faint"
        />
      </section>

      {aiReady ? (
        <button type="button" disabled={designing || applying} onClick={design} className={cx("h-14 text-base", program ? "btn-outline" : "btn-primary")}>
          {designing ? "Designing your program…" : program ? "Design it again" : "Design my program"}
        </button>
      ) : (
        <p className="rounded-2xl bg-inner px-4 py-3 text-[13px] leading-relaxed text-muted">Program design switches on once ANTHROPIC_API_KEY is set.</p>
      )}
      {designing ? <p className="-mt-2 text-center text-[13px] text-muted">This takes about 30 seconds.</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-p-pink px-4 py-3 text-sm font-semibold text-tile-ink">
          {error}
        </p>
      ) : null}

      {program && !designing ? (
        <>
          <section className="flex flex-col gap-2.5 rounded-3xl border border-line bg-card p-5">
            <span className="text-[13px] font-semibold text-muted">The plan</span>
            <p className="text-[15px] leading-relaxed text-ink-2">{program.summary}</p>
            {program.focus.length ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {program.focus.map((f) => (
                  <span key={f} className="rounded-full bg-inner px-2.5 py-1 text-xs font-semibold text-ink-2">
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {program.days.map((d, i) => (
            <section key={i} className="flex flex-col rounded-3xl border border-line bg-card px-4 pt-3.5 pb-1">
              <h2 className="pb-1.5 text-[17px] font-bold">
                <span className="text-muted">{i + 1}.</span> {d.name}
              </h2>
              {d.exercises.map((e) => (
                <div key={e.exerciseId} className="flex items-baseline gap-3 border-t border-line py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold wrap-break-word">{e.name}</span>
                    {e.note ? <span className="text-xs text-muted">{e.note}</span> : null}
                  </span>
                  <span className="tabular shrink-0 text-[15px] font-bold">
                    {e.sets} × {e.reps}
                  </span>
                </div>
              ))}
            </section>
          ))}

          <button
            type="button"
            disabled={applying}
            onClick={() => {
              if (!confirm("Replace your current routines with this program? Your workout history stays.")) return;
              startApply(() => applyProgram());
            }}
            className="btn-primary h-14 text-base"
          >
            {applying ? "Setting it up…" : "Use this program"}
          </button>
          <p className="-mt-2 px-1 text-center text-[13px] text-muted">
            Your current routines are archived, not deleted. You can edit any day after.
          </p>
        </>
      ) : null}
    </>
  );
}

function Choice({ label, options, value, onChange }: { label: string; options: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-semibold">{label}</span>
      <div role="group" aria-label={label} className="flex gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className="chip h-9 min-w-11 justify-center px-3">
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
