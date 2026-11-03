import { NextResponse } from "next/server";
import { z } from "zod";
import { householdPeople, saveSettings, setReviewerRequired } from "@/lib/review/service";
import { signedInHousehold } from "@/lib/review/session";

const Body = z.object({
  reminderMinutes: z.number().int().min(5).max(24 * 60),
  reminders: z.number().int().min(0).max(5),
  reviewers: z.array(z.object({ email: z.string().email(), required: z.boolean() })).max(11),
});

/**
 * Saves the reminder timing and which reviewers are required or optional. Returns 401 when nobody is
 * signed in. The body is `{ reminderMinutes, reminders, reviewers }`: 5 to 1440 minutes, 0 to 5
 * reminders, and up to 11 `{ email, required }` entries. An invalid body is a 400 with the validation
 * message. Reviewer emails that are not in the household are ignored. Returns `{ ok: true }`.
 */
export async function PUT(req: Request) {
  const me = await signedInHousehold();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.message }, { status: 400 });
  const people = new Set(householdPeople(me.record));
  saveSettings(me.record.id, { reminderMinutes: body.data.reminderMinutes, reminders: body.data.reminders });
  for (const r of body.data.reviewers)
    if (people.has(r.email.toLowerCase())) setReviewerRequired(me.record.id, r.email, r.required);
  return NextResponse.json({ ok: true });
}
