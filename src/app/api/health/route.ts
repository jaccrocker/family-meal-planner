import { NextResponse } from "next/server";

/** Liveness check for the homelab container and Cloudflare Access smoke test. */
export function GET() {
  return NextResponse.json({ ok: true });
}
