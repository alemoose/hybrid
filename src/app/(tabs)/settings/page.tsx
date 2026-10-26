import { logout } from "@/app/login/actions";
import { Card, PageHeader } from "@/components/ui";
import { getTimeZone } from "@/lib/auth";
import { passwordConfigured } from "@/lib/session";

export default async function SettingsPage() {
  const tz = await getTimeZone();
  return (
    <>
      <PageHeader back="/" eyebrow="You" title="Settings" />
      <Card className="flex flex-col divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px]">Time zone</span>
          <span className="text-[15px] text-muted">{tz}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[15px]">Units</span>
          <span className="text-[15px] text-muted">Pounds</span>
        </div>
      </Card>
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
