import { passwordConfigured } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const configured = passwordConfigured();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">Food + gym log</span>
        <h1 className="font-display text-5xl font-semibold tracking-tight">Hey.</h1>
      </div>
      {configured ? (
        <LoginForm />
      ) : (
        <p className="rounded-3xl border border-line bg-card p-5 text-[15px] leading-relaxed text-ink-2">
          No password is set yet. Add an <b className="text-ink">APP_PASSWORD</b> environment
          variable in Vercel (or <code>.env.local</code>), then reload this page.
        </p>
      )}
    </main>
  );
}
