import "server-only";
import { addDays } from "./dates";
import { foodByDay, getDayFood, getGoals } from "./food-queries";
import { sodiumGoalFor, waterGoal } from "./nutrition";
import { workoutsByDay } from "./queries";

/** Food, water and training for one day, with that day's sodium and water targets. */
export async function getDayContext(key: string, tz: string) {
  const yesterday = addDays(key, -1);
  const [goals, food, workouts, prev] = await Promise.all([
    getGoals(),
    getDayFood(key, tz),
    workoutsByDay(key, key, tz),
    foodByDay(yesterday, yesterday, tz),
  ]);
  const todays = workouts.get(key) ?? [];
  const trainedMinutes = todays.reduce((m, w) => m + (w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000, 0);
  const trained = todays.length > 0;
  const water = waterGoal({ goals, trainedMinutes, yesterdaySodium: prev.get(yesterday)?.nutrients.sodium ?? 0 });

  const why = [`${water.base} oz base`];
  if (water.training) why.push(`+${water.training} for training`);
  if (water.salty) why.push(`+${water.salty} after a salty day`);

  return {
    goals,
    food,
    trained,
    sodiumGoal: sodiumGoalFor(goals, trained),
    water: { ...water, why: goals.waterOverride > 0 ? "Your fixed daily goal" : why.join(" ") },
  };
}
