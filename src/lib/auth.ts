import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, TZ_COOKIE, isValidSession } from "./session";

/** Call at the top of every Server Action: the proxy guards pages, actions guard themselves. */
export async function requireAuth(): Promise<void> {
  const jar = await cookies();
  if (!isValidSession(jar.get(SESSION_COOKIE)?.value)) {
    redirect("/login");
  }
}

/** The viewer's time zone, sent by the browser; dates are grouped by it. */
export async function getTimeZone(): Promise<string> {
  const jar = await cookies();
  const tz = jar.get(TZ_COOKIE)?.value;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {
      // fall through
    }
  }
  return process.env.APP_TIMEZONE || "UTC";
}
