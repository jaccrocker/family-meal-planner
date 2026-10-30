import { NextResponse } from "next/server";
import { buildShoppingList, createShoppingList, instacartConfigured, listAsText } from "@/lib/instacart";
import { PlannerStateSchema, cartFor } from "@/lib/planner";

/**
 * Builds the week's Instacart shopping list page on the server, where the API
 * key stays. Without a key it returns the request it would send plus the
 * keyless fallback text. It never checks out.
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
    return NextResponse.json({ mode: "live", url, request, text });
  } catch (e) {
    return NextResponse.json({ mode: "error", error: (e as Error).message, request, text }, { status: 502 });
  }
}
