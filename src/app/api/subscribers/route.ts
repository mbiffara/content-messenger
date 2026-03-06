import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscribers);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, phone, active } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing subscriber id" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (phone !== undefined) data.phone = phone;
  if (active !== undefined) data.active = active;

  const subscriber = await prisma.subscriber.update({
    where: { id },
    data,
  });

  return NextResponse.json(subscriber);
}
