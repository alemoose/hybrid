"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { saveRecSource } from "@/lib/rec-queries";

export type RecSetupResult = { ok: true } | { ok: false; error: string };

/** Accepts the rec center's page link, a Connect2Concepts widget link, or the bare key. */
export async function setupRecCounts(input: string): Promise<RecSetupResult> {
  await requireAuth();
  try {
    const source = await saveRecSource(String(input ?? "").slice(0, 500));
    revalidatePath("/gym");
    revalidatePath("/settings");
    return source.key
      ? { ok: true }
      : { ok: false, error: "No live-counts widget on that page. Try the link of the page that shows the counts." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't open that page (${e.message}).` : "Couldn't open that page." };
  }
}
