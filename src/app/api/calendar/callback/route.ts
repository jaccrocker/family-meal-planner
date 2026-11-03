import { connection, NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/features";
import { connect } from "@/lib/integrations/google-calendar";
import { signedInHousehold } from "@/lib/review/session";

/**
 * Google's return trip after the calendar consent screen. Needs a signed in household and a
 * `code` and `state` query pair, where `state` must match the fmp_cal_state cookie set by
 * /api/calendar/connect. Always answers with a redirect to /approve, adding `calendar=connected`
 * on success or `calendar=failed` when sign in, the code, the state match or the token exchange
 * fails. The state cookie is cleared after the exchange is attempted. Returns 404 JSON when the
 * calendar feature is switched off.
 */
export async function GET(req: NextRequest) {
  await connection();
  if (!features().calendar) return NextResponse.json({ error: "Calendar is switched off" }, { status: 404 });
  const me = await signedInHousehold();
  const url = new URL(req.url);
  const back = new URL("/approve", process.env.APP_URL ?? process.env.AUTH_URL ?? url.origin);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!me || !code || !state || state !== req.cookies.get("fmp_cal_state")?.value) {
    back.searchParams.set("calendar", "failed");
    return NextResponse.redirect(back);
  }
  try {
    await connect(me.record.id, code);
    back.searchParams.set("calendar", "connected");
  } catch (e) {
    console.error(`calendar connect: ${(e as Error).message}`);
    back.searchParams.set("calendar", "failed");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete({ name: "fmp_cal_state", path: "/api/calendar" });
  return res;
}
