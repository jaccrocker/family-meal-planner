import { NextResponse } from "next/server";
import { disconnect } from "@/lib/integrations/google-calendar";
import { signedInHousehold } from "@/lib/review/session";

/**
 * Forgets the stored calendar access for this household. Events already written stay on the calendar.
 * Returns 401 when nobody is signed in and `{ ok: true }` otherwise. Unlike the other calendar routes,
 * it does not check whether the calendar feature is on.
 */
export async function POST() {
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  disconnect(me.record.id);
  return NextResponse.json({ ok: true });
}
