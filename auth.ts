import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, candidateProfiles, notificationSettings, sessions, users, verificationTokens } from "@/db/schema";
import { defaultProfile } from "@/lib/profile";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(db ? { adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }) } : {}),
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user }) {
      const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
      return Boolean(allowedEmail && user.email?.toLowerCase() === allowedEmail);
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!db || !user.id) return;
      await db.insert(candidateProfiles).values({ userId: user.id, ...defaultProfile, scoreWeights: defaultProfile.scoreWeights }).onConflictDoNothing();
      await db.insert(notificationSettings).values({ userId: user.id }).onConflictDoNothing();
    },
  },
});
