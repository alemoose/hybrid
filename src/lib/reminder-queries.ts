import "server-only";
import { listPhotos } from "./goal-queries";
import type { Reminders } from "./reminders";
import { getHer } from "./settings";

export async function getReminders(): Promise<Reminders> {
  const [her, photos] = await Promise.all([getHer(), listPhotos("reminder")]);
  return { name: her.name, notes: her.notes, photoIds: photos.map((p) => p.id) };
}
