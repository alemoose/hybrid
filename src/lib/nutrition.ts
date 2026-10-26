// Pure food math: no database, no React. Tested in nutrition.test.ts.

export type Nutrients = { calories: number; protein: number; carbs: number; fat: number; sodium: number };

export type FoodItem = Nutrients & {
  name: string;
  quantity: number;
  unit: string;
};

export const ZERO: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 };

/** Items store per-unit values; totals multiply by quantity. */
export function totals(items: FoodItem[]): Nutrients {
  return items.reduce<Nutrients>(
    (t, i) => ({
      calories: t.calories + i.calories * i.quantity,
      protein: t.protein + i.protein * i.quantity,
      carbs: t.carbs + i.carbs * i.quantity,
      fat: t.fat + i.fat * i.quantity,
      sodium: t.sodium + i.sodium * i.quantity,
    }),
    { ...ZERO },
  );
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    sodium: a.sodium + b.sodium,
  };
}

/**
 * Restaurant kitchens use more oil and butter than people guess. Adds ~10%
 * of calories as fat to estimated items (never to official chain numbers).
 */
export function withRestaurantCooking(item: FoodItem): FoodItem {
  const extra = item.calories * 0.1;
  return { ...item, calories: item.calories + extra, fat: item.fat + extra / 9 };
}

export type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Daily sodium target in mg (US guideline: 2,300). */
  sodium: number;
  /** Extra sodium allowed on training days, for what's lost in sweat. */
  sodiumWorkoutBonus: number;
  /** Body weight drives the water baseline. */
  bodyWeight: number;
  /** Fixed daily water goal in oz; 0 means work it out. */
  waterOverride: number;
  /** Helps identify local restaurants, e.g. "Tuscaloosa, AL". */
  homeArea: string;
};

export const DEFAULT_GOALS: Goals = {
  calories: 2400,
  protein: 180,
  carbs: 250,
  fat: 75,
  sodium: 2300,
  sodiumWorkoutBonus: 500,
  bodyWeight: 180,
  waterOverride: 0,
  homeArea: "Tuscaloosa, AL",
};

export function sodiumGoalFor(goals: Goals, trained: boolean): number {
  return goals.sodium + (trained ? goals.sodiumWorkoutBonus : 0);
}

export type WaterPlan = { goal: number; base: number; training: number; salty: number };

/**
 * Starting point, not science: half your body weight (lb) in ounces,
 * plus 12 oz per 30 minutes trained, plus 8 oz after a salty day.
 * Rounded to the nearest 4 oz.
 */
export function waterGoal(input: {
  goals: Goals;
  trainedMinutes: number;
  yesterdaySodium: number;
}): WaterPlan {
  const { goals, trainedMinutes, yesterdaySodium } = input;
  if (goals.waterOverride > 0) return { goal: goals.waterOverride, base: goals.waterOverride, training: 0, salty: 0 };
  const base = Math.max(48, goals.bodyWeight / 2);
  const training = (Math.max(0, trainedMinutes) / 30) * 12;
  const salty = yesterdaySodium > goals.sodium * 1.25 ? 8 : 0;
  const round4 = (n: number) => Math.round(n / 4) * 4;
  return { goal: round4(base + training + salty), base: round4(base), training: round4(training), salty };
}

/** "On target" means within 10% of the calorie goal. */
export function calorieStatus(calories: number, goal: number): "none" | "hit" | "miss" {
  if (calories <= 0) return "none";
  return Math.abs(calories - goal) <= goal * 0.1 ? "hit" : "miss";
}

export function defaultMeal(hour: number): "breakfast" | "lunch" | "dinner" | "snack" {
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "$12.20", "12.2" or "12" to cents; null when blank or invalid. */
export function parseMoney(input: string): number | null {
  const n = Number.parseFloat(input.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Normalized text used to reuse earlier estimates for the same description. */
export function cacheKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
