import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { addMember, findHousehold, removeMember } from "@/lib/store";

const Body = z.object({ email: z.string().email() });

/** The owner adds or removes other adults by Google email, up to MAX_MEMBERS. */
const MAX_MEMBERS = 10;

async function owner() {
  const session = await auth();
  const sub = session?.user?.id;
  const email = session?.user?.email;
  if (!sub || !email) return undefined;
  const record = findHousehold(sub, email);
  return record?.isOwner ? record : undefined;
}

/**
 * Adds another adult to the household by Google email. Owner only (403 otherwise). The body is
 * `{ email }`; the address is trimmed and lowercased before saving. Returns 400 for an invalid
 * email, the owner's own address, or a new member beyond the limit, and `{ ok: true }` on success.
 */
export async function POST(req: Request) {
  const record = await owner();
  if (!record) return NextResponse.json({ error: "Only the household owner can add members" }, { status: 403 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const email = body.data.email.trim().toLowerCase();
  if (email === record.ownerEmail) return NextResponse.json({ error: "That is your own account" }, { status: 400 });
  if (!record.members.includes(email) && record.members.length >= MAX_MEMBERS)
    return NextResponse.json({ error: `A household can share with up to ${MAX_MEMBERS} other adults` }, { status: 400 });
  addMember(record.id, email);
  return NextResponse.json({ ok: true });
}

/**
 * Removes an adult from the household by email. Owner only (403 otherwise). The body is `{ email }`;
 * returns 400 for an invalid email and `{ ok: true }` otherwise.
 */
export async function DELETE(req: Request) {
  const record = await owner();
  if (!record) return NextResponse.json({ error: "Only the household owner can remove members" }, { status: 403 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  removeMember(record.id, body.data.email);
  return NextResponse.json({ ok: true });
}
