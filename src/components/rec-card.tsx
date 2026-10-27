import Link from "next/link";
import { getTimeZone } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { areaRank, busyLevel, formatHour, parseFeedTime, type Busy, type RecArea } from "@/lib/rec";
import { getRecNow } from "@/lib/rec-queries";
import { getReminders } from "@/lib/reminder-queries";
import { pickReminder } from "@/lib/reminders";
import { Card, cx } from "./ui";

export const BUSY: Record<Busy, { label: string; text: string; bar: string }> = {
  quiet: { label: "Quiet", text: "text-good", bar: "bg-good" },
  moderate: { label: "Moderate", text: "text-gold", bar: "bg-gold" },
  busy: { label: "Busy", text: "text-warn", bar: "bg-warn" },
};

/** "10:52 AM", or "Mon 10:27 PM" when the count isn't from today. */
export function updatedText(updated: string, today: string): string {
  const t = parseFeedTime(updated);
  if (!t) return "";
  const time = formatHour(t.hour, t.minute);
  if (t.key === today) return time;
  const day = new Date(`${t.key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${day} ${time}`;
}

export function AreaRow({ area, today }: { area: RecArea; today: string }) {
  const level = area.closed ? null : busyLevel(area.pct);
  const style = level ? BUSY[level] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[15px] font-semibold wrap-break-word">{area.name}</span>
        {area.closed ? (
          <span className="text-[13px] font-semibold text-muted">Closed</span>
        ) : (
          <>
            <span className="tabular text-[15px] font-bold">{area.count}</span>
            {area.pct != null ? <span className="tabular w-10 text-right text-[13px] text-muted">{area.pct}%</span> : null}
            {style ? <span className={cx("w-[70px] text-right text-[13px] font-bold", style.text)}>{style.label}</span> : null}
          </>
        )}
      </div>
      {!area.closed && area.pct != null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className={cx("h-full rounded-full", style?.bar ?? "bg-accent")} style={{ width: `${Math.max(2, area.pct)}%` }} />
        </div>
      ) : null}
      {area.updated && parseFeedTime(area.updated)?.key !== today ? (
        <span className="text-xs text-faint">Last count {updatedText(area.updated, today)}</span>
      ) : null}
    </div>
  );
}

/** The rec center right now: weight room, resistance room and cardio. Links to every area. */
export async function RecCard() {
  const [now, tz, reminders] = await Promise.all([getRecNow(), getTimeZone(), getReminders()]);
  const today = todayKey(tz);

  if (now.status !== "ok") {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <span className="text-[15px] font-bold">Rec center now</span>
        <p className="text-[13px] leading-relaxed text-muted">
          {now.status === "no-key" ? "Couldn't find the live counts on the rec center's site." : `Live counts are unavailable: ${now.message}`}
        </p>
        <Link href="/settings#rec" className="text-sm font-semibold text-accent">
          Set it up in Settings
        </Link>
      </Card>
    );
  }

  const main = now.groups[0];
  const top = main.areas.filter((a) => areaRank(a.name) < 9).slice(0, 3);
  const shown = top.length ? top : main.areas.slice(0, 3);
  const stamp = shown.map((a) => parseFeedTime(a.updated)).find((t) => t?.key === today);
  // When the weight room is filling up, a nudge to keep your eyes on your own plan.
  const weightRoom = shown.find((a) => areaRank(a.name) === 0);
  const crowded = weightRoom && !weightRoom.closed && busyLevel(weightRoom.pct) !== "quiet" && busyLevel(weightRoom.pct) != null;
  const note = crowded && reminders.notes.length ? pickReminder({ ...reminders, photoIds: [] }, `rec:${today}:${stamp?.hour ?? 0}`).note : null;
  // Weight rooms at the other facilities (the Witt), as a fallback when the main one is packed.
  const others = now.groups.slice(1).flatMap((g) => {
    const room = g.areas.find((a) => areaRank(a.name) === 0);
    return room ? [{ facility: g.facility, room }] : [];
  });
  const quieter = crowded
    ? others.find((o) => !o.room.closed && o.room.pct != null && weightRoom.pct != null && o.room.pct <= weightRoom.pct - 15)
    : undefined;

  return (
    <Card className="flex flex-col gap-3.5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">Rec center now</span>
        {stamp ? <span className="text-xs text-muted">Updated {formatHour(stamp.hour, stamp.minute)}</span> : null}
      </div>
      {shown.map((a) => (
        <AreaRow key={a.id || a.name} area={a} today={today} />
      ))}
      {others.length ? (
        <div className="flex flex-col gap-3.5 border-t border-line pt-3.5">
          {others.map((o) => (
            <AreaRow key={o.room.id || o.room.name} area={{ ...o.room, name: withFacility(o.facility, o.room.name) }} today={today} />
          ))}
        </div>
      ) : null}
      {crowded ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-inner px-3.5 py-3">
          <span className="text-[13px] font-semibold text-ink-2">
            {quieter
              ? `Filling up. ${shortFacility(quieter.facility)} is quieter right now (${quieter.room.count} people).`
              : "Filling up. Headphones in, eyes on your plan."}
          </span>
          {note ? <span className="text-[13px] leading-snug text-rose">{note}</span> : null}
        </div>
      ) : null}
      <Link href="/gym/rec" className="border-t border-line pt-3 text-sm font-semibold text-accent">
        Every area and usual quiet times
      </Link>
    </Card>
  );
}

/** "Witt Student Activity Center" → "Witt"; names without a clear short form stay as they are. */
export function shortFacility(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return /^(witt|aquatic)/i.test(first) ? first : name;
}

/** "Witt" + "Weight Room" → "Witt · Weight Room", but "Witt Weight Room" stays as it is. */
function withFacility(facility: string, area: string): string {
  const short = shortFacility(facility);
  return area.toLowerCase().startsWith(short.toLowerCase()) ? area : `${short} · ${area}`;
}

export function RecCardSkeleton() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="text-[15px] font-bold">Rec center now</span>
      <span className="text-[13px] text-muted">Checking the live counts…</span>
    </Card>
  );
}
