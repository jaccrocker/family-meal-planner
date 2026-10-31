import { NextResponse } from "next/server";
import { z } from "zod";
import { transport } from "@/lib/review/mailer";
import { currentReview, getReviewers, getSettings, startReview } from "@/lib/review/service";
import { signedInHousehold } from "@/lib/review/session";

/** The household's current review, its settings and who would be asked. */
export async function GET() {
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    me: me.email,
    review: currentReview(me.record.id) ?? null,
    settings: getSettings(me.record.id),
    reviewers: getReviewers(me.record).filter((r) => r.email !== me.email),
    transport: transport(),
  });
}

const Start = z.object({ weekOf: z.string().max(20) });

/** Sends the saved plan to every other household adult for review. */
export async function POST(req: Request) {
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = Start.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Missing week" }, { status: 400 });
  if (me.record.state.plan.length === 0) return NextResponse.json({ error: "Add a meal first" }, { status: 400 });
  const review = await startReview(me.record, { email: me.email, name: me.name }, body.data.weekOf);
  return NextResponse.json({ review });
}
