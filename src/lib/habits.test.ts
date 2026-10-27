import { describe, expect, it } from "vitest";
import { consistency, streak } from "./habits";

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
