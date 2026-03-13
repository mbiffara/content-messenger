import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscribers = await prisma.subscriber.findMany({
    where: { accountId: auth.accountId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscribers);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, name, phone } = await req.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const existing = await prisma.subscriber.findUnique({
    where: { accountId_email: { accountId: auth.accountId, email } },
  });
  if (existing) return NextResponse.json({ error: "Subscriber with this email already exists" }, { status: 409 });

  const subscriber = await prisma.subscriber.create({
    data: { accountId: auth.accountId, email, name: name || null, phone: phone || null },
  });

  return NextResponse.json(subscriber);
}

export async function DELETE() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete deliveries first to avoid FK constraint
  await prisma.delivery.deleteMany({ where: { accountId: auth.accountId } });
  const { count } = await prisma.subscriber.deleteMany({ where: { accountId: auth.accountId } });

  return NextResponse.json({ deleted: count });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, phone, active } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing subscriber id" }, { status: 400 });
  }

  // Verify subscriber belongs to this account
  const existing = await prisma.subscriber.findFirst({
    where: { id, accountId: auth.accountId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (phone !== undefined) data.phone = phone;
  if (active !== undefined) data.active = active;

  const subscriber = await prisma.subscriber.update({
    where: { id },
    data,
  });

  return NextResponse.json(subscriber);
}
