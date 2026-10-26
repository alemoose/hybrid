import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { routines } from "@/lib/db/schema";
import { getGoals } from "@/lib/food-queries";
import { currentWeight, measurementSnapshots } from "@/lib/goal-queries";
import { requestTime } from "@/lib/dates";
import { getBodyGoal, getPhysique, getProfile } from "@/lib/settings";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const [goals, profile, bodyGoal, physique, weight, { latest }, routineRows] = await Promise.all([
    getGoals(),
    getProfile(),
    getBodyGoal(),
    getPhysique(),
    currentWeight(requestTime()),
    measurementSnapshots(),
    db.select({ id: routines.id }).from(routines).where(eq(routines.archived, false)),
  ]);
  return (
    <Wizard
      initial={{
        profile,
        weight: weight != null ? Math.round(weight * 10) / 10 : null,
        goalWeight: bodyGoal?.goalWeight ?? null,
        pace: bodyGoal?.pace ?? -0.5,
        goals,
        physique: physique ? { title: physique.title, subtitle: physique.subtitle, hasPhoto: physique.photoId != null } : null,
        shoulders: latest.shoulders?.value ?? null,
        waist: latest.waist?.value ?? null,
        routineCount: routineRows.length,
      }}
    />
  );
}
