import { describe, expect, it } from "vitest";
import { defaultPrefs, prefsForPrompt } from "./training-prefs";

describe("training prefs", () => {
  it("guesses experience from logged workouts", () => {
    expect(defaultPrefs(5).experience).toBe("new");
    expect(defaultPrefs(80).experience).toBe("some");
    expect(defaultPrefs(300).experience).toBe("experienced");
  });

  it("tells the model about beginners and skipped equipment", () => {
    const lines = prefsForPrompt({ experience: "new", equipment: ["machine", "cable", "dumbbell", "bodyweight"], gym: "My gym" }).join("\n");
    expect(lines).toContain("4–5 exercises a day");
    expect(lines).toContain("not comfortable with kettlebells, barbells & racks, smith machine");
    expect(lines).toContain("weight-stack");
    expect(lines).toContain("Their gym: My gym");
  });

  it("says nothing extra when everything is fine", () => {
    const lines = prefsForPrompt({ ...defaultPrefs(300), gym: "" });
    expect(lines).toHaveLength(1);
  });
});
