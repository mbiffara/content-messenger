import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const broadcasts = await prisma.broadcast.findMany({
    where: { accountId: auth.accountId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });

  return NextResponse.json(broadcasts);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, body, imageUrl, audioUrl, audioFileName, status, scheduledAt } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      accountId: auth.accountId,
      title: title.trim(),
      body: body || null,
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      audioFileName: audioFileName || null,
      status: status || "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  return NextResponse.json(broadcast, { status: 201 });
}
