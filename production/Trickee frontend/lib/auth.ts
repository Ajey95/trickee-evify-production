import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

function backendUrl(path: string) {
  const base = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
  return `${base}${path}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        firebaseIdToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.firebaseIdToken && (!credentials?.email || !credentials.password)) return null;
        const isFirebaseLogin = Boolean(credentials.firebaseIdToken);
        const response = await fetch(backendUrl(isFirebaseLogin ? "/auth/firebase-login" : "/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isFirebaseLogin
              ? { id_token: credentials.firebaseIdToken }
              : {
                  email: credentials.email,
                  password: credentials.password,
                }
          ),
        });
        if (!response.ok) return null;
        const result = await response.json();
        if (result?.success && result?.data?.access_token && result?.data?.user) {
          const user = result.data.user;
          return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.role,
            fleet_id: user.fleet_id,
            driver_id: user.driver_id,
            accessToken: result.data.access_token,
          } as any;
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const backendUser = user as any;
        (token as any).role = backendUser.role;
        (token as any).fleet_id = backendUser.fleet_id;
        (token as any).driver_id = backendUser.driver_id;
        (token as any).accessToken = backendUser.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as any;
        user.role = (token as any).role;
        user.fleet_id = (token as any).fleet_id;
        user.driver_id = (token as any).driver_id;
        (session as any).accessToken = (token as any).accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
