"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadExercisePlan, saveWorkout } from "@/app/actions";
import { ExercisePicker } from "@/components/exercise-picker";
import { CheckIcon, DownIcon, MoreIcon } from "@/components/icons";
import { ReminderCard } from "@/components/reminder-card";
import { Pill, cx } from "@/components/ui";
import { clearDraft, newId, readDraft, writeDraft } from "@/lib/draft-storage";
import { changeTone, formatNumber } from "@/lib/format";
import { hasReminders, pickReminder, type Reminders } from "@/lib/reminders";
import { formVideoUrl, formatWeight, type SetKind } from "@/lib/training";
import type { DraftExercise, DraftSet, ExerciseOption, WorkoutDraft } from "@/lib/workout-types";

type Props = { plan: WorkoutDraft; exerciseOptions: ExerciseOption[]; intent: "start" | "resume"; reminders: Reminders };

const KIND_CYCLE: SetKind[] = ["working", "warmup", "drop", "failure"];
const WARMUP_REST = 60;

function initialState({ plan, intent }: Props): { draft: WorkoutDraft | null; conflict: WorkoutDraft | null } {
  const saved = readDraft();
  if (intent === "resume") return { draft: saved, conflict: null };
  if (saved) return { draft: null, conflict: saved };
  return { draft: { ...plan, startedAt: Date.now() }, conflict: null };
}

function parseWeight(v: string): number {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseReps(v: string): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Keep the screen on while a workout is open (iOS 16.4+, Chrome). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Not supported or denied: the workout still works.
      }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** A short double beep plus a buzz where supported. Audio unlocks on the first tap. */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    if (!ctx.current && typeof AudioContext !== "undefined") ctx.current = new AudioContext();
    ctx.current?.resume().catch(() => {});
  }, []);
  const play = useCallback(() => {
    navigator.vibrate?.([200, 100, 200]);
    const ac = ctx.current;
    if (!ac) return;
    for (const offset of [0, 0.22]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ac.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + offset + 0.16);
      osc.connect(gain).connect(ac.destination);
      osc.start(ac.currentTime + offset);
      osc.stop(ac.currentTime + offset + 0.18);
    }
  }, []);
  return { unlock, play };
}

export default function ActiveWorkout(props: Props) {
  const router = useRouter();
  const [{ draft, conflict }, setState] = useState(() => initialState(props));
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderHidden, setReminderHidden] = useState(false);
  const [saving, startSaving] = useTransition();
  const [, startAdding] = useTransition();
  const now = useNow(500);
  const chime = useChime();
  const chimedFor = useRef<number | null>(null);
  useWakeLock();

  useEffect(() => {
    if (draft) writeDraft(draft);
  }, [draft]);

  // Once started, drop ?routine= so a reload resumes instead of asking to start over.
  const started = draft != null;
  useEffect(() => {
    if (started && location.search) window.history.replaceState(null, "", "/workout");
  }, [started]);

  useEffect(() => {
    if (!draft && !conflict) router.replace("/gym");
  }, [draft, conflict, router]);

  const restLeft = rest ? rest.endsAt - now : 0;
  useEffect(() => {
    if (rest && restLeft <= 0 && chimedFor.current !== rest.endsAt) {
      chimedFor.current = rest.endsAt;
      chime.play();
    }
  }, [rest, restLeft, chime]);

  const update = (fn: (d: WorkoutDraft) => WorkoutDraft) =>
    setState((s) => (s.draft ? { ...s, draft: fn(s.draft) } : s));

  const updateExercise = (key: string, fn: (e: DraftExercise) => DraftExercise) =>
    update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

  const updateSet = (exKey: string, setId: string, patch: Partial<DraftSet>) =>
    updateExercise(exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

  if (conflict) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-[18px]">
        <h1 className="font-display text-2xl font-semibold">You have a workout in progress</h1>
        <p className="text-[15px] text-ink-2">
          {conflict.name}, started {clock(now - conflict.startedAt)} ago.
        </p>
        <button type="button" className="btn-primary" onClick={() => setState({ draft: conflict, conflict: null })}>
          Resume {conflict.name}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            clearDraft();
            setState({ draft: { ...props.plan, startedAt: Date.now() }, conflict: null });
          }}
        >
          Discard it and start {props.plan.name}
        </button>
      </main>
    );
  }
  if (!draft) return null;

  const doneSets = draft.exercises.flatMap((e) => e.sets.filter((s) => s.done));
  const totalSets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const volume = doneSets
    .filter((s) => s.kind === "working" || s.kind === "failure")
    .reduce((t, s) => t + parseWeight(s.weight) * parseReps(s.reps), 0);

  // A reminder of her when the workout opens (until the first set), and a different note each rest.
  const { reminders } = props;
  const herLabel = reminders.name ? `Why ${reminders.name}` : "Remember";
  const startReminder =
    hasReminders(reminders) && !reminderHidden && doneSets.length === 0 ? pickReminder(reminders, `workout:${draft.startedAt}`) : null;
  const restNote = rest && reminders.notes.length ? pickReminder({ ...reminders, photoIds: [] }, `rest:${rest.endsAt}`).note : null;

  const toggleDone = (ex: DraftExercise, set: DraftSet) => {
    chime.unlock();
    if (!set.done && parseReps(set.reps) === 0) {
      setError("Enter reps before checking off a set.");
      return;
    }
    setError(null);
    updateSet(ex.key, set.id, { done: !set.done });
    if (!set.done) {
      const seconds = set.kind === "warmup" ? Math.min(WARMUP_REST, ex.restSeconds) : ex.restSeconds;
      if (seconds > 0) setRest({ endsAt: Date.now() + seconds * 1000, total: seconds * 1000 });
    }
  };

  const addSet = (ex: DraftExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    updateExercise(ex.key, (e) => ({
      ...e,
      sets: [
        ...e.sets,
        {
          id: newId(),
          kind: last?.kind === "warmup" ? "working" : (last?.kind ?? "working"),
          weight: last?.weight ?? "",
          reps: last?.reps ?? "",
          done: false,
        },
      ],
    }));
  };

  const moveExercise = (key: string, dir: -1 | 1) =>
    update((d) => {
      const list = [...d.exercises];
      const i = list.findIndex((e) => e.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, exercises: list };
    });

  const addExercise = (option: ExerciseOption) => {
    setPicking(false);
    startAdding(async () => {
      const planned = await loadExercisePlan(option.id).catch(() => null);
      const ex: DraftExercise = planned ?? {
        key: newId(),
        exerciseId: option.id,
        name: option.name,
        equipment: option.equipment,
        restSeconds: 120,
        suggestion: null,
        prevSets: [],
        sets: [1, 2, 3].map(() => ({ id: newId(), kind: "working", weight: "", reps: "", done: false })),
      };
      update((d) => ({ ...d, exercises: [...d.exercises, ex] }));
    });
  };

  const finish = () => {
    if (doneSets.length === 0) {
      setError("Check off at least one set to save this workout.");
      return;
    }
    const unfinished = totalSets - doneSets.length;
    if (unfinished > 0 && !confirm(`${unfinished} unchecked set${unfinished === 1 ? "" : "s"} won't be saved. Finish anyway?`)) {
      return;
    }
    startSaving(async () => {
      try {
        const { id } = await saveWorkout({
          routineId: draft.routineId,
          name: draft.name,
          startedAt: draft.startedAt,
          finishedAt: Date.now(),
          exercises: draft.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets
              .filter((s) => s.done)
              .map((s) => ({ kind: s.kind, weight: parseWeight(s.weight), reps: parseReps(s.reps) })),
          })),
        });
        clearDraft();
        router.replace(`/gym/history/${id}?finished=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save. Your workout is still here, try again.");
      }
    });
  };

  const discard = () => {
    if (!confirm("Discard this workout? Nothing will be saved.")) return;
    clearDraft();
    router.replace("/gym");
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3.5 px-[18px] pt-[max(calc(env(safe-area-inset-top)+28px),16px)] pb-[max(env(safe-area-inset-bottom),32px)]">
      <header className="sticky top-[env(safe-area-inset-top)] z-10 -mx-[18px] flex items-center gap-3 bg-bg/95 px-[18px] pt-1 pb-2 backdrop-blur">
        <Link href="/" aria-label="Minimize workout" className="circle-btn">
          <DownIcon size={18} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <h1 className="truncate font-display text-[22px] font-semibold tracking-[-0.5px]">{draft.name}</h1>
          <span className="tabular text-[13px] text-muted">
            {clock(now - draft.startedAt)} · {formatNumber(volume)} lb · {doneSets.length} of {totalSets} sets
          </span>
        </div>
        <button type="button" onClick={finish} disabled={saving} className="btn-primary h-10 rounded-xl px-[18px]">
          {saving ? "Saving…" : "Finish"}
        </button>
      </header>

      {rest ? (
        <section aria-label="Rest timer" className="sticky top-[calc(env(safe-area-inset-top)+68px)] z-10 flex items-center gap-3 rounded-[18px] bg-inner px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-muted">{restLeft > 0 ? "Rest" : "Rest done"}</span>
              <span className={cx("tabular font-display text-[26px] leading-none font-semibold", restLeft <= 0 && "text-good")}>
                {clock(restLeft)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-inner-2">
              <div
                className="h-full rounded-full bg-cobalt"
                style={{ width: `${Math.max(0, Math.min(100, (restLeft / rest.total) * 100))}%` }}
              />
            </div>
            {restNote ? <p className="line-clamp-2 text-[13px] leading-snug text-rose">{restNote}</p> : null}
          </div>
          <button
            type="button"
            className="btn-outline h-10 rounded-xl px-3 text-sm"
            onClick={() => setRest((r) => (r ? { endsAt: Math.max(Date.now(), r.endsAt) + 15_000, total: r.total + 15_000 } : r))}
          >
            +15s
          </button>
          <button type="button" className="btn-outline h-10 rounded-xl px-3 text-sm" onClick={() => setRest(null)}>
            {restLeft > 0 ? "Skip" : "Done"}
          </button>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-2xl bg-p-pink px-4 py-3 text-sm font-semibold text-tile-ink">
          {error}
        </p>
      ) : null}

      {startReminder ? <ReminderCard label={herLabel} {...startReminder} onClose={() => setReminderHidden(true)} /> : null}

      {draft.exercises.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-dash p-6 text-center text-[15px] text-muted">
          Add your first exercise to get going.
        </p>
      ) : null}

      {draft.exercises.map((ex, exIndex) => {
        let working = 0;
        return (
          <section key={ex.key} className="flex flex-col gap-2.5 rounded-3xl border border-line bg-card px-3.5 pt-4 pb-3">
            <div className="relative flex items-center gap-2 px-1">
              <h2 className="flex-1 text-[17px] font-bold">{ex.name}</h2>
              <a
                href={formVideoUrl(ex.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Form videos for ${ex.name}`}
                className="shrink-0 text-[13px] font-semibold text-accent"
              >
                How to
              </a>
              <button
                type="button"
                aria-label={`Options for ${ex.name}`}
                aria-expanded={menuFor === ex.key}
                onClick={() => setMenuFor(menuFor === ex.key ? null : ex.key)}
                className="flex size-9 items-center justify-center rounded-full text-muted"
              >
                <MoreIcon size={20} />
              </button>
              {menuFor === ex.key ? (
                <div className="absolute top-10 right-0 z-20 flex w-48 flex-col overflow-hidden rounded-2xl border border-line-strong bg-inner text-[15px] shadow-xl">
                  {[
                    { label: "Move up", disabled: exIndex === 0, run: () => moveExercise(ex.key, -1) },
                    { label: "Move down", disabled: exIndex === draft.exercises.length - 1, run: () => moveExercise(ex.key, 1) },
                    {
                      label: "Remove last set",
                      disabled: ex.sets.length === 0,
                      run: () => updateExercise(ex.key, (e) => ({ ...e, sets: e.sets.slice(0, -1) })),
                    },
                    {
                      label: "Remove exercise",
                      danger: true,
                      run: () => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== ex.key) })),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        item.run();
                        setMenuFor(null);
                      }}
                      className={cx(
                        "h-11 border-b border-line px-4 text-left last:border-b-0 disabled:opacity-40",
                        item.danger ? "text-warn" : "",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {ex.suggestion ? (
              <div className="flex items-center gap-2.5 px-1">
                <Pill tone={changeTone(ex.suggestion.change)}>{ex.suggestion.label}</Pill>
                <span className="text-[13px] leading-snug text-muted">{ex.suggestion.reason}</span>
              </div>
            ) : ex.prevSets.length === 0 ? (
              <p className="px-1 text-[13px] text-muted">First time: pick a weight you can do for clean reps.</p>
            ) : null}

            <div className="grid grid-cols-[36px_minmax(0,1fr)_64px_52px_44px] items-center pt-0.5 text-center text-[11px] font-bold tracking-[0.08em] text-muted">
              <span>SET</span>
              <span className="pl-2 text-left">PREVIOUS</span>
              <span>LB</span>
              <span>REPS</span>
              <span />
            </div>

            <div className="flex flex-col gap-1">
              {ex.sets.map((set, i) => {
                if (set.kind === "working") working++;
                const labelText = set.kind === "warmup" ? "W" : set.kind === "drop" ? "D" : set.kind === "failure" ? "F" : String(working);
                const prev = ex.prevSets[i];
                const prevText = prev ? (prev.weight > 0 ? `${formatWeight(prev.weight)} × ${prev.reps}` : `${prev.reps} reps`) : "—";
                return (
                  <div
                    key={set.id}
                    className={cx(
                      "grid min-h-11 grid-cols-[36px_minmax(0,1fr)_64px_52px_44px] items-center rounded-xl text-center text-base",
                      set.done && "bg-good/13",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Set type: ${set.kind}. Tap to change`}
                      onClick={() =>
                        updateSet(ex.key, set.id, { kind: KIND_CYCLE[(KIND_CYCLE.indexOf(set.kind) + 1) % KIND_CYCLE.length] })
                      }
                      className={cx(
                        "h-11 font-bold",
                        set.kind === "warmup" && "text-gold",
                        set.kind === "drop" && "text-accent",
                        set.kind === "failure" && "text-warn",
                      )}
                    >
                      {labelText}
                    </button>
                    <span className="tabular truncate pl-2 text-left text-[13px] text-muted">{prevText}</span>
                    <input
                      aria-label={`Set ${labelText} weight in pounds`}
                      inputMode="decimal"
                      value={set.weight}
                      placeholder={ex.equipment === "bodyweight" ? "BW" : "0"}
                      onChange={(e) => updateSet(ex.key, set.id, { weight: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className={cx(
                        "tabular mx-1 h-9 rounded-lg bg-transparent text-center font-display font-semibold outline-none placeholder:text-faint focus:bg-inner",
                        set.done ? "text-ink" : "text-faint focus:text-ink",
                      )}
                    />
                    <input
                      aria-label={`Set ${labelText} reps`}
                      inputMode="numeric"
                      value={set.reps}
                      placeholder="0"
                      onChange={(e) => updateSet(ex.key, set.id, { reps: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className={cx(
                        "tabular mx-1 h-9 rounded-lg bg-transparent text-center font-display font-semibold outline-none placeholder:text-faint focus:bg-inner",
                        set.done ? "text-ink" : "text-faint focus:text-ink",
                      )}
                    />
                    <button
                      type="button"
                      aria-label={set.done ? `Undo set ${labelText}` : `Mark set ${labelText} done`}
                      aria-pressed={set.done}
                      onClick={() => toggleDone(ex, set)}
                      className={cx(
                        "flex size-[30px] items-center justify-center justify-self-center rounded-full",
                        set.done ? "bg-good text-dark" : "border-2 border-dash text-transparent",
                      )}
                    >
                      <CheckIcon size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => addSet(ex)} className="h-10 rounded-xl bg-inner text-sm font-semibold">
              + Add set
            </button>
          </section>
        );
      })}

      <button type="button" onClick={() => setPicking(true)} className="btn-outline h-12 border-dashed">
        + Add exercise
      </button>
      <button type="button" onClick={discard} className="h-11 text-sm font-semibold text-warn">
        Discard workout
      </button>

      {picking ? (
        <ExercisePicker options={props.exerciseOptions} onPick={addExercise} onClose={() => setPicking(false)} />
      ) : null}
    </main>
  );
}
