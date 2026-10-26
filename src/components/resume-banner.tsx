"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readDraft } from "@/lib/draft-storage";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("focus", cb);
  };
};

const snapshot = () => {
  const d = readDraft();
  return d ? `${d.name}|${d.startedAt}` : "";
};

/** Shows when a workout is open on this device, so it's one tap to get back. */
export function ResumeBanner() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!value) return null;
  const [name, startedAt] = value.split("|");
  const started = new Date(Number(startedAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <Link
      href="/workout"
      className="flex items-center gap-3 rounded-[18px] bg-cobalt px-4 py-3.5 text-white"
    >
      <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
      <span className="flex flex-1 flex-col">
        <span className="text-[15px] font-bold">{name} in progress</span>
        <span className="text-[13px] opacity-85">Started at {started}</span>
      </span>
      <span className="text-sm font-bold">Resume</span>
    </Link>
  );
}
