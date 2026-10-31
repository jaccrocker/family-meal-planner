"use client";

import { useMemo, useState } from "react";
import type { CartLine } from "@/lib/engine/types";
import { skylightPhrases } from "@/lib/integrations/skylight";

/** Read these to an Echo to put the list on the Skylight grocery list through Skylight's own Alexa skill. */
export function SkylightPhrases({ lines }: { lines: CartLine[] }) {
  const phrases = useMemo(() => skylightPhrases(lines), [lines]);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Add to Skylight by voice</h2>
        <button onClick={() => copy("all", phrases.map((p) => p.phrase).join("\n"))} className="btn btn-quiet h-8 px-3 text-sm">
          {copied === "all" ? "Copied" : "Copy all"}
        </button>
      </div>
      <p className="text-sm text-muted">
        Say each line to an Echo with the Skylight skill linked, and the item lands on your Skylight grocery list.
      </p>
      <ul className="mt-3 divide-y divide-line-2 text-sm">
        {phrases.map((p) => (
          <li key={p.item} className="flex items-center justify-between gap-3 py-2">
            <span>&ldquo;{p.phrase}&rdquo;</span>
            <button onClick={() => copy(p.item, p.phrase)} className="shrink-0 text-xs font-semibold text-brand">
              {copied === p.item ? "Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
