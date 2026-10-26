import { describe, expect, it } from "vitest";
import {
  defaultPace,
  goalProgress,
  pacesFor,
  maintenanceCalories,
  projectGoalDate,
  restingCalories,
  suggestTargets,
  weeklyAverages,
  weightTrend,
} from "./body";

const DAY = 86_400_000;
const profile = { sex: "male" as const, age: 22, heightIn: 70, activity: "moderate" as const };

describe("calorie suggestions", () => {
  it("uses Mifflin-St Jeor", () => {
    // 180 lb = 81.65 kg, 70 in = 177.8 cm: 816.5 + 1111.25 - 110 + 5
    expect(restingCalories({ ...profile, weightLb: 180 })).toBeCloseTo(1822.7, 0);
    expect(maintenanceCalories({ ...profile, weightLb: 180 })).toBeCloseTo(2825, -1);
  });

  it("subtracts for a cut and splits macros", () => {
    const t = suggestTargets({ ...profile, weightLb: 182, goalWeightLb: 175, pace: -0.5 });
    expect(t.calories).toBe(2600); // ~2,850 maintenance - 250
    expect(t.protein).toBe(175);
    expect(t.fat).toBe(80);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeGreaterThan(t.calories - 40);
  });

  it("never suggests crash-diet calories", () => {
    const t = suggestTargets({ ...profile, sex: "female", age: 60, heightIn: 60, weightLb: 110, goalWeightLb: 100, activity: "light", pace: -1 });
    expect(t.calories).toBe(1200);
  });
});

describe("weightTrend", () => {
  const now = Date.UTC(2026, 9, 26);
  const daily = (start: number, perDay: number, days: number) =>
    Array.from({ length: days }, (_, i) => ({ at: now - (days - 1 - i) * DAY, weight: start + perDay * i }));

  it("averages the last week and fits a weekly rate", () => {
    const t = weightTrend(daily(186, -0.1, 28), now);
    expect(t.ratePerWeek).toBeCloseTo(-0.7, 5);
    expect(t.current).toBeCloseTo(186 - 0.1 * 24, 5);
  });

  it("needs about a week of data before giving a rate", () => {
    expect(weightTrend(daily(180, 0, 3), now).ratePerWeek).toBeNull();
    expect(weightTrend([], now).current).toBeNull();
  });
});

describe("projectGoalDate", () => {
  const now = Date.UTC(2026, 9, 26);
  it("projects when heading toward the goal", () => {
    const d = projectGoalDate(182, 175, -0.5, now)!;
    expect(Math.round((d.getTime() - now) / (7 * DAY))).toBe(14);
  });

  it("returns null when moving away or too slow", () => {
    expect(projectGoalDate(182, 175, 0.2, now)).toBeNull();
    expect(projectGoalDate(182, 175, -0.01, now)).toBeNull();
    expect(projectGoalDate(182, 175, null, now)).toBeNull();
  });
});

describe("goalProgress", () => {
  it("handles goals that go down or up", () => {
    expect(goalProgress(36, 34.5, 32)).toBeCloseTo(0.375);
    expect(goalProgress(5, 8, 15)).toBeCloseTo(0.3);
    expect(goalProgress(5, 3, 15)).toBe(0);
    expect(goalProgress(5, 20, 15)).toBe(1);
  });
});

describe("weeklyAverages", () => {
  it("groups by week and skips empty ones", () => {
    const now = Date.UTC(2026, 9, 26);
    const pts = weeklyAverages(
      [
        { at: now - 1 * DAY, weight: 182 },
        { at: now - 2 * DAY, weight: 184 },
        { at: now - 15 * DAY, weight: 186 },
      ],
      now,
      4,
    );
    expect(pts.map((p) => p.weight)).toEqual([186, 183]);
  });
});

describe("paces", () => {
  it("only offers paces toward the goal", () => {
    expect(pacesFor(140, 160).map((p) => p.value)).toEqual([0, 0.25, 0.5, 1]);
    expect(pacesFor(182, 175).map((p) => p.value)).toEqual([-1, -0.5, 0]);
    expect(pacesFor(null, 160)).toHaveLength(6);
  });

  it("defaults to half a pound a week in the goal's direction", () => {
    expect(defaultPace(140, 160)).toBe(0.5);
    expect(defaultPace(182, 175)).toBe(-0.5);
    expect(defaultPace(150, 150.5)).toBe(0);
  });

  it("adds a surplus for a gain", () => {
    const base = { sex: "male" as const, age: 20, heightIn: 70, activity: "moderate" as const, weightLb: 140, goalWeightLb: 160 };
    expect(suggestTargets({ ...base, pace: 0.5 }).calories - suggestTargets({ ...base, pace: 0 }).calories).toBe(250);
  });
});
