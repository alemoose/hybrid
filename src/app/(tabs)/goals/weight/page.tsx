import { PageHeader, SectionLabel } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { listWeights } from "@/lib/goal-queries";
import { getBodyGoal } from "@/lib/settings";
import { QuickWeight } from "../goal-widgets";
import { DeleteButton, GoalWeightForm } from "./weight-forms";

export default async function WeightPage() {
  const [tz, goal, weights] = await Promise.all([getTimeZone(), getBodyGoal(), listWeights()]);
  const latest = weights[weights.length - 1];
  return (
    <>
      <PageHeader back="/goals" eyebrow="Goals" title="Weight" />
      <SectionLabel>Log today</SectionLabel>
      <QuickWeight placeholder={latest ? latest.weight.toFixed(1) : "Weight"} />
      <SectionLabel>Goal</SectionLabel>
      <GoalWeightForm goalWeight={goal?.goalWeight ?? null} pace={goal?.pace ?? 0} currentWeight={latest?.weight ?? null} />
      {weights.length > 0 ? (
        <>
          <SectionLabel>History</SectionLabel>
          <ul className="flex flex-col rounded-3xl border border-line bg-card px-4">
            {[...weights].reverse().map((w, i) => (
              <li key={w.id} className={`flex h-12 items-center gap-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="flex-1 text-[15px] text-ink-2">
                  {formatInstant(w.at, tz, { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="tabular text-[15px] font-bold">{w.weight.toFixed(1)} lb</span>
                <DeleteButton id={w.id} kind="weight" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
