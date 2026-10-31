import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/features";
import { applyVoice } from "@/lib/integrations/voice";
import { householdByOwnerEmail, saveState } from "@/lib/store";

/**
 * Called by the household's private Alexa skill. A long random VOICE_API_TOKEN
 * stands in for sign in and maps to the household owned by VOICE_HOUSEHOLD_EMAIL.
 */
function authorized(req: Request): boolean {
  const want = process.env.VOICE_API_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const Slot = z.string().max(80).optional();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), meal: z.string().min(1).max(80), day: Slot, mealType: Slot }),
  z.object({ action: z.literal("move"), fromDay: z.string().max(20), toDay: z.string().max(20), mealType: Slot }),
  z.object({ action: z.literal("remove"), day: z.string().max(20), mealType: Slot }),
  z.object({ action: z.literal("whats"), day: Slot, mealType: Slot }),
]);

export async function POST(req: Request) {
  if (!features().alexa) return NextResponse.json({ error: "Voice is switched off" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ speech: "Sorry, I didn't catch that." }, { status: 400 });
  const email = process.env.VOICE_HOUSEHOLD_EMAIL ?? "";
  // Two tries, in case a browser tab saves between our read and write.
  for (let attempt = 0; attempt < 2; attempt++) {
    const record = householdByOwnerEmail(email);
    if (!record) return NextResponse.json({ speech: "I can't find your household yet." }, { status: 404 });
    const result = applyVoice(record.state, body.data);
    if (!result.changed) return NextResponse.json({ speech: result.speech });
    if (saveState(record.id, result.state, record.version)) {
      console.log(`voice: ${body.data.action}`);
      return NextResponse.json({ speech: result.speech });
    }
  }
  return NextResponse.json({ speech: "The plan just changed. Please try again." }, { status: 409 });
}
