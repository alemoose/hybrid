import Link from "next/link";
import { formatDayKey } from "@/lib/dates";
import { cx } from "./ui";

type Day = { key: string; isToday: boolean; workouts: unknown[] };

/** Last 7 days at a glance; blue dot = trained. Taps through to the calendar. */
export function WeekStrip({ days }: { days: Day[] }) {
  return (
    <Link
      href="/progress/calendar"
      aria-label="This week. Open the calendar"
      className="grid grid-cols-7 gap-1 rounded-[20px] border border-line bg-card p-2"
    >
      {days.map((d) => (
        <span
          key={d.key}
          className={cx(
            "flex flex-col items-center gap-1 rounded-xl border-[1.5px] py-1.5",
            d.isToday ? "border-accent" : "border-transparent",
          )}
        >
          <span className="text-[11px] font-bold text-muted">{formatDayKey(d.key, { weekday: "narrow" })}</span>
          <span className="tabular text-[15px] font-bold">{Number(d.key.slice(8))}</span>
          <span className={cx("size-[5px] rounded-full", d.workouts.length ? "bg-accent" : "bg-transparent")} />
        </span>
      ))}
    </Link>
  );
}
