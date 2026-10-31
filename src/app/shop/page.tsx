"use client";

import Link from "next/link";
import { useState } from "react";
import { SkylightPhrases } from "@/components/integrations/SkylightPhrases";
import { usePlanner } from "@/components/PlannerProvider";
import type { ShoppingListRequest } from "@/lib/instacart";

interface Result {
  mode: "live" | "demo" | "error";
  url?: string;
  error?: string;
  request: ShoppingListRequest;
  text: string;
}

export default function ShopPage() {
  const { state, cart, mode, weekOf, features } = usePlanner();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function shop() {
    setBusy(true);
    try {
      const res = await fetch("/api/instacart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, weekOf, demo: mode !== "account" }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
      if (data.mode === "live" && data.url) window.open(data.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const text = result?.text ?? cart.lines.map((l) => `- ${l.displayText}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  if (cart.lines.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Nothing to shop for yet</h1>
        <Link href="/meals" className="btn btn-primary mt-4">
          Pick meals
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Send the list to Instacart</h1>
        <p className="mt-1 text-muted">
          Week of {weekOf}: {cart.lines.length} items. You pick the store and check out in Instacart; the planner never
          places or pays for an order.
        </p>
      </div>

      <section className="rounded-xl bg-warn-soft p-4 text-sm text-warn ring-1 ring-warn-line">
        <div className="font-semibold">Turn on your family cart first</div>
        In Instacart, open the cart and choose Shop with family cart before adding the list, so the items land in the
        shared cart. Don&apos;t switch carts while an order is open; switching clears the family cart.
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <button
          onClick={shop}
          disabled={busy}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-full bg-[#003D29] px-6 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Building the list…" : "Shop on Instacart"}
        </button>

        {result?.mode === "live" && result.url ? (
          <p className="text-sm">
            List ready.{" "}
            <a href={result.url} target="_blank" rel="noopener" className="font-semibold text-brand underline">
              Open it in Instacart
            </a>{" "}
            if it did not open.
          </p>
        ) : null}

        {result?.mode === "demo" ? (
          <div className="space-y-2 text-sm text-ink-2">
            <p>
              Demo mode: no Instacart key here, so this is the shopping list the planner would send. With a key, the
              same request returns a link that opens the list in Instacart.
            </p>
            <details className="rounded-lg border border-line-2 p-3">
              <summary className="cursor-pointer font-semibold text-ink">See the Instacart request</summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs">
                {JSON.stringify(result.request, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}

        {result?.mode === "error" ? (
          <p className="text-sm text-warn">Instacart did not take the list ({result.error}). Copy it instead.</p>
        ) : null}

        <div className="border-t border-line-2 pt-4">
          <div className="font-semibold">No Instacart link?</div>
          <p className="text-sm text-muted">Copy the list and add the items in Instacart by hand.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={copy} className="btn btn-quiet h-9 text-sm">
              {copied ? "Copied" : "Copy the list instead"}
            </button>
            <a href="https://www.instacart.com/store" target="_blank" rel="noopener" className="btn btn-quiet h-9 text-sm">
              Open Instacart
            </a>
          </div>
        </div>
      </section>

      {features.skylight ? <SkylightPhrases lines={cart.lines} /> : null}

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">This week&apos;s list</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-2">
          {cart.lines.map((l) => (
            <li key={l.item}>{l.displayText}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
