import { NextResponse } from "next/server";

/**
 * Liveness check for the homelab container and Cloudflare Access smoke test. Needs no sign in and
 * always returns `{ ok: true }`.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
