// The workout in progress lives in localStorage, so a reload, a locked
// phone or a dropped connection mid-set never loses anything.
import type { WorkoutDraft } from "./workout-types";

const KEY = "log.activeWorkout";

export function readDraft(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WorkoutDraft;
    return draft?.version === 1 ? draft : null;
  } catch {
    return null;
  }
}

export function writeDraft(draft: WorkoutDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the workout still works for this session.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
