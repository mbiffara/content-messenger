import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface User {
    role: string;
    currentAccountId: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      currentAccountId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    currentAccountId: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { memberships: { include: { account: true } } },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Default to the first account the user belongs to
        const firstAccount = user.memberships[0]?.account;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          currentAccountId: firstAccount?.id || "",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.currentAccountId = user.currentAccountId;
      }
      // Handle account switching via session.update()
      if (trigger === "update" && updateData?.currentAccountId) {
        token.currentAccountId = updateData.currentAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.currentAccountId = token.currentAccountId;
      return session;
    },
  },
};

export interface AuthContext {
  userId: string;
  accountId: string;
  role: string;
  isSuperAdmin: boolean;
  canEditStripe: boolean;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id, role, currentAccountId } = session.user;

  return {
    userId: id,
    accountId: currentAccountId,
    role,
    isSuperAdmin: role === "super_admin",
    canEditStripe: role === "super_admin" || role === "account_admin",
  };
}
