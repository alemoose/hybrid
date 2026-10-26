"use client";

import { useActionState, useEffect, useState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [tz, setTz] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after mount
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="h-14 rounded-2xl border border-line-strong bg-card px-4 text-lg outline-none focus:border-accent"
        />
      </label>
      <input type="hidden" name="tz" value={tz} />
      {state.error ? <p className="text-sm font-semibold text-warn">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-2xl bg-ink text-base font-bold text-dark disabled:opacity-60"
      >
        {pending ? "Checking…" : "Let me in"}
      </button>
    </form>
  );
}
