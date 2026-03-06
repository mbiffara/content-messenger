import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";

// CRON endpoint: call daily to deliver next lessons + scheduled broadcasts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lessonsSent = 0;
  let broadcastsSent = 0;
  let failures = 0;

  // --- Sequence-based lesson delivery ---
  const subscribers = await prisma.subscriber.findMany({
    where: { active: true, phone: { not: null } },
  });

  for (const sub of subscribers) {
    if (!sub.phone) continue;

    // Find the next published lesson for this subscriber
    const nextLesson = await prisma.lesson.findFirst({
      where: {
        status: "published",
        position: { gt: sub.currentPosition },
        deliveries: { none: { subscriberId: sub.id } },
      },
      orderBy: { position: "asc" },
    });

    if (!nextLesson) continue;

    try {
      // Send text/image first if present
      if (nextLesson.body || nextLesson.imageUrl) {
        if (nextLesson.imageUrl) {
          await sendMediaMessage(sub.phone, "image", nextLesson.imageUrl, nextLesson.body || undefined);
        } else if (nextLesson.body) {
          await sendTextMessage(sub.phone, nextLesson.body);
        }
      }

      // Send audio separately
      let messageId = "";
      if (nextLesson.audioUrl) {
        const result = await sendMediaMessage(sub.phone, "audio", nextLesson.audioUrl);
        messageId = result.messageId;
      }

      await prisma.delivery.create({
        data: {
          lessonId: nextLesson.id,
          subscriberId: sub.id,
          status: "sent",
          whatsappMsgId: messageId,
          sentAt: new Date(),
        },
      });

      await prisma.subscriber.update({
        where: { id: sub.id },
        data: { currentPosition: nextLesson.position },
      });

      lessonsSent++;
    } catch {
      await prisma.delivery.create({
        data: {
          lessonId: nextLesson.id,
          subscriberId: sub.id,
          status: "failed",
        },
      });
      failures++;
    }
  }

  // --- Scheduled broadcast delivery ---
  const now = new Date();
  const dueBroadcasts = await prisma.broadcast.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
  });

  for (const bc of dueBroadcasts) {
    for (const sub of subscribers) {
      if (!sub.phone) continue;

      try {
        let messageId = "";

        if (bc.imageUrl) {
          const result = await sendMediaMessage(sub.phone, "image", bc.imageUrl, bc.body || undefined);
          messageId = result.messageId;
        } else if (bc.body) {
          const result = await sendTextMessage(sub.phone, bc.body);
          messageId = result.messageId;
        }

        await prisma.delivery.create({
          data: {
            broadcastId: bc.id,
            subscriberId: sub.id,
            status: "sent",
            whatsappMsgId: messageId,
            sentAt: new Date(),
          },
        });

        broadcastsSent++;
      } catch {
        await prisma.delivery.create({
          data: {
            broadcastId: bc.id,
            subscriberId: sub.id,
            status: "failed",
          },
        });
        failures++;
      }
    }

    await prisma.broadcast.update({
      where: { id: bc.id },
      data: { status: "sent", sentAt: now },
    });
  }

  return NextResponse.json({
    lessonsSent,
    broadcastsSent,
    failures,
  });
}
