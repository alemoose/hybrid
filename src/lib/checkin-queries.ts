import "server-only";
import { weightTrend } from "./body";
import { ADJUST_COOLDOWN_DAYS, suggestAdjustment, weekAverages, type Adjustment } from "./checkin";
import { addDays, daysBetween, todayKey } from "./dates";
import { foodByDay, getGoals } from "./food-queries";
import { habitHistory } from "./habit-queries";
import { creatineLoadingDaysLeft } from "./habits";
import { listWeights } from "./goal-queries";
import { workoutsByDay } from "./queries";
import { getBodyGoal, getProfile, getSetting } from "./settings";

const DAY = 86_400_000;

/** The last calorie change made from a check-in. */
export type CalorieChange = { day: string; from: number; to: number };
export const getLastChange = () => getSetting<CalorieChange | null>("calorieChange", null);
/** The day the Today nudge was last waved off; it stays hidden for a week. */
export const getDismissedDay = () => getSetting<string | null>("checkinDismissed", null);

/**
 * The last 7 full days (today is still in progress) against the 7 before,
 * plus the weight trend and what to do about calories.
 */
export async function getCheckin(tz: string, now = Date.now()) {
  const today = todayKey(tz);
  const last = addDays(today, -1);
  const first = addDays(today, -7);
  const prevFirst = addDays(today, -14);
  const [goals, bodyGoal, profile, food, workouts, prevWorkouts, weights, lastChange, dismissed, creatine] = await Promise.all([
    getGoals(),
    getBodyGoal(),
    getProfile(),
    foodByDay(prevFirst, last, tz),
    workoutsByDay(first, last, tz),
    workoutsByDay(prevFirst, addDays(first, -1), tz),
    listWeights(now - 42 * DAY),
    getLastChange(),
    getDismissedDay(),
    habitHistory("creatine", today),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const dayFood = (key: string) => {
    const d = food.get(key);
    return {
      key,
      calories: d?.nutrients.calories ?? 0,
      protein: d?.nutrients.protein ?? 0,
      sodium: d?.nutrients.sodium ?? 0,
      spentCents: d?.spentCents ?? 0,
      meals: d?.meals ?? 0,
    };
  };
  const week = days.map(dayFood);
  const prevWeek = days.map((k) => dayFood(addDays(k, -7)));
  const thisWeek = weekAverages(week, goals.sodium);
  const lastWeek = weekAverages(prevWeek, goals.sodium);

  const trend = weightTrend(weights, now);
  const pace = bodyGoal?.pace ?? 0;
  const sessions = [...workouts.values()].flat();
  const prevSessions = [...prevWorkouts.values()].flat();

  const cooling = lastChange ? daysBetween(lastChange.day, today) < ADJUST_COOLDOWN_DAYS : false;
  const adjustment: Adjustment | { kind: "cooldown"; change: CalorieChange; daysLeft: number } =
    cooling && lastChange
      ? { kind: "cooldown", change: lastChange, daysLeft: ADJUST_COOLDOWN_DAYS - daysBetween(lastChange.day, today) }
      : suggestAdjustment({
          pace,
          rate: trend.ratePerWeek,
          calorieGoal: goals.calories,
          avgCalories: thisWeek.avgCalories,
          loggedDays: thisWeek.loggedDays,
          minCalories: profile?.sex === "female" ? 1200 : 1500,
          creatineDaysLeft: creatineLoadingDaysLeft(creatine, today),
        });

  return {
    range: { first, last },
    goals,
    pace,
    goalWeight: bodyGoal?.goalWeight ?? null,
    week,
    thisWeek,
    lastWeek,
    weight: trend,
    workouts: { count: sessions.length, volume: sessions.reduce((t, w) => t + w.volume, 0) },
    prevWorkouts: { count: prevSessions.length, volume: prevSessions.reduce((t, w) => t + w.volume, 0) },
    adjustment,
    /** Show the Today nudge: a change is suggested and it wasn't waved off in the last week. */
    nudge: adjustment.kind === "change" && (dismissed == null || daysBetween(dismissed, today) >= 7),
  };
}
