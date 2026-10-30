"use client";

import Link from "next/link";
import { usePlanner } from "@/components/PlannerProvider";
import { CATALOG_BY_ID, LIBRARY_BY_ID } from "@/lib/engine/library";
import { CATEGORY_ORDER, type CartLine } from "@/lib/engine/types";
import { formatQty } from "@/lib/engine/units";

export default function ReviewPage() {
  const { cart, state, update } = usePlanner();
  const dinners = state.plan.filter((p) => p.mealType === "Dinner" && !LIBRARY_BY_ID.get(p.mealId)?.noGroceries).length;
  const lunches = state.plan.filter((p) => p.mealType === "Lunch").length;

  const exclude = (item: string) => update((s) => ({ ...s, exclude: [...new Set([...s.exclude, item])] }));
  const restore = (item: string) => update((s) => ({ ...s, exclude: s.exclude.filter((x) => x !== item) }));
  const removed = state.exclude
    .map((id) => CATALOG_BY_ID.get(id) ?? state.customItems.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (state.plan.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold">No meals planned yet</h1>
        <p className="mt-1 text-muted">Pick a few meals and the cart builds itself.</p>
        <Link href="/meals" className="btn btn-primary mt-4">
          Pick meals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Review your cart</h1>
          <p className="mt-1 text-muted">
            {cart.lines.length} items for {dinners} {dinners === 1 ? "dinner" : "dinners"}
            {lunches ? `, ${lunches} ${lunches === 1 ? "lunch" : "lunches"}` : ""}; {cart.servings.toFixed(2)} servings per meal
          </p>
        </div>
        <Link href="/shop" className="btn btn-primary">
          Next: shop
        </Link>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const lines = cart.lines.filter((l) => l.category === cat);
        if (!lines.length) return null;
        return (
          <section key={cat} className="card overflow-hidden">
            <h2 className="border-b border-line-2 px-5 py-3 font-display text-lg font-semibold">{cat}</h2>
            <ul className="divide-y divide-line-2">
              {lines.map((l) => (
                <Line key={l.item} line={l} onHave={() => exclude(l.item)} />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="card space-y-2 p-5 text-sm text-ink-2">
        {cart.staples.length ? (
          <p>
            <span className="font-semibold text-ink">Staying home:</span>{" "}
            {cart.staples.map((s) => s.name).join(", ")} from your pantry staples.
          </p>
        ) : null}
        {cart.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
        {removed.length ? (
          <p>
            <span className="font-semibold text-ink">Already have:</span>{" "}
            {removed.map((r, i) => (
              <span key={r.id}>
                {i ? ", " : ""}
                {r.name}{" "}
                <button onClick={() => restore(r.id)} className="text-brand underline">
                  add back
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Line({ line, onHave }: { line: CartLine; onHave: () => void }) {
  const withLeftovers = new Set(line.trace.filter((t) => t.viaLeftover).map((t) => t.mealName));
  const meals = [...new Set(line.trace.map((t) => t.mealName))].map((m) =>
    withLeftovers.has(m) ? `${m} plus leftovers` : m,
  );
  const single = line.pack.unit === "each" && line.pack.size === 1;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {line.name}{" "}
          <span className="font-normal text-ink-2">
            {single ? `× ${line.packs}` : `${line.packs} × ${line.pack.label}`}
          </span>
        </div>
        <div className="text-sm text-muted">
          Need {formatQty(line.needed, line.unit)} for {meals.join(", ")}
        </div>
        {line.waste ? (
          <div className="mt-1 inline-block rounded-md bg-warn-soft px-2 py-0.5 text-xs text-warn ring-1 ring-warn-line">
            Over half of this goes unused; buys {formatQty(line.packs * line.pack.size, line.unit)}, meals use{" "}
            {formatQty(line.needed, line.unit)}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={`/trace?item=${encodeURIComponent(line.item)}`} className="btn btn-quiet h-8 px-3 text-sm">
          Why
        </Link>
        <button onClick={onHave} className="btn btn-quiet h-8 px-3 text-sm">
          Have it
        </button>
      </div>
    </li>
  );
}
