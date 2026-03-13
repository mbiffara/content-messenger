import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      _count: { select: { subscribers: true, lessons: true, broadcasts: true } },
    },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, slug } = await req.json();

  const data: Record<string, string> = {};
  if (name !== undefined) data.name = name.trim();
  if (slug !== undefined) data.slug = slug.trim().toLowerCase();

  const account = await prisma.account.update({ where: { id }, data });
  return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Clean up all account data
  await prisma.delivery.deleteMany({ where: { accountId: id } });
  await prisma.subscriber.deleteMany({ where: { accountId: id } });
  await prisma.lesson.deleteMany({ where: { accountId: id } });
  await prisma.broadcast.deleteMany({ where: { accountId: id } });
  await prisma.setting.deleteMany({ where: { accountId: id } });
  await prisma.accountMember.deleteMany({ where: { accountId: id } });
  await prisma.account.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
