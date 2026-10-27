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

describe("suggestOrders", () => {
  it("reads three orders and their totals", async () => {
    const { suggestOrders } = await import("./suggest");
    const order = (title: string, calories: number) => ({
      restaurant: "Chick-fil-A",
      title,
      why: "Lots of protein",
      source: "official",
      source_url: "https://www.chick-fil-a.com/nutrition-allergens",
      items: [{ name: title, quantity: 1, unit: "serving", calories, protein_g: 40, carbs_g: 20, fat_g: 10, sodium_mg: 900 }],
    });
    const { client, bodies } = scripted([
      message("tool_use", [
        { type: "tool_use", id: "t1", name: "suggest_orders", input: { orders: [order("12 ct grilled nuggets", 200), order("Grilled club", 520), order("Cobb salad", 830)] } },
      ]),
    ]);
    const orders = await suggestOrders({
      left: { calories: 1685, protein: 121, carbs: 188, fat: 43, sodium: 410 },
      meal: "dinner",
      restaurants: ["Chick-fil-A", "Foosackly's"],
      restaurant: "Chick-fil-A",
      note: "",
      homeArea: "Tuscaloosa, AL",
      client,
    });
    expect(orders).toHaveLength(3);
    expect(orders[1]).toMatchObject({ title: "Grilled club", source: "official", caloriesLow: 520, why: "Lots of protein" });
    expect(JSON.stringify(bodies[0].messages)).toContain("1,685 kcal, 121 g protein");
    expect(JSON.stringify(bodies[0].messages)).toContain("getting food from Chick-fil-A");
  });
});

describe("designProgram", () => {
  const library = [
    { id: 1, name: "Pull-Up", equipment: "bodyweight", primaryMuscle: "back" },
    { id: 2, name: "Lateral Raise (Dumbbell)", equipment: "dumbbell", primaryMuscle: "shoulders" },
    { id: 3, name: "Squat (Barbell)", equipment: "barbell", primaryMuscle: "quads" },
  ];

  it("sends the photo and goal, and keeps only real exercises", async () => {
    const { designProgram } = await import("./program");
    const { client, bodies } = scripted([
      message("tool_use", [
        {
          type: "tool_use",
          id: "t1",
          name: "propose_program",
          input: {
            summary: "Upper/lower with extra lats and delts.",
            focus: ["Wide lats", "Side delts"],
            days: [
              {
                name: "Upper A",
                exercises: [
                  { exercise_id: 1, sets: 4, reps: 8, rest_seconds: 150, note: "" },
                  { exercise_id: 2, sets: 9, reps: 15, rest_seconds: 10, note: "Lead with elbows" },
                  { exercise_id: 99, sets: 3, reps: 10, rest_seconds: 90, note: "made up" },
                  { exercise_id: 1, sets: 3, reps: 8, rest_seconds: 90, note: "duplicate" },
                ],
              },
              { name: "Empty", exercises: [{ exercise_id: 42, sets: 3, reps: 8, rest_seconds: 90, note: "" }] },
            ],
          },
        },
      ]),
    ]);
    const program = await designProgram(
      {
        physique: { title: "Nightwing build", subtitle: "Lean, broad shoulders", photo: { data: "aGk=", mediaType: "image/jpeg" } },
        targets: ["Shoulders ÷ waist: 1.42 now → 1.60"],
        lifts: [],
        routines: [],
        preferences: ["Experience: new to lifting (under 6 months)."],
        about: "male, 20",
        daysPerWeek: 4,
        minutes: 60,
        note: "",
        library,
      },
      client,
    );
    expect(program.days).toHaveLength(1);
    expect(program.days[0].exercises.map((e) => e.name)).toEqual(["Pull-Up", "Lateral Raise (Dumbbell)"]);
    expect(program.days[0].exercises[1]).toMatchObject({ sets: 6, reps: 15, restSeconds: 30 });
    const sent = JSON.stringify(bodies[0].messages);
    expect(sent).toContain('"type":"image"');
    expect(sent).toContain("Nightwing build");
    expect(sent).toContain("Experience: new to lifting");
    expect(sent).toContain("2 | Lateral Raise (Dumbbell) | dumbbell | shoulders");
  });
});

describe("clip", () => {
  it("shortens at a word boundary", async () => {
    const { clip } = await import("./program");
    expect(clip("Pick a weight-stack leg press if the gym has one", 30)).toBe("Pick a weight-stack leg press…");
    expect(clip("Short note", 30)).toBe("Short note");
  });
});
