import { NextResponse } from "next/server";
import { z } from "zod";
import { DAYS } from "@/lib/engine/types";
import { mealsFor } from "@/lib/planner";
import type { PlanLine } from "@/lib/review/email";
import { lookupToken, respond } from "@/lib/review/service";
import { householdState } from "@/lib/store";

/**
 * The household's meals a reviewer may swap in: leftovers left out, sorted by name. Returns an empty
 * list when the household has no saved state. The token in a reviewer's link is the only credential:
 * it is random, stored hashed, and stops working once a newer plan goes out.
 */
function options(householdId: number) {
  const state = householdState(householdId);
  if (!state) return [];
  return [...mealsFor(state).values()]
    .filter((m) => !m.leftoverOf)
    .map((m) => ({ id: m.id, name: m.name, type: m.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Shows a reviewer the plan they were asked to review. No sign in: the token in the path is the
 * credential. Returns 404 for an unknown token. Otherwise returns the review (week, creator, plan,
 * status), this reviewer's request (email, status, comment, required) and the household's meals
 * available as swaps, sorted by name and leaving out leftovers.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const found = lookupToken(token);
  if (!found) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  return NextResponse.json({
    review: { weekOf: found.review.weekOf, creatorName: found.review.creatorName, plan: found.review.plan, status: found.review.status },
    request: { email: found.request.email, status: found.request.status, comment: found.request.comment, required: found.request.required },
    options: options(found.householdId),
  });
}

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approved") }),
  z.object({
    kind: z.literal("changes"),
    comment: z.string().max(1000),
    plan: z
      .array(z.object({ day: z.enum(DAYS), mealType: z.enum(["Breakfast", "Lunch", "Dinner"]), mealId: z.string().max(80) }))
      .max(21),
  }),
]);

/**
 * Records a reviewer's answer. No sign in: the token in the path is the credential. The body is
 * either `{ kind: "approved" }` or `{ kind: "changes", comment, plan }` with up to 21 plan lines.
 * Meal names are taken from the household's own meals, and plan lines with an unknown meal id are
 * dropped. Returns 404 for an unknown token, 400 for an unreadable body, 409 when the answer is
 * refused (for example the plan was replaced by a newer one), and `{ ok, status }` on success.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const found = lookupToken(token);
  if (!found) return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Could not read that answer" }, { status: 400 });
  let result;
  if (body.data.kind === "approved") result = await respond(token, { kind: "approved" });
  else {
    // Names come from the household's own meals, never from the browser.
    const names = new Map(options(found.householdId).map((o) => [o.id, o.name]));
    for (const p of found.review.plan) names.set(p.mealId, p.name);
    const plan: PlanLine[] = body.data.plan
      .filter((p) => names.has(p.mealId))
      .map((p) => ({ ...p, name: names.get(p.mealId)! }));
    result = await respond(token, { kind: "changes", plan, comment: body.data.comment });
  }
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json({ ok: true, status: result.request.status });
}
