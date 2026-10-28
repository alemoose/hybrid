"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { estimateFood, logMeal, logUsual } from "@/app/food-actions";
import { CloseIcon, ForkIcon } from "@/components/icons";
import { Pill, cx, type PillTone } from "@/components/ui";
import type { LogMealInput, MealEstimate, UsualOption } from "@/lib/food-types";
import { formatNumber } from "@/lib/format";
import { resizeImage } from "@/lib/image";
import { formatMoney, parseMoney, totals, withRestaurantCooking, type FoodItem } from "@/lib/nutrition";

type Meal = LogMealInput["meal"];
type Source = LogMealInput["source"];
type DraftItem = FoodItem & { key: string; editing: boolean };

const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

const SOURCE_LABEL: Record<Source, { text: string; tone: PillTone }> = {
  official: { text: "Official nutrition", tone: "green" },
  estimate: { text: "AI estimate", tone: "yellow" },
  label: { text: "From the label", tone: "blue" },
  manual: { text: "Entered by hand", tone: "pink" },
};

const noSubscribe = () => () => {};
/** Plate plus a label or two; the server takes no more. */
const MAX_PHOTOS = 3;

let keySeq = 0;
const nextKey = () => `item-${++keySeq}`;

const blankItem = (): DraftItem => ({
  key: nextKey(),
  editing: true,
  name: "",
  quantity: 1,
  unit: "serving",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0,
});

type Review = {
  title: string;
  restaurant: string;
  source: Source;
  note: string;
  url: string;
  range: [number, number] | null;
  cached: boolean;
};

const reviewFrom = (estimate: MealEstimate): Review => ({
  title: estimate.title,
  restaurant: estimate.restaurant,
  source: estimate.source,
  note: estimate.sourceNote,
  url: estimate.sourceUrl,
  range: estimate.source === "estimate" ? [estimate.caloriesLow, estimate.caloriesHigh] : null,
  cached: estimate.cached,
});

const draftItems = (estimate: MealEstimate): DraftItem[] => estimate.items.map((i) => ({ ...i, key: nextKey(), editing: false }));

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function FoodLogger({
  usuals,
  aiReady,
  defaultMeal,
  day,
  sodiumGoal,
  initial,
}: {
  /** Opens straight on the review screen, e.g. for a suggested order. */
  initial?: MealEstimate;
  usuals: UsualOption[];
  aiReady: boolean;
  defaultMeal: Meal;
  day?: string;
  sodiumGoal: number;
}) {
  const router = useRouter();
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<{ data: string; mime: string; preview: string }[]>([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(() => (initial ? reviewFrom(initial) : null));
  const [items, setItems] = useState<DraftItem[]>(() => (initial ? draftItems(initial) : []));
  const [cooking, setCooking] = useState(initial ? initial.source === "estimate" : true);
  const [split, setSplit] = useState(false);
  const [price, setPrice] = useState("");
  const [looking, startLooking] = useTransition();
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = useSyncExternalStore(noSubscribe, () => getRecognition() != null, () => false);

  const done = () => router.push(day ? `/food?d=${day}` : "/food");

  const toggleVoice = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition = getRecognition();
    if (!Recognition) return;
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (said) setText((t) => (t.trim() ? `${t.trim()} ${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  const pickPhotos = async (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    if (!files.length || room <= 0) return;
    setError(files.length > room ? `Up to ${MAX_PHOTOS} photos per meal; added the first ${room}.` : null);
    try {
      const added = await Promise.all(files.slice(0, room).map((f) => resizeImage(f)));
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
  };

  const startReview = (estimate: MealEstimate | null) => {
    if (estimate) {
      setReview(reviewFrom(estimate));
      setItems(draftItems(estimate));
      setCooking(estimate.source === "estimate");
      setSplit(false);
    } else {
      setReview({ title: text.trim(), restaurant: "", source: "manual", note: "", url: "", range: null, cached: false });
      setItems([{ ...blankItem(), name: text.trim() }]);
      setCooking(false);
      setSplit(false);
    }
  };

  const lookUp = () => {
    setError(null);
    startLooking(async () => {
      const res = await estimateFood({ text, images: photos.map((p) => ({ data: p.data, mediaType: p.mime })) });
      if (res.ok) startReview(res.estimate);
      else setError(res.error);
    });
  };

  const quickLog = (u: UsualOption) => {
    setError(null);
    startSaving(async () => {
      try {
        await logUsual(u.id, meal, day);
        done();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't log that.");
      }
    });
  };

  const share = split ? 0.5 : 1;

  /** What actually gets saved for one row: restaurant cooking applied to estimates, halved when split. */
  const finalItem = ({ name, quantity, unit, calories, protein, carbs, fat, sodium }: DraftItem): FoodItem => {
    const item = { name: name.trim() || "Item", quantity: quantity * share, unit, calories, protein, carbs, fat, sodium };
    return review?.source === "estimate" && cooking ? withRestaurantCooking(item) : item;
  };
  const finalItems = (): FoodItem[] => items.filter((i) => i.quantity > 0).map(finalItem);

  const save = (saveAsUsual: boolean) => {
    if (!review) return;
    const list = finalItems();
    if (list.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setError(null);
    startSaving(async () => {
      try {
        await logMeal({
          meal,
          day,
          title: review.title.trim() || list[0].name,
          restaurant: review.restaurant.trim(),
          source: review.source,
          priceCents: myCost(),
          items: list,
          saveAsUsual,
        });
        done();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      }
    });
  };

  const myCost = (): number | null => {
    const cents = parseMoney(price);
    return cents == null ? null : Math.round(cents * share);
  };

  const patch = (key: string, p: Partial<DraftItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const mealPicker = (
    <div role="group" aria-label="Which meal" className="grid grid-cols-4 gap-1.5 rounded-[20px] border border-line bg-card p-1.5">
      {MEALS.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={meal === m.id}
          onClick={() => setMeal(m.id)}
          className={cx("h-10 rounded-[14px] text-[13px] font-semibold", meal === m.id ? "bg-ink text-dark" : "text-ink")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  const errorBox = error ? (
    <p role="alert" className="rounded-2xl bg-p-pink px-4 py-3 text-sm font-semibold text-tile-ink">
      {error}
    </p>
  ) : null;

  // ---------- Step 2: review ----------
  if (review) {
    const shown = finalItems();
    const t = totals(shown);
    const s = SOURCE_LABEL[review.source];
    const sodiumPct = sodiumGoal > 0 ? Math.round((t.sodium / sodiumGoal) * 100) : 0;
    return (
      <>
        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="meal-title" className="text-[13px] font-semibold text-muted">
                Meal name
              </label>
              <Pill tone={s.tone}>{s.text}</Pill>
            </div>
            <GrowingTitle id="meal-title" value={review.title} onChange={(title) => setReview({ ...review, title })} />
          </div>
          <label className="flex items-center gap-3 border-t border-line pt-3">
            <span className="w-24 text-[13px] font-semibold text-muted">Restaurant</span>
            <input
              value={review.restaurant}
              onChange={(e) => setReview({ ...review, restaurant: e.target.value })}
              placeholder="Home, or where you got it"
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            />
          </label>
          {review.note || review.cached ? (
            <p className="text-[13px] leading-snug text-muted">
              {review.note}
              {review.cached ? (review.note ? " · " : "") + "Saved answer, no new lookup" : ""}
              {review.url ? (
                <>
                  {" · "}
                  <a href={review.url} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                    Source
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>

        {mealPicker}

        <section className="flex flex-col rounded-3xl border border-line bg-card px-4 py-1">
          {items.map((item, i) => {
            const shownItem = item.quantity > 0 ? finalItem(item) : null;
            return (
              <div key={item.key} className={cx("flex flex-col gap-2 py-3", i > 0 && "border-t border-line")}>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => patch(item.key, { editing: !item.editing })}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    aria-expanded={item.editing}
                  >
                    <span className="text-[15px] font-bold wrap-break-word">{item.name || "New item"}</span>
                    <span className="tabular text-xs text-muted">
                      {shownItem
                        ? `${split ? "Your half: " : ""}${formatNumber(shownItem.calories * shownItem.quantity)} kcal · P ${formatNumber(shownItem.protein * shownItem.quantity)} C ${formatNumber(shownItem.carbs * shownItem.quantity)} F ${formatNumber(shownItem.fat * shownItem.quantity)} · ${formatNumber(shownItem.sodium * shownItem.quantity)} mg sodium`
                        : "Removed"}
                    </span>
                  </button>
                  <div className="flex items-center rounded-xl border border-line-strong">
                    <button
                      type="button"
                      aria-label={`Less ${item.name}`}
                      onClick={() => patch(item.key, { quantity: Math.max(0, item.quantity - (item.quantity <= 1 ? 0.5 : 1)) })}
                      className="size-9 text-lg font-semibold"
                    >
                      −
                    </button>
                    <span className="tabular min-w-7 text-center text-[15px] font-bold">{formatQty(item.quantity)}</span>
                    <button
                      type="button"
                      aria-label={`More ${item.name}`}
                      onClick={() => patch(item.key, { quantity: item.quantity < 1 ? item.quantity + 0.5 : item.quantity + 1 })}
                      className="size-9 text-lg font-semibold"
                    >
                      +
                    </button>
                  </div>
                </div>
                {item.editing ? (
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-inner p-3">
                    <label className="col-span-2 flex flex-col gap-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                      Name
                      <input
                        value={item.name}
                        onChange={(e) => patch(item.key, { name: e.target.value })}
                        className="h-9 rounded-lg bg-card px-2 text-[15px] font-semibold tracking-normal text-ink normal-case outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                      Unit
                      <input
                        value={item.unit}
                        onChange={(e) => patch(item.key, { unit: e.target.value })}
                        className="h-9 rounded-lg bg-card px-2 text-[15px] font-semibold tracking-normal text-ink normal-case outline-none"
                      />
                    </label>
                    {(
                      [
                        ["calories", "kcal"],
                        ["protein", "Protein g"],
                        ["carbs", "Carbs g"],
                        ["fat", "Fat g"],
                        ["sodium", "Sodium mg"],
                      ] as const
                    ).map(([field, label]) => (
                      <NumberField
                        key={field}
                        label={`${label} each`}
                        value={item[field]}
                        onChange={(v) => patch(item.key, { [field]: v })}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))}
                      className="col-span-3 h-9 text-sm font-semibold text-warn"
                    >
                      Remove item
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setItems((list) => [...list, blankItem()])}
            className="h-12 border-t border-line text-left text-sm font-semibold text-accent"
          >
            + Add something I missed
          </button>
        </section>

        {review.source === "estimate" ? (
          <Toggle
            on={cooking}
            onClick={() => setCooking((c) => !c)}
            title="Restaurant cooking"
            detail="Adds ~10% for the oil and butter you can't see"
          />
        ) : null}

        <Toggle
          on={split}
          onClick={() => setSplit((v) => !v)}
          title="Split it ½"
          detail="Sharing? Logs half of everything, and half the cost"
        />

        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="tabular font-display text-[34px] leading-none font-semibold tracking-[-1.2px]">
                {formatNumber(t.calories)}
                <span className="font-sans text-[15px] font-semibold tracking-normal text-muted"> kcal</span>
              </span>
              {review.range ? (
                <span className="text-[13px] text-muted">
                  Likely {formatNumber(review.range[0] * share)}–{formatNumber(review.range[1] * share)}
                </span>
              ) : null}
            </div>
            <span className="tabular text-sm text-muted">
              P {formatNumber(t.protein)} · C {formatNumber(t.carbs)} · F {formatNumber(t.fat)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold">Sodium</span>
            <span className={cx("tabular text-[15px] font-bold", sodiumPct >= 50 ? "text-warn" : "text-ink")}>
              {formatNumber(t.sodium)} mg <span className="font-medium text-muted">· {sodiumPct}% of your day</span>
            </span>
          </div>
          <label className="flex items-center justify-between border-t border-line pt-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{split ? "Total bill" : "What it cost"}</span>
              {split && myCost() != null ? <span className="tabular text-[13px] text-muted">Your half: {formatMoney(myCost()!)}</span> : null}
            </span>
            <span className="flex items-center gap-1 rounded-xl border border-line-strong bg-inner px-3">
              <span className="text-muted">$</span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                aria-label="Price in dollars"
                className="tabular h-10 w-20 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:text-faint"
              />
            </span>
          </label>
        </section>

        {errorBox}

        <div className="flex flex-col gap-2">
          <button type="button" disabled={saving} onClick={() => save(false)} className="btn-primary h-[54px] text-base">
            {saving ? "Saving…" : `Log to ${meal}`}
          </button>
          <button type="button" disabled={saving} onClick={() => save(true)} className="btn-outline">
            Log and save as a usual
          </button>
          <button
            type="button"
            onClick={() => {
              setReview(null);
              setItems([]);
            }}
            className="h-11 text-sm font-semibold text-muted"
          >
            Start over
          </button>
        </div>
      </>
    );
  }

  // ---------- Step 1: describe ----------
  return (
    <>
      <section className="flex gap-3.5 rounded-[20px] border border-line bg-card p-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-inner">
          <ForkIcon size={20} />
        </span>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[13px] font-semibold text-muted">What did you eat?</span>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Whataburger #1 combo with a Dr Pepper, or 12 Foosackly's fingers and fries"
            className="w-full resize-none bg-transparent text-lg leading-snug font-semibold outline-none placeholder:text-[15px] placeholder:font-normal placeholder:text-faint"
          />
        </label>
      </section>

      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={p.preview} alt={`Meal photo ${i + 1}`} className="h-28 max-w-[30vw] rounded-2xl border border-line object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-ink text-dark"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex justify-center gap-2">
        <button type="button" className="chip gap-1.5" disabled={photos.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}>
          <CameraGlyph /> {photos.length ? `Add photo (${photos.length}/${MAX_PHOTOS})` : "Photo"}
        </button>
        {voiceSupported ? (
          <button type="button" className="chip gap-1.5" aria-pressed={listening} onClick={toggleVoice}>
            <MicGlyph /> {listening ? "Listening…" : "Voice"}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            pickPhotos(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {mealPicker}

      {usuals.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-bold tracking-[0.08em] text-muted uppercase">Your usuals · tap to log</h2>
          <div className="flex flex-wrap gap-2">
            {usuals.map((u) => (
              <button key={u.id} type="button" disabled={saving} onClick={() => quickLog(u)} className="chip h-auto max-w-full flex-col items-start rounded-2xl py-2 text-left whitespace-normal">
                <span className="text-[11px] font-semibold text-muted">{u.restaurant || "Usual"}</span>
                <span>
                  {u.title} <span className="font-medium text-muted">· {formatNumber(u.calories)}</span>
                  {u.priceCents != null ? <span className="font-medium text-muted"> · {formatMoney(u.priceCents)}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {errorBox}

      <div className="flex flex-col gap-2 pt-2">
        {aiReady ? (
          <button
            type="button"
            disabled={looking || (!text.trim() && photos.length === 0)}
            onClick={lookUp}
            className="btn-primary h-14 text-base"
          >
            {looking ? "Looking it up…" : "Look it up"}
          </button>
        ) : (
          <p className="rounded-2xl bg-inner px-4 py-3 text-[13px] leading-relaxed text-muted">
            Lookups switch on once ANTHROPIC_API_KEY is set. For now, enter meals by hand.
          </p>
        )}
        <button type="button" disabled={looking} onClick={() => startReview(null)} className="btn-outline">
          Enter by hand
        </button>
        {looking ? (
          <p className="text-center text-[13px] text-muted">Chains take a few extra seconds: it checks their official nutrition.</p>
        ) : null}
      </div>
    </>
  );
}

function Toggle({ on, onClick, title, detail }: { on: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="flex items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-3.5 text-left"
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] text-muted">{detail}</span>
      </span>
      <span
        aria-hidden="true"
        className={cx("flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px]", on ? "justify-end bg-cobalt" : "justify-start bg-line-strong")}
      >
        <span className="size-6 rounded-full bg-white" />
      </span>
    </button>
  );
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(1);
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? String(Math.round(value * 10) / 10) : "");
  return (
    <label className="flex flex-col gap-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
      {label}
      <input
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        className="tabular h-9 rounded-lg bg-card px-2 text-[15px] font-semibold tracking-normal text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}

function CameraGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** A one-line title field that wraps onto more lines instead of cutting long names off. */
function GrowingTitle({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      enterKeyHint="done"
      className="resize-none overflow-hidden bg-transparent font-display text-[22px] leading-tight font-semibold outline-none"
    />
  );
}
