"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlanner } from "./PlannerProvider";

const STEPS = [
  { href: "/setup", label: "Set up" },
  { href: "/meals", label: "Meals" },
  { href: "/approve", label: "Approve" },
  { href: "/review", label: "Review" },
  { href: "/shop", label: "Shop" },
];

/**
 * Site header. Shows only the app name on the landing page and on reviewer pages (/r/...).
 * Elsewhere it adds the numbered steps with the current one highlighted, the cart line count
 * beside Review, and a Demo mode badge when the planner is in demo mode.
 */
export function Nav() {
  const path = usePathname();
  const { mode, cart } = usePlanner();
  const active = (href: string) => path.startsWith(href) || (href === "/review" && path.startsWith("/trace"));

  // Reviewers arrive from an email link and see only their page, not the planner's steps.
  if (path.startsWith("/r/")) {
    return (
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3 font-display text-lg font-bold text-brand sm:px-6">Family Meal Planner</div>
      </header>
    );
  }

  // The landing page shows only the name; the steps start at Set up.
  if (path === "/") {
    return (
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3 font-display text-lg font-bold text-brand sm:px-6">Family Meal Planner</div>
      </header>
    );
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-lg font-bold text-brand">
          Family Meal Planner
        </Link>
        {/* On phones the steps take their own row below the name. */}
        <nav className="order-last flex basis-full gap-1 overflow-x-auto text-sm sm:order-none sm:flex-1 sm:basis-auto">
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
