import { handlers } from "@/auth";

/**
 * Auth.js route handlers, mounted at /api/auth/*. GET and POST are passed straight through to
 * the handlers from the app's Auth.js setup, which serve sign in, sign out, callback and session
 * requests. This file adds no logic of its own.
 */
export const { GET, POST } = handlers;
