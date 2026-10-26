import type { PillTone } from "@/components/ui";
import type { TargetLine } from "./queries";

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function changeTone(change: TargetLine["change"]): PillTone {
  switch (change) {
    case "up":
      return "green";
    case "repeat":
      return "yellow";
    case "deload":
      return "pink";
    default:
      return "blue";
  }
}

export function daysSinceText(days: number | null): string {
  if (days == null) return "Not done yet";
  if (days === 0) return "Done today";
  if (days === 1) return "Yesterday";
  return `${days} days since`;
}
