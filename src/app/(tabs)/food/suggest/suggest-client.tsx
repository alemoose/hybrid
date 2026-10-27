"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { suggestFood, type SuggestResult } from "@/app/food-actions";
import { Pill, cx } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { totals } from "@/lib/nutrition";

export function SuggestClient({
  aiReady,
  restaurants,
  left,
}: {
  aiReady: boolean;
  restaurants: string[];
  left: { calories: number; protein: number; sodium: number };
}) {
  const [restaurant, setRestaurant] = useState("");
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [pending, start] = useTransition();
  const place = custom.trim() || restaurant;

  const ask = () =>
    start(async () => {
      setResult(null);
      setResult(await suggestFood({ restaurant: place, note }));
    });

  return (
    <>
      <section className="grid grid-cols-3 gap-2 rounded-3xl border border-line bg-card p-4 text-center">
        <Left label="kcal left" value={formatNumber(left.calories)} />
        <Left label="protein left" value={`${formatNumber(left.protein)} g`} />
        <Left label="sodium left" value={`${formatNumber(left.sodium)} mg`} warn={left.sodium < 800} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-xs font-bold tracking-[0.08em] text-muted uppercase">Where from</h2>
        <div className="flex flex-wrap gap-2">
          {["", ...restaurants].map((r) => (
            <button
              key={r || "any"}
              type="button"
              aria-pressed={!custom.trim() && restaurant === r}
              onClick={() => {
                setRestaurant(r);
                setCustom("");
              }}
              className="chip"
            >
              {r || "Any of my spots"}
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Somewhere else, e.g. Zaxby's"
          aria-label="Another restaurant"
          className="h-11 rounded-xl border border-line-strong bg-card px-3 text-[15px] outline-none placeholder:text-faint"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? e.g. no spicy, under $12"
          aria-label="Anything else"
          className="h-11 rounded-xl border border-line-strong bg-card px-3 text-[15px] outline-none placeholder:text-faint"
        />
      </section>

      {aiReady ? (
        <button type="button" disabled={pending || left.calories < 150} onClick={ask} className="btn-primary h-14 text-base">
          {pending ? "Finding orders…" : left.calories < 150 ? "You're at your calories" : `Suggest ${place ? `from ${place}` : "an order"}`}
        </button>
      ) : (
        <p className="rounded-2xl bg-inner px-4 py-3 text-[13px] leading-relaxed text-muted">Suggestions switch on once ANTHROPIC_API_KEY is set.</p>
      )}
      {pending ? <p className="-mt-2 text-center text-[13px] text-muted">Checking menus, about 20 seconds.</p> : null}

      {result && !result.ok ? (
        <p role="alert" className="rounded-2xl bg-p-pink px-4 py-3 text-sm font-semibold text-tile-ink">
          {result.error}
        </p>
      ) : null}

      {result?.ok
        ? result.orders.map((o, i) => {
            const t = totals(o.items);
            const over = t.calories > left.calories;
            return (
              <section key={i} className="flex flex-col gap-2.5 rounded-3xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-muted">{o.restaurant}</span>
                    <span className="text-[17px] font-bold wrap-break-word">{o.title}</span>
                  </div>
                  <Pill tone={o.source === "official" ? "green" : "yellow"}>{o.source === "official" ? "Official" : "Estimate"}</Pill>
                </div>
                <ul className="flex flex-col gap-0.5 text-[13px] text-ink-2">
                  {o.items.map((it, j) => (
                    <li key={j}>
                      {it.quantity !== 1 ? `${it.quantity} × ` : ""}
                      {it.name}
                    </li>
                  ))}
                </ul>
                <p className="tabular text-sm">
                  <span className={cx("font-bold", over && "text-warn")}>{formatNumber(t.calories)} kcal</span>
                  <span className="text-muted">
                    {" "}
                    · <span className="font-semibold text-rose">P {formatNumber(t.protein)}</span> · C {formatNumber(t.carbs)} · F{" "}
                    {formatNumber(t.fat)} · {formatNumber(t.sodium)} mg sodium
                  </span>
                </p>
                {o.why ? <p className="text-[13px] leading-relaxed text-muted">{o.why}</p> : null}
                <Link href={`/add?mode=food&suggestion=${encodeURIComponent(result.key)}&i=${i}`} className="btn-outline">
                  Ate this · review and log
                </Link>
              </section>
            );
          })
        : null}
    </>
  );
}

function Left({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cx("tabular font-display text-[20px] font-semibold", warn && "text-warn")}>{value}</span>
      <span className="text-[11px] font-semibold text-muted">{label}</span>
    </div>
  );
}
