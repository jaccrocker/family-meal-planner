"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle, signOutAction } from "@/app/actions";
import { GoogleButton } from "@/components/GoogleButton";
import { usePlanner } from "@/components/PlannerProvider";
import { weightedServings } from "@/lib/engine/engine";
import { CATALOG, CATALOG_BY_ID } from "@/lib/engine/library";
import type { Household, Multipliers } from "@/lib/engine/types";

const BANDS: { key: "adults" | "kids4to10" | "kids11to18"; mult: keyof Multipliers; label: string; hint: string }[] = [
  { key: "adults", mult: "adult", label: "Adults", hint: "Full portions" },
  { key: "kids4to10", mult: "kid4to10", label: "Kids 4 to 10", hint: "About half portions" },
  { key: "kids11to18", mult: "kid11to18", label: "Kids 11 to 18", hint: "Most of an adult portion" },
];

export default function SetupPage() {
  const { state, update } = usePlanner();
  const h = state.household;
  const setHousehold = (fn: (h: Household) => Household) => update((s) => ({ ...s, household: fn(s.household) }));
  const servings = weightedServings(h);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Set up your household</h1>
        <p className="mt-1 text-muted">Tell us who is eating. Every grocery quantity scales from this.</p>
      </div>

      <AccountCard />

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">Who&apos;s eating</h2>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">{servings.toFixed(2)}</span> adult servings per meal
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {BANDS.map((b) => (
            <div key={b.key} className="rounded-xl border border-line-2 p-4">
              <div className="font-semibold">{b.label}</div>
              <div className="text-sm text-muted">{b.hint}</div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  className="btn btn-quiet h-9 w-9 px-0"
                  aria-label={`Fewer ${b.label}`}
                  onClick={() => setHousehold((x) => ({ ...x, [b.key]: Math.max(0, x[b.key] - 1) }))}
                >
                  −
                </button>
                <span className="w-6 text-center text-xl font-semibold tabular-nums">{h[b.key]}</span>
                <button
                  className="btn btn-quiet h-9 w-9 px-0"
                  aria-label={`More ${b.label}`}
                  onClick={() => setHousehold((x) => ({ ...x, [b.key]: Math.min(20, x[b.key] + 1) }))}
                >
                  +
                </button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-muted">
                Portion
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="3"
                  value={h.multipliers[b.mult]}
                  onChange={(e) =>
                    setHousehold((x) => ({
                      ...x,
                      multipliers: { ...x.multipliers, [b.mult]: Math.max(0, Math.min(3, Number(e.target.value) || 0)) },
                    }))
                  }
                  className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-ink"
                />
                × adult
              </label>
            </div>
          ))}
        </div>
      </section>

      <Staples />

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">List goes to</h2>
          <p className="text-sm text-muted">
            Your Instacart family cart. Turn on Shop with family cart in Instacart before adding the list.
          </p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">Instacart family cart</span>
      </section>

      <div className="flex justify-end">
        <Link href="/meals" className="btn btn-primary">
          Next: pick meals
        </Link>
      </div>
    </div>
  );
}

function AccountCard() {
  const { user, googleConfigured, membership, mode, startDemo, loading } = usePlanner();
  const router = useRouter();

  if (user) {
    return (
      <section className="card flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{user.name}</div>
            <div className="text-sm text-muted">Signed in with Google as {user.email}</div>
          </div>
        </div>
        <form action={signOutAction}>
          <button className="btn btn-quiet h-9 text-sm">Sign out</button>
        </form>
        {loading ? null : membership && !membership.isOwner ? (
          <p className="w-full text-sm text-muted">You share the household of {membership.ownerEmail}.</p>
        ) : (
          <OtherAdults />
        )}
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Save your household and weekly plans</h2>
      <p className="mt-1 text-sm text-muted">
        Sign in with your Google account. We keep only your name and email; no passwords and no access to your Gmail,
        Calendar or Drive.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <form action={signInWithGoogle}>
          <GoogleButton disabled={!googleConfigured} />
        </form>
        <button
          onClick={() => {
            startDemo();
            router.push("/meals");
          }}
          className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Try the demo without signing in
        </button>
      </div>
      {!googleConfigured ? (
        <p className="mt-3 text-xs text-muted">Google sign in is not configured on this server; the demo works without it.</p>
      ) : null}
      {mode === "demo" ? (
        <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          You are in demo mode: a sample family of four and a planned week. Changes stay in this browser until you sign in.
        </p>
      ) : null}
    </section>
  );
}

/** Up to this many other adults can share the household, each with their own Google account. */
const MAX_OTHER_ADULTS = 10;

function OtherAdults() {
  const { membership, refreshMembership } = usePlanner();
  const [rows, setRows] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const members = membership?.members ?? [];
  const room = MAX_OTHER_ADULTS - members.length;

  async function call(method: "POST" | "DELETE", value: string, row?: number) {
    setError(null);
    const res = await fetch("/api/household/members", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Something went wrong");
    else {
      if (row !== undefined) setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== row) : [""]));
      await refreshMembership();
    }
  }

  return (
    <div className="w-full border-t border-line-2 pt-4">
      <div className="font-semibold">Other adults</div>
      <p className="text-sm text-muted">
        They sign in with their own Google account and see the same plan. Add up to {MAX_OTHER_ADULTS}.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {members.map((m) => (
          <li key={m} className="flex items-center gap-3">
            {m}
            <button onClick={() => call("DELETE", m)} className="text-muted underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
      {room > 0
        ? rows.slice(0, room).map((value, i) => (
            <form
              key={i}
              className="mt-2 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                call("POST", value, i);
              }}
            >
              <input
                type="email"
                required
                placeholder="Their Google email"
                aria-label={`Adult ${members.length + i + 2} Google email`}
                value={value}
                onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-9 min-w-56 flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
              />
              <button className="btn btn-quiet h-9 text-sm">Add</button>
            </form>
          ))
        : null}
      {room > rows.length ? (
        <button
          type="button"
          onClick={() => setRows((r) => [...r, ""])}
          className="btn btn-quiet mt-2 h-9 w-9 px-0"
          aria-label="Add another adult"
          title="Add another adult"
        >
          +
        </button>
      ) : null}
      {room <= 0 ? <p className="mt-2 text-sm text-muted">That is the most adults a household can share.</p> : null}
      {error ? <p className="mt-1 text-sm text-warn">{error}</p> : null}
    </div>
  );
}

function Staples() {
  const { state, update } = usePlanner();
  const staples = new Set(state.household.staples);
  const shown = CATALOG.filter((c) => c.staple || staples.has(c.id));
  const extra = state.household.staples.filter((id) => !CATALOG_BY_ID.has(id));

  const toggle = (id: string) =>
    update((s) => {
      const set = new Set(s.household.staples);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...s, household: { ...s.household, staples: [...set] } };
    });

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Pantry staples</h2>
      <p className="text-sm text-muted">Ticked items stay home; they never go in the cart.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...shown.map((c) => ({ id: c.id, name: c.name })), ...extra.map((id) => ({ id, name: id.replace(/^custom:/, "").replace(/-/g, " ") }))].map(
          (c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                staples.has(c.id) ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-ink-2"
              }`}
            >
              <input type="checkbox" checked={staples.has(c.id)} onChange={() => toggle(c.id)} className="accent-[var(--brand)]" />
              {c.name}
            </label>
          ),
        )}
      </div>
    </section>
  );
}
