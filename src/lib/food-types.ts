// Shapes shared between the estimate server code and the food screens.
import type { FoodItem } from "./nutrition";

export type EstimateSource = "official" | "estimate" | "label";

export type MealEstimate = {
  title: string;
  restaurant: string;
  isChain: boolean;
  source: EstimateSource;
  /** Where the numbers came from, in a few words. */
  sourceNote: string;
  sourceUrl: string;
  items: FoodItem[];
  caloriesLow: number;
  caloriesHigh: number;
  /** True when this came from the saved-answer cache instead of a new lookup. */
  cached: boolean;
};

export type EstimateResult = { ok: true; estimate: MealEstimate } | { ok: false; error: string };

export type UsualOption = {
  id: number;
  title: string;
  restaurant: string;
  calories: number;
  sodium: number;
  priceCents: number | null;
};

export type LogMealInput = {
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  /** Local day to log into ("2026-10-26"); omitted means now. */
  day?: string;
  title: string;
  restaurant: string;
  source: "official" | "estimate" | "label" | "manual";
  priceCents: number | null;
  items: FoodItem[];
  saveAsUsual: boolean;
};
