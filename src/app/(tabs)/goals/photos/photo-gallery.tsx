"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePhoto } from "@/app/goal-actions";
import { cx } from "@/components/ui";

type Photo = { id: number; pose: string; label: string };

/** Tap two photos to compare them side by side; the first and latest are picked to start. */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [pose, setPose] = useState("front");
  const list = photos.filter((p) => p.pose === pose);
  const [picked, setPicked] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const defaults = list.length >= 2 ? [list[0].id, list[list.length - 1].id] : list.map((p) => p.id);
  const compare = (picked.filter((id) => list.some((p) => p.id === id)).length === 2 ? picked : defaults)
    .map((id) => list.find((p) => p.id === id)!)
    .filter(Boolean);

  const toggle = (id: number) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => list.some((p) => p.id === x)), id].slice(-2)));

  return (
    <>
      <div role="group" aria-label="Pose" className="grid grid-cols-3 gap-1.5">
        {["front", "side", "back"].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pose === p}
            onClick={() => {
              setPose(p);
              setPicked([]);
            }}
            className={cx("h-9 rounded-[10px] text-[13px] font-semibold capitalize", pose === p ? "bg-ink text-dark" : "bg-card text-ink")}
          >
            {p}
          </button>
        ))}
      </div>

      {compare.length > 0 ? (
        <section className="grid grid-cols-2 gap-2.5">
          {compare.map((p) => (
            <figure key={p.id} className="m-0 flex flex-col gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route */}
              <img src={`/photos/${p.id}`} alt={`${pose} photo, ${p.label}`} className="aspect-[3/4] w-full rounded-2xl border border-line object-cover" />
              <figcaption className="text-[13px] font-bold">{p.label}</figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      <Link href={`/capture?pose=${pose}`} className="btn-primary">
        Take a {pose} photo
      </Link>

      {list.length > 0 ? (
        <>
          <p className="px-1 text-[13px] text-muted">Tap any two to compare them.</p>
          <ul className="grid grid-cols-3 gap-2">
            {[...list].reverse().map((p) => {
              const selected = compare.some((c) => c.id === p.id);
              return (
                <li key={p.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`Compare ${p.label}`}
                    onClick={() => toggle(p.id)}
                    className={cx("overflow-hidden rounded-xl border-2", selected ? "border-accent" : "border-transparent")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route */}
                    <img src={`/photos/${p.id}`} alt="" className="aspect-[3/4] w-full object-cover" />
                  </button>
                  <span className="flex items-center justify-between text-xs">
                    <span className="text-muted">{p.label}</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("Delete this photo?")) start(() => deletePhoto(p.id));
                      }}
                      className="font-semibold text-warn"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="px-1 text-sm text-muted">No {pose} photos yet.</p>
      )}
    </>
  );
}
