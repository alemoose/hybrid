import { EXERCISE_LIBRARY } from "./db/exercise-library";
import { EXERCISE_GUIDES } from "./exercise-guides";

export type Guide = { steps: string[]; photos: [start: string, end: string] };

const SLUG_BY_NAME = new Map(EXERCISE_LIBRARY.map((e) => [e.name.toLowerCase(), e.slug]));
// The source ends most guides with this; it adds nothing.
const FILLER = /^repeat (for|the|as)\b/i;

/**
 * The form guide for a built-in exercise: by slug, or by name for workout drafts, which only
 * carry the name. Null for custom exercises and the few built-ins without one.
 */
export function guideFor({ slug, name }: { slug?: string; name?: string }): Guide | null {
  const key = slug ?? (name ? SLUG_BY_NAME.get(name.toLowerCase()) : undefined);
  const steps = key ? EXERCISE_GUIDES[key] : undefined;
  if (!key || !steps) return null;
  return {
    steps: steps.filter((s) => !FILLER.test(s)),
    photos: [`/exercise-guides/${key}-0.jpg`, `/exercise-guides/${key}-1.jpg`],
  };
}
