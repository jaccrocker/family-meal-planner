import "server-only";
import { auth } from "@/auth";
import { findHousehold } from "@/lib/store";

/** The signed in person and their household, or undefined. */
export async function signedInHousehold() {
  const session = await auth();
  const sub = session?.user?.id;
  const email = session?.user?.email;
  if (!sub || !email) return undefined;
  const record = findHousehold(sub, email);
  return record ? { record, email: email.toLowerCase(), name: session.user?.name ?? email } : undefined;
}
