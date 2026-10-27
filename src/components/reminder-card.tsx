import { CloseIcon } from "./icons";

/** A note and/or photo of her. Works in server and client components. */
export function ReminderCard({
  label,
  note,
  photoId,
  onClose,
}: {
  label: string;
  note: string | null;
  photoId: number | null;
  onClose?: () => void;
}) {
  return (
    <section className="flex items-center gap-3.5 rounded-3xl border border-line bg-card p-3.5">
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element -- private photo route
        <img src={`/photos/${photoId}`} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12px] font-bold tracking-[0.06em] text-rose uppercase">{label}</span>
        {note ? <p className="text-[15px] leading-snug text-ink-2">{note}</p> : null}
      </div>
      {onClose ? (
        <button type="button" aria-label="Hide" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center self-start rounded-full text-muted">
          <CloseIcon size={14} />
        </button>
      ) : null}
    </section>
  );
}
