import Link from "next/link";
import { createStarterRoutines } from "@/app/actions";
import { ResumeBanner } from "@/components/resume-banner";
import { WeekStrip } from "@/components/week-strip";
import { Bar, Card, DateTile, PageHeader, Pill, SectionTitle, TextLink } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatDayKey, formatDuration, formatInstant, todayKey } from "@/lib/dates";
import { changeTone, daysSinceText, formatNumber } from "@/lib/format";
import { getUpNext, lastSevenDays, recentWorkouts } from "@/lib/queries";

export default async function TodayPage() {
  const tz = await getTimeZone();
  const [upNext, week, recent] = await Promise.all([getUpNext(tz), lastSevenDays(tz), recentWorkouts(3)]);
  const today = todayKey(tz);

  return (
    <>
      <PageHeader
        eyebrow={formatDayKey(today, { weekday: "long", month: "long", day: "numeric" })}
        title="Today"
        right={
          <Link href="/settings" aria-label="Settings" className="circle-btn text-sm font-bold">
            Me
          </Link>
        }
      />

      <WeekStrip days={week} />
      <ResumeBanner />

      <Card className="flex flex-col gap-2 p-5">
        <span className="text-[15px] font-medium text-muted">Calories left today</span>
        <span className="font-display text-[44px] leading-none font-semibold tracking-[-2px] text-faint">—</span>
        <span className="text-[13px] text-muted">Food logging is the next thing we build.</span>
      </Card>

      {upNext ? (
        <Card className="flex flex-col gap-0.5 px-5 py-4">
          <div className="flex items-baseline justify-between pb-2.5">
            <h2 className="font-display text-lg font-semibold">Training</h2>
            <TextLink href="/gym">Routines</TextLink>
          </div>
          <div className="mb-1.5 flex flex-col gap-2.5 rounded-2xl bg-inner p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[17px] font-bold">{upNext.next.name}</span>
              <span className="text-[13px] font-bold text-gold">Up next · {daysSinceText(upNext.next.daysSince)}</span>
            </div>
            <Bar pct={100} color="bg-ember" track="bg-inner-2" />
            {upNext.next.targets.length > 0 ? (
              <ul className="flex flex-col gap-1.5 py-0.5">
                {upNext.next.targets.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{t.name}</span>
                    <span className="tabular font-bold">{t.target}</span>
                    <Pill tone={changeTone(t.change)}>{t.label}</Pill>
                  </li>
                ))}
                {upNext.next.moreCount > 0 ? (
                  <li className="text-xs text-muted">+ {upNext.next.moreCount} more</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-muted">No exercises in this routine yet.</p>
            )}
            <div className="flex items-center gap-3">
              <Link href={`/workout?routine=${upNext.next.id}`} className="btn-primary h-11 flex-1 rounded-xl">
                Start workout
              </Link>
              <span className="text-[13px] text-muted">~{upNext.next.minutes} min</span>
            </div>
          </div>
          {upNext.upcoming.map((u, i) => (
            <div key={u.id} className="flex h-14 flex-col justify-center gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold">{u.name}</span>
                <span className="text-[13px] text-muted">{daysSinceText(u.daysSince)}</span>
              </div>
              <Bar
                pct={u.daysSince == null ? 0 : (u.daysSince / 7) * 100}
                color={i === 0 ? "bg-gold" : "bg-accent"}
              />
            </div>
          ))}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Set up your training</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Routines run in order, and each workout suggests your next weights from the last one. Start with a
            Push / Pull / Legs split or build your own.
          </p>
          <div className="flex gap-2">
            <form action={createStarterRoutines} className="flex-1">
              <button type="submit" className="btn-primary w-full">
                Add Push/Pull/Legs
              </button>
            </form>
            <Link href="/gym/routines/new" className="btn-outline flex-1">
              Build my own
            </Link>
          </div>
        </Card>
      )}

      {recent.length > 0 ? (
        <section className="flex flex-col px-1 pt-1">
          <SectionTitle action={<TextLink href="/progress/calendar">Calendar</TextLink>}>Recent workouts</SectionTitle>
          {recent.map((w, i) => (
            <Link
              key={w.id}
              href={`/gym/history/${w.id}`}
              className={`flex h-[62px] items-center gap-3 ${i < recent.length - 1 ? "border-b border-line" : ""}`}
            >
              <DateTile
                top={formatInstant(w.startedAt, tz, { month: "short" }).toUpperCase()}
                bottom={formatInstant(w.startedAt, tz, { day: "numeric" })}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-semibold">{w.name}</span>
                <span className="text-[13px] text-muted">
                  {formatDuration(w.finishedAt.getTime() - w.startedAt.getTime())} · {w.sets} sets
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted">volume</span>
                <span className="tabular text-base font-bold">{formatNumber(w.volume)} lb</span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </>
  );
}
