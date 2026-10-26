// Built-in exercises, seeded on every migrate (existing slugs are left alone).
// [slug, name, equipment, primary muscle, secondary muscles]

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "smith"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "traps",
  "forearms",
  "full body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

type Row = [slug: string, name: string, equipment: Equipment, primary: Muscle, secondary?: Muscle[]];

const rows: Row[] = [
  // Chest
  ["bench-press-barbell", "Bench Press (Barbell)", "barbell", "chest", ["triceps", "shoulders"]],
  ["incline-bench-press-barbell", "Incline Bench Press (Barbell)", "barbell", "chest", ["shoulders", "triceps"]],
  ["bench-press-dumbbell", "Bench Press (Dumbbell)", "dumbbell", "chest", ["triceps", "shoulders"]],
  ["incline-bench-press-dumbbell", "Incline Bench Press (Dumbbell)", "dumbbell", "chest", ["shoulders", "triceps"]],
  ["bench-press-smith", "Bench Press (Smith Machine)", "smith", "chest", ["triceps", "shoulders"]],
  ["chest-press-machine", "Chest Press (Machine)", "machine", "chest", ["triceps"]],
  ["chest-fly-machine", "Chest Fly (Machine)", "machine", "chest"],
  ["cable-fly", "Cable Fly", "cable", "chest"],
  ["chest-fly-dumbbell", "Chest Fly (Dumbbell)", "dumbbell", "chest"],
  ["push-up", "Push-Up", "bodyweight", "chest", ["triceps", "shoulders"]],
  ["chest-dip", "Chest Dip", "bodyweight", "chest", ["triceps"]],

  // Back
  ["deadlift-barbell", "Deadlift (Barbell)", "barbell", "back", ["hamstrings", "glutes", "traps"]],
  ["pull-up", "Pull-Up", "bodyweight", "back", ["biceps"]],
  ["chin-up", "Chin-Up", "bodyweight", "back", ["biceps"]],
  ["weighted-pull-up", "Pull-Up (Weighted)", "bodyweight", "back", ["biceps"]],
  ["lat-pulldown", "Lat Pulldown (Cable)", "cable", "back", ["biceps"]],
  ["close-grip-lat-pulldown", "Close-Grip Lat Pulldown", "cable", "back", ["biceps"]],
  ["seated-cable-row", "Seated Cable Row", "cable", "back", ["biceps"]],
  ["bent-over-row-barbell", "Bent Over Row (Barbell)", "barbell", "back", ["biceps"]],
  ["pendlay-row", "Pendlay Row (Barbell)", "barbell", "back", ["biceps"]],
  ["single-arm-row-dumbbell", "Single-Arm Row (Dumbbell)", "dumbbell", "back", ["biceps"]],
  ["t-bar-row", "T-Bar Row", "machine", "back", ["biceps"]],
  ["chest-supported-row-machine", "Chest-Supported Row (Machine)", "machine", "back", ["biceps"]],
  ["straight-arm-pulldown", "Straight-Arm Pulldown (Cable)", "cable", "back"],
  ["face-pull", "Face Pull (Cable)", "cable", "shoulders", ["traps"]],
  ["back-extension", "Back Extension", "bodyweight", "back", ["glutes", "hamstrings"]],
  ["rack-pull", "Rack Pull (Barbell)", "barbell", "back", ["traps", "glutes"]],

  // Shoulders
  ["overhead-press-barbell", "Overhead Press (Barbell)", "barbell", "shoulders", ["triceps"]],
  ["shoulder-press-dumbbell", "Seated Shoulder Press (Dumbbell)", "dumbbell", "shoulders", ["triceps"]],
  ["arnold-press", "Arnold Press (Dumbbell)", "dumbbell", "shoulders", ["triceps"]],
  ["shoulder-press-machine", "Shoulder Press (Machine)", "machine", "shoulders", ["triceps"]],
  ["lateral-raise-dumbbell", "Lateral Raise (Dumbbell)", "dumbbell", "shoulders"],
  ["lateral-raise-cable", "Lateral Raise (Cable)", "cable", "shoulders"],
  ["lateral-raise-machine", "Lateral Raise (Machine)", "machine", "shoulders"],
  ["rear-delt-fly-dumbbell", "Rear Delt Fly (Dumbbell)", "dumbbell", "shoulders"],
  ["reverse-pec-deck", "Reverse Fly (Machine)", "machine", "shoulders"],
  ["upright-row-cable", "Upright Row (Cable)", "cable", "shoulders", ["traps"]],
  ["shrug-dumbbell", "Shrug (Dumbbell)", "dumbbell", "traps"],
  ["shrug-barbell", "Shrug (Barbell)", "barbell", "traps"],

  // Arms
  ["curl-barbell", "Bicep Curl (Barbell)", "barbell", "biceps"],
  ["curl-ez-bar", "EZ-Bar Curl", "barbell", "biceps"],
  ["curl-dumbbell", "Bicep Curl (Dumbbell)", "dumbbell", "biceps"],
  ["hammer-curl", "Hammer Curl (Dumbbell)", "dumbbell", "biceps", ["forearms"]],
  ["incline-curl-dumbbell", "Incline Curl (Dumbbell)", "dumbbell", "biceps"],
  ["preacher-curl", "Preacher Curl", "machine", "biceps"],
  ["curl-cable", "Bicep Curl (Cable)", "cable", "biceps"],
  ["triceps-pushdown", "Triceps Pushdown (Cable)", "cable", "triceps"],
  ["overhead-triceps-extension-cable", "Overhead Triceps Extension (Cable)", "cable", "triceps"],
  ["overhead-triceps-extension-dumbbell", "Overhead Triceps Extension (Dumbbell)", "dumbbell", "triceps"],
  ["skull-crusher", "Skull Crusher (EZ-Bar)", "barbell", "triceps"],
  ["close-grip-bench-press", "Close-Grip Bench Press", "barbell", "triceps", ["chest"]],
  ["triceps-dip", "Triceps Dip", "bodyweight", "triceps", ["chest"]],
  ["wrist-curl", "Wrist Curl (Dumbbell)", "dumbbell", "forearms"],

  // Legs
  ["squat-barbell", "Squat (Barbell)", "barbell", "quads", ["glutes", "hamstrings"]],
  ["front-squat", "Front Squat (Barbell)", "barbell", "quads", ["glutes", "core"]],
  ["goblet-squat", "Goblet Squat", "dumbbell", "quads", ["glutes"]],
  ["hack-squat", "Hack Squat (Machine)", "machine", "quads", ["glutes"]],
  ["leg-press", "Leg Press", "machine", "quads", ["glutes"]],
  ["bulgarian-split-squat", "Bulgarian Split Squat (Dumbbell)", "dumbbell", "quads", ["glutes"]],
  ["walking-lunge", "Walking Lunge (Dumbbell)", "dumbbell", "quads", ["glutes"]],
  ["step-up", "Step-Up (Dumbbell)", "dumbbell", "quads", ["glutes"]],
  ["leg-extension", "Leg Extension (Machine)", "machine", "quads"],
  ["romanian-deadlift-barbell", "Romanian Deadlift (Barbell)", "barbell", "hamstrings", ["glutes", "back"]],
  ["romanian-deadlift-dumbbell", "Romanian Deadlift (Dumbbell)", "dumbbell", "hamstrings", ["glutes", "back"]],
  ["sumo-deadlift", "Sumo Deadlift (Barbell)", "barbell", "glutes", ["hamstrings", "quads", "back"]],
  ["good-morning", "Good Morning (Barbell)", "barbell", "hamstrings", ["back"]],
  ["lying-leg-curl", "Lying Leg Curl (Machine)", "machine", "hamstrings"],
  ["seated-leg-curl", "Seated Leg Curl (Machine)", "machine", "hamstrings"],
  ["hip-thrust", "Hip Thrust (Barbell)", "barbell", "glutes", ["hamstrings"]],
  ["glute-bridge", "Glute Bridge", "bodyweight", "glutes"],
  ["hip-abduction", "Hip Abduction (Machine)", "machine", "glutes"],
  ["hip-adduction", "Hip Adduction (Machine)", "machine", "quads"],
  ["standing-calf-raise", "Standing Calf Raise (Machine)", "machine", "calves"],
  ["seated-calf-raise", "Seated Calf Raise (Machine)", "machine", "calves"],

  // Core
  ["hanging-leg-raise", "Hanging Leg Raise", "bodyweight", "core"],
  ["cable-crunch", "Cable Crunch", "cable", "core"],
  ["ab-wheel", "Ab Wheel Rollout", "bodyweight", "core"],
  ["crunch", "Crunch", "bodyweight", "core"],
  ["decline-sit-up", "Decline Sit-Up", "bodyweight", "core"],
  ["russian-twist", "Russian Twist", "bodyweight", "core"],
  ["pallof-press", "Pallof Press (Cable)", "cable", "core"],

  // Full body
  ["kettlebell-swing", "Kettlebell Swing", "kettlebell", "full body", ["glutes", "hamstrings"]],
  ["power-clean", "Power Clean (Barbell)", "barbell", "full body", ["traps", "quads"]],
];

export const EXERCISE_LIBRARY = rows.map(([slug, name, equipment, primaryMuscle, secondary = []]) => ({
  slug,
  name,
  equipment,
  primaryMuscle,
  secondaryMuscles: secondary.join(","),
}));

/** Sensible default jump in pounds when every target rep was hit. */
export function defaultIncrement(equipment: string): number {
  switch (equipment) {
    case "bodyweight":
      return 0;
    case "machine":
      return 10;
    default:
      return 5;
  }
}
