import { logout } from "@/app/login/actions";
import { Card, PageHeader, SectionLabel } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/estimate";
import { getTimeZone } from "@/lib/auth";
import { getGoals } from "@/lib/food-queries";
import { passwordConfigured } from "@/lib/session";
import { DEFAULT_REC_PAGE, getRecSource } from "@/lib/rec-queries";
import { GoalsForm } from "./goals-form";
import { RecForm } from "./rec-form";

export default async function SettingsPage() {
  const [tz, goals, rec] = await Promise.all([getTimeZone(), getGoals(), getRecSource()]);
  return (
    <>
      <PageHeader back="/goals" eyebrow="You" title="Settings" />

      <SectionLabel>Daily goals</SectionLabel>
      <GoalsForm goals={goals} />

      <SectionLabel>App</SectionLabel>
      <Card className="flex flex-col divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px]">Food lookups</span>
          <span className={`text-[15px] ${aiConfigured() ? "text-good" : "text-warn"}`}>
            {aiConfigured() ? "On" : "Needs ANTHROPIC_API_KEY"}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px]">Time zone</span>
          <span className="text-[15px] text-muted">{tz}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px]">Units</span>
          <span className="text-[15px] text-muted">Pounds · ounces</span>
        </div>
      </Card>
      <SectionLabel>Gym</SectionLabel>
      <div id="rec" className="scroll-mt-6">
        <Card>
          <RecForm connected={Boolean(rec?.key)} page={rec?.page ?? DEFAULT_REC_PAGE} />
        </Card>
      </div>
      <a href="/welcome" className="btn-outline">
        Run setup again
      </a>
      {passwordConfigured() ? (
        <form action={logout}>
          <button type="submit" className="btn-outline w-full">
            Sign out
          </button>
        </form>
      ) : (
        <p className="px-1 text-[13px] text-muted">No password set, so this app is open (development only).</p>
      )}
    </>
  );
}
