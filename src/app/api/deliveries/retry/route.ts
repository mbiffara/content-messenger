import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deliveryIds } = await req.json();
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
    return NextResponse.json({ error: "Missing deliveryIds" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: auth.accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const sessionId = account.whatsappSessionId;

  const deliveries = await prisma.delivery.findMany({
    where: {
      id: { in: deliveryIds },
      accountId: auth.accountId,
      status: "failed",
    },
    include: {
      subscriber: true,
      lesson: true,
      broadcast: true,
    },
  });

  let retried = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const phone = delivery.subscriber.phone;
    if (!phone) {
      failed++;
      continue;
    }

    // Determine content from lesson or broadcast
    const content = delivery.lesson || delivery.broadcast;
    if (!content) {
      failed++;
      continue;
    }

    try {
      let messageId = "";

      // For lessons: send text/image first, then audio separately
      if (delivery.lesson) {
        const lesson = delivery.lesson;
        if (lesson.imageUrl) {
          await sendMediaMessage(phone, "image", lesson.imageUrl, lesson.body || undefined, sessionId);
        } else if (lesson.body) {
          await sendTextMessage(phone, lesson.body, sessionId);
        }
        if (lesson.audioUrl) {
          const result = await sendMediaMessage(phone, "audio", lesson.audioUrl, undefined, sessionId);
          messageId = result.messageId;
        }
      }

      // For broadcasts: send image with caption or text
      if (delivery.broadcast) {
        const bc = delivery.broadcast;
        if (bc.imageUrl) {
          const result = await sendMediaMessage(phone, "image", bc.imageUrl, bc.body || undefined, sessionId);
          messageId = result.messageId;
        } else if (bc.body) {
          const result = await sendTextMessage(phone, bc.body, sessionId);
          messageId = result.messageId;
        }
      }

      // Log the retry attempt on the old delivery, then replace it
      await prisma.deliveryLog.create({
        data: { deliveryId: delivery.id, event: "retried", detail: "Manual retry initiated" },
      });

      // Delete old failed delivery and create new sent one
      await prisma.delivery.delete({ where: { id: delivery.id } });
      const newDelivery = await prisma.delivery.create({
        data: {
          accountId: auth.accountId,
          subscriberId: delivery.subscriberId,
          lessonId: delivery.lessonId,
          broadcastId: delivery.broadcastId,
          status: "sent",
          whatsappMsgId: messageId,
          sentAt: new Date(),
        },
      });

      await prisma.deliveryLog.create({
        data: { deliveryId: newDelivery.id, event: "sent", detail: "Delivered via manual retry" },
      });

      // If it's a lesson, update subscriber position
      if (delivery.lesson) {
        await prisma.subscriber.update({
          where: { id: delivery.subscriberId },
          data: { currentPosition: delivery.lesson.position },
        });
      }

      retried++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[retry] Failed to retry delivery ${delivery.id}:`, err);
      await prisma.deliveryLog.create({
        data: { deliveryId: delivery.id, event: "failed", detail: `Retry failed: ${errorMsg}` },
      }).catch(() => {}); // don't fail if log insert fails
      failed++;
    }
  }

  return NextResponse.json({ retried, failed });
}
