// Pure body math: calorie suggestions, weight trend and goal progress.
// No database, no React. Tested in body.test.ts.

export type Sex = "male" | "female";

export const ACTIVITY = {
  light: { label: "Light", detail: "1–2 workouts a week", factor: 1.375 },
  moderate: { label: "Moderate", detail: "3–4 workouts a week", factor: 1.55 },
  active: { label: "Active", detail: "5–6 workouts a week", factor: 1.725 },
  very: { label: "Very active", detail: "Daily training or a physical job", factor: 1.9 },
} as const;
export type Activity = keyof typeof ACTIVITY;

export const PACES = [
  { value: -1, label: "Lose faster", detail: "1 lb a week" },
  { value: -0.5, label: "Lose steady", detail: "½ lb a week" },
  { value: 0, label: "Maintain", detail: "Stay around here" },
  { value: 0.25, label: "Lean gain", detail: "+¼ lb a week, least fat" },
  { value: 0.5, label: "Gain steady", detail: "+½ lb a week" },
  { value: 1, label: "Gain faster", detail: "+1 lb a week, some fat too" },
] as const;

const DIRECTION_GAP = 1;

/** Only the paces that head toward the goal (plus maintain); all of them while either weight is unknown. */
export function pacesFor(current: number | null, goal: number | null) {
  if (current == null || goal == null || Math.abs(goal - current) < DIRECTION_GAP) return PACES;
  return PACES.filter((p) => p.value === 0 || Math.sign(p.value) === Math.sign(goal - current));
}

/** A sensible pace once the goal's direction is known: ½ lb a week either way. */
export function defaultPace(current: number | null, goal: number | null): number {
  if (current == null || goal == null || Math.abs(goal - current) < DIRECTION_GAP) return 0;
  return goal > current ? 0.5 : -0.5;
}

export type Profile = {
  sex: Sex;
  age: number;
  heightIn: number;
  activity: Activity;
};

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Mifflin-St Jeor resting energy, in kcal/day. */
export function restingCalories(p: Profile & { weightLb: number }): number {
  const kg = p.weightLb * 0.453592;
  const cm = p.heightIn * 2.54;
  return 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === "male" ? 5 : -161);
}

export function maintenanceCalories(p: Profile & { weightLb: number }): number {
  return restingCalories(p) * ACTIVITY[p.activity].factor;
}

export type FoodTargets = { calories: number; protein: number; carbs: number; fat: number };

/**
 * A starting point you can edit: maintenance adjusted for the chosen pace
 * (3,500 kcal ≈ 1 lb), protein at ~1 g per lb of goal weight, fat at ~28%
 * of calories, carbs fill the rest.
 */
export function suggestTargets(p: Profile & { weightLb: number; goalWeightLb: number; pace: number }): FoodTargets {
  const maintenance = maintenanceCalories(p);
  const floor = p.sex === "male" ? 1500 : 1200;
  const calories = Math.max(floor, round(maintenance + (p.pace * 3500) / 7, 50));
  const protein = round(Math.min(Math.max(p.goalWeightLb, p.weightLb * 0.8), p.weightLb * 1.1), 5);
  const fat = round((calories * 0.28) / 9, 5);
  const carbs = Math.max(50, round((calories - protein * 4 - fat * 9) / 4, 5));
  return { calories, protein, carbs, fat };
}

export type WeighIn = { at: number; weight: number };

const DAY = 86_400_000;

/**
 * Daily weight swings 2–4 lb with water and salt, so "now" is the average of
 * the last 7 days of weigh-ins, and the rate is a straight-line fit over the
 * last 4 weeks.
 */
export function weightTrend(entries: WeighIn[], now: number): { current: number | null; ratePerWeek: number | null } {
  if (entries.length === 0) return { current: null, ratePerWeek: null };
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  const recent = sorted.filter((e) => e.at > now - 7 * DAY);
  const pool = recent.length ? recent : sorted.slice(-1);
  const current = pool.reduce((t, e) => t + e.weight, 0) / pool.length;

  const window = sorted.filter((e) => e.at >= now - 28 * DAY);
  if (window.length < 2 || window[window.length - 1].at - window[0].at < 6 * DAY) {
    return { current, ratePerWeek: null };
  }
  const xs = window.map((e) => e.at / DAY);
  const ys = window.map((e) => e.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return { current, ratePerWeek: den === 0 ? 0 : (num / den) * 7 };
}

/** When the goal is reached at the current rate, or null if it isn't heading there (or > 2 years out). */
export function projectGoalDate(current: number, goal: number, ratePerWeek: number | null, now: number): Date | null {
  if (ratePerWeek == null) return null;
  const remaining = goal - current;
  if (Math.abs(remaining) < 0.5) return new Date(now);
  if (ratePerWeek === 0 || Math.sign(remaining) !== Math.sign(ratePerWeek)) return null;
  const weeks = remaining / ratePerWeek;
  return weeks > 104 ? null : new Date(now + weeks * 7 * DAY);
}

/** 0–1 progress from start toward target; works for goals that go down (waist) or up (pull-ups). */
export function goalProgress(start: number, now: number, target: number): number {
  if (target === start) return now === target ? 1 : 0;
  return Math.min(1, Math.max(0, (now - start) / (target - start)));
}

export const MEASUREMENTS = [
  { key: "shoulders", label: "Shoulders" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "arms", label: "Arms" },
  { key: "thighs", label: "Thighs" },
  { key: "neck", label: "Neck" },
] as const;
export type MeasurementKey = (typeof MEASUREMENTS)[number]["key"];

/** Weekly average weights for the chart, oldest first; weeks without weigh-ins are skipped. */
export function weeklyAverages(entries: WeighIn[], now: number, weeks = 12): WeighIn[] {
  const out: WeighIn[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now - w * 7 * DAY;
    const inWeek = entries.filter((e) => e.at > end - 7 * DAY && e.at <= end);
    if (inWeek.length) {
      out.push({ at: end - 3.5 * DAY, weight: inWeek.reduce((t, e) => t + e.weight, 0) / inWeek.length });
    }
  }
  return out;
}
