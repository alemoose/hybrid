import Link from "next/link";
import { loadSuggestion } from "@/app/food-actions";
import { CloseIcon } from "@/components/icons";
import { ResumeBanner } from "@/components/resume-banner";
import { SectionLabel, cx } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/estimate";
import { getTimeZone } from "@/lib/auth";
import { formatDayKey, localHour, todayKey } from "@/lib/dates";
import { getGoals, listUsuals } from "@/lib/food-queries";
import { defaultMeal } from "@/lib/nutrition";
import { listRoutines } from "@/lib/queries";
import { FoodLogger } from "./food-logger";

// Chain lookups search the web before answering.
export const maxDuration = 120;

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const [sp, tz] = await Promise.all([searchParams, getTimeZone()]);
  const mode = sp.mode === "workout" ? "workout" : "food";
  const today = todayKey(tz);
  const day = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d < today ? sp.d : undefined;
  const dayQuery = day ? `&d=${day}` : "";

  return (
    <>
      <div className="flex items-center gap-7">
        <Link href={day ? `/food?d=${day}` : "/"} aria-label="Close" className="circle-btn">
          <CloseIcon size={18} />
        </Link>
        <div role="group" aria-label="What are you logging" className="grid w-[210px] grid-cols-2 rounded-full bg-inner p-1">
          {(["food", "workout"] as const).map((m) => (
            <Link
              key={m}
              href={`/add?mode=${m}${dayQuery}`}
              aria-current={mode === m ? "page" : undefined}
              replace
              className={cx(
                "flex h-9 items-center justify-center rounded-full text-sm capitalize",
                mode === m ? "bg-ink font-bold text-dark" : "font-semibold text-muted",
              )}
            >
              {m}
            </Link>
          ))}
        </div>
      </div>

      {day ? (
        <p className="px-1 text-sm font-semibold text-gold">
          Logging for {formatDayKey(day, { weekday: "long", month: "short", day: "numeric" })}
        </p>
      ) : null}

      {mode === "food" ? (
        <FoodMode
          tz={tz}
          day={day}
          suggestion={typeof sp.suggestion === "string" ? { key: sp.suggestion, index: Number(sp.i) || 0 } : undefined}
        />
      ) : (
        <WorkoutMode />
      )}
    </>
  );
}

async function FoodMode({ tz, day, suggestion }: { tz: string; day?: string; suggestion?: { key: string; index: number } }) {
  const [usuals, goals, initial] = await Promise.all([
    listUsuals(8),
    getGoals(),
    suggestion ? loadSuggestion(suggestion.key, suggestion.index) : null,
  ]);
  return (
    <FoodLogger
      usuals={usuals}
      aiReady={aiConfigured()}
      defaultMeal={day ? "lunch" : defaultMeal(localHour(new Date(), tz))}
      day={day}
      sodiumGoal={goals.sodium}
      initial={initial ?? undefined}
    />
  );
}

async function WorkoutMode() {
  const routines = await listRoutines();
  return (
    <>
      <ResumeBanner />
      <Link href="/workout?empty=1" className="btn-outline h-14 justify-start rounded-2xl px-4 text-base">
        <span className="text-xl text-accent">+</span> Start empty workout
      </Link>
      {routines.length > 0 ? <SectionLabel>Start a routine</SectionLabel> : null}
      {routines.map((r) => (
        <Link
          key={r.id}
          href={`/workout?routine=${r.id}`}
          className="flex items-center gap-3 rounded-[20px] border border-line bg-card px-4 py-3.5"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-bold">{r.name}</span>
            <span className="truncate text-[13px] text-muted">{r.exerciseNames.join(", ")}</span>
          </span>
          <span className="text-sm font-bold text-accent">Start</span>
        </Link>
      ))}
    </>
  );
}
