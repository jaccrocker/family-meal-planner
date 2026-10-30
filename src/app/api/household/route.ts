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

export async function PUT(req: Request) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const record = findHousehold(me.sub, me.email);
  if (!record) return NextResponse.json({ error: "No household" }, { status: 404 });
  const parsed = PlannerStateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  saveState(record.id, parsed.data);
  return NextResponse.json({ ok: true });
}
