import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, subscribers: true } },
    },
  });

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug } = await req.json();

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const existing = await prisma.account.findUnique({ where: { slug: slug.trim() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this slug already exists" }, { status: 409 });
  }

  const account = await prisma.account.create({
    data: {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
    },
  });

  return NextResponse.json(account, { status: 201 });
}
