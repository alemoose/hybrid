import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { estimateMeal } from "./estimate";

const recorded = {
  title: "Chicken burrito bowl",
  restaurant: "Chipotle",
  is_chain: true,
  source: "official",
  source_note: "Chipotle nutrition calculator",
  source_url: "https://www.chipotle.com/nutrition-calculator",
  items: [
    { name: "Chicken", quantity: 1, unit: "serving", calories: 180, protein_g: 32, carbs_g: 0, fat_g: 7, sodium_mg: 310 },
    { name: "White rice", quantity: 1, unit: "serving", calories: 210, protein_g: 4, carbs_g: 40, fat_g: 4, sodium_mg: 350 },
  ],
  calories_low: 390,
  calories_high: 390,
};

function message(stop_reason: string, content: unknown[]) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason,
    stop_sequence: null,
    content,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

/** A client whose API replies come from a script, recording each request body. */
function scripted(replies: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  const client = new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      const next = replies.shift();
      return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  return { client, bodies };
}

describe("estimateMeal", () => {
  it("reads the record_meal tool call", async () => {
    const { client, bodies } = scripted([
      message("tool_use", [{ type: "tool_use", id: "t1", name: "record_meal", input: recorded }]),
    ]);
    const est = await estimateMeal({ text: "chipotle chicken bowl", homeArea: "Tuscaloosa, AL", client });
    expect(est).toMatchObject({ restaurant: "Chipotle", source: "official", isChain: true, cached: false });
    expect(est.items[1]).toMatchObject({ name: "White rice", calories: 210, sodium: 350 });
    expect(bodies[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    expect(JSON.stringify(bodies[0].messages)).toContain("Tuscaloosa, AL");
  });

  it("resumes a paused web search turn", async () => {
    const { client, bodies } = scripted([
      message("pause_turn", [{ type: "text", text: "Searching…" }]),
      message("tool_use", [{ type: "tool_use", id: "t1", name: "record_meal", input: recorded }]),
    ]);
    await estimateMeal({ text: "chipotle bowl", homeArea: "", client });
    const second = bodies[1].messages as { role: string }[];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("asks again when the model answers without the tool", async () => {
    const { client, bodies } = scripted([
      message("end_turn", [{ type: "text", text: "About 800 calories." }]),
      message("tool_use", [{ type: "tool_use", id: "t1", name: "record_meal", input: recorded }]),
    ]);
    await estimateMeal({ text: "tacos", homeArea: "", client });
    const second = bodies[1].messages as { role: string }[];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("clamps bad numbers", async () => {
    const bad = { ...recorded, items: [{ ...recorded.items[0], calories: -50, quantity: 0 }] };
    const { client } = scripted([message("tool_use", [{ type: "tool_use", id: "t1", name: "record_meal", input: bad }])]);
    const est = await estimateMeal({ text: "x", homeArea: "", client });
    expect(est.items[0]).toMatchObject({ calories: 0, quantity: 1 });
  });

  it("explains refusals", async () => {
    const { client } = scripted([message("refusal", [])]);
    await expect(estimateMeal({ text: "x", homeArea: "", client })).rejects.toThrow("Couldn't estimate");
  });
});
