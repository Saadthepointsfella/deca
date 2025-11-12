import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Email",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(creds) {
        try {
          const res = await fetch(`${BACKEND}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: creds?.email }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.user.id,
            org_id: data.user.org_id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            token: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.org_id = (user as any).org_id;
        token.role = (user as any).role;
        token.backendToken = (user as any).token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).org_id = token.org_id;
      (session as any).role = token.role;
      (session as any).backendToken = token.backendToken;
      return session;
    },
  },
};
