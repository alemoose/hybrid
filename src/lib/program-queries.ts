import "server-only";
import type { Program } from "./ai/program";
import { getSetting } from "./settings";

export type ProgramDraft = { program: Program; daysPerWeek: number; minutes: number; note: string; createdAt: number; usedAt?: number };

export const getProgramDraft = () => getSetting<ProgramDraft | null>("programDraft", null);
