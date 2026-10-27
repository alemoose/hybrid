import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-3xl border border-line bg-card", className)}>{children}</section>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-xs font-bold tracking-[0.08em] text-muted uppercase">{children}</h2>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1 pb-1.5">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-accent">
      {children}
    </Link>
  );
}

/** Eyebrow line over a big display title, with an optional control on the right. */
export function PageHeader({
  eyebrow,
  title,
  back,
  right,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-1">
      {back ? (
        <Link href={back} aria-label="Back" className="circle-btn">
          <BackIcon size={18} />
        </Link>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {eyebrow ? <span className="text-sm font-semibold text-muted">{eyebrow}</span> : null}
        <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.6px] text-balance">{title}</h1>
      </div>
      {right}
    </header>
  );
}

const pillTones = {
  green: "bg-p-green",
  yellow: "bg-p-yellow",
  blue: "bg-p-blue",
  pink: "bg-p-pink",
} as const;

export type PillTone = keyof typeof pillTones;

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-tile-ink", pillTones[tone])}>
      {children}
    </span>
  );
}

export function DateTile({ top, bottom, tone }: { top: string; bottom: string; tone?: PillTone }) {
  return (
    <div
      className={cx(
        "flex size-[42px] shrink-0 flex-col items-center justify-center rounded-xl leading-[1.05]",
        tone ? cx(pillTones[tone], "text-tile-ink") : "border border-line-strong bg-card",
      )}
    >
      <span className={cx("text-[10px] font-semibold", tone ? "" : "text-muted")}>{top}</span>
      <span className="text-base font-bold">{bottom}</span>
    </div>
  );
}

export function Bar({ pct, color = "bg-accent", track = "bg-line" }: { pct: number; color?: string; track?: string }) {
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full", track)}>
      <div className={cx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  );
}
