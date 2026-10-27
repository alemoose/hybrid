// Little reminders of someone you love that turn up around the app: when a
// workout starts, between sets, and every few days on Today. No database.

export type Reminders = { name: string; notes: string[]; photoIds: number[] };

/** Small, stable string hash, so the same day (or rest) always picks the same reminder. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function hasReminders(r: Reminders | null): r is Reminders {
  return r != null && (r.notes.length > 0 || r.photoIds.length > 0);
}

/** One note and one photo for a seed (a day, a workout, a rest). Either may be missing. */
export function pickReminder(r: Reminders, seed: string): { note: string | null; photoId: number | null } {
  const h = hash(seed);
  return {
    note: r.notes.length ? r.notes[h % r.notes.length] : null,
    photoId: r.photoIds.length ? r.photoIds[(h >>> 8) % r.photoIds.length] : null,
  };
}

/** Today shows one on roughly a third of days, so it stays a surprise. */
export function showsOnToday(day: string): boolean {
  return hash(`today:${day}`) % 3 === 0;
}
