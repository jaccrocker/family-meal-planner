"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlanner } from "./PlannerProvider";

const STEPS = [
  { href: "/", label: "Set up" },
  { href: "/meals", label: "Meals" },
  { href: "/review", label: "Review" },
  { href: "/shop", label: "Shop" },
];

export function Nav() {
  const path = usePathname();
  const { mode, cart } = usePlanner();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/review" && path.startsWith("/trace"));

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-lg font-bold text-brand">
          Family Meal Planner
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
          {STEPS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${
                active(s.href) ? "bg-brand-soft text-brand-dark" : "text-muted hover:text-ink"
              }`}
            >
              {i + 1} {s.label}
              {s.href === "/review" && cart.lines.length > 0 ? (
                <span className="ml-1.5 text-xs text-muted">{cart.lines.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        {mode === "demo" ? (
          <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">Demo mode</span>
        ) : null}
      </div>
    </header>
  );
}
