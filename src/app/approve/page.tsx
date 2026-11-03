"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCard } from "@/components/integrations/CalendarCard";
import { usePlanner } from "@/components/PlannerProvider";
import { reviewEmail, type PlanLine } from "@/lib/review/email";
import { mealsFor } from "@/lib/planner";

type Status = "pending" | "approved" | "changes" | "auto_approved";

interface RequestView {
  id: number;
  email: string;
  required: boolean;
  status: Status;
  sends: number;
  lastSentAt: string | null;
  comment: string | null;
  changes: string[];
  proposedPlan: PlanLine[] | null;
}

interface ReviewView {
  id: number;
  weekOf: string;
  status: "open" | "closed";
  createdAt: string;
  reminderMinutes: number;
  reminders: number;
  requests: RequestView[];
  ready: boolean;
}

interface Data {
  me: string;
  review: ReviewView | null;
  settings: { reminderMinutes: number; reminders: number };
  reviewers: { email: string; required: boolean }[];
  transport: "log" | "smtp" | "resend";
}

const LABEL: Record<Status, string> = {
  pending: "Waiting",
  approved: "Approved",
  changes: "Suggested changes",
  auto_approved: "Approved automatically",
};

const TONE: Record<Status, string> = {
  pending: "bg-line-2 text-muted",
  approved: "bg-brand-soft text-brand-dark",
  changes: "bg-warn-soft text-warn",
  auto_approved: "bg-brand-soft text-brand-dark",
};

export default function ApprovePage() {
  const { mode, state, update, weekOf, user, features } = usePlanner();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/review");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    if (mode !== "account") return;
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [mode, load]);

  const plan: PlanLine[] = useMemo(() => {
    const meals = mealsFor(state);
    return state.plan.map((p) => ({ ...p, name: meals.get(p.mealId)?.name ?? p.mealId }));
  }, [state]);

  const preview = useMemo(
    () =>
      reviewEmail({
        creatorName: user?.name ?? "Jordan",
        weekOf,
        plan,
        approveUrl: "#",
        editUrl: "#",
        reminder: 0,
        required: true,
      }),
    [plan, user, weekOf],
  );

  async function saveSettings(next: Pick<Data, "settings" | "reviewers">) {
    if (!data) return;
    setData({ ...data, ...next });
    await fetch("/api/review/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...next.settings, reviewers: next.reviewers }),
    });
  }

  async function send() {
    setBusy(true);
    setError(null);
    // Let the debounced plan save land first, so reviewers see the plan on screen.
    await fetch("/api/household", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekOf }),
    });
    if (!res.ok) setError((await res.json()).error ?? "Could not send");
    await load();
    setBusy(false);
  }

  function takeChanges(r: RequestView) {
    if (!r.proposedPlan) return;
    const proposed = r.proposedPlan;
    update((s) => ({ ...s, plan: proposed.map(({ day, mealType, mealId }) => ({ day, mealType, mealId })) }));
  }

  if (state.plan.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold">No meals planned yet</h1>
        <p className="mt-1 text-muted">Pick a few meals, then send the plan to your household.</p>
        <Link href="/meals" className="btn btn-primary mt-4">
          Pick meals
        </Link>
      </div>
    );
  }

  const review = data?.review?.status === "open" ? data.review : null;
  const reviewers = data?.reviewers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Get the plan approved</h1>
          <p className="mt-1 text-muted">
            Everyone else in the household gets the plan by email, approves it in one click, or suggests changes.
          </p>
        </div>
        <Link href="/review" className={`btn ${review?.ready || mode !== "account" ? "btn-primary" : "btn-quiet"}`}>
          {review && !review.ready ? "Continue without waiting" : "Next: review cart"}
        </Link>
      </div>

      {mode !== "account" ? (
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Sign in to send for approval</h2>
          <p className="mt-1 text-sm text-muted">
            In demo mode nothing is emailed. Below is the email household members get: the week at a glance, an Approve
            button and a Suggest changes button. Reviewers who stay silent get a reminder every hour, twice, and are
            approved automatically an hour after the last one.
          </p>
        </section>
      ) : null}

      {mode === "account" && data ? (
        <section className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Reviewers</h2>
            {data.transport === "log" ? (
              <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">
                Test mode: emails are recorded, not sent
              </span>
            ) : null}
          </div>
          {reviewers.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Add other adults in <Link href="/setup" className="font-semibold text-brand underline">Set up</Link> to ask them
              to approve.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reviewers.map((r) => {
                const req = review?.requests.find((q) => q.email === r.email);
                return (
                  <li key={r.email} className="rounded-xl border border-line-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.email}</span>
                        {req ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[req.status]}`}>
                            {LABEL[req.status]}
                            {req.status === "pending" && req.sends > 1 ? `, ${req.sends - 1} reminder${req.sends > 2 ? "s" : ""} sent` : ""}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-1 rounded-lg bg-line-2 p-1 text-sm">
                        {[true, false].map((required) => (
                          <button
                            key={String(required)}
                            onClick={() =>
                              saveSettings({
                                settings: data.settings,
                                reviewers: reviewers.map((x) => (x.email === r.email ? { ...x, required } : x)),
                              })
                            }
                            className={`rounded-md px-3 py-1 font-medium ${r.required === required ? "bg-surface shadow-sm" : "text-muted"}`}
                          >
                            {required ? "Required" : "Optional"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {req?.status === "changes" ? (
                      <div className="mt-3 rounded-lg bg-warn-soft/60 p-3 text-sm">
                        {req.changes.length ? (
                          <ul className="list-disc pl-5">
                            {req.changes.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        ) : null}
                        {req.comment ? <p className="mt-1">&ldquo;{req.comment}&rdquo;</p> : null}
                        {req.proposedPlan ? (
                          <button onClick={() => takeChanges(req)} className="btn btn-quiet mt-2 h-11 sm:h-8 px-3 text-sm">
                            Use these changes
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            Remind every
            <input
              type="number"
              min={5}
              max={1440}
              value={data.settings.reminderMinutes}
              onChange={(e) =>
                saveSettings({
                  reviewers,
                  settings: { ...data.settings, reminderMinutes: Math.max(5, Math.min(1440, Number(e.target.value) || 60)) },
                })
              }
              className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-ink"
            />
            minutes,
            <input
              type="number"
              min={0}
              max={5}
              value={data.settings.reminders}
              onChange={(e) =>
                saveSettings({
                  reviewers,
                  settings: { ...data.settings, reminders: Math.max(0, Math.min(5, Number(e.target.value) || 0)) },
                })
              }
              className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-ink"
            />
            times, then approve automatically after one more interval.
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button disabled={busy || reviewers.length === 0} onClick={send} className="btn btn-primary">
              {busy ? "Sending…" : review ? "Send the updated plan" : "Send for approval"}
            </button>
            {review ? (
              <span className="text-sm text-muted">
                {review.ready
                  ? "Every required reviewer has approved."
                  : `Sent ${new Date(review.createdAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}.`}
              </span>
            ) : null}
          </div>
          {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}
        </section>
      ) : null}

      {mode === "account" && features.calendar ? <CalendarCard /> : null}

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">The email</h2>
        <p className="text-sm text-muted">Subject: {preview.subject}</p>
        <iframe
          title="Email preview"
          srcDoc={preview.html}
          sandbox=""
          className="mt-3 h-[520px] w-full rounded-xl border border-line-2 bg-white"
        />
      </section>
    </div>
  );
}
