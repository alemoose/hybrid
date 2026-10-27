"use client";

import { useState, useTransition } from "react";
import { setupRecCounts } from "@/app/rec-actions";

export function RecForm({ connected, page }: { connected: boolean; page: string }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await setupRecCounts(value);
          setMessage(res.ok ? { ok: true, text: "Connected. The Gym tab shows live counts now." } : { ok: false, text: res.error });
          if (res.ok) setValue("");
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px]">Rec center counts</span>
        <span className={`text-[15px] ${connected ? "text-good" : "text-warn"}`}>{connected ? "Connected" : "Not found"}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        Paste the link of the page that shows live counts, or leave it empty to check {new URL(page).hostname} again.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="url"
        placeholder="https://urec.sl.ua.edu/…"
        aria-label="Live counts page link"
        className="h-11 rounded-xl border border-line-strong bg-inner px-3 text-[15px] outline-none placeholder:text-faint"
      />
      {message ? <p className={`text-sm font-semibold ${message.ok ? "text-good" : "text-warn"}`}>{message.text}</p> : null}
      <button type="submit" disabled={pending} className="btn-outline">
        {pending ? "Checking…" : connected ? "Check again" : "Find live counts"}
      </button>
    </form>
  );
}
