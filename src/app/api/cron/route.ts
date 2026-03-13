import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";

function isPastDeliveryTime(deliveryTime: string, timezone: string): boolean {
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
  const currentMinutes = parseInt(currentHour) * 60 + parseInt(currentMinute);

  const [targetH, targetM] = deliveryTime.split(":").map(Number);
  const targetMinutes = targetH * 60 + targetM;

  return currentMinutes >= targetMinutes;
}

function getTodayStart(timezone: string): Date {
  // Get today's date in the account's timezone, then convert to UTC start
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  // Create a date string and parse it in the timezone
  const dateStr = `${year}-${month}-${day}T00:00:00`;
  // Approximate: use the offset to get UTC midnight for this timezone
  const tzDate = new Date(dateStr);
  const utcDate = new Date(tzDate.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzLocal = new Date(tzDate.toLocaleString("en-US", { timeZone: timezone }));
  const offset = utcDate.getTime() - tzLocal.getTime();
  return new Date(tzDate.getTime() + offset);
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

  console.log(`[cron] Processing ${accounts.length} account(s)`);

  for (const account of accounts) {
    const sessionId = account.whatsappSessionId;

    // --- Sequence-based lesson delivery ---
    const deliveryTime = await getAccountSetting(account.id, "lesson_delivery_time");
    const timezone = await getAccountSetting(account.id, "lesson_delivery_timezone") || "UTC";

    // Only send if we're past the configured delivery time for today
    const shouldSendLessons = deliveryTime ? isPastDeliveryTime(deliveryTime, timezone) : false;
    console.log(`[cron] Account "${account.name}" (${account.id}): deliveryTime=${deliveryTime} tz=${timezone} shouldSend=${shouldSendLessons}`);

    const subscribers = await prisma.subscriber.findMany({
      where: { accountId: account.id, active: true, phone: { not: null } },
    });

    if (shouldSendLessons) {
      const todayStart = getTodayStart(timezone);

      for (const sub of subscribers) {
        if (!sub.phone) continue;

        // Check if this subscriber already received a lesson today
        const alreadySentToday = await prisma.delivery.findFirst({
          where: {
            subscriberId: sub.id,
            lessonId: { not: null },
            status: "sent",
            sentAt: { gte: todayStart },
          },
        });
        if (alreadySentToday) continue;

        // Find the next published lesson for this subscriber
        const nextLesson = await prisma.lesson.findFirst({
          where: {
            accountId: account.id,
            status: "published",
            position: { gt: sub.currentPosition },
            deliveries: { none: { subscriberId: sub.id, status: "sent" } },
          },
          orderBy: { position: "asc" },
        });

        if (!nextLesson) continue;

        try {
          // Remove any previous failed delivery for this lesson+subscriber
          await prisma.delivery.deleteMany({
            where: { lessonId: nextLesson.id, subscriberId: sub.id, status: "failed" },
          });

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

          const delivery = await prisma.delivery.create({
            data: {
              accountId: account.id,
              lessonId: nextLesson.id,
              subscriberId: sub.id,
              status: "sent",
              whatsappMsgId: messageId,
              sentAt: new Date(),
            },
          });

          await prisma.deliveryLog.create({
            data: { deliveryId: delivery.id, event: "sent", detail: `Lesson "${nextLesson.title}" delivered via cron` },
          });

          await prisma.subscriber.update({
            where: { id: sub.id },
            data: { currentPosition: nextLesson.position },
          });

          lessonsSent++;
          console.log(`[cron] Sent lesson "${nextLesson.title}" to ${sub.email} (${sub.phone})`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[cron] Failed lesson "${nextLesson.title}" to ${sub.email} (${sub.phone}):`, err);
          const delivery = await prisma.delivery.create({
            data: {
              accountId: account.id,
              lessonId: nextLesson.id,
              subscriberId: sub.id,
              status: "failed",
            },
          });
          await prisma.deliveryLog.create({
            data: { deliveryId: delivery.id, event: "failed", detail: errorMsg },
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

          const delivery = await prisma.delivery.create({
            data: {
              accountId: account.id,
              broadcastId: bc.id,
              subscriberId: sub.id,
              status: "sent",
              whatsappMsgId: messageId,
              sentAt: new Date(),
            },
          });

          await prisma.deliveryLog.create({
            data: { deliveryId: delivery.id, event: "sent", detail: `Broadcast "${bc.title}" delivered via cron` },
          });

          broadcastsSent++;
          console.log(`[cron] Sent broadcast "${bc.title}" to ${sub.email} (${sub.phone})`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[cron] Failed broadcast "${bc.title}" to ${sub.email} (${sub.phone}):`, err);
          const delivery = await prisma.delivery.create({
            data: {
              accountId: account.id,
              broadcastId: bc.id,
              subscriberId: sub.id,
              status: "failed",
            },
          });
          await prisma.deliveryLog.create({
            data: { deliveryId: delivery.id, event: "failed", detail: errorMsg },
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
