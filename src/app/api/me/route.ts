import { NextResponse } from "next/server";
import { auth, googleConfigured } from "@/auth";

/** Who is signed in, and whether Google sign in is set up on this server. */
export async function GET() {
  const session = await auth();
  const user = session?.user?.email
    ? { name: session.user.name ?? session.user.email, email: session.user.email, image: session.user.image ?? null }
    : null;
  return NextResponse.json({ user, googleConfigured });
}
