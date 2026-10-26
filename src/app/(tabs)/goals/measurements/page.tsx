import { PageHeader, SectionLabel } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { MEASUREMENT_LABEL, measurementHistory, measurementSnapshots } from "@/lib/goal-queries";
import { DeleteButton } from "../weight/weight-forms";
import { MeasurementForm } from "./measurement-form";

export default async function MeasurementsPage() {
  const [tz, history, { latest }] = await Promise.all([getTimeZone(), measurementHistory(80), measurementSnapshots()]);
  const last = Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v?.value ?? null]));
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title="Measurements" />
      <p className="px-1 text-sm leading-relaxed text-muted">
        Measure in the morning, relaxed, tape snug but not tight. Fill in any you want; blanks are skipped.
      </p>
      <MeasurementForm last={last} />
      {history.length > 0 ? (
        <>
          <SectionLabel>History</SectionLabel>
          <ul className="flex flex-col rounded-3xl border border-line bg-card px-4">
            {history.map((m, i) => (
              <li key={m.id} className={`flex h-12 items-center gap-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="w-24 text-[13px] text-muted">{formatInstant(m.loggedAt, tz, { month: "short", day: "numeric" })}</span>
                <span className="flex-1 text-[15px] text-ink-2">{MEASUREMENT_LABEL[m.kind] ?? m.kind}</span>
                <span className="tabular text-[15px] font-bold">{m.value.toFixed(1)} in</span>
                <DeleteButton id={m.id} kind="measurement" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
