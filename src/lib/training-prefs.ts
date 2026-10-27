// What the program designer should know about you and your gym. No database.
import type { Equipment } from "./db/exercise-library";

export const EXPERIENCE = {
  new: { label: "New", detail: "Under 6 months" },
  some: { label: "Some", detail: "6 months to 2 years" },
  experienced: { label: "Experienced", detail: "2+ years" },
} as const;
export type Experience = keyof typeof EXPERIENCE;

/** Equipment chips, in the order they're shown. */
export const EQUIPMENT_CHOICES: { value: Equipment; label: string }[] = [
  { value: "machine", label: "Machines" },
  { value: "cable", label: "Cables" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "kettlebell", label: "Kettlebells" },
  { value: "barbell", label: "Barbells & racks" },
  { value: "smith", label: "Smith machine" },
];

/** From UREC's weight rooms page; editable in the designer. */
export const SRC_GYM =
  "University of Alabama Student Recreation Center (SRC). Main weight room: two multi-cable stations, weight-stack and plate-loaded machines, seven Hammer Strength power racks, two glute drives, dumbbells from 5 to about 100 lb. Resistance Training Room (RTR) at the back: Hammer Strength belt squat/dip machine, three combo racks, two cable stations, a glute drive, free weights and kettlebells.";

export type TrainingPrefs = { experience: Experience; equipment: Equipment[]; gym: string };

/** First-time defaults: experience from how many workouts are logged; every kind of equipment. */
export function defaultPrefs(workoutsLogged: number): TrainingPrefs {
  return {
    experience: workoutsLogged < 40 ? "new" : workoutsLogged < 200 ? "some" : "experienced",
    equipment: EQUIPMENT_CHOICES.map((c) => c.value),
    gym: SRC_GYM,
  };
}

/** Lines for the model about how to train this person. */
export function prefsForPrompt(prefs: TrainingPrefs): string[] {
  const lines: string[] = [];
  if (prefs.experience === "new") {
    lines.push(
      "Experience: new to lifting (under 6 months). Keep it simple: 4–5 exercises a day, 2–3 working sets each, mostly 8–12 reps (nothing under 6), one main movement per muscle, and movements that are easy to learn. Leave 1–2 reps in the tank. Add a short note on the first exercise of each day about starting light and learning the movement.",
    );
  } else if (prefs.experience === "some") {
    lines.push("Experience: 6 months to 2 years of lifting.");
  } else {
    lines.push("Experience: 2+ years of consistent lifting; they can handle more volume and heavier compound work.");
  }
  const off = EQUIPMENT_CHOICES.filter((c) => !prefs.equipment.includes(c.value)).map((c) => c.label.toLowerCase());
  if (off.length) {
    lines.push(`They're not comfortable with ${off.join(", ")} yet. The library below already leaves those out.`);
  }
  if (!prefs.equipment.includes("barbell")) {
    lines.push(
      "Because barbells and loading plates make them self-conscious, prefer weight-stack (pin-select) machines, cables and dumbbells over plate-loaded machines; when a machine could be either, say \"weight-stack\" in the note.",
    );
  }
  if (prefs.gym.trim()) lines.push(`Their gym: ${prefs.gym.trim()}`);
  return lines;
}
