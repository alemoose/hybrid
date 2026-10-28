import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MealEstimate } from "../food-types";
import type { FoodItem } from "../nutrition";

export const MODEL = "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You log meals for a nutrition tracker. The user eats out a lot, mostly fast food and local restaurants, and wants calories, protein, carbs, fat and sodium.

How to work:
- Identify the restaurant if one is named or shown. If it is a chain that publishes nutrition (McDonald's, Chipotle, Whataburger, Cicis, Starbucks, Publix deli, etc.), search for the chain's official nutrition information and use those exact numbers. Set source to "official".
- For build-your-own places (Chipotle, Subway, Cicis slices), list each component as its own item so the user can adjust portions.
- For a photo of a nutrition label, read the label and set source to "label".
- There may be several photos, for example the plate plus the label of one food on it. Use each label's numbers for that food and estimate the rest from the photos and description. Scale labeled foods to what the user says they ate: "3/4 of the package" of a 2-serving package is 1.5 servings. Set source to "label" when most of the calories come from labels.
- For local or independent restaurants with no published nutrition, estimate from typical recipes and portions for that kind of place. Restaurant portions are large and cooked with more oil, butter and salt than home cooking; estimate realistically, not optimistically. Sodium in particular is usually higher than people expect. Set source to "estimate".
- Use one search at most for a chain unless the first result is unusable. Never search for local places with no published nutrition.
- quantity is how many of the unit the user ate; nutrient values are for ONE unit.
- calories_low and calories_high bracket the likely total for the whole meal (equal to the total when the numbers are official).
- Keep the title short, like "Chicken burrito bowl" or "3 asada tacos, rice, beans".

When you have the numbers, call record_meal exactly once.`;

/** One food per entry; nutrient values are for ONE unit. Shared with order suggestions. */
export const ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["name", "quantity", "unit", "calories", "protein_g", "carbs_g", "fat_g", "sodium_mg"],
    properties: {
      name: { type: "string" },
      quantity: { type: "number" },
      unit: { type: "string", description: "e.g. serving, taco, slice, cup, 6 pc" },
      calories: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      sodium_mg: { type: "number" },
    },
  },
} as const;

export type ItemInput = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sodium_mg: number;
};

const RECORD_MEAL: Anthropic.Beta.BetaTool = {
  name: "record_meal",
  description: "Record the meal's items and nutrition. Call exactly once, after any lookups.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "restaurant", "is_chain", "source", "source_note", "source_url", "items", "calories_low", "calories_high"],
    properties: {
      title: { type: "string" },
      restaurant: { type: "string", description: "Restaurant name, or empty for home or unknown." },
      is_chain: { type: "boolean" },
      source: { type: "string", enum: ["official", "estimate", "label"] },
      source_note: { type: "string", description: "A few words on where the numbers came from." },
      source_url: { type: "string", description: "Official nutrition page used, or empty." },
      items: ITEMS_SCHEMA,
      calories_low: { type: "number" },
      calories_high: { type: "number" },
    },
  },
};

type RecordInput = {
  title: string;
  restaurant: string;
  is_chain: boolean;
  source: "official" | "estimate" | "label";
  source_note: string;
  source_url: string;
  items: ItemInput[];
  calories_low: number;
  calories_high: number;
};

const n = (v: unknown, max: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0;
};

export function toFoodItems(list: ItemInput[] | undefined): FoodItem[] {
  return (list ?? []).slice(0, 30).map((i) => ({
    name: String(i.name).slice(0, 80) || "Item",
    quantity: n(i.quantity, 50) || 1,
    unit: String(i.unit).slice(0, 30) || "serving",
    calories: n(i.calories, 5000),
    protein: n(i.protein_g, 500),
    carbs: n(i.carbs_g, 1000),
    fat: n(i.fat_g, 500),
    sodium: n(i.sodium_mg, 20000),
  }));
}

function toEstimate(input: RecordInput): MealEstimate {
  const items = toFoodItems(input.items);
  const source = ["official", "estimate", "label"].includes(input.source) ? input.source : "estimate";
  return {
    title: String(input.title).slice(0, 80) || "Meal",
    restaurant: String(input.restaurant ?? "").slice(0, 60),
    isChain: Boolean(input.is_chain),
    source,
    sourceNote: String(input.source_note ?? "").slice(0, 160),
    sourceUrl: /^https?:\/\//.test(input.source_url ?? "") ? input.source_url.slice(0, 500) : "",
    items,
    caloriesLow: n(input.calories_low, 20000),
    caloriesHigh: n(input.calories_high, 20000),
    cached: false,
  };
}

export class EstimateError extends Error {}

/** Turns SDK errors into messages the food screens can show. */
export function apiErrorMessage(err: unknown, what = "Lookup"): EstimateError | null {
  if (err instanceof Anthropic.AuthenticationError) return new EstimateError("The Anthropic API key isn't valid.");
  if (err instanceof Anthropic.RateLimitError) return new EstimateError("Too many lookups at once. Try again in a minute.");
  if (err instanceof Anthropic.APIError) return new EstimateError(`${what} failed (${err.status ?? "network"}). Try again.`);
  return null;
}

export async function estimateMeal(input: {
  text: string;
  images?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[];
  homeArea: string;
  /** Injected in tests. */
  client?: Anthropic;
}): Promise<MealEstimate> {
  const client = input.client ?? new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const images = input.images ?? [];
  images.forEach((image, i) => {
    if (images.length > 1) content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  });
  const area = input.homeArea ? ` I usually eat around ${input.homeArea}.` : "";
  content.push({
    type: "text",
    text: `${input.text.trim() || (images.length > 1 ? "Log what's in the photos." : "Log what's in the photo.")}${area}`,
  });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];

  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        cache_control: { type: "ephemeral" },
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }, RECORD_MEAL],
        tool_choice: { type: "auto" },
        messages,
      });
    } catch (err) {
      throw apiErrorMessage(err) ?? err;
    }

    if (response.stop_reason === "refusal") throw new EstimateError("Couldn't estimate that one. Try describing it differently.");

    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "record_meal",
    );
    if (call) return toEstimate(call.input as RecordInput);

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "pause_turn") {
      // Finished without recording: ask once more for the tool call.
      messages.push({ role: "user", content: "Call record_meal now with your best numbers." });
    }
  }
  throw new EstimateError("Couldn't get numbers for that. Try again or enter it by hand.");
}
