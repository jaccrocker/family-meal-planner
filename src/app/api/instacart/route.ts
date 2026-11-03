import { NextResponse } from "next/server";
import { buildShoppingList, createShoppingList, instacartConfigured, listAsText } from "@/lib/instacart";
import { PlannerStateSchema, cartFor } from "@/lib/planner";

/**
 * Builds the week's Instacart shopping list page on the server, where the API
 * key stays. Without a key it returns the request it would send plus the
 * keyless fallback text. It never checks out. Needs no sign in.
 *
 * The body is `{ state, weekOf?, demo? }`, where `state` is the planner state. Returns 400 when the
 * state fails the planner schema (with the validation message) or the cart is empty. With `demo` set,
 * or no API key configured, returns `{ mode: "demo", request, text }`. Otherwise creates the list
 * and returns `{ mode: "live", url, request, text }`, or 502 with `{ mode: "error", error, request,
 * text }` when Instacart fails.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = PlannerStateSchema.safeParse(body.state);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const cart = cartFor(parsed.data);
  if (cart.lines.length === 0) return NextResponse.json({ error: "The cart is empty" }, { status: 400 });

  const title = `Family Meal Planner, week of ${String(body.weekOf ?? "").slice(0, 20)}`.trim();
  const origin = new URL(req.url).origin;
  const request = buildShoppingList(cart.lines, { title, linkback: `${origin}/review` });
  const text = listAsText(cart.lines, title);

  if (body.demo || !instacartConfigured()) {
    return NextResponse.json({ mode: "demo", request, text });
  }
  try {
    const url = await createShoppingList(request);
    console.log(`instacart: list created, ${cart.lines.length} lines`);
    return NextResponse.json({ mode: "live", url, request, text });
  } catch (e) {
    console.error(`instacart: ${(e as Error).message}`);
    return NextResponse.json({ mode: "error", error: (e as Error).message, request, text }, { status: 502 });
  }
}
