import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, DateTile, PageHeader, Pill, SectionTitle, TextLink, type PillTone } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { changeTone } from "@/lib/format";
import { getExerciseProgress } from "@/lib/queries";
import { countedSets, formatWeight } from "@/lib/training";
import { ExerciseChart, type ChartPoint } from "./exercise-chart";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ExercisePage({ params }: PageProps<"/progress/exercises/[id]">) {
  const [{ id }, tz] = await Promise.all([params, getTimeZone()]);
  const data = await getExerciseProgress(Number(id));
  if (!data) notFound();
  const { exercise, points, suggestion, records } = data;
  const bodyweight = points.length > 0 && points.every((p) => p.metrics.heaviest === 0);

  const chartPoints: ChartPoint[] = points.map((p) => ({
    label: formatInstant(p.date, tz, { month: "short", day: "numeric" }),
    estMax: p.metrics.estMax,
    heaviest: p.metrics.heaviest,
    bestSet: p.metrics.bestSet.volume,
    volume: Math.round(p.metrics.volume),
    maxReps: p.metrics.maxReps,
    totalReps: p.metrics.totalReps,
  }));

  const recordRows: { label: string; rec: { date: Date; value: string } | null; tone: PillTone }[] = bodyweight
    ? [{ label: "Most reps", rec: records.maxReps, tone: "yellow" }]
    : [
        { label: "Heaviest weight", rec: records.heaviest, tone: "yellow" },
        { label: "Est. 1-rep max", rec: records.estMax, tone: "blue" },
        { label: "Best set", rec: records.bestSet, tone: "pink" },
      ];
  const history = [...points].reverse().slice(0, 12);

  return (
    <>
      <PageHeader
        back="/progress"
        eyebrow={`${label(exercise.equipment)} · ${exercise.primaryMuscle}`}
        title={exercise.name}
      />

      {points.length === 0 ? (
        <Card className="p-5 text-[15px] text-ink-2">No sessions yet. Log this exercise once and the chart starts.</Card>
      ) : (
        <ExerciseChart points={chartPoints} bodyweight={bodyweight} />
      )}

      {suggestion ? (
        <section className="flex items-center gap-3 rounded-[18px] bg-inner px-4 py-3.5">
          <Pill tone={changeTone(suggestion.change)}>Next time</Pill>
          <span className="text-sm leading-snug text-ink-2">
            <b className="text-ink">
              {suggestion.weight > 0 ? `${formatWeight(suggestion.weight)} × ${suggestion.reps}.` : `${suggestion.reps} reps.`}
            </b>{" "}
            {suggestion.reason}.
          </span>
        </section>
      ) : null}

      {points.length > 0 ? (
        <section className="flex flex-col px-1">
          <SectionTitle>Personal records</SectionTitle>
          {recordRows.map((r, i) =>
            r.rec ? (
              <div
                key={r.label}
                className={`flex h-[58px] items-center gap-3 ${i < recordRows.length - 1 ? "border-b border-line" : ""}`}
              >
                <DateTile
                  tone={r.tone}
                  top={formatInstant(r.rec.date, tz, { month: "short" }).toUpperCase()}
                  bottom={formatInstant(r.rec.date, tz, { day: "numeric" })}
                />
                <span className="flex-1 text-[15px] text-ink-2">{r.label}</span>
                <span className="tabular text-base font-bold">{r.rec.value}</span>
              </div>
            ) : null,
          )}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="flex flex-col px-1">
          <SectionTitle action={<TextLink href="/progress/calendar">Calendar</TextLink>}>History</SectionTitle>
          {history.map((p, i) => (
            <Link
              key={p.workoutId}
              href={`/gym/history/${p.workoutId}`}
              className={`flex min-h-[62px] items-center gap-3 py-2 ${i < history.length - 1 ? "border-b border-line" : ""}`}
            >
              <DateTile
                top={formatInstant(p.date, tz, { month: "short" }).toUpperCase()}
                bottom={formatInstant(p.date, tz, { day: "numeric" })}
              />
              <span className="tabular min-w-0 flex-1 text-[15px] font-semibold">
                {countedSets(p.sets)
                  .map((s) => (s.weight > 0 ? `${formatWeight(s.weight)} × ${s.reps}` : `${s.reps}`))
                  .join(" · ")}
              </span>
              {!bodyweight ? (
                <span className="flex flex-col items-end">
                  <span className="text-xs text-muted">est. max</span>
                  <span className="tabular text-base font-bold">{p.metrics.estMax}</span>
                </span>
              ) : null}
            </Link>
          ))}
        </section>
      ) : null}
    </>
  );
}
