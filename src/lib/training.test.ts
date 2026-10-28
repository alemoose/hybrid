import { describe, expect, it } from "vitest";
import {
  estimateOneRepMax,
  formVideoUrl,
  nextRoutineId,
  sessionMetrics,
  suggestNext,
  type LoggedSet,
} from "./training";

const w = (weight: number, reps: number): LoggedSet => ({ kind: "working", weight, reps });
const warm = (weight: number, reps: number): LoggedSet => ({ kind: "warmup", weight, reps });

describe("estimateOneRepMax", () => {
  it("uses Epley and returns the weight for a single", () => {
    expect(estimateOneRepMax(205, 6)).toBe(246);
    expect(estimateOneRepMax(300, 1)).toBe(300);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});

describe("sessionMetrics", () => {
  it("ignores warm-ups", () => {
    const m = sessionMetrics([warm(95, 10), w(205, 6), w(205, 6), w(195, 8)])!;
    expect(m.heaviest).toBe(205);
    expect(m.estMax).toBe(247); // 195 × 8
    expect(m.volume).toBe(205 * 6 * 2 + 195 * 8);
    expect(m.bestSet).toEqual({ weight: 195, reps: 8, volume: 1560 });
    expect(m.totalReps).toBe(20);
  });

  it("returns null when nothing counted", () => {
    expect(sessionMetrics([warm(95, 10)])).toBeNull();
  });
});

describe("suggestNext", () => {
  const base = { targetSets: 3, targetReps: 8, increment: 5 };

  it("returns null without history", () => {
    expect(suggestNext({ ...base, history: [] })).toBeNull();
  });

  it("adds weight after hitting every rep", () => {
    const s = suggestNext({ ...base, history: [[warm(95, 10), w(135, 8), w(135, 8), w(135, 8)]] })!;
    expect(s).toMatchObject({ weight: 140, reps: 8, change: "up", label: "+5 lb" });
  });

  it("adds a rep when short of the target", () => {
    const s = suggestNext({ ...base, history: [[w(205, 6), w(205, 6)]], targetSets: 2 })!;
    expect(s).toMatchObject({ weight: 205, reps: 7, change: "reps" });
  });

  it("repeats when one rep short of the target", () => {
    const s = suggestNext({ ...base, history: [[w(85, 8), w(85, 7), w(85, 7)]] })!;
    expect(s).toMatchObject({ weight: 85, reps: 8, change: "repeat", label: "Repeat" });
  });

  it("doesn't count fewer sets than planned as a hit", () => {
    const s = suggestNext({ ...base, history: [[w(135, 8), w(135, 8)]] })!;
    expect(s.change).toBe("repeat");
  });

  it("suggests a deload after three stalled sessions", () => {
    const stalled = [w(185, 6), w(185, 6), w(185, 5)];
    const s = suggestNext({ ...base, history: [stalled, stalled, stalled] })!;
    expect(s).toMatchObject({ weight: 165, change: "deload" });
  });

  it("progresses bodyweight moves by reps", () => {
    const s = suggestNext({ ...base, increment: 0, history: [[w(0, 8), w(0, 7)]] })!;
    expect(s).toMatchObject({ weight: 0, reps: 8, change: "reps" });
  });
});

describe("nextRoutineId", () => {
  it("rotates through routines in order", () => {
    expect(nextRoutineId([1, 2, 3], null)).toBe(1);
    expect(nextRoutineId([1, 2, 3], 1)).toBe(2);
    expect(nextRoutineId([1, 2, 3], 3)).toBe(1);
    expect(nextRoutineId([1, 2, 3], 99)).toBe(1);
    expect(nextRoutineId([], 1)).toBeNull();
  });
});

describe("formVideoUrl", () => {
  it("puts the equipment first and asks for form", () => {
    expect(decodeURIComponent(formVideoUrl("Lateral Raise (Dumbbell)"))).toContain("search_query=dumbbell lateral raise proper form");
    expect(decodeURIComponent(formVideoUrl("Pull-Up"))).toContain("search_query=pull-up proper form");
  });
});
