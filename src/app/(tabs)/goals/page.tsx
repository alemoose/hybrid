import Link from "next/link";
import { Bar, Card, PageHeader, Pill, SectionTitle, TextLink, type PillTone } from "@/components/ui";
import { WeightChart } from "@/components/weight-chart";
import { getTimeZone } from "@/lib/auth";
import { MEASUREMENTS, projectGoalDate, weeklyAverages, weightTrend } from "@/lib/body";
import { dayKey, daysBetween, formatInstant, requestTime, todayKey } from "@/lib/dates";
import { listPhotos, listWeights, measurementSnapshots, targetStatuses, type TargetStatus } from "@/lib/goal-queries";
import { getBodyGoal, getPhysique } from "@/lib/settings";
import { formatTargetValue } from "@/lib/target-view";
import { PhotoCompare, QuickWeight } from "./goal-widgets";

function TargetRows({ statuses }: { statuses: TargetStatus[] }) {
  const colors = ["bg-accent", "bg-gold", "bg-rose", "bg-good"];
  return (
    <>
      {statuses.map((s, i) => (
        <div key={s.target.id} className="flex flex-col justify-center gap-2 border-t border-line py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">{s.target.label}</span>
            <span className="tabular shrink-0 text-[13px] text-muted">
              <b className="text-ink">{s.current != null ? formatTargetValue(s.current, s.unit) : "—"}</b> →{" "}
              {formatTargetValue(s.target.targetValue, s.unit)}
            </span>
          </div>
          <Bar pct={s.progress * 100} color={colors[i % colors.length]} />
        </div>
      ))}
    </>
  );
}

export default async function GoalsPage() {
  const tz = await getTimeZone();
  const now = requestTime();
  const [physique, physiqueTargets, strengthTargets, bodyGoal, weights, progressPhotos, snapshots] = await Promise.all([
    getPhysique(),
    targetStatuses("physique"),
    targetStatuses("strength"),
    getBodyGoal(),
    listWeights(now - 120 * 86_400_000),
    listPhotos("progress"),
    measurementSnapshots(),
  ]);

  // ----- Weight -----
  const trend = weightTrend(weights, now);
  const points = weeklyAverages(weights, now, 16);
  let weightCard = null;
  if (bodyGoal) {
    const current = trend.current;
    const start = bodyGoal.startWeight ?? weights[0]?.weight ?? current;
    const projected = current != null ? projectGoalDate(current, bodyGoal.goalWeight, trend.ratePerWeek, now) : null;
    const remaining = current != null ? bodyGoal.goalWeight - current : null;
    let status: { text: string; tone: PillTone };
    if (current == null || trend.ratePerWeek == null) status = { text: "Getting started", tone: "blue" };
    else if (Math.abs(remaining!) < 1) status = { text: "At your goal", tone: "green" };
    else if (!projected) status = { text: "Off track", tone: "pink" };
    else if (bodyGoal.pace !== 0 && Math.abs(trend.ratePerWeek) < Math.abs(bodyGoal.pace) * 0.6) status = { text: "Slower than planned", tone: "yellow" };
    else status = { text: "On pace", tone: "green" };

    const rate = trend.ratePerWeek;
    const sentence =
      current == null
        ? "Log your weight a few times a week. The trend shows up after about a week."
        : rate == null
          ? "A few more weigh-ins and the trend line appears."
          : `${rate < 0 ? "Losing" : rate > 0 ? "Gaining" : "Holding at"} ${Math.abs(rate).toFixed(2)} lb a week. ${
              projected
                ? `At this pace you reach ${bodyGoal.goalWeight} around ${formatInstant(projected, tz, { month: "short", day: "numeric" })}.`
                : Math.abs(remaining!) < 1
                  ? "Right where you want to be."
                  : "That's heading away from your goal."
            }`;
    const progressPct =
      current != null && start != null && start !== bodyGoal.goalWeight
        ? Math.min(100, Math.max(0, ((start - current) / (start - bodyGoal.goalWeight)) * 100))
        : 0;

    weightCard = (
      <Card className="flex flex-col gap-3.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium text-muted">Goal weight</span>
            <span className="tabular font-display text-[56px] leading-[1.05] font-semibold tracking-[-2.5px]">
              {bodyGoal.goalWeight}
              <span className="font-sans text-lg font-semibold tracking-normal text-muted"> lb</span>
            </span>
          </div>
          <Pill tone={status.tone}>{status.text}</Pill>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[13px] text-muted">
            <span>Started {start != null ? start.toFixed(1) : "—"}</span>
            <span className="font-bold text-ink">
              Now {current != null ? current.toFixed(1) : "—"}
              {remaining != null && Math.abs(remaining) >= 0.5 ? ` · ${Math.abs(remaining).toFixed(1)} lb to go` : ""}
            </span>
          </div>
          <Bar pct={progressPct} color="bg-good" />
        </div>
        {points.length >= 2 ? (
          <WeightChart
            points={points}
            goal={bodyGoal.goalWeight}
            projection={projected ? { at: projected.getTime(), weight: bodyGoal.goalWeight } : null}
            labels={[
              formatInstant(points[0].at, tz, { month: "short", day: "numeric" }),
              "Now",
              projected ? formatInstant(projected, tz, { month: "short", day: "numeric" }) : "",
            ]}
            ariaLabel={`Weekly average weight from ${points[0].weight.toFixed(1)} to ${points[points.length - 1].weight.toFixed(1)} pounds${projected ? `, projected to reach ${bodyGoal.goalWeight} around ${formatInstant(projected, tz, { month: "long", day: "numeric" })}` : ""}`}
          />
        ) : null}
        <p className="text-sm leading-relaxed text-ink-2">{sentence}</p>
        <QuickWeight placeholder={current != null ? current.toFixed(1) : "Weight"} />
        <TextLink href="/goals/weight">History and goal settings</TextLink>
      </Card>
    );
  }

  // ----- Photos -----
  const poses = (["front", "side", "back"] as const).map((pose) => {
    const list = progressPhotos.filter((p) => p.pose === pose);
    const label = (p: (typeof list)[number]) => ({ id: p.id, label: formatInstant(p.takenAt, tz, { month: "short", day: "numeric" }) });
    return { pose, first: list[0] ? label(list[0]) : null, latest: list.length ? label(list[list.length - 1]) : null };
  });
  const lastPhoto = progressPhotos[progressPhotos.length - 1];
  const lastTaken = lastPhoto
    ? (() => {
        const d = daysBetween(dayKey(lastPhoto.takenAt, tz), todayKey(tz));
        return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
      })()
    : null;

  const measured = MEASUREMENTS.filter((m) => snapshots.latest[m.key]);

  return (
    <>
      <PageHeader
        back="/"
        eyebrow={bodyGoal ? `Since ${formatInstant(bodyGoal.startedAt, tz, { month: "long", day: "numeric" })}` : "Your goals"}
        title="Goals"
        right={
          <Link href="/settings" aria-label="Settings" className="circle-btn">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        }
      />

      {/* Physique */}
      <Card className="flex flex-col gap-3.5 p-3 pb-4">
        <Link href="/goals/physique" className="relative block">
          {physique?.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route
            <img
              src={`/photos/${physique.photoId}`}
              alt={physique.title ? `Inspiration: ${physique.title}` : "Your inspiration photo"}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
            />
          ) : (
            <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-dash bg-inner text-faint">
              <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="m21 16-5-5-9 9" />
              </svg>
              <span className="text-sm font-semibold">Add your inspiration photo</span>
            </span>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-p-blue px-2.5 py-1 text-xs font-bold text-tile-ink">The goal</span>
        </Link>
        <div className="flex items-start justify-between gap-3 px-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.4px]">{physique?.title || "Your physique goal"}</h2>
            <span className="text-[13px] text-muted">{physique?.subtitle || "Name it, add a picture, and set a few numbers to chase."}</span>
          </div>
          <TextLink href="/goals/physique">Edit</TextLink>
        </div>
        {physiqueTargets.length > 0 ? (
          <div className="flex flex-col px-2">
            <TargetRows statuses={physiqueTargets} />
          </div>
        ) : null}
      </Card>

      {/* Weight */}
      {weightCard ?? (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Set a goal weight</h2>
          <p className="text-sm text-ink-2">See your trend, your pace and when you&apos;ll get there.</p>
          <Link href="/goals/weight" className="btn-primary">
            Set goal weight
          </Link>
        </Card>
      )}

      {/* Photos */}
      <Card className="flex flex-col gap-3 px-5 pt-4 pb-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Progress photos</h2>
          <TextLink href="/goals/photos">All photos</TextLink>
        </div>
        <PhotoCompare poses={poses} lastTaken={lastTaken} />
      </Card>

      {/* Measurements */}
      <section className="flex flex-col px-1">
        <SectionTitle action={<TextLink href="/goals/measurements">{measured.length ? "Update" : "Add"}</TextLink>}>
          Measurements
        </SectionTitle>
        {measured.length === 0 ? (
          <p className="pb-2 text-sm text-muted">Waist and shoulders show changes the scale hides, like losing fat while building muscle.</p>
        ) : (
          measured.map((m, i) => {
            const latest = snapshots.latest[m.key]!.value;
            const delta = latest - snapshots.first[m.key]!.value;
            const tints = ["bg-p-green", "bg-p-blue", "bg-p-yellow", "bg-p-pink"];
            return (
              <div key={m.key} className={`flex h-[52px] items-center gap-3 ${i < measured.length - 1 ? "border-b border-line" : ""}`}>
                <span className={`flex size-[34px] items-center justify-center rounded-full text-xs font-bold text-tile-ink ${tints[i % tints.length]}`}>
                  {m.label.charAt(0)}
                </span>
                <span className="flex-1 text-[15px] text-ink-2">{m.label}</span>
                <span className="tabular text-base font-bold">{latest.toFixed(1)} in</span>
                <span className={`tabular w-12 text-right text-[13px] font-bold ${delta === 0 ? "text-muted" : m.key === "waist" ? (delta < 0 ? "text-good" : "text-warn") : "text-accent"}`}>
                  {delta === 0 ? "—" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}`}
                </span>
              </div>
            );
          })
        )}
      </section>

      {/* Strength */}
      <Card className="flex flex-col px-5 pt-4 pb-1">
        <div className="flex items-baseline justify-between pb-2">
          <h2 className="font-display text-lg font-semibold">Strength goals</h2>
          <TextLink href="/goals/strength">{strengthTargets.length ? "Edit" : "Add"}</TextLink>
        </div>
        {strengthTargets.length === 0 ? (
          <p className="pb-4 text-sm text-muted">Pick a lift and a number, like Romanian Deadlift to 275 lb.</p>
        ) : (
          <TargetRows statuses={strengthTargets} />
        )}
      </Card>
    </>
  );
}
