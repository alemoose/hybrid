import type { Adjustment } from "@/lib/checkin";
import type { CalorieChange } from "@/lib/checkin-queries";
import { formatDayKey } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

export function formatRate(rate: number): string {
  const r = Math.round(rate * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)} lb/week`;
}

export function paceText(pace: number): string {
  if (pace === 0) return "maintain";
  const amount = Math.abs(pace) === 0.5 ? "½" : Math.abs(pace) === 0.25 ? "¼" : String(Math.abs(pace));
  return `${pace > 0 ? "+" : "−"}${amount} lb/week`;
}

/** Headline and explanation for a check-in result. */
export function verdict(
  a: Adjustment | { kind: "cooldown"; change: CalorieChange; daysLeft: number },
  ctx: { pace: number; calorieGoal: number },
): { title: string; body: string; tone: "good" | "gold" | "muted" } {
  const pace = paceText(ctx.pace);
  switch (a.kind) {
    case "need-weights":
      return {
        title: "Weigh in a few more times",
        body: "The trend needs about two weeks of weigh-ins, three or more a week. Same time each day works best: mornings, after the bathroom, before eating.",
        tone: "muted",
      };
    case "need-food":
      return {
        title: "Log a few more days",
        body: `You logged ${a.loggedDays} of the last 7 days. Log at least 4 so the averages can be trusted.`,
        tone: "muted",
      };
    case "on-track":
      return {
        title: "Right on pace",
        body: `You're at ${formatRate(a.rate)} and your pace is ${pace}. Keep calories where they are.`,
        tone: "good",
      };
    case "hit-goal-first":
      return a.direction === "more"
        ? {
            title: `Eat your ${formatNumber(ctx.calorieGoal)} first`,
            body: `You're at ${formatRate(a.rate)} (pace ${pace}), but you averaged ${formatNumber(a.avgCalories)}, about ${formatNumber(ctx.calorieGoal - a.avgCalories)} under your goal. Hit the goal for a week before raising it: a shake, an extra side, or a bigger lunch closes the gap.`,
            tone: "gold",
          }
        : {
            title: `Stay near your ${formatNumber(ctx.calorieGoal)}`,
            body: `You're at ${formatRate(a.rate)} (pace ${pace}), and you averaged ${formatNumber(a.avgCalories)}, about ${formatNumber(a.avgCalories - ctx.calorieGoal)} over your goal. Stick to the goal for a week before lowering it.`,
            tone: "gold",
          };
    case "change":
      return {
        title: `${a.delta > 0 ? "Bump" : "Ease"} calories to ${formatNumber(a.calories)}`,
        body: `You're at ${formatRate(a.rate)} and your pace is ${pace}, while eating close to your goal. ${a.delta > 0 ? "+" : "−"}${Math.abs(a.delta)} kcal a day, all from carbs, should ${a.delta > 0 ? "get the scale moving" : "slow it to your pace"}.`,
        tone: "gold",
      };
    case "cooldown":
      return {
        title: `Calories changed to ${formatNumber(a.change.to)}`,
        body: `You changed from ${formatNumber(a.change.from)} on ${formatDayKey(a.change.day, { month: "short", day: "numeric" })}. Give it ${a.daysLeft} more ${a.daysLeft === 1 ? "day" : "days"} to show up on the scale before changing again.`,
        tone: "muted",
      };
  }
}
