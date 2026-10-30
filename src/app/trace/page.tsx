"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePlanner } from "@/components/PlannerProvider";
import { formatQty, round } from "@/lib/engine/units";

export default function TracePage() {
  return (
    <Suspense>
      <Trace />
    </Suspense>
  );
}

function Trace() {
  const item = useSearchParams().get("item");
  const { cart, state } = usePlanner();
  const line = cart.lines.find((l) => l.item === item);
  const h = state.household;

  if (!line) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted">That item is not in this week&apos;s cart.</p>
        <Link href="/review" className="btn btn-quiet mt-4">
          Back to the cart
        </Link>
      </div>
    );
  }

  const u = line.unit === "each" ? "" : ` ${line.unit === "floz" ? "fl oz" : line.unit}`;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/review" className="text-sm text-brand underline-offset-4 hover:underline">
        Back to the cart
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold">Why {line.name}</h1>
        <p className="mt-1 text-lg text-ink-2">
          {formatQty(line.needed, line.unit)} needed, so {line.packs} × {line.pack.label}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">Servings per meal</h2>
        <p className="mt-1 font-mono text-sm text-ink-2">
          {h.adults} adults × {h.multipliers.adult} + {h.kids4to10} kids 4 to 10 × {h.multipliers.kid4to10} +{" "}
          {h.kids11to18} kids 11 to 18 × {h.multipliers.kid11to18} = {round(cart.servings)}
        </p>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-line-2 text-left text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Meal</th>
              <th className="px-3 py-3 text-right font-medium">Per serving</th>
              <th className="px-3 py-3 text-right font-medium">Servings</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2 font-mono">
            {line.trace.map((t, i) => (
              <tr key={i}>
                <td className="px-5 py-2.5 font-sans">
                  <span className="text-muted">{t.day}</span> {t.mealName}
                  {t.viaLeftover ? <div className="text-xs text-muted">cooked extra for {t.viaLeftover}</div> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {round(t.perServing, 3)}
                  {u}
                </td>
                <td className="px-3 py-2.5 text-right">× {round(t.servings)}</td>
                <td className="px-5 py-2.5 text-right">
                  {round(t.amount)}
                  {u}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line font-mono">
            <tr>
              <td className="px-5 py-2.5 font-sans font-semibold" colSpan={3}>
                Total needed
              </td>
              <td className="px-5 py-2.5 text-right font-semibold">
                {round(line.needed)}
                {u}
              </td>
            </tr>
            <tr>
              <td className="px-5 py-2.5 font-sans" colSpan={3}>
                Packs of {line.pack.label}, rounded up
              </td>
              <td className="px-5 py-2.5 text-right">buy {line.packs}</td>
            </tr>
            <tr>
              <td className="px-5 py-2.5 font-sans text-muted" colSpan={3}>
                Left over after the week
              </td>
              <td className="px-5 py-2.5 text-right text-muted">
                {round(line.extra)}
                {u}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="text-sm text-muted">
        Per serving amounts come from the meal list and are editable; the math above is plain code, so the same week
        always gives the same cart.
      </p>
    </div>
  );
}
