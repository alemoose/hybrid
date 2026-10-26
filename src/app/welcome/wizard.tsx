"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { completeOnboarding, skipOnboarding } from "@/app/goal-actions";
import { cx } from "@/components/ui";
import { ACTIVITY, PACES, maintenanceCalories, suggestTargets, type Activity, type Profile, type Sex } from "@/lib/body";
import { formatNumber } from "@/lib/format";
import { resizeImage, type ResizedImage } from "@/lib/image";
import type { Goals } from "@/lib/nutrition";

type Initial = {
  profile: Profile | null;
  weight: number | null;
  goalWeight: number | null;
  pace: number;
  goals: Goals;
  physique: { title: string; subtitle: string; hasPhoto: boolean } | null;
  shoulders: number | null;
  waist: number | null;
  routineCount: number;
};

const STEPS = ["You", "Goal", "Food", "Water", "Training", "Physique"] as const;

const num = (s: string) => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-3 px-5 py-3">
      <span className="flex flex-1 flex-col">
        <span className="text-[15px]">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="tabular h-11 w-24 rounded-xl border border-line-strong bg-inner px-3 text-right text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-faint focus:border-accent"
      />
      {unit ? <span className="w-8 text-sm text-muted">{unit}</span> : null}
    </label>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <section className="flex flex-col divide-y divide-line rounded-3xl border border-line bg-card">{children}</section>;
}

function Choice({ selected, onClick, title, detail }: { selected: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex flex-col items-start rounded-2xl border px-4 py-3 text-left",
        selected ? "border-ink bg-ink text-dark" : "border-line-strong bg-card",
      )}
    >
      <span className="text-[15px] font-bold">{title}</span>
      <span className={cx("text-[13px]", selected ? "text-dark/70" : "text-muted")}>{detail}</span>
    </button>
  );
}

export function Wizard({ initial }: { initial: Initial }) {
  const router = useRouter();
  const g = initial.goals;
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  // You
  const [weight, setWeight] = useState(initial.weight != null ? String(initial.weight) : "");
  const [feet, setFeet] = useState(initial.profile ? String(Math.floor(initial.profile.heightIn / 12)) : "");
  const [inches, setInches] = useState(initial.profile ? String(Math.round(initial.profile.heightIn % 12)) : "");
  const [age, setAge] = useState(initial.profile ? String(initial.profile.age) : "");
  const [sex, setSex] = useState<Sex | null>(initial.profile?.sex ?? null);
  const [activity, setActivity] = useState<Activity>(initial.profile?.activity ?? "moderate");
  // Goal
  const [goalWeight, setGoalWeight] = useState(initial.goalWeight != null ? String(initial.goalWeight) : "");
  const [pace, setPace] = useState(initial.pace);
  // Food (null = follow the suggestion)
  const [food, setFood] = useState<Record<"calories" | "protein" | "carbs" | "fat", string> | null>(
    initial.profile ? { calories: String(g.calories), protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat) } : null,
  );
  const [sodium, setSodium] = useState(String(g.sodium));
  const [homeArea, setHomeArea] = useState(g.homeArea);
  // Water
  const [waterOverride, setWaterOverride] = useState(g.waterOverride ? String(g.waterOverride) : "");
  // Training
  const [starter, setStarter] = useState(initial.routineCount === 0);
  // Physique
  const [title, setTitle] = useState(initial.physique?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial.physique?.subtitle ?? "");
  const [photo, setPhoto] = useState<ResizedImage | null>(null);
  const [shoulders, setShoulders] = useState(initial.shoulders != null ? String(initial.shoulders) : "");
  const [waist, setWaist] = useState(initial.waist != null ? String(initial.waist) : "");
  const [ratioGoal, setRatioGoal] = useState("");
  const [waistGoal, setWaistGoal] = useState("");
  const [pullUpGoal, setPullUpGoal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const w = num(weight);
  const gw = num(goalWeight);
  const heightIn = (num(feet) ?? 0) * 12 + (num(inches) ?? 0);
  const a = num(age);
  const profileReady = w != null && heightIn >= 48 && a != null && sex != null;
  const profile: Profile | null = profileReady ? { sex: sex!, age: a!, heightIn, activity } : null;
  const suggestion = profile && w ? suggestTargets({ ...profile, weightLb: w, goalWeightLb: gw ?? w, pace }) : null;
  const maintenance = profile && w ? maintenanceCalories({ ...profile, weightLb: w }) : null;
  const foodValues = food ?? (suggestion ? { calories: String(suggestion.calories), protein: String(suggestion.protein), carbs: String(suggestion.carbs), fat: String(suggestion.fat) } : { calories: String(g.calories), protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat) });
  const setFoodField = (k: keyof typeof foodValues, v: string) => setFood({ ...foodValues, [k]: v });
  const paceConflict = w != null && gw != null && pace !== 0 && Math.sign(gw - w) !== Math.sign(pace) && Math.abs(gw - w) >= 1;
  const weeksToGoal = w != null && gw != null && pace !== 0 && Math.sign(gw - w) === Math.sign(pace) ? Math.round(Math.abs((gw - w) / pace)) : null;
  const waterBase = w ? Math.round(Math.max(48, w / 2) / 4) * 4 : 90;

  const canNext = [
    profileReady,
    gw != null && !paceConflict,
    num(foodValues.calories) != null,
    true,
    true,
    true,
  ];

  const finish = () => {
    if (!profile || w == null || gw == null) return;
    setError(null);
    start(async () => {
      try {
        await completeOnboarding({
          profile,
          weight: w,
          goalWeight: gw,
          pace,
          food: {
            calories: num(foodValues.calories) ?? g.calories,
            protein: num(foodValues.protein) ?? g.protein,
            carbs: num(foodValues.carbs) ?? g.carbs,
            fat: num(foodValues.fat) ?? g.fat,
          },
          sodium: num(sodium) ?? 2300,
          waterOverride: num(waterOverride) ?? 0,
          homeArea,
          starterRoutines: starter,
          physique:
            title.trim() || photo
              ? { title, subtitle, photo: photo ? { data: photo.data, mime: photo.mime, width: photo.width, height: photo.height } : null }
              : null,
          measurements: { shoulders: num(shoulders), waist: num(waist) },
          targets: { ratio: num(ratioGoal), waist: num(waistGoal), pullUps: num(pullUpGoal) },
        });
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      }
    });
  };

  if (step === -1) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
        <span className="text-sm font-semibold text-muted">Setup · about 2 minutes</span>
        <h1 className="font-display text-[44px] leading-[1.05] font-semibold tracking-[-1.5px]">Let&apos;s set your goals.</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          A few numbers about you, where you want to get, and how you like to train. Everything gets a sensible starting point
          you can change later in Settings.
        </p>
        <button type="button" onClick={() => setStep(0)} className="btn-primary h-14 text-base">
          Start
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            start(async () => {
              await skipOnboarding();
              router.push("/");
            })
          }
          className="h-11 text-sm font-semibold text-muted"
        >
          {initial.profile ? "Keep my current settings" : "Skip for now"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-[18px] pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-ink" : "bg-line-strong")} />
        ))}
      </div>
      <span className="px-1 text-sm font-semibold text-muted">
        {step + 1} of {STEPS.length} · {STEPS[step]}
      </span>

      {step === 0 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">About you</h1>
          <Group>
            <Field label="Current weight" unit="lb" value={weight} onChange={setWeight} placeholder="180" />
            <label className="flex items-center gap-3 px-5 py-3">
              <span className="flex-1 text-[15px]">Height</span>
              <input inputMode="numeric" aria-label="Feet" value={feet} onChange={(e) => setFeet(e.target.value)} placeholder="5" className="tabular h-11 w-14 rounded-xl border border-line-strong bg-inner px-2 text-right text-[17px] font-semibold outline-none placeholder:text-faint" />
              <span className="text-sm text-muted">ft</span>
              <input inputMode="numeric" aria-label="Inches" value={inches} onChange={(e) => setInches(e.target.value)} placeholder="10" className="tabular h-11 w-14 rounded-xl border border-line-strong bg-inner px-2 text-right text-[17px] font-semibold outline-none placeholder:text-faint" />
              <span className="text-sm text-muted">in</span>
            </label>
            <Field label="Age" value={age} onChange={setAge} placeholder="25" />
          </Group>
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[13px] font-semibold text-muted">Calorie formula (it uses different numbers for each)</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice selected={sex === "male"} onClick={() => setSex("male")} title="Male" detail="Mifflin-St Jeor" />
              <Choice selected={sex === "female"} onClick={() => setSex("female")} title="Female" detail="Mifflin-St Jeor" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[13px] font-semibold text-muted">How active are you?</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ACTIVITY) as Activity[]).map((k) => (
                <Choice key={k} selected={activity === k} onClick={() => setActivity(k)} title={ACTIVITY[k].label} detail={ACTIVITY[k].detail} />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">Where do you want to be?</h1>
          <Group>
            <Field label="Goal weight" unit="lb" value={goalWeight} onChange={setGoalWeight} placeholder={w ? String(Math.round(w)) : "175"} />
          </Group>
          <div className="grid grid-cols-2 gap-2">
            {PACES.map((p) => (
              <Choice key={p.value} selected={pace === p.value} onClick={() => setPace(p.value)} title={p.label} detail={p.detail} />
            ))}
          </div>
          {weeksToGoal != null ? (
            <p className="px-1 text-sm text-ink-2">
              At that pace, about <b className="text-ink">{weeksToGoal} weeks</b>. The app tracks your real trend and tells you if
              you&apos;re ahead or behind.
            </p>
          ) : paceConflict ? (
            <p className="px-1 text-sm text-warn">That pace goes the other way from your goal weight. Pick another.</p>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">Daily food targets</h1>
          <p className="px-1 text-sm leading-relaxed text-ink-2">
            {maintenance ? (
              <>
                Your maintenance is about <b className="text-ink">{formatNumber(maintenance)} kcal</b>. These are a starting point:
                protein near your goal weight in grams, the rest split between carbs and fat.
              </>
            ) : (
              "A starting point you can change any time."
            )}
          </p>
          <Group>
            <Field label="Calories" unit="kcal" value={foodValues.calories} onChange={(v) => setFoodField("calories", v)} />
            <Field label="Protein" unit="g" value={foodValues.protein} onChange={(v) => setFoodField("protein", v)} />
            <Field label="Carbs" unit="g" value={foodValues.carbs} onChange={(v) => setFoodField("carbs", v)} />
            <Field label="Fat" unit="g" value={foodValues.fat} onChange={(v) => setFoodField("fat", v)} />
          </Group>
          {food && suggestion ? (
            <button type="button" onClick={() => setFood(null)} className="self-start px-1 text-sm font-semibold text-accent">
              Use the suggestion ({formatNumber(suggestion.calories)} kcal)
            </button>
          ) : null}
          <Group>
            <Field label="Sodium" unit="mg" value={sodium} onChange={setSodium} hint="US guideline is 2,300. A bit more is allowed on training days." />
            <label className="flex items-center gap-3 px-5 py-3">
              <span className="flex flex-1 flex-col">
                <span className="text-[15px]">Where you eat</span>
                <span className="text-xs text-muted">Helps identify local restaurants</span>
              </span>
              <input value={homeArea} onChange={(e) => setHomeArea(e.target.value)} placeholder="City, State" className="h-11 w-40 rounded-xl border border-line-strong bg-inner px-3 text-right text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-faint" />
            </label>
          </Group>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">Water</h1>
          <section className="flex flex-col gap-2 rounded-3xl border border-line bg-card p-5">
            <span className="text-[15px] font-medium text-muted">Your daily goal starts at</span>
            <span className="tabular font-display text-[56px] leading-none font-semibold tracking-[-2.5px]">
              {num(waterOverride) || waterBase}
              <span className="font-sans text-lg font-semibold tracking-normal text-muted"> oz</span>
            </span>
            <span className="text-[13px] leading-relaxed text-muted">
              Half your body weight in ounces, plus about 12 oz for every 30 minutes you train, plus 8 oz after a salty day. A
              starting point, not science: thirst and pale-yellow pee are good guides too.
            </span>
          </section>
          <Group>
            <Field label="Use a fixed goal instead" unit="oz" value={waterOverride} onChange={setWaterOverride} placeholder="Auto" />
          </Group>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">Training</h1>
          {initial.routineCount > 0 ? (
            <p className="px-1 text-sm text-ink-2">
              You already have {initial.routineCount} routine{initial.routineCount === 1 ? "" : "s"}. Edit them any time in the Gym tab.
            </p>
          ) : (
            <>
              <p className="px-1 text-sm leading-relaxed text-ink-2">
                Routines run in order, and each workout suggests your next weights from the last one.
              </p>
              <div className="grid gap-2">
                <Choice selected={starter} onClick={() => setStarter(true)} title="Start with Push / Pull / Legs" detail="Three ready-made days. Edit any exercise after." />
                <Choice selected={!starter} onClick={() => setStarter(false)} title="I'll build my own" detail="Start from an empty Gym tab" />
              </div>
            </>
          )}
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h1 className="px-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.6px]">Physique goal</h1>
          <p className="-mt-2 px-1 text-sm text-muted">Optional. A picture to chase, plus numbers that show you&apos;re getting closer.</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="relative block overflow-hidden rounded-3xl border border-line bg-card">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              <img src={photo.preview} alt="Your inspiration photo" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <span className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 text-faint">
                <span className="text-sm font-semibold">
                  {initial.physique?.hasPhoto ? "Photo saved · tap to replace" : "Tap to add an inspiration photo"}
                </span>
                <span className="text-xs">Only you can see it</span>
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setPhoto(await resizeImage(file, 1440));
            }}
          />
          <section className="flex flex-col gap-2 rounded-3xl border border-line bg-card p-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name it, e.g. Nightwing build" aria-label="Physique goal name" className="h-11 rounded-xl border border-line-strong bg-inner px-3 font-display text-lg font-semibold outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-normal placeholder:text-faint" />
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="What it means, e.g. lean, broad shoulders, narrow waist" aria-label="What it means to you" className="h-11 rounded-xl border border-line-strong bg-inner px-3 text-[15px] outline-none placeholder:text-faint" />
          </section>
          <Group>
            <Field label="Shoulders now" unit="in" value={shoulders} onChange={setShoulders} placeholder="—" hint="Around the widest point" />
            <Field label="Waist now" unit="in" value={waist} onChange={setWaist} placeholder="—" hint="At the belly button" />
          </Group>
          <Group>
            <Field label="V-taper goal" value={ratioGoal} onChange={setRatioGoal} placeholder="1.60" hint={num(shoulders) && num(waist) ? `Now ${(num(shoulders)! / num(waist)!).toFixed(2)} (shoulders ÷ waist)` : "Shoulders ÷ waist"} />
            <Field label="Waist goal" unit="in" value={waistGoal} onChange={setWaistGoal} placeholder="—" />
            <Field label="Pull-ups in one set" unit="reps" value={pullUpGoal} onChange={setPullUpGoal} placeholder="—" />
          </Group>
        </>
      ) : null}

      {error ? <p className="rounded-2xl bg-p-pink px-4 py-3 text-sm font-semibold text-tile-ink">{error}</p> : null}

      <div className="mt-auto flex gap-2 pt-2">
        <button type="button" onClick={() => setStep(step - 1)} className="btn-outline px-6">
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!canNext[step]} onClick={() => setStep(step + 1)} className="btn-primary flex-1">
            Next
          </button>
        ) : (
          <button type="button" disabled={saving} onClick={finish} className="btn-primary flex-1">
            {saving ? "Saving…" : "Finish setup"}
          </button>
        )}
      </div>
    </main>
  );
}
