import { NextResponse } from "next/server";
import { auth, googleConfigured } from "@/auth";
import { features } from "@/lib/features";

/** Who is signed in, whether Google sign in is set up, and which integrations are switched on. */
export async function GET() {
  const session = await auth();
  const user = session?.user?.email
    ? { name: session.user.name ?? session.user.email, email: session.user.email, image: session.user.image ?? null }
    : null;
  return NextResponse.json({ user, googleConfigured, features: features() });
}
