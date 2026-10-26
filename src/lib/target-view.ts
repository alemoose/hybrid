import type { TargetStatus } from "./goal-queries";

/** Text for a target value: ratios to 2 decimals, inches to 1, lifts and reps whole. */
export function formatTargetValue(n: number, unit: string): string {
  if (unit === "") return n.toFixed(2);
  if (unit === " in") return `${n.toFixed(1).replace(/\.0$/, "")} in`;
  return `${Math.round(n)}${unit}`;
}

export function toTargetView(s: TargetStatus) {
  return {
    id: s.target.id,
    label: s.target.label,
    now: s.current != null ? formatTargetValue(s.current, s.unit) : "—",
    goal: formatTargetValue(s.target.targetValue, s.unit),
  };
}
