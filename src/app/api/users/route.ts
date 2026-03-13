import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      memberships: {
        include: { account: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, name, password, role, accountIds } = await req.json();

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const validRoles = ["super_admin", "account_admin", "admin"];
  const userRole = validRoles.includes(role) ? role : "admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email.trim(),
      name: name?.trim() || null,
      passwordHash,
      role: userRole,
    },
  });

  // Link to accounts
  if (accountIds && Array.isArray(accountIds)) {
    for (const accountId of accountIds) {
      await prisma.accountMember.create({
        data: { userId: user.id, accountId },
      });
    }
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
