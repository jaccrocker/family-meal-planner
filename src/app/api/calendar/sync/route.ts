import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/features";
import { syncWeek } from "@/lib/integrations/google-calendar";
import { planLines } from "@/lib/review/service";
import { signedInHousehold } from "@/lib/review/session";

const Body = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dryRun: z.boolean() });

/**
 * Previews (dryRun) or writes the saved week's meals to the family calendar. Returns 404 when the
 * calendar feature is switched off and 401 when nobody is signed in. The body is
 * `{ weekStart: "YYYY-MM-DD", dryRun: boolean }`; anything else is a 400. Returns the sync result on
 * success, or 502 with the error message when building the plan or writing to the calendar fails.
 */
export async function POST(req: Request) {
  if (!features().calendar) return NextResponse.json({ error: "Calendar is switched off" }, { status: 404 });
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const slots = planLines(me.record.state);
    return NextResponse.json(await syncWeek(me.record.id, body.data.weekStart, slots, body.data.dryRun));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
