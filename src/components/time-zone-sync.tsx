"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const COOKIE = "log_tz";

/** Keeps the time-zone cookie in step with the device, e.g. after travel. */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (tz && decodeURIComponent(current ?? "") !== tz) {
      const secure = location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax${secure}`;
      router.refresh();
    }
  }, [router]);
  return null;
}
