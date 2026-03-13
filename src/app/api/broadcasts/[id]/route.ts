import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const broadcast = await prisma.broadcast.findFirst({
    where: { id, accountId: auth.accountId },
    include: {
      deliveries: {
        include: {
          subscriber: { select: { id: true, name: true, email: true, phone: true } },
          logs: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!broadcast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(broadcast);
}
