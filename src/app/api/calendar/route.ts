import { connection, NextResponse } from "next/server";
import { features } from "@/lib/features";
import { calendarName, getLink } from "@/lib/integrations/google-calendar";
import { signedInHousehold } from "@/lib/review/session";

/** Whether the family calendar is connected, and which one. */
export async function GET() {
  await connection();
  if (!features().calendar) return NextResponse.json({ error: "Calendar is switched off" }, { status: 404 });
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({
    wanted: calendarName(),
    keyReady: Boolean(process.env.INTEGRATIONS_ENCRYPTION_KEY),
    link: getLink(me.record.id) ?? null,
  });
}
