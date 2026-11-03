import { NextResponse } from "next/server";
import { closeReview } from "@/lib/review/service";
import { signedInHousehold } from "@/lib/review/session";

/**
 * Ends the open review, for example after the creator takes a reviewer's changes and wants to send
 * again. Returns 401 when nobody is signed in and `{ ok: true }` otherwise.
 */
export async function POST() {
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  closeReview(me.record.id);
  return NextResponse.json({ ok: true });
}
