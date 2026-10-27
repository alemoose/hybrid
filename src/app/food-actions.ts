"use server";

import { and, desc, eq, gte, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTimeZone, requireAuth } from "@/lib/auth";
import { EstimateError, aiConfigured, estimateMeal } from "@/lib/ai/estimate";
import { suggestOrders, type OrderSuggestion } from "@/lib/ai/suggest";
import { getDayContext } from "@/lib/day-context";
import { db } from "@/lib/db";
import { MEALS, estimateCache, mealItems, mealLogs, usuals, waterLogs, type Meal } from "@/lib/db/schema";
import { dayKey, localHour, todayKey, utcWindow, zonedTime } from "@/lib/dates";
import { frequentRestaurants, getGoals, parseItems, saveGoals } from "@/lib/food-queries";
import type { EstimateResult, LogMealInput, MealEstimate } from "@/lib/food-types";
import { DEFAULT_GOALS, cacheKey, defaultMeal, totals, type FoodItem, type Goals } from "@/lib/nutrition";

const MEAL_HOUR: Record<Meal, number> = { breakfast: 8, lunch: 12, snack: 15, dinner: 19 };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_CHARS = 5_000_000; // ~3.7 MB of base64

const clamp = (v: unknown, max: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0;
};

function cleanItems(items: FoodItem[]): FoodItem[] {
  return (items ?? []).slice(0, 40).map((i) => ({
    name: String(i.name ?? "").trim().slice(0, 80) || "Item",
    quantity: clamp(i.quantity, 50),
    unit: String(i.unit ?? "serving").slice(0, 30) || "serving",
    calories: clamp(i.calories, 5000),
    protein: clamp(i.protein, 500),
    carbs: clamp(i.carbs, 1000),
    fat: clamp(i.fat, 500),
    sodium: clamp(i.sodium, 20000),
  })).filter((i) => i.quantity > 0);
}

async function eatenAtFor(day: string | undefined, meal: Meal): Promise<Date> {
  const tz = await getTimeZone();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day === todayKey(tz)) return new Date();
  return zonedTime(day, MEAL_HOUR[meal], tz);
}

// ---------- Suggestions ----------

export type SuggestResult = { ok: true; key: string; orders: OrderSuggestion[] } | { ok: false; error: string };

/** Three orders that fit what's left today. The same ask on the same day is answered from the cache. */
export async function suggestFood(input: { restaurant: string; note: string }): Promise<SuggestResult> {
  await requireAuth();
  if (!aiConfigured()) return { ok: false, error: "Suggestions need an ANTHROPIC_API_KEY." };
  const tz = await getTimeZone();
  const today = todayKey(tz);
  const restaurant = String(input.restaurant ?? "").trim().slice(0, 60);
  const note = String(input.note ?? "").trim().slice(0, 200);
  const [ctx, restaurants] = await Promise.all([getDayContext(today, tz), frequentRestaurants()]);
  const n = ctx.food.summary.nutrients;
  const left = {
    calories: Math.max(0, ctx.goals.calories - n.calories),
    protein: Math.max(0, ctx.goals.protein - n.protein),
    carbs: Math.max(0, ctx.goals.carbs - n.carbs),
    fat: Math.max(0, ctx.goals.fat - n.fat),
    sodium: Math.max(0, ctx.sodiumGoal - n.sodium),
  };
  if (left.calories < 150) return { ok: false, error: "You're at your calories for today. Nothing left to plan." };

  const meal = defaultMeal(localHour(new Date(), tz));
  // Rounded so small changes in what's left still reuse the answer.
  const key = `suggest:${today}:${cacheKey(restaurant) || "any"}:${Math.round(left.calories / 100)}:${Math.round(left.protein / 10)}:${cacheKey(note)}`;
  const [hit] = await db.select().from(estimateCache).where(eq(estimateCache.key, key));
  if (hit) return { ok: true, key, orders: JSON.parse(hit.resultJson) as OrderSuggestion[] };

  try {
    const goals = await getGoals();
    const orders = await suggestOrders({ left, meal, restaurants, restaurant, note, homeArea: goals.homeArea });
    const resultJson = JSON.stringify(orders);
    await db.insert(estimateCache).values({ key, resultJson }).onConflictDoUpdate({ target: estimateCache.key, set: { resultJson } });
    return { ok: true, key, orders };
  } catch (err) {
    if (err instanceof EstimateError) return { ok: false, error: err.message };
    console.error("suggestFood failed", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

/** A saved suggestion, to open in the food logger's review screen. */
export async function loadSuggestion(key: string, index: number): Promise<OrderSuggestion | null> {
  await requireAuth();
  if (!key.startsWith("suggest:")) return null;
  const [hit] = await db.select().from(estimateCache).where(eq(estimateCache.key, key));
  if (!hit) return null;
  const orders = JSON.parse(hit.resultJson) as OrderSuggestion[];
  return orders[index] ?? null;
}

// ---------- Estimating ----------

export async function estimateFood(input: {
  text: string;
  image?: { data: string; mediaType: string };
}): Promise<EstimateResult> {
  await requireAuth();
  const text = String(input.text ?? "").slice(0, 1000);
  const image =
    input.image && IMAGE_TYPES.includes(input.image.mediaType as (typeof IMAGE_TYPES)[number]) && input.image.data.length < MAX_IMAGE_CHARS
      ? { data: input.image.data, mediaType: input.image.mediaType as (typeof IMAGE_TYPES)[number] }
      : undefined;
  if (!text.trim() && !image) return { ok: false, error: "Describe what you ate or add a photo." };
  if (!aiConfigured()) {
    return { ok: false, error: "Lookups need an ANTHROPIC_API_KEY. You can still enter the numbers by hand." };
  }

  const key = cacheKey(text);
  if (!image && key) {
    const [hit] = await db.select().from(estimateCache).where(eq(estimateCache.key, key));
    if (hit) return { ok: true, estimate: { ...(JSON.parse(hit.resultJson) as MealEstimate), cached: true } };
  }

  try {
    const goals = await getGoals();
    const estimate = await estimateMeal({ text, image, homeArea: goals.homeArea });
    if (!image && key) {
      const resultJson = JSON.stringify(estimate);
      await db
        .insert(estimateCache)
        .values({ key, resultJson })
        .onConflictDoUpdate({ target: estimateCache.key, set: { resultJson } });
    }
    return { ok: true, estimate };
  } catch (err) {
    if (err instanceof EstimateError) return { ok: false, error: err.message };
    console.error("estimateFood failed", err);
    return { ok: false, error: "Something went wrong looking that up. Try again." };
  }
}

// ---------- Logging ----------

async function insertMeal(input: {
  meal: Meal;
  eatenAt: Date;
  title: string;
  restaurant: string;
  source: LogMealInput["source"];
  priceCents: number | null;
  usualId: number | null;
  items: FoodItem[];
}) {
  const t = totals(input.items);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(mealLogs)
      .values({
        meal: input.meal,
        eatenAt: input.eatenAt,
        title: input.title,
        restaurant: input.restaurant,
        source: input.source,
        priceCents: input.priceCents,
        usualId: input.usualId,
        ...t,
      })
      .returning({ id: mealLogs.id });
    if (input.items.length) {
      await tx.insert(mealItems).values(input.items.map((i, position) => ({ ...i, mealLogId: row.id, position })));
    }
    return row.id;
  });
}

export async function logMeal(input: LogMealInput): Promise<{ id: number }> {
  await requireAuth();
  const meal = MEALS.includes(input.meal) ? input.meal : "snack";
  const items = cleanItems(input.items);
  if (items.length === 0) throw new Error("Add at least one item.");
  const title = String(input.title ?? "").trim().slice(0, 80) || items[0].name;
  const restaurant = String(input.restaurant ?? "").trim().slice(0, 60);
  const source = (["official", "estimate", "label", "manual"] as const).includes(input.source) ? input.source : "manual";
  const priceCents = input.priceCents == null ? null : Math.round(clamp(input.priceCents, 100_000));

  let usualId: number | null = null;
  if (input.saveAsUsual) {
    const [u] = await db
      .insert(usuals)
      .values({ title, restaurant, source, priceCents, itemsJson: JSON.stringify(items), useCount: 1, lastUsedAt: new Date() })
      .returning({ id: usuals.id });
    usualId = u.id;
  }
  const id = await insertMeal({ meal, eatenAt: await eatenAtFor(input.day, meal), title, restaurant, source, priceCents, usualId, items });
  revalidatePath("/", "layout");
  return { id };
}

export async function logUsual(usualId: number, meal: Meal, day?: string): Promise<void> {
  await requireAuth();
  const [u] = await db.select().from(usuals).where(eq(usuals.id, usualId));
  if (!u) throw new Error("That usual no longer exists.");
  const m = MEALS.includes(meal) ? meal : "snack";
  await insertMeal({
    meal: m,
    eatenAt: await eatenAtFor(day, m),
    title: u.title,
    restaurant: u.restaurant,
    source: u.source,
    priceCents: u.priceCents,
    usualId: u.id,
    items: parseItems(u.itemsJson),
  });
  await db
    .update(usuals)
    .set({ useCount: u.useCount + 1, lastUsedAt: new Date() })
    .where(eq(usuals.id, u.id));
  revalidatePath("/", "layout");
}

export async function deleteMeal(id: number): Promise<void> {
  await requireAuth();
  await db.transaction(async (tx) => {
    await tx.delete(mealItems).where(eq(mealItems.mealLogId, id));
    await tx.delete(mealLogs).where(eq(mealLogs.id, id));
  });
  revalidatePath("/", "layout");
}

export async function removeUsual(id: number): Promise<void> {
  await requireAuth();
  await db.update(usuals).set({ archived: true }).where(eq(usuals.id, id));
  revalidatePath("/", "layout");
}

/** Saves a logged meal as a usual (e.g. after the fact from its detail page). */
export async function saveMealAsUsual(mealLogId: number): Promise<void> {
  await requireAuth();
  const [log] = await db.select().from(mealLogs).where(eq(mealLogs.id, mealLogId));
  if (!log) return;
  const items = await db.select().from(mealItems).where(eq(mealItems.mealLogId, mealLogId)).orderBy(mealItems.position);
  const [u] = await db
    .insert(usuals)
    .values({
      title: log.title,
      restaurant: log.restaurant,
      source: log.source,
      priceCents: log.priceCents,
      itemsJson: JSON.stringify(
        items.map(({ name, quantity, unit, calories, protein, carbs, fat, sodium }) => ({ name, quantity, unit, calories, protein, carbs, fat, sodium })),
      ),
      useCount: 1,
      lastUsedAt: new Date(),
    })
    .returning({ id: usuals.id });
  await db.update(mealLogs).set({ usualId: u.id }).where(eq(mealLogs.id, mealLogId));
  revalidatePath("/", "layout");
}

// ---------- Water ----------

export async function addWater(ounces: number, day?: string): Promise<void> {
  await requireAuth();
  const oz = clamp(ounces, 128);
  if (oz <= 0) return;
  await db.insert(waterLogs).values({ ounces: oz, loggedAt: await eatenAtFor(day, "snack") });
  revalidatePath("/", "layout");
}

export async function undoWater(day?: string): Promise<void> {
  await requireAuth();
  const tz = await getTimeZone();
  const key = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayKey(tz);
  const { from, to } = utcWindow(key, key);
  const rows = await db
    .select()
    .from(waterLogs)
    .where(and(gte(waterLogs.loggedAt, from), lt(waterLogs.loggedAt, to)))
    .orderBy(desc(waterLogs.loggedAt));
  const last = rows.find((r) => dayKey(r.loggedAt, tz) === key);
  if (last) await db.delete(waterLogs).where(eq(waterLogs.id, last.id));
  revalidatePath("/", "layout");
}

// ---------- Goals ----------

export async function updateGoals(_prev: { saved: boolean }, formData: FormData): Promise<{ saved: boolean }> {
  await requireAuth();
  const num = (name: keyof Goals, max: number) => {
    const v = Number(formData.get(name));
    return Number.isFinite(v) && v >= 0 ? Math.min(max, v) : (DEFAULT_GOALS[name] as number);
  };
  await saveGoals({
    calories: num("calories", 10000),
    protein: num("protein", 1000),
    carbs: num("carbs", 2000),
    fat: num("fat", 1000),
    sodium: num("sodium", 20000),
    sodiumWorkoutBonus: num("sodiumWorkoutBonus", 5000),
    bodyWeight: num("bodyWeight", 1000),
    waterOverride: num("waterOverride", 400),
    homeArea: String(formData.get("homeArea") ?? "").trim().slice(0, 60),
  });
  revalidatePath("/", "layout");
  return { saved: true };
}
