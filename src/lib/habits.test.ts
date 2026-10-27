import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { consistency, creatineLoadingDaysLeft, creatineStart, streak } from "./habits";

describe("streak", () => {
  const done = new Set(["2026-10-24", "2026-10-25", "2026-10-26"]);

  it("counts back from today, or from yesterday until today ends", () => {
    expect(streak(done, "2026-10-26")).toBe(3);
    expect(streak(done, "2026-10-27")).toBe(3);
    expect(streak(new Set([...done, "2026-10-27"]), "2026-10-27")).toBe(4);
  });

  it("resets after a missed day", () => {
    expect(streak(done, "2026-10-28")).toBe(0);
    expect(streak(new Set(), "2026-10-28")).toBe(0);
  });

  it("measures consistency", () => {
    expect(consistency(done, "2026-10-27", 4)).toBe(0.75);
  });
});

describe("creatine loading", () => {
  it("starts at the first day of the current run", () => {
    const run = new Set(["2026-08-01", "2026-10-10", "2026-10-15", "2026-10-26"]);
    expect(creatineStart(run, "2026-10-27")).toBe("2026-10-10");
    expect(creatineStart(new Set(), "2026-10-27")).toBeNull();
  });

  it("counts down four weeks from the start", () => {
    expect(creatineLoadingDaysLeft(new Set(["2026-10-20", "2026-10-26"]), "2026-10-27")).toBe(21);
    // Every other day since September: well past loading.
    const steady = new Set(Array.from({ length: 29 }, (_, i) => addDays("2026-09-01", i * 2)));
    expect(creatineLoadingDaysLeft(steady, "2026-10-27")).toBe(0);
    // A three-week break restarts it.
    expect(creatineLoadingDaysLeft(new Set([...steady, "2026-11-20"]), "2026-11-20")).toBe(28);
  });

  it("ends if you stopped taking it", () => {
    expect(creatineLoadingDaysLeft(new Set(["2026-10-01"]), "2026-10-27")).toBe(0);
  });
});
