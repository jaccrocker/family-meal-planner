import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** True when the Google OAuth client is set up; demo mode works without it. */
export const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Google sign in asks only for openid, email and profile (the provider's default
// scopes). No Gmail, Calendar or Drive access, which also keeps the app outside
// Google's verification and test user limits.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured ? [Google] : [],
  secret: process.env.AUTH_SECRET ?? (googleConfigured ? undefined : "demo-mode-without-google"),
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
