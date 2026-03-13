import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";

function isLessonDeliveryTime(deliveryTime: string, timezone: string): boolean {
  // deliveryTime is "HH:MM", timezone is IANA like "America/Argentina/Buenos_Aires"
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const currentHour = parts.find((p) => p.type === "hour")?.value || "00";
  const currentMinute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentTime = `${currentHour}:${currentMinute}`;

  return currentTime === deliveryTime;
}

async function getAccountSetting(accountId: string, key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({
    where: { accountId_key: { accountId, key } },
  });
  return s?.value ?? null;
}

// CRON endpoint: call every minute to deliver next lessons + scheduled broadcasts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lessonsSent = 0;
  let broadcastsSent = 0;
  let failures = 0;

  // Iterate all accounts
  const accounts = await prisma.account.findMany();

  for (const account of accounts) {
    const sessionId = account.whatsappSessionId;

    // --- Sequence-based lesson delivery ---
    const deliveryTime = await getAccountSetting(account.id, "lesson_delivery_time");
    const timezone = await getAccountSetting(account.id, "lesson_delivery_timezone") || "UTC";
    const shouldSendLessons = deliveryTime ? isLessonDeliveryTime(deliveryTime, timezone) : false;

    const subscribers = await prisma.subscriber.findMany({
      where: { accountId: account.id, active: true, phone: { not: null } },
    });

    if (shouldSendLessons) {
      for (const sub of subscribers) {
        if (!sub.phone) continue;

        // Find the next published lesson for this subscriber
        const nextLesson = await prisma.lesson.findFirst({
          where: {
            accountId: account.id,
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
              await sendMediaMessage(sub.phone, "image", nextLesson.imageUrl, nextLesson.body || undefined, sessionId);
            } else if (nextLesson.body) {
              await sendTextMessage(sub.phone, nextLesson.body, sessionId);
            }
          }

          // Send audio separately
          let messageId = "";
          if (nextLesson.audioUrl) {
            const result = await sendMediaMessage(sub.phone, "audio", nextLesson.audioUrl, undefined, sessionId);
            messageId = result.messageId;
          }

          await prisma.delivery.create({
            data: {
              accountId: account.id,
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
              accountId: account.id,
              lessonId: nextLesson.id,
              subscriberId: sub.id,
              status: "failed",
            },
          });
          failures++;
        }
      }
    }

    // --- Scheduled broadcast delivery ---
    const now = new Date();
    const dueBroadcasts = await prisma.broadcast.findMany({
      where: {
        accountId: account.id,
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
            const result = await sendMediaMessage(sub.phone, "image", bc.imageUrl, bc.body || undefined, sessionId);
            messageId = result.messageId;
          } else if (bc.body) {
            const result = await sendTextMessage(sub.phone, bc.body, sessionId);
            messageId = result.messageId;
          }

          await prisma.delivery.create({
            data: {
              accountId: account.id,
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
              accountId: account.id,
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
  }

  return NextResponse.json({
    lessonsSent,
    broadcastsSent,
    failures,
  });
}
