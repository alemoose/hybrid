import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { mealItems, mealLogs, usuals, waterLogs, type MealLog } from "./db/schema";
import { addDays, dayKey, utcWindow } from "./dates";
import { getSetting, setSetting } from "./settings";
import { DEFAULT_GOALS, ZERO, addNutrients, type FoodItem, type Goals, type Nutrients } from "./nutrition";
import type { UsualOption } from "./food-types";

// ---------- Goals ----------

export async function getGoals(): Promise<Goals> {
  return { ...DEFAULT_GOALS, ...(await getSetting<Partial<Goals>>("goals", {})) };
}

export async function saveGoals(goals: Goals): Promise<void> {
  await setSetting("goals", goals);
}

// ---------- Usuals ----------

export function parseItems(json: string): FoodItem[] {
  try {
    const items = JSON.parse(json) as FoodItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export async function listUsuals(limit = 8): Promise<UsualOption[]> {
  const rows = await db
    .select()
    .from(usuals)
    .where(eq(usuals.archived, false))
    .orderBy(desc(usuals.useCount), desc(usuals.lastUsedAt), asc(usuals.title))
    .limit(limit);
  return rows.map((u) => {
    const items = parseItems(u.itemsJson);
    const t = items.reduce((acc, i) => ({ c: acc.c + i.calories * i.quantity, s: acc.s + i.sodium * i.quantity }), { c: 0, s: 0 });
    return {
      id: u.id,
      title: u.title,
      restaurant: u.restaurant,
      calories: Math.round(t.c),
      sodium: Math.round(t.s),
      priceCents: u.priceCents,
    };
  });
}

// ---------- Days ----------

export type LoggedMeal = MealLog & { items: (FoodItem & { id: number })[] };

export type DaySummary = {
  nutrients: Nutrients;
  spentCents: number;
  water: number;
  meals: number;
};

const emptyDay = (): DaySummary => ({ nutrients: { ...ZERO }, spentCents: 0, water: 0, meals: 0 });

/** Everything eaten and drunk on one local day. */
export async function getDayFood(key: string, tz: string) {
  const { from, to } = utcWindow(key, key);
  const [logs, water] = await Promise.all([
    db.select().from(mealLogs).where(and(gte(mealLogs.eatenAt, from), lt(mealLogs.eatenAt, to))).orderBy(asc(mealLogs.eatenAt)),
    db.select().from(waterLogs).where(and(gte(waterLogs.loggedAt, from), lt(waterLogs.loggedAt, to))).orderBy(asc(waterLogs.loggedAt)),
  ]);
  const dayLogs = logs.filter((l) => dayKey(l.eatenAt, tz) === key);
  const dayWater = water.filter((w) => dayKey(w.loggedAt, tz) === key);
  const items = dayLogs.length
    ? await db
        .select()
        .from(mealItems)
        .where(
          inArray(
            mealItems.mealLogId,
            dayLogs.map((l) => l.id),
          ),
        )
        .orderBy(asc(mealItems.position))
    : [];
  const meals: LoggedMeal[] = dayLogs.map((l) => ({
    ...l,
    items: items
      .filter((i) => i.mealLogId === l.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        sodium: i.sodium,
      })),
  }));
  const summary = emptyDay();
  for (const l of dayLogs) addLog(summary, l);
  for (const w of dayWater) summary.water += w.ounces;
  return { meals, summary, waterLogs: dayWater };
}

function addLog(summary: DaySummary, l: MealLog) {
  summary.nutrients = addNutrients(summary.nutrients, l);
  summary.spentCents += l.priceCents ?? 0;
  summary.meals += 1;
}

/** Per-day food totals for a run of local days (inclusive). */
export async function foodByDay(firstKey: string, lastKey: string, tz: string): Promise<Map<string, DaySummary>> {
  const { from, to } = utcWindow(firstKey, lastKey);
  const [logs, water] = await Promise.all([
    db.select().from(mealLogs).where(and(gte(mealLogs.eatenAt, from), lt(mealLogs.eatenAt, to))),
    db.select().from(waterLogs).where(and(gte(waterLogs.loggedAt, from), lt(waterLogs.loggedAt, to))),
  ]);
  const map = new Map<string, DaySummary>();
  const day = (key: string) => {
    let d = map.get(key);
    if (!d) map.set(key, (d = emptyDay()));
    return d;
  };
  for (const l of logs) {
    const key = dayKey(l.eatenAt, tz);
    if (key >= firstKey && key <= lastKey) addLog(day(key), l);
  }
  for (const w of water) {
    const key = dayKey(w.loggedAt, tz);
    if (key >= firstKey && key <= lastKey) day(key).water += w.ounces;
  }
  return map;
}

export async function yesterdaySodium(today: string, tz: string): Promise<number> {
  const y = addDays(today, -1);
  return (await foodByDay(y, y, tz)).get(y)?.nutrients.sodium ?? 0;
}

export type RestaurantSpend = { restaurant: string; cents: number; visits: number };

/** Spending grouped by restaurant over a run of local days. */
export async function spendingByRestaurant(firstKey: string, lastKey: string, tz: string): Promise<RestaurantSpend[]> {
  const { from, to } = utcWindow(firstKey, lastKey);
  const logs = await db.select().from(mealLogs).where(and(gte(mealLogs.eatenAt, from), lt(mealLogs.eatenAt, to)));
  const map = new Map<string, RestaurantSpend>();
  for (const l of logs) {
    const key = dayKey(l.eatenAt, tz);
    if (key < firstKey || key > lastKey || l.priceCents == null) continue;
    const name = l.restaurant || "Other";
    const r = map.get(name) ?? { restaurant: name, cents: 0, visits: 0 };
    r.cents += l.priceCents;
    r.visits += 1;
    map.set(name, r);
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents);
}
