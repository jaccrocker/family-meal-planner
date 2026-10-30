import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { addMember, findHousehold, removeMember } from "@/lib/store";

const Body = z.object({ email: z.string().email() });

/** The owner adds or removes a second adult by Google email. */
async function owner() {
  const session = await auth();
  const sub = session?.user?.id;
  const email = session?.user?.email;
  if (!sub || !email) return undefined;
  const record = findHousehold(sub, email);
  return record?.isOwner ? record : undefined;
}

export async function POST(req: Request) {
  const record = await owner();
  if (!record) return NextResponse.json({ error: "Only the household owner can add members" }, { status: 403 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  addMember(record.id, body.data.email);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const record = await owner();
  if (!record) return NextResponse.json({ error: "Only the household owner can remove members" }, { status: 403 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  removeMember(record.id, body.data.email);
  return NextResponse.json({ ok: true });
}
