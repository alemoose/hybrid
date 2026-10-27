import { PageHeader } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/estimate";
import { getTimeZone } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { getDayContext } from "@/lib/day-context";
import { frequentRestaurants } from "@/lib/food-queries";
import { SuggestClient } from "./suggest-client";

// Suggestions may look up a chain's nutrition first.
export const maxDuration = 120;

export default async function SuggestPage() {
  const tz = await getTimeZone();
  const [ctx, restaurants] = await Promise.all([getDayContext(todayKey(tz), tz), frequentRestaurants(90, 8)]);
  const n = ctx.food.summary.nutrients;
  return (
    <>
      <PageHeader back="/food" eyebrow="Food" title="What should I order?" />
      <SuggestClient
        aiReady={aiConfigured()}
        restaurants={restaurants}
        left={{
          calories: Math.max(0, Math.round(ctx.goals.calories - n.calories)),
          protein: Math.max(0, Math.round(ctx.goals.protein - n.protein)),
          sodium: Math.max(0, Math.round(ctx.sodiumGoal - n.sodium)),
        }}
      />
    </>
  );
}
