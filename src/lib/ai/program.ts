import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EstimateError, MODEL, apiErrorMessage } from "./estimate";

const SYSTEM = `You are a strength coach writing a gym program for one person, aimed at the physique they want to build.

How to work:
- Study their goal: the inspiration photo (if any), its name and description, and the numbers they track. Work out which muscles make that look (for example a V-taper needs wide lats, round side and rear delts, and a tight waist) and give those more weekly sets, while keeping the whole body trained.
- Fit the program to the days per week and session length they give. Name each day plainly ("Upper A", "Pull + delts").
- Use ONLY exercises from the provided library, by exercise_id. Prefer what they already do when it fits, so their history carries over.
- Their experience level and equipment comfort come first: a program they'll actually do beats a perfect one.
- 4–7 exercises a day unless their experience says otherwise. Big compound lifts first with 2–3 minutes rest; isolation work later with 60–90 seconds. Reps: 5–8 for heavy compounds, 8–12 for most work, 12–20 for delts, calves, abs and arms.
- Most muscles should get 10–20 hard sets a week; priority muscles toward the top of that range.
- They are in a calorie surplus unless told otherwise. Respect anything in their note (injuries, equipment, time).
- "summary" is 2–3 sentences in plain words: the split and why it builds this physique.
- "focus" lists the 3–5 things the program prioritizes, each a few words.
- Each exercise "note" is optional and short (a cue or why it's there), or empty.

Call propose_program exactly once.`;

const PROPOSE_PROGRAM: Anthropic.Beta.BetaTool = {
  name: "propose_program",
  description: "Record the program. Call exactly once.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "focus", "days"],
    properties: {
      summary: { type: "string" },
      focus: { type: "array", items: { type: "string" } },
      days: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "exercises"],
          properties: {
            name: { type: "string" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["exercise_id", "sets", "reps", "rest_seconds", "note"],
                properties: {
                  exercise_id: { type: "integer" },
                  sets: { type: "integer" },
                  reps: { type: "integer" },
                  rest_seconds: { type: "integer" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

type ProposeInput = {
  summary: string;
  focus: string[];
  days: { name: string; exercises: { exercise_id: number; sets: number; reps: number; rest_seconds: number; note: string }[] }[];
};

export type ProgramDay = {
  name: string;
  exercises: { exerciseId: number; name: string; sets: number; reps: number; restSeconds: number; note: string }[];
};
export type Program = { summary: string; focus: string[]; days: ProgramDay[] };

export type ProgramRequest = {
  physique: { title: string; subtitle: string; photo: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null };
  /** Lines like "Shoulders ÷ waist: 1.42 now → 1.60". */
  targets: string[];
  /** Lines like "Bench Press (Barbell): est. max 185 lb, 9 sessions in 90 days". */
  lifts: string[];
  /** Lines like "Push Day: Bench Press (Barbell), Overhead Press (Barbell), …". */
  routines: string[];
  /** Experience, equipment comfort and the gym (see training-prefs). */
  preferences: string[];
  about: string;
  daysPerWeek: number;
  minutes: number;
  note: string;
  library: { id: number; name: string; equipment: string; primaryMuscle: string }[];
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Keeps only exercises that exist, and every number in a sane range. */
export function cleanProgram(input: ProposeInput, library: ProgramRequest["library"]): Program {
  const byId = new Map(library.map((e) => [e.id, e]));
  const days = (input.days ?? []).slice(0, 7).flatMap((d) => {
    const seen = new Set<number>();
    const exercises = (d.exercises ?? []).flatMap((e) => {
      const ex = byId.get(Number(e.exercise_id));
      if (!ex || seen.has(ex.id)) return [];
      seen.add(ex.id);
      return [
        {
          exerciseId: ex.id,
          name: ex.name,
          sets: clampInt(e.sets, 1, 6, 3),
          reps: clampInt(e.reps, 3, 30, 10),
          restSeconds: clampInt(e.rest_seconds, 30, 300, 90),
          note: String(e.note ?? "").slice(0, 120),
        },
      ];
    });
    return exercises.length ? [{ name: String(d.name ?? "").trim().slice(0, 40) || "Day", exercises: exercises.slice(0, 9) }] : [];
  });
  return {
    summary: String(input.summary ?? "").slice(0, 600),
    focus: (input.focus ?? []).map((f) => String(f).slice(0, 60)).filter(Boolean).slice(0, 6),
    days,
  };
}

export async function designProgram(req: ProgramRequest, client: Anthropic = new Anthropic()): Promise<Program> {
  const text = [
    `Goal physique: ${req.physique.title || "(no name)"}${req.physique.subtitle ? `: ${req.physique.subtitle}` : ""}.`,
    req.physique.photo ? "The attached photo is my inspiration." : "",
    req.targets.length ? `Numbers I track:\n${req.targets.join("\n")}` : "",
    `About me: ${req.about}`,
    req.lifts.length ? `My recent lifts:\n${req.lifts.join("\n")}` : "I haven't logged lifts in the app yet.",
    req.routines.length ? `My current routines:\n${req.routines.join("\n")}` : "",
    req.preferences.join("\n"),
    `I can train ${req.daysPerWeek} days a week, about ${req.minutes} minutes a session.`,
    req.note ? `Also: ${req.note}` : "",
    `Exercise library (id | name | equipment | primary muscle):\n${req.library.map((e) => `${e.id} | ${e.name} | ${e.equipment} | ${e.primaryMuscle}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (req.physique.photo) {
    content.push({ type: "image", source: { type: "base64", media_type: req.physique.photo.mediaType, data: req.physique.photo.data } });
  }
  content.push({ type: "text", text });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];

  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [PROPOSE_PROGRAM],
        tool_choice: { type: "auto" },
        messages,
      });
    } catch (err) {
      throw apiErrorMessage(err, "Designing the program") ?? err;
    }
    if (response.stop_reason === "refusal") throw new EstimateError("Couldn't design a program from that. Try changing the note.");
    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "propose_program",
    );
    if (call) {
      const program = cleanProgram(call.input as ProposeInput, req.library);
      if (program.days.length) return program;
      throw new EstimateError("The program came back empty. Try again.");
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: "Call propose_program now." });
  }
  throw new EstimateError("Couldn't design a program. Try again.");
}
