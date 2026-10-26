"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { logWeight } from "@/app/goal-actions";
import { cx } from "@/components/ui";

export function QuickWeight({ placeholder }: { placeholder: string }) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await logWeight(Number.parseFloat(value));
            setValue("");
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <label className="flex h-12 flex-1 items-center gap-2 rounded-[14px] border border-line-strong bg-inner px-3">
        <span className="sr-only">Today&apos;s weight in pounds</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
          }}
          placeholder={placeholder}
          className="tabular h-full w-full bg-transparent text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-faint"
        />
        <span className="text-sm text-muted">lb</span>
      </label>
      <button type="submit" disabled={pending || !value} className="btn-primary px-5">
        {pending ? "Saving…" : done ? "Logged ✓" : "Log weight"}
      </button>
      {error ? <p className="sr-only" role="alert">{error}</p> : null}
    </form>
  );
}

type PosePhotos = { pose: string; first: { id: number; label: string } | null; latest: { id: number; label: string } | null };

export function PhotoCompare({ poses, lastTaken }: { poses: PosePhotos[]; lastTaken: string | null }) {
  const [pose, setPose] = useState(poses[0].pose);
  const current = poses.find((p) => p.pose === pose)!;
  const frames = [current.first, current.latest].filter(
    (f, i, all) => f && (i === 0 || f.id !== all[0]?.id),
  ) as { id: number; label: string }[];

  return (
    <>
      <div role="group" aria-label="Pose" className="grid grid-cols-3 gap-1.5">
        {poses.map((p) => (
          <button
            key={p.pose}
            type="button"
            aria-pressed={pose === p.pose}
            onClick={() => setPose(p.pose)}
            className={cx("h-9 rounded-[10px] text-[13px] font-semibold capitalize", pose === p.pose ? "bg-ink text-dark" : "bg-inner text-ink")}
          >
            {p.pose}
          </button>
        ))}
      </div>
      {frames.length === 0 ? (
        <Link
          href={`/capture?pose=${pose}`}
          className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-dash bg-inner text-faint"
        >
          <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="6" r="3" />
            <path d="M6 21v-7a6 6 0 0 1 12 0v7" />
          </svg>
          <span className="text-sm font-semibold">No {pose} photo yet</span>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {frames.map((f, i) => (
            <figure key={f.id} className="m-0 flex flex-col gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route */}
              <img src={`/photos/${f.id}`} alt={`${pose} progress photo, ${f.label}`} className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
              <figcaption className="flex justify-between text-[13px]">
                <span className="font-bold">{f.label}</span>
                <span className="text-muted">{frames.length === 1 ? "First" : i === 0 ? "First" : "Latest"}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <Link href={`/capture?pose=${pose}`} className="btn-primary">
        Take this week&apos;s photo
      </Link>
      <span className="text-xs leading-relaxed text-muted">
        {lastTaken ? `Last photo ${lastTaken}. ` : ""}The camera shows a faint outline of your last {pose} photo so you match the pose. Photos stay
        private to you.
      </span>
    </>
  );
}
