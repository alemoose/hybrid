import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "./db/exercise-library";
import { guideFor } from "./exercise-guide";
import { EXERCISE_GUIDES } from "./exercise-guides";

describe("guideFor", () => {
  it("finds a guide by slug or by name, without the filler last step", () => {
    const bySlug = guideFor({ slug: "lateral-raise-dumbbell" });
    expect(bySlug?.photos).toEqual(["/exercise-guides/lateral-raise-dumbbell-0.jpg", "/exercise-guides/lateral-raise-dumbbell-1.jpg"]);
    expect(bySlug?.steps.some((s) => /^repeat/i.test(s))).toBe(false);
    expect(guideFor({ name: "Lateral Raise (Dumbbell)" })).toEqual(bySlug);
    expect(guideFor({ name: "My made-up move" })).toBeNull();
  });

  it("covers only real exercises, each with both photos", () => {
    const slugs = new Set(EXERCISE_LIBRARY.map((e) => e.slug));
    for (const slug of Object.keys(EXERCISE_GUIDES)) {
      expect(slugs.has(slug), slug).toBe(true);
      for (const i of [0, 1]) expect(existsSync(join(process.cwd(), "public/exercise-guides", `${slug}-${i}.jpg`)), slug).toBe(true);
    }
  });
});
