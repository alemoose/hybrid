import { describe, expect, it } from "vitest";
import { hasReminders, pickReminder, showsOnToday } from "./reminders";

const r = { name: "Her", notes: ["a", "b", "c"], photoIds: [4, 9] };

describe("reminders", () => {
  it("picks the same reminder for the same seed", () => {
    expect(pickReminder(r, "2026-10-27")).toEqual(pickReminder(r, "2026-10-27"));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickReminder(r, `rest-${i}`).note));
    expect(seen.size).toBe(3);
  });

  it("handles notes or photos alone", () => {
    expect(pickReminder({ ...r, photoIds: [] }, "x").photoId).toBeNull();
    expect(pickReminder({ ...r, notes: [] }, "x").note).toBeNull();
    expect(hasReminders({ name: "", notes: [], photoIds: [] })).toBe(false);
  });

  it("shows on Today about a third of the time", () => {
    const days = Array.from({ length: 300 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}-${i}`);
    const share = days.filter(showsOnToday).length / days.length;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.45);
  });
});
