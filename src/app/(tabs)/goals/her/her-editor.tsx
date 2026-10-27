"use client";

import { useRef, useState, useTransition } from "react";
import { deletePhoto, saveHer, uploadReminderPhoto } from "@/app/goal-actions";
import { CloseIcon } from "@/components/icons";
import { resizeImage } from "@/lib/image";

const IDEAS = ["The way she laughs at my worst jokes", "She believed in me before I did", "Our first date at…", "How she looks at me"];

export function HerEditor({ name, notes, photoIds }: { name: string; notes: string[]; photoIds: number[] }) {
  const [herName, setHerName] = useState(name);
  const [list, setList] = useState(notes);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (next: { name?: string; notes?: string[] }) => {
    setError(null);
    start(async () => {
      try {
        await saveHer({ name: next.name ?? herName, notes: next.notes ?? list });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [...list, text];
    setList(next);
    setDraft("");
    save({ notes: next });
  };

  return (
    <>
      <label className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-card px-5 py-3">
        <span className="text-[15px] font-semibold">Her name</span>
        <input
          value={herName}
          onChange={(e) => setHerName(e.target.value)}
          onBlur={() => herName.trim() !== name && save({ name: herName })}
          placeholder="Optional"
          className="h-10 w-40 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-faint"
        />
      </label>

      <section className="flex flex-col rounded-3xl border border-line bg-card px-4 py-1">
        {list.map((note, i) => (
          <div key={`${i}-${note}`} className="flex items-start gap-2 border-b border-line py-3">
            <p className="flex-1 text-[15px] leading-relaxed text-ink-2">{note}</p>
            <button
              type="button"
              aria-label="Remove this note"
              disabled={pending}
              onClick={() => {
                const next = list.filter((_, j) => j !== i);
                setList(next);
                save({ notes: next });
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
        <div className="flex flex-col gap-2 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={`Why you love her, e.g. "${IDEAS[list.length % IDEAS.length]}"`}
            aria-label="New reason"
            className="resize-none rounded-xl border border-line-strong bg-inner px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-faint"
          />
          <button type="button" disabled={pending || !draft.trim()} onClick={addNote} className="btn-outline">
            Add
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold tracking-[0.08em] text-muted uppercase">Photos</h2>
        <div className="grid grid-cols-3 gap-2">
          {photoIds.map((id) => (
            <div key={id} className="relative aspect-square overflow-hidden rounded-2xl bg-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo route */}
              <img src={`/photos/${id}`} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label="Delete photo"
                disabled={pending}
                onClick={() => confirm("Delete this photo?") && start(() => deletePhoto(id))}
                className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <CloseIcon size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-dash text-sm font-semibold text-muted"
          >
            {pending ? "Saving…" : "+ Photo"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError(null);
            try {
              const img = await resizeImage(file, 1080);
              start(async () => {
                await uploadReminderPhoto({ data: img.data, mime: img.mime, width: img.width, height: img.height });
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't use that photo.");
            }
          }}
        />
      </section>
      {error ? <p className="text-sm font-semibold text-warn">{error}</p> : null}
    </>
  );
}
