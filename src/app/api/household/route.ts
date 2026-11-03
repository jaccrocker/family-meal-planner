import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EMPTY_STATE, PlannerStateSchema } from "@/lib/planner";
import { createHousehold, findHousehold, saveState } from "@/lib/store";

async function who() {
  const session = await auth();
  const sub = session?.user?.id;
  const email = session?.user?.email;
  return sub && email ? { sub, email } : undefined;
}

/** Loads the signed in person's household, creating one on first sign in. */
export async function GET() {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const record = findHousehold(me.sub, me.email) ?? createHousehold(me.sub, me.email, EMPTY_STATE);
  return NextResponse.json(record);
}

/**
 * Saves the signed in person's planner state. Requires sign in (401). The body is the full planner
 * state, checked against the planner schema (400 with the validation message). Returns 404 when the
 * person has no household yet. An optional `x-base-version` header names the version the browser
 * last saw; if the server has moved on, nothing is saved and the reply is 409 with `conflict` and
 * the current household record. Otherwise returns `{ ok, version }` with the new version.
 */
export async function PUT(req: Request) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const record = findHousehold(me.sub, me.email);
  if (!record) return NextResponse.json({ error: "No household" }, { status: 404 });
  const parsed = PlannerStateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  // A tab that loaded an older version gets the newer household back instead of overwriting it.
  const base = req.headers.get("x-base-version") ?? undefined;
  const version = saveState(record.id, parsed.data, base);
  if (!version) return NextResponse.json({ conflict: true, record: findHousehold(me.sub, me.email) }, { status: 409 });
  return NextResponse.json({ ok: true, version });
}
