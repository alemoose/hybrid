import { describe, expect, it } from "vitest";
import { carbsFor, suggestAdjustment, weekAverages } from "./checkin";

const base = { pace: 0.5, calorieGoal: 2700, avgCalories: 2680, loggedDays: 6 };

describe("suggestAdjustment", () => {
  it("waits for weigh-ins and food logs", () => {
    expect(suggestAdjustment({ ...base, rate: null }).kind).toBe("need-weights");
    expect(suggestAdjustment({ ...base, rate: 0, loggedDays: 3 })).toEqual({ kind: "need-food", loggedDays: 3 });
  });

  it("leaves a goal alone when the scale is near the pace", () => {
    expect(suggestAdjustment({ ...base, rate: 0.35 }).kind).toBe("on-track");
    expect(suggestAdjustment({ ...base, rate: 0.7 }).kind).toBe("on-track");
  });

  it("raises calories for a stalled bulk you've been eating to", () => {
    // 0.5 lb/week behind ≈ 250 kcal, capped at 200.
    expect(suggestAdjustment({ ...base, rate: 0 })).toEqual({ kind: "change", rate: 0, delta: 200, calories: 2900 });
    // 0.2 behind ≈ 100.
    expect(suggestAdjustment({ ...base, rate: 0.2, pace: 0.5 })).toMatchObject({ kind: "change", delta: 150 });
  });

  it("says to eat the goal first when you're under it", () => {
    expect(suggestAdjustment({ ...base, rate: 0, avgCalories: 2300 })).toMatchObject({ kind: "hit-goal-first", direction: "more" });
  });

  it("lowers calories when gaining too fast, or a cut that stalled", () => {
    expect(suggestAdjustment({ ...base, rate: 1.3 })).toMatchObject({ kind: "change", delta: -200, calories: 2500 });
    expect(suggestAdjustment({ pace: -0.5, rate: 0, calorieGoal: 2200, avgCalories: 2190, loggedDays: 7 })).toMatchObject({
      kind: "change",
      delta: -200,
    });
    expect(suggestAdjustment({ pace: -0.5, rate: 0, calorieGoal: 2200, avgCalories: 2600, loggedDays: 7 })).toMatchObject({
      kind: "hit-goal-first",
      direction: "less",
    });
  });

  it("never goes under the floor", () => {
    expect(suggestAdjustment({ pace: -1, rate: 0, calorieGoal: 1250, avgCalories: 1250, loggedDays: 7 })).toMatchObject({
      kind: "change",
      calories: 1200,
      delta: -50,
    });
  });
});

describe("week helpers", () => {
  it("moves carbs with calories", () => {
    expect(carbsFor(330, 200)).toBe(380);
    expect(carbsFor(60, -200)).toBe(50);
  });

  it("averages logged days only", () => {
    const day = (calories: number, meals = 2) => ({ calories, protein: 100, sodium: calories, spentCents: 500, meals });
    const w = weekAverages([day(2000), day(3000), day(0, 0)], 2300);
    expect(w).toEqual({ loggedDays: 2, avgCalories: 2500, avgProtein: 100, saltyDays: 1, spentCents: 1500 });
  });
});
