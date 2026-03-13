import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns accounts the current user belongs to (for account switcher)
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.isSuperAdmin) {
    // Super admins can access all accounts
    const accounts = await prisma.account.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json(accounts);
  }

  const memberships = await prisma.accountMember.findMany({
    where: { userId: auth.userId },
    include: { account: { select: { id: true, name: true, slug: true } } },
    orderBy: { account: { name: "asc" } },
  });

  return NextResponse.json(memberships.map((m) => m.account));
}
