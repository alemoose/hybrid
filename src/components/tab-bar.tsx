"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, DumbbellIcon, ForkIcon, HomeIcon, PlusIcon } from "./icons";
import { cx } from "./ui";

const tabs = [
  { href: "/", label: "Today", Icon: HomeIcon, match: (p: string) => p === "/" || p.startsWith("/goals") },
  { href: "/food", label: "Food", Icon: ForkIcon, match: (p: string) => p.startsWith("/food") },
  null,
  { href: "/gym", label: "Gym", Icon: DumbbellIcon, match: (p: string) => p.startsWith("/gym") },
  { href: "/progress", label: "Progress", Icon: ChartIcon, match: (p: string) => p.startsWith("/progress") },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav"
    >
      <div className="mx-auto flex h-[72px] max-w-md items-start justify-around px-2.5 pt-2">
        {tabs.map((tab) =>
          tab ? (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.match(pathname) ? "page" : undefined}
              className={cx(
                "flex w-16 flex-col items-center gap-[3px] text-[11px] font-semibold",
                tab.match(pathname) ? "text-ink" : "text-faint",
              )}
            >
              <tab.Icon />
              {tab.label}
            </Link>
          ) : (
            <Link
              key="add"
              href="/add"
              aria-label="Log something"
              className="flex size-[52px] items-center justify-center rounded-2xl bg-cobalt text-white"
            >
              <PlusIcon />
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
