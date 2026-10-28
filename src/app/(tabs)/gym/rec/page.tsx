import { AreaRow, BUSY, HoursLine, updatedText } from "@/components/rec-card";
import { Card, EmptyState, PageHeader, SectionLabel, TextLink, cx } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatInstant, requestTime, todayKey } from "@/lib/dates";
import { areaRank, buildingHours, busyLevel, formatHour, hourlyPattern, pollerStale, quietestHours, recClock, type Sample } from "@/lib/rec";
import { getLastPoll, getRecNow, samplesFor } from "@/lib/rec-queries";

export const dynamic = "force-dynamic";

const FIRST_HOUR = 5;
const LAST_HOUR = 23;
const MIN_HOURS = 8;

export default async function RecPage() {
  const [now, tz, lastPoll] = await Promise.all([getRecNow(), getTimeZone(), getLastPoll()]);
  const today = todayKey(tz);

  if (now.status !== "ok") {
    return (
      <>
        <PageHeader back="/gym" eyebrow="Gym" title="Rec center" />
        <EmptyState title="No live counts yet">
          <p className="text-sm leading-relaxed text-muted">
            {now.status === "no-key" ? "Couldn't find the live counts on the rec center's site." : now.message}{" "}
            <TextLink href="/settings#rec">Set it up in Settings</TextLink>
          </p>
        </EmptyState>
      </>
    );
  }

  const weightRoom = now.groups[0].areas.find((a) => areaRank(a.name) === 0) ?? now.groups[0].areas[0];
  const samples = weightRoom ? await samplesFor(weightRoom.id) : [];
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;

  return (
    <>
      <PageHeader back="/gym" eyebrow="Gym" title="Rec center" />

      {now.groups.map((g) => (
        <section key={g.facility || "areas"} className="flex flex-col gap-2">
          <SectionLabel>{g.facility || "Areas"}</SectionLabel>
          <Card className="flex flex-col gap-3.5 p-4">
            {(() => {
              const hours = buildingHours(g.facility, recClock(requestTime()));
              return hours ? <HoursLine hours={hours} /> : null;
            })()}
            {g.areas.map((a) => (
              <AreaRow key={a.id || a.name} area={a} today={today} />
            ))}
            {g.areas[0]?.updated ? <span className="text-xs text-faint">Updated {updatedText(g.areas[0].updated, today)}</span> : null}
          </Card>
        </section>
      ))}

      {weightRoom ? (
        <>
          <SectionLabel>Usually · {weightRoom.name}</SectionLabel>
          <Pattern samples={samples} weekend={isWeekend} title={isWeekend ? "Weekends" : "Weekdays"} />
          <Pattern samples={samples} weekend={!isWeekend} title={isWeekend ? "Weekdays" : "Weekends"} />
          <p className="-mt-1 px-1 text-[13px] leading-relaxed text-muted">
            Built from the {samples.length} {samples.length === 1 ? "count" : "counts"} saved so far. Hybrid checks every 30 minutes
            while the gym is open, so this fills in over a couple of weeks.
          </p>
          <p className={cx("-mt-2 px-1 text-[13px]", pollerStale(lastPoll, requestTime()) ? "font-semibold text-warn" : "text-muted")}>
            {lastPoll
              ? `Automatic checks: last ran ${formatInstant(lastPoll, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })}${
                  pollerStale(lastPoll, requestTime()) ? ". They seem to have stopped; check the job on cron-job.org." : ""
                }`
              : "Automatic checks haven't run yet."}
          </p>
        </>
      ) : null}
    </>
  );
}

function Pattern({ samples, weekend, title }: { samples: Sample[]; weekend: boolean; title: string }) {
  const pattern = hourlyPattern(samples, weekend);
  const hours = pattern.slice(FIRST_HOUR, LAST_HOUR + 1);
  const known = hours.filter((v) => v != null).length;
  // Name a quiet stretch only once most open hours have been seen.
  const quiet = known >= MIN_HOURS ? quietestHours(pattern) : null;
  const max = Math.max(50, ...hours.map((v) => v ?? 0));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] text-muted">
          {quiet ? (
            <>
              Quietest <span className="font-semibold text-good">{formatHour(quiet.from)}–{formatHour(quiet.to)}</span>
            </>
          ) : known ? (
            "Need a few more counts"
          ) : (
            "No counts yet"
          )}
        </span>
      </div>
      <div className="flex h-20 items-end gap-[3px]" aria-label={`${title} by hour`}>
        {hours.map((v, i) => {
          const level = busyLevel(v);
          return (
            <div
              key={i}
              title={`${formatHour(FIRST_HOUR + i)}: ${v == null ? "no data" : `${v}%`}`}
              className={cx("flex-1 rounded-t-[3px]", level ? BUSY[level].bar : "bg-line")}
              style={{ height: v == null ? "3px" : `${Math.max(6, (v / max) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-faint">
        {[5, 8, 11, 14, 17, 20, 23].map((h) => (
          <span key={h}>{formatHour(h).replace(" ", "").toLowerCase()}</span>
        ))}
      </div>
    </Card>
  );
}
