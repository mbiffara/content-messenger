import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";

// Manually send a broadcast to all active subscribers
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { broadcastId } = await req.json();

  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });

  const subscribers = await prisma.subscriber.findMany({
    where: { active: true, phone: { not: null } },
  });

  const results = { sent: 0, failed: 0 };

  for (const sub of subscribers) {
    if (!sub.phone) continue;

    try {
      let messageId = "";

      if (broadcast.imageUrl) {
        const result = await sendMediaMessage(sub.phone, "image", broadcast.imageUrl, broadcast.body || undefined);
        messageId = result.messageId;
      } else if (broadcast.body) {
        const result = await sendTextMessage(sub.phone, broadcast.body);
        messageId = result.messageId;
      }

      await prisma.delivery.create({
        data: {
          broadcastId: broadcast.id,
          subscriberId: sub.id,
          status: "sent",
          whatsappMsgId: messageId,
          sentAt: new Date(),
        },
      });

      results.sent++;
    } catch {
      await prisma.delivery.create({
        data: {
          broadcastId: broadcast.id,
          subscriberId: sub.id,
          status: "failed",
        },
      });
      results.failed++;
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "sent", sentAt: new Date() },
  });

  return NextResponse.json(results);
}
