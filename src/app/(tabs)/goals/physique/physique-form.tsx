"use client";

import { useRef, useState, useTransition } from "react";
import { savePhysique } from "@/app/goal-actions";
import { resizeImage, type ResizedImage } from "@/lib/image";

export function PhysiqueForm({ title, subtitle, photoId }: { title: string; subtitle: string; photoId: number | null }) {
  const [t, setT] = useState(title);
  const [s, setS] = useState(subtitle);
  const [photo, setPhoto] = useState<ResizedImage | null>(null);
  const [removed, setRemoved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = photo?.preview ?? (!removed && photoId ? `/photos/${photoId}` : null);

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-3 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            await savePhysique({
              title: t,
              subtitle: s,
              photo: photo ? { data: photo.data, mime: photo.mime, width: photo.width, height: photo.height } : null,
              removePhoto: removed && !photo,
            });
            setSaved(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save.");
          }
        });
      }}
    >
      <button type="button" onClick={() => fileRef.current?.click()} className="relative block overflow-hidden rounded-[18px]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview or private photo route
          <img src={preview} alt="Your inspiration photo" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border border-dashed border-dash bg-inner text-faint">
            <span className="text-sm font-semibold">Tap to add an inspiration photo</span>
            <span className="text-xs">Any picture you like. Only you can see it.</span>
          </span>
        )}
        {preview ? (
          <span className="absolute top-2.5 right-2.5 rounded-full border border-line-strong bg-card px-3 py-1.5 text-[13px] font-semibold">
            Change
          </span>
        ) : null}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setPhoto(await resizeImage(file, 1440));
            setRemoved(false);
            setSaved(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't use that photo.");
          }
        }}
      />
      {preview ? (
        <button
          type="button"
          onClick={() => {
            setPhoto(null);
            setRemoved(true);
            setSaved(false);
          }}
          className="self-start px-1 text-[13px] font-semibold text-warn"
        >
          Remove photo
        </button>
      ) : null}
      <label className="flex flex-col gap-1 px-1">
        <span className="text-[13px] font-semibold text-muted">Name it</span>
        <input
          value={t}
          onChange={(e) => {
            setT(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Nightwing build"
          className="h-11 rounded-xl border border-line-strong bg-inner px-3 font-display text-lg font-semibold outline-none placeholder:font-sans placeholder:text-[15px] placeholder:font-normal placeholder:text-faint focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 px-1">
        <span className="text-[13px] font-semibold text-muted">What it means to you</span>
        <input
          value={s}
          onChange={(e) => {
            setS(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Lean, broad shoulders, narrow waist, athletic legs"
          className="h-11 rounded-xl border border-line-strong bg-inner px-3 text-[15px] outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      {error ? <p className="px-1 text-sm font-semibold text-warn">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary mx-1">
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </form>
  );
}
