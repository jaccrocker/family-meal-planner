import { NextResponse } from "next/server";
import { z } from "zod";
import { ParseUnavailable, parseMeal, toMeal } from "@/lib/parser";

const Body = z.object({
  meal: z.string().trim().min(2).max(120),
  type: z.enum(["Breakfast", "Lunch", "Dinner"]).default("Dinner"),
  answer: z.string().trim().max(60).optional(),
});

/**
 * Breaks a typed meal into ingredients per serving. Returns either a question
 * when the meal is ambiguous, or a meal the engine can use. Needs no sign in.
 *
 * The body is `{ meal, type?, answer? }`: `meal` is 2 to 120 characters, `type` is Breakfast, Lunch or
 * Dinner (default Dinner), and `answer` (up to 60 characters) replies to an earlier question. Returns
 * 400 for an unusable body, `{ question, options }` when the meal is ambiguous, and the parsed meal
 * otherwise. Failures return 422 when the parser is unavailable and 502 for any other error.
 */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Type a meal name" }, { status: 400 });
  const { meal, type, answer } = body.data;
  try {
    const parsed = await parseMeal(meal, answer);
    if (parsed.question && parsed.ingredients.length === 0) {
      return NextResponse.json({ question: parsed.question, options: parsed.options ?? [] });
    }
    return NextResponse.json(toMeal(parsed, type));
  } catch (e) {
    const status = e instanceof ParseUnavailable ? 422 : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
