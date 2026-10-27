// Weekly check-in math: is the scale moving at the chosen pace, and should the
// calorie goal change? No database, no React. Tested in checkin.test.ts.

/** Within this many lb/week of the pace counts as on track; scale noise is bigger than that. */
const ON_TRACK = 0.25;
/** Eating this far from the goal means the goal isn't the problem yet. */
const ADHERENCE_GAP = 150;
/** One change at a time, then let the scale catch up. */
const MIN_STEP = 100;
const MAX_STEP = 200;
export const ADJUST_COOLDOWN_DAYS = 14;

export type Adjustment =
  | { kind: "need-weights" }
  | { kind: "need-food"; loggedDays: number }
  | { kind: "on-track"; rate: number }
  | { kind: "hit-goal-first"; rate: number; avgCalories: number; direction: "more" | "less" }
  | { kind: "change"; rate: number; delta: number; calories: number }
  /** Would lower calories, but creatine water weight is still settling. */
  | { kind: "creatine-hold"; rate: number; daysLeft: number };

const round50 = (n: number) => Math.round(n / 50) * 50;

/**
 * 1 lb/week ≈ 500 kcal/day. If the scale is off pace and you've been eating
 * your goal, move the goal 100–200 kcal toward the pace. If you haven't been
 * eating your goal, say that instead: raising a goal you're not hitting won't help.
 */
export function suggestAdjustment(input: {
  pace: number;
  /** Weekly rate from the weight trend, or null without ~2 weeks of weigh-ins. */
  rate: number | null;
  calorieGoal: number;
  avgCalories: number;
  loggedDays: number;
  minCalories?: number;
  /** Days left in a creatine loading phase; its water weight makes the scale run fast. */
  creatineDaysLeft?: number;
}): Adjustment {
  const { pace, rate, calorieGoal, avgCalories, loggedDays } = input;
  if (rate == null) return { kind: "need-weights" };
  if (loggedDays < 4) return { kind: "need-food", loggedDays };
  const off = rate - pace;
  if (Math.abs(off) <= ON_TRACK) return { kind: "on-track", rate };

  const needed = -off * 500;
  if (needed < 0 && (input.creatineDaysLeft ?? 0) > 0) return { kind: "creatine-hold", rate, daysLeft: input.creatineDaysLeft! };
  if (needed > 0 && avgCalories < calorieGoal - ADHERENCE_GAP) {
    return { kind: "hit-goal-first", rate, avgCalories, direction: "more" };
  }
  if (needed < 0 && avgCalories > calorieGoal + ADHERENCE_GAP) {
    return { kind: "hit-goal-first", rate, avgCalories, direction: "less" };
  }
  const step = Math.min(MAX_STEP, Math.max(MIN_STEP, round50(Math.abs(needed))));
  const delta = Math.sign(needed) * step;
  const calories = Math.max(input.minCalories ?? 1200, calorieGoal + delta);
  return calories === calorieGoal ? { kind: "on-track", rate } : { kind: "change", rate, delta: calories - calorieGoal, calories };
}

/** Carbs absorb a calorie change; protein and fat stay put. */
export function carbsFor(carbs: number, delta: number): number {
  return Math.max(50, Math.round((carbs + delta / 4) / 5) * 5);
}

export type DayFood = { calories: number; protein: number; sodium: number; spentCents: number; meals: number };

export function weekAverages(days: DayFood[], sodiumGoal: number) {
  const logged = days.filter((d) => d.meals > 0);
  const avg = (pick: (d: DayFood) => number) => (logged.length ? Math.round(logged.reduce((t, d) => t + pick(d), 0) / logged.length) : 0);
  return {
    loggedDays: logged.length,
    avgCalories: avg((d) => d.calories),
    avgProtein: avg((d) => d.protein),
    saltyDays: logged.filter((d) => d.sodium > sodiumGoal).length,
    spentCents: days.reduce((t, d) => t + d.spentCents, 0),
  };
}
