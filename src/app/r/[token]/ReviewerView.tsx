"use client";

import { useEffect, useRef, useState } from "react";
import { DAYS, type Day, type MealType } from "@/lib/engine/types";
import type { PlanLine } from "@/lib/review/email";

type Status = "pending" | "approved" | "changes" | "auto_approved";

interface Data {
  review: { weekOf: string; creatorName: string; plan: PlanLine[]; status: "open" | "closed" };
  request: { email: string; status: Status; comment: string | null; required: boolean };
  options: { id: string; name: string; type: MealType }[];
}

const TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner"];

/**
 * Approve in one click, or edit the week and send suggestions back. The approve
 * link from the email posts from the browser after the page loads, so mail
 * scanners that fetch links do not approve on the reader's behalf.
 */
export function ReviewerView({ token, approveOnOpen }: { token: string; approveOnOpen: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const autoApproved = useRef(false);

  async function load() {
    const res = await fetch(`/api/r/${token}`);
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "This link is not valid.");
    else {
      setData(json);
      setDraft(Object.fromEntries((json as Data).review.plan.map((p) => [`${p.day}|${p.mealType}`, p.mealId])));
    }
    return res.ok ? (json as Data) : null;
  }

  async function answer(body: object) {
    setBusy(true);
    const res = await fetch(`/api/r/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError((await res.json()).error ?? "Something went wrong");
    await load();
    setEditing(false);
    setBusy(false);
  }

  useEffect(() => {
    (async () => {
      const d = await load();
      if (d && approveOnOpen && !autoApproved.current && d.review.status === "open" && d.request.status === "pending") {
        autoApproved.current = true;
        await answer({ kind: "approved" });
      }
    })();
    // Runs once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error && !data) return <Card title="This link does not work">{error}</Card>;
  if (!data) return <Card title="Loading the plan">One moment.</Card>;

  const { review, request } = data;
  const closed = review.status !== "open";
  const done = request.status === "approved" || request.status === "auto_approved";

  const submitChanges = () =>
    answer({
      kind: "changes",
      comment,
      plan: Object.entries(draft)
        .filter(([, id]) => id)
        .map(([k, mealId]) => {
          const [day, mealType] = k.split("|");
          return { day, mealType, mealId };
        }),
    });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Meals for the week of {review.weekOf}</h1>
        <p className="mt-1 text-muted">
          Planned by {review.creatorName}.{" "}
          {request.required ? "Your approval is needed." : "Your review is optional."}
        </p>
      </div>

      {closed ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">A newer plan replaced this one; check your email.</p>
      ) : done ? (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {request.status === "approved" ? "You approved this plan. Thanks." : "This plan was approved automatically."}
        </p>
      ) : request.status === "changes" ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Your suggestions went to {review.creatorName}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}

      <section className="card p-4 sm:p-5">
        <ul className="divide-y divide-line-2">
          {DAYS.map((day: Day) => (
            <li key={day} className="flex flex-wrap items-start gap-3 py-2.5">
              <span className="w-12 font-semibold">{day}</span>
              <div className="flex-1 space-y-1.5">
                {TYPES.map((t) => {
                  const key = `${day}|${t}`;
                  if (editing) {
                    if (t !== "Dinner" && !draft[key]) return null;
                    return (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-xs text-muted">{t}</span>
                        <select
                          value={draft[key] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          className="h-9 flex-1 rounded-lg border border-line bg-surface px-2"
                        >
                          <option value="">Nothing planned</option>
                          {data.options
                            .filter((o) => o.type === t)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          {review.plan
                            .filter((p) => p.mealType === t && !data.options.some((o) => o.id === p.mealId))
                            .map((p) => (
                              <option key={p.mealId} value={p.mealId}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    );
                  }
                  const p = review.plan.find((x) => x.day === day && x.mealType === t);
                  return p ? (
                    <div key={t} className="text-sm">
                      <span className="mr-2 text-xs text-muted">{t}</span>
                      {p.name}
                    </div>
                  ) : null;
                })}
                {!editing && !review.plan.some((p) => p.day === day) ? (
                  <div className="text-sm text-muted">Nothing planned</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {closed ? null : editing ? (
        <section className="card space-y-3 p-4 sm:p-5">
          <label className="block text-sm font-semibold">
            Comments for {review.creatorName}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1 w-full rounded-lg border border-line bg-surface p-2 font-normal"
              placeholder="Anything to add?"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={submitChanges} className="btn btn-primary">
              Send suggestions
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-quiet">
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!done ? (
            <button disabled={busy} onClick={() => answer({ kind: "approved" })} className="btn btn-primary">
              Approve
            </button>
          ) : null}
          <button onClick={() => setEditing(true)} className="btn btn-quiet">
            {done ? "Suggest changes instead" : "Suggest changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-muted">{children}</p>
    </div>
  );
}
