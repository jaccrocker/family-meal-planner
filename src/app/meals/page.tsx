"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlanner } from "@/components/PlannerProvider";
import { LIBRARY, LIBRARY_BY_ID, LISTED_INGREDIENTS } from "@/lib/engine/library";
import { DAYS, type Day, type Meal, type MealType } from "@/lib/engine/types";
import type { PlannerState } from "@/lib/planner";

const TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner"];

export default function MealsPage() {
  const { state, update, cart } = usePlanner();
  const [day, setDay] = useState<Day>("Mon");
  const [tab, setTab] = useState<MealType>("Dinner");
  const [query, setQuery] = useState("");

  const meals = useMemo(() => {
    const all = new Map<string, Meal>(LIBRARY_BY_ID);
    for (const m of state.customMeals) all.set(m.id, m as Meal);
    return all;
  }, [state.customMeals]);

  const entryAt = (d: Day, t: MealType) => state.plan.find((p) => p.day === d && p.mealType === t);

  const place = (meal: Meal, d: Day = day) =>
    update((s) => ({
      ...s,
      plan: [...s.plan.filter((p) => !(p.day === d && p.mealType === meal.type)), { day: d, mealType: meal.type, mealId: meal.id }],
    }));

  const remove = (d: Day, t: MealType) =>
    update((s) => ({ ...s, plan: s.plan.filter((p) => !(p.day === d && p.mealType === t)) }));

  const counts = TYPES.map(
    (t) => state.plan.filter((p) => p.mealType === t && !meals.get(p.mealId)?.noGroceries).length,
  );
  const leftovers = state.plan.filter((p) => meals.get(p.mealId)?.leftoverOf).length;
  const library = [...LIBRARY, ...(state.customMeals as Meal[])].filter(
    (m) => m.type === tab && m.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const planned = new Set(state.plan.map((p) => p.mealId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Pick this week&apos;s meals</h1>
          <p className="mt-1 text-muted">
            {counts[2]} dinners, {counts[1] - leftovers > 0 ? `${counts[1] - leftovers} lunches, ` : ""}
            {leftovers} leftover {leftovers === 1 ? "lunch" : "lunches"}
            {counts[0] ? `, ${counts[0]} breakfasts` : ""}; {cart.servings.toFixed(2)} servings each
          </p>
        </div>
        <Link href="/review" className="btn btn-primary">
          Review cart ({cart.lines.length})
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-4 sm:p-5">
          <h2 className="font-display text-xl font-semibold">Week plan</h2>
          <p className="text-sm text-muted">Pick a day, then add meals from the library.</p>
          <div className="mt-3 space-y-2">
            {DAYS.map((d) => (
              <div
                key={d}
                onClick={() => setDay(d)}
                className={`cursor-pointer rounded-xl border p-3 ${d === day ? "border-brand bg-brand-soft/50" : "border-line-2"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{d}</span>
                  {d === day ? <span className="text-xs font-semibold text-brand">Adding here</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TYPES.map((t) => {
                    const e = entryAt(d, t);
                    const meal = e ? meals.get(e.mealId) : undefined;
                    if (!meal) return null;
                    return (
                      <span key={t} className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1 text-sm shadow-sm ring-1 ring-line">
                        <span className="text-xs text-muted">{t}</span>
                        {meal.name}
                        {meal.noGroceries ? <span className="text-xs text-muted">no groceries</span> : null}
                        <button
                          aria-label={`Remove ${meal.name}`}
                          className="text-muted hover:text-ink"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            remove(d, t);
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {TYPES.every((t) => !entryAt(d, t)) ? <span className="text-sm text-muted">Not planned</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="font-display text-xl font-semibold">Your meals</h2>
          <div className="mt-3 flex gap-1 rounded-lg bg-line-2 p-1 text-sm">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium ${tab === t ? "bg-surface shadow-sm" : "text-muted"}`}
              >
                {t} {[...LIBRARY, ...(state.customMeals as Meal[])].filter((m) => m.type === t).length}
              </button>
            ))}
          </div>
          <input
            placeholder="Search meals"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-3 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
          />
          <ul className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {library.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-line-2 p-3">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-muted">
                    {m.leftoverOf
                      ? `Adds servings to ${LIBRARY_BY_ID.get(m.leftoverOf)?.name}`
                      : m.noGroceries
                        ? "Nothing to buy"
                        : (LISTED_INGREDIENTS.get(m.id) ?? m.ingredients.map((i) => i.ingredient)).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => place(m)}
                  className={`btn h-8 shrink-0 px-3 text-sm ${planned.has(m.id) ? "btn-quiet" : "btn-primary"}`}
                >
                  {planned.has(m.id) ? "Add again" : `Add to ${day}`}
                </button>
              </li>
            ))}
            {library.length === 0 ? <li className="text-sm text-muted">No meals match.</li> : null}
          </ul>
          <TypedMeal day={day} onAdded={(m) => place(m)} />
        </section>
      </div>
    </div>
  );
}

type ParseResponse =
  | { question: string; options: string[] }
  | { meal: Meal; items: PlannerState["customItems"]; staples: string[] }
  | { error: string };

function TypedMeal({ day, onAdded }: { day: Day; onAdded: (m: Meal) => void }) {
  const { update } = usePlanner();
  const [name, setName] = useState("");
  const [type, setType] = useState<MealType>("Dinner");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(answer?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal: name, type, answer }),
      });
      const data = (await res.json()) as ParseResponse;
      if ("error" in data) setError(data.error);
      else if ("question" in data) setQuestion(data);
      else {
        update((s) => ({
          ...s,
          customMeals: [...s.customMeals.filter((m) => m.id !== data.meal.id), data.meal as PlannerState["customMeals"][number]],
          customItems: [...s.customItems.filter((c) => !data.items.some((i) => i.id === c.id)), ...data.items],
          household: { ...s.household, staples: [...new Set([...s.household.staples, ...data.staples])] },
        }));
        onAdded(data.meal);
        setQuestion(null);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line-2 pt-4">
      <div className="font-semibold">Something else?</div>
      <p className="text-sm text-muted">Type any meal; Muse Spark breaks it into ingredients and the planner does the math.</p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuestion(null);
          submit();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tacos"
          className="h-9 min-w-40 flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MealType)}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button disabled={busy || name.trim().length < 2} className="btn btn-quiet h-9 text-sm">
          {busy ? "Reading…" : `Add to ${day}`}
        </button>
      </form>
      {busy ? <p className="mt-2 text-sm text-muted">Muse Spark is breaking this down, about 20 seconds.</p> : null}
      {question ? (
        <div className="mt-3 rounded-lg bg-brand-soft p-3 text-sm">
          <div className="font-semibold text-brand-dark">{question.question}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {question.options.map((o) => (
              <button key={o} disabled={busy} onClick={() => submit(o)} className="btn btn-quiet h-8 px-3 text-sm">
                {o}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}
    </div>
  );
}
