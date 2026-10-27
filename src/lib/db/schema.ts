import { sql } from "drizzle-orm";
import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  equipment: text("equipment").notNull(),
  primaryMuscle: text("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles").notNull().default(""),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const routines = sqliteTable("routines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const routineExercises = sqliteTable(
  "routine_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routineId: integer("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull().default(0),
    targetSets: integer("target_sets").notNull().default(3),
    targetReps: integer("target_reps").notNull().default(8),
    /** Pounds added when every target rep was hit last time. */
    increment: real("increment").notNull().default(5),
    restSeconds: integer("rest_seconds").notNull().default(120),
  },
  (t) => [index("routine_exercises_routine_idx").on(t.routineId)],
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routineId: integer("routine_id").references(() => routines.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes").notNull().default(""),
  },
  (t) => [index("workouts_started_idx").on(t.startedAt)],
);

export const SET_KINDS = ["warmup", "working", "drop", "failure"] as const;
export type SetKind = (typeof SET_KINDS)[number];

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id),
    /** Order of the exercise within the workout. */
    exerciseOrder: integer("exercise_order").notNull(),
    setIndex: integer("set_index").notNull(),
    kind: text("kind", { enum: SET_KINDS }).notNull().default("working"),
    weight: real("weight").notNull().default(0),
    reps: integer("reps").notNull().default(0),
  },
  (t) => [
    index("workout_sets_workout_idx").on(t.workoutId),
    index("workout_sets_exercise_idx").on(t.exerciseId),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;

// ---------- Food ----------

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

/** Where the numbers came from: a chain's published nutrition, an AI estimate, a label, or typed in. */
export const FOOD_SOURCES = ["official", "estimate", "label", "manual"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eatenAt: integer("eaten_at", { mode: "timestamp_ms" }).notNull(),
    meal: text("meal", { enum: MEALS }).notNull(),
    title: text("title").notNull(),
    restaurant: text("restaurant").notNull().default(""),
    source: text("source", { enum: FOOD_SOURCES }).notNull().default("estimate"),
    /** What it cost, in cents. Null when not entered. */
    priceCents: integer("price_cents"),
    usualId: integer("usual_id"),
    // Totals snapshot so daily summaries don't need the items.
    calories: real("calories").notNull().default(0),
    protein: real("protein").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    fat: real("fat").notNull().default(0),
    sodium: real("sodium").notNull().default(0),
  },
  (t) => [index("meal_logs_eaten_idx").on(t.eatenAt)],
);

export const mealItems = sqliteTable(
  "meal_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mealLogId: integer("meal_log_id")
      .notNull()
      .references(() => mealLogs.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    quantity: real("quantity").notNull().default(1),
    unit: text("unit").notNull().default("serving"),
    // Per one unit.
    calories: real("calories").notNull().default(0),
    protein: real("protein").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    fat: real("fat").notNull().default(0),
    sodium: real("sodium").notNull().default(0),
  },
  (t) => [index("meal_items_log_idx").on(t.mealLogId)],
);

/** A saved regular order: one tap logs it again. Items are stored as JSON. */
export const usuals = sqliteTable("usuals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  restaurant: text("restaurant").notNull().default(""),
  source: text("source", { enum: FOOD_SOURCES }).notNull().default("estimate"),
  priceCents: integer("price_cents"),
  itemsJson: text("items_json").notNull(),
  useCount: integer("use_count").notNull().default(0),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const waterLogs = sqliteTable(
  "water_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull(),
    ounces: real("ounces").notNull(),
  },
  (t) => [index("water_logs_at_idx").on(t.loggedAt)],
);

/** Past AI answers for typed descriptions, so the same meal never costs twice. */
export const estimateCache = sqliteTable("estimate_cache", {
  key: text("key").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type MealLog = typeof mealLogs.$inferSelect;
export type MealItem = typeof mealItems.$inferSelect;
export type Usual = typeof usuals.$inferSelect;

// ---------- Body & goals ----------

export const bodyWeights = sqliteTable(
  "body_weights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull(),
    weight: real("weight").notNull(),
  },
  (t) => [index("body_weights_at_idx").on(t.loggedAt)],
);

/** Tape measurements in inches; `kind` is a MeasurementKey (waist, shoulders, …). */
export const measurements = sqliteTable(
  "measurements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull(),
    kind: text("kind").notNull(),
    value: real("value").notNull(),
  },
  (t) => [index("measurements_kind_idx").on(t.kind, t.loggedAt)],
);

export const PHOTO_KINDS = ["progress", "inspiration"] as const;
export const POSES = ["front", "side", "back"] as const;
export type Pose = (typeof POSES)[number];

/**
 * Photos live in the database (resized in the browser to ~1440px JPEG) and
 * are only served through the password-protected /photos route.
 */
export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: PHOTO_KINDS }).notNull(),
    pose: text("pose").notNull().default(""),
    takenAt: integer("taken_at", { mode: "timestamp_ms" }).notNull(),
    mime: text("mime").notNull(),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    data: blob("data", { mode: "buffer" }).notNull(),
  },
  (t) => [index("photos_kind_idx").on(t.kind, t.pose, t.takenAt)],
);

export const TARGET_GROUPS = ["physique", "strength"] as const;
/**
 * measurement: a tape measurement (key = MeasurementKey)
 * ratio: shoulders ÷ waist (key = "shoulders/waist")
 * lift: best estimated max, or most reps for bodyweight moves (key = exercise id)
 */
export const TARGET_KINDS = ["measurement", "ratio", "lift"] as const;

export const goalTargets = sqliteTable("goal_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  group: text("group", { enum: TARGET_GROUPS }).notNull(),
  kind: text("kind", { enum: TARGET_KINDS }).notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  /** Where you were when the goal was set; null means use the first recorded value. */
  startValue: real("start_value"),
  targetValue: real("target_value").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type GoalTarget = typeof goalTargets.$inferSelect;

// ---------- Rec center ----------

/** Counts seen from the rec center feed, one row per area per feed update, for "usually quiet" hours. */
export const recSamples = sqliteTable(
  "rec_samples",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    locationId: integer("location_id").notNull(),
    location: text("location").notNull(),
    count: integer("count").notNull(),
    capacity: integer("capacity").notNull(),
    /** The feed's timestamp, rec center local time. */
    updated: text("updated").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("rec_samples_update_idx").on(t.locationId, t.updated)],
);
