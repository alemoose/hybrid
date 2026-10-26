import { describe, expect, it } from "vitest";
import { dayKey, localHour, zonedTime } from "./dates";

describe("zonedTime", () => {
  it("finds local noon in another time zone", () => {
    const t = zonedTime("2026-10-26", 12, "America/Chicago");
    expect(t.toISOString()).toBe("2026-10-26T17:00:00.000Z");
    expect(dayKey(t, "America/Chicago")).toBe("2026-10-26");
    expect(localHour(t, "America/Chicago")).toBe(12);
  });
});
