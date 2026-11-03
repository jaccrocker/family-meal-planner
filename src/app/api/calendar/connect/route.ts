import { randomBytes } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { features } from "@/lib/features";
import { authUrl } from "@/lib/integrations/google-calendar";
import { signedInHousehold } from "@/lib/review/session";

/**
 * Sends the signed in adult to Google to allow calendar access. Returns 404 when the calendar feature
 * is switched off and 401 when nobody is signed in. Otherwise redirects to Google and sets a short
 * lived `fmp_cal_state` cookie (httpOnly, secure, 10 minutes, scoped to `/api/calendar`) that guards
 * the return trip.
 */
export async function GET() {
  await connection();
  if (!features().calendar) return NextResponse.json({ error: "Calendar is switched off" }, { status: 404 });
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("fmp_cal_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/calendar" });
  return res;
}
