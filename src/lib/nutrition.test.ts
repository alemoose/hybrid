import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOALS,
  cacheKey,
  calorieStatus,
  defaultMeal,
  parseMoney,
  sodiumGoalFor,
  totals,
  waterGoal,
  withRestaurantCooking,
  type FoodItem,
} from "./nutrition";

const taco: FoodItem = { name: "Taco", quantity: 3, unit: "taco", calories: 190, protein: 13, carbs: 14, fat: 9, sodium: 400 };

describe("totals", () => {
  it("multiplies per-unit values by quantity", () => {
    expect(totals([taco])).toEqual({ calories: 570, protein: 39, carbs: 42, fat: 27, sodium: 1200 });
  });
});

describe("withRestaurantCooking", () => {
  it("adds 10% of calories as fat", () => {
    const t = withRestaurantCooking({ ...taco, quantity: 1 });
    expect(t.calories).toBeCloseTo(209);
    expect(t.fat).toBeCloseTo(9 + 19 / 9);
    expect(t.sodium).toBe(400);
  });
});

describe("water and sodium goals", () => {
  it("starts from half your body weight in ounces", () => {
    expect(waterGoal({ goals: DEFAULT_GOALS, trainedMinutes: 0, yesterdaySodium: 0 }).goal).toBe(92);
  });

  it("adds for training and a salty day", () => {
    const plan = waterGoal({ goals: DEFAULT_GOALS, trainedMinutes: 60, yesterdaySodium: 3500 });
    expect(plan).toMatchObject({ base: 92, training: 24, salty: 8, goal: 124 });
  });

  it("respects a fixed goal", () => {
    expect(waterGoal({ goals: { ...DEFAULT_GOALS, waterOverride: 100 }, trainedMinutes: 60, yesterdaySodium: 0 }).goal).toBe(100);
  });

  it("allows extra sodium on training days", () => {
    expect(sodiumGoalFor(DEFAULT_GOALS, false)).toBe(2300);
    expect(sodiumGoalFor(DEFAULT_GOALS, true)).toBe(2800);
  });
});

describe("small helpers", () => {
  it("rates calories against the goal", () => {
    expect(calorieStatus(0, 2400)).toBe("none");
    expect(calorieStatus(2300, 2400)).toBe("hit");
    expect(calorieStatus(2900, 2400)).toBe("miss");
  });

  it("guesses the meal from the hour", () => {
    expect(defaultMeal(8)).toBe("breakfast");
    expect(defaultMeal(12)).toBe("lunch");
    expect(defaultMeal(19)).toBe("dinner");
    expect(defaultMeal(23)).toBe("snack");
  });

  it("parses prices", () => {
    expect(parseMoney("$12.20")).toBe(1220);
    expect(parseMoney("5")).toBe(500);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });

  it("normalizes cache keys", () => {
    expect(cacheKey("  Chipotle chicken BOWL, extra guac! ")).toBe("chipotle chicken bowl extra guac");
  });
});
