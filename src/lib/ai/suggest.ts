import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MealEstimate } from "../food-types";
import { totals, type Nutrients } from "../nutrition";
import { EstimateError, ITEMS_SCHEMA, MODEL, apiErrorMessage, toFoodItems, type ItemInput } from "./estimate";

const SYSTEM = `You suggest restaurant orders for someone tracking calories, protein and sodium. They eat out a lot, mostly fast food and local spots, and are usually trying to hit a protein goal.

How to work:
- Suggest exactly 3 orders that fit the calories and protein they have left. Get close to the remaining protein without going far over the remaining calories. A little under is fine.
- Prefer the restaurants they already go to. If they named one, all 3 orders come from it.
- Use real menu items, ordered the way a person would order them ("12-count grilled nuggets, side salad, Diet Lemonade"). Use official nutrition: if you aren't sure of a chain's numbers, search its nutrition page. Search at most 3 times in total.
- Keep sodium in mind when they have little left, and say so in "why".
- quantity is how many of the unit; nutrient values are for ONE unit.
- "why" is one short sentence on how it fits, like "45 g protein for 640 kcal, the best ratio on the menu".
- "source" is "official" when every number comes from published nutrition, otherwise "estimate".

When you have the orders, call suggest_orders exactly once.`;

const SUGGEST_ORDERS: Anthropic.Beta.BetaTool = {
  name: "suggest_orders",
  description: "Record the 3 suggested orders. Call exactly once, after any lookups.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["orders"],
    properties: {
      orders: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["restaurant", "title", "why", "source", "source_url", "items"],
          properties: {
            restaurant: { type: "string" },
            title: { type: "string", description: "Short, like \"Grilled nuggets meal\"." },
            why: { type: "string" },
            source: { type: "string", enum: ["official", "estimate"] },
            source_url: { type: "string", description: "Official nutrition page used, or empty." },
            items: ITEMS_SCHEMA,
          },
        },
      },
    },
  },
};

type SuggestInput = {
  orders: { restaurant: string; title: string; why: string; source: "official" | "estimate"; source_url: string; items: ItemInput[] }[];
};

export type OrderSuggestion = MealEstimate & { why: string };

function toSuggestions(input: SuggestInput): OrderSuggestion[] {
  return (input.orders ?? []).slice(0, 3).flatMap((o) => {
    const items = toFoodItems(o.items);
    if (items.length === 0) return [];
    const total = totals(items).calories;
    return [
      {
        title: String(o.title).slice(0, 80) || "Order",
        restaurant: String(o.restaurant ?? "").slice(0, 60),
        isChain: true,
        source: o.source === "official" ? "official" : "estimate",
        sourceNote: String(o.why ?? "").slice(0, 160) || "Suggested order",
        sourceUrl: /^https?:\/\//.test(o.source_url ?? "") ? o.source_url.slice(0, 500) : "",
        items,
        caloriesLow: total,
        caloriesHigh: total,
        cached: false,
        why: String(o.why ?? "").slice(0, 200),
      },
    ];
  });
}

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString("en-US");

export async function suggestOrders(input: {
  left: Nutrients;
  meal: string;
  /** Their regular spots, most visited first. */
  restaurants: string[];
  /** One restaurant to order from, or empty for any of their spots. */
  restaurant: string;
  note: string;
  homeArea: string;
  client?: Anthropic;
}): Promise<OrderSuggestion[]> {
  const client = input.client ?? new Anthropic();
  const lines = [
    `I have ${fmt(input.left.calories)} kcal, ${fmt(input.left.protein)} g protein, ${fmt(input.left.carbs)} g carbs, ${fmt(input.left.fat)} g fat and ${fmt(input.left.sodium)} mg sodium left today. This is for ${input.meal}.`,
    input.restaurant ? `I'm getting food from ${input.restaurant}.` : `Places I usually go: ${input.restaurants.join(", ") || "fast food chains"}.`,
    input.homeArea ? `I live near ${input.homeArea}.` : "",
    input.note ? `Also: ${input.note}` : "",
  ].filter(Boolean);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: lines.join("\n") }];

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
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }, SUGGEST_ORDERS],
        tool_choice: { type: "auto" },
        messages,
      });
    } catch (err) {
      throw apiErrorMessage(err, "Suggestions") ?? err;
    }
    if (response.stop_reason === "refusal") throw new EstimateError("Couldn't suggest anything for that. Try another restaurant.");

    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "suggest_orders",
    );
    if (call) {
      const orders = toSuggestions(call.input as SuggestInput);
      if (orders.length) return orders;
      throw new EstimateError("Came back without orders. Try again.");
    }
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Call suggest_orders now with your 3 best orders." });
    }
  }
  throw new EstimateError("Couldn't come up with orders. Try again.");
}
