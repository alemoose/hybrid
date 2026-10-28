"use client";

import { useEffect, useState } from "react";
import type { Guide } from "@/lib/exercise-guide";
import { formVideoUrl } from "@/lib/training";
import { CloseIcon } from "./icons";

/** Start and end photos flipping like a GIF (tap to pause), the steps, and a way to find videos. */
export function ExerciseGuide({ name, guide }: { name: string; guide: Guide | null }) {
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!guide || paused) return;
    const id = setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => clearInterval(id);
  }, [guide, paused]);

  const videos = (
    <a href={formVideoUrl(name)} target="_blank" rel="noreferrer" className="btn-outline h-12 text-[15px]">
      Watch form videos on YouTube ↗
    </a>
  );

  if (!guide) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl bg-inner px-4 py-3 text-[13px] leading-relaxed text-muted">
          No photo guide for this one yet. Videos are the best reference.
        </p>
        {videos}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Play the movement" : "Pause the movement"}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl border border-line bg-white"
      >
        {guide.photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- two small static photos, swapped by opacity
          <img
            key={src}
            src={src}
            alt={`${name}, ${i === 0 ? "start" : "end"} position`}
            className="absolute inset-0 size-full object-contain transition-opacity duration-300"
            style={{ opacity: frame === i ? 1 : 0 }}
          />
        ))}
        <span className="absolute bottom-2 left-2 rounded-full bg-dark/75 px-2.5 py-1 text-xs font-semibold text-ink">
          {frame === 0 ? "Start" : "End"}
          {paused ? " · paused" : ""}
        </span>
      </button>
      <ol className="flex flex-col gap-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-inner text-xs font-bold text-ink">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {videos}
    </div>
  );
}

/** Full-screen guide over the workout, so checking form never leaves the session. */
export function ExerciseGuideSheet({ name, guide, onClose }: { name: string; guide: Guide | null; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={`How to do ${name}`} className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-[max(calc(env(safe-area-inset-top)+28px),16px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 font-display text-xl font-semibold">{name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="circle-btn">
            <CloseIcon size={18} />
          </button>
        </div>
        <ExerciseGuide name={name} guide={guide} />
      </div>
    </div>
  );
}
