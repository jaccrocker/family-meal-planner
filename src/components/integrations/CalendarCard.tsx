"use client";

import { useCallback, useEffect, useState } from "react";
import { nextMondayISO } from "@/lib/planner";

interface Status {
  wanted: string;
  keyReady: boolean;
  link: { googleEmail: string; calendarId: string | null; calendarName: string | null; lastSyncAt: string | null } | null;
}

interface SyncResult {
  calendarName: string | null;
  plan: { create: string[]; update: string[]; remove: string[] };
  applied: boolean;
}

/** Puts the week's meals on the shared family calendar: preview first, then write on the adult's own click. */
export function CalendarCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weekStart = nextMondayISO();

  const load = useCallback(async () => {
    const res = await fetch("/api/calendar");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function sync(dryRun: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, dryRun }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Calendar did not answer");
    else setPreview(json);
    await load();
    setBusy(false);
  }

  if (!status) return null;
  const name = status.link?.calendarName ?? status.wanted;
  const changes = preview ? preview.plan.create.length + preview.plan.update.length + preview.plan.remove.length : 0;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Put the week on {name}</h2>
      {!status.link ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Connect Google Calendar once. The planner adds an event for each planned meal and only ever changes events it
            made.
          </p>
          {status.keyReady ? (
            <a href="/api/calendar/connect" className="btn btn-quiet mt-3 h-9 text-sm">
              Connect Google Calendar
            </a>
          ) : (
            <p className="mt-2 text-sm text-warn">The server needs its integrations key before it can connect.</p>
          )}
        </>
      ) : !status.link.calendarId ? (
        <p className="mt-1 text-sm text-warn">
          Connected as {status.link.googleEmail}, but no calendar named {status.wanted} that this account can edit.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Connected as {status.link.googleEmail}.
            {status.link.lastSyncAt ? ` Last updated ${new Date(status.link.lastSyncAt).toLocaleString("en-US")}.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => sync(true)} className="btn btn-quiet h-9 text-sm">
              Preview changes
            </button>
            {preview && !preview.applied && changes > 0 ? (
              <button disabled={busy} onClick={() => sync(false)} className="btn btn-primary h-9 text-sm">
                Add to {name}
              </button>
            ) : null}
          </div>
          {preview ? (
            <div className="mt-3 text-sm">
              {changes === 0 ? (
                <p className="text-muted">{name} already matches this week.</p>
              ) : (
                <ul className="list-disc pl-5">
                  {preview.plan.create.map((x) => (
                    <li key={`c${x}`}>Add {x}</li>
                  ))}
                  {preview.plan.update.map((x) => (
                    <li key={`u${x}`}>Change to {x}</li>
                  ))}
                  {preview.plan.remove.map((x) => (
                    <li key={`r${x}`}>Remove {x}</li>
                  ))}
                </ul>
              )}
              {preview.applied ? <p className="mt-2 font-semibold text-brand-dark">Done. {name} is up to date.</p> : null}
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}
    </section>
  );
}
