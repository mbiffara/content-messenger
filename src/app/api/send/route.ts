import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp";
import path from "path";

function resolveMediaPath(url: string): string {
  // If it's a relative URL like /uploads/xxx.jpg, resolve to absolute file path
  if (url.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", url);
  }
  return url;
}

function getMediaType(url: string): "image" | "audio" | "video" | "document" {
  const ext = path.extname(url).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp3", ".ogg", ".m4a", ".wav", ".aac", ".opus"].includes(ext)) return "audio";
  if ([".mp4", ".mov", ".avi", ".webm"].includes(ext)) return "video";
  return "document";
}

// Manually send a broadcast to all active subscribers
export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { broadcastId } = await req.json();

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, accountId: auth.accountId },
  });
  if (!broadcast) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });

  // Get the account's whatsapp session ID
  const account = await prisma.account.findUnique({ where: { id: auth.accountId } });
  const sessionId = account?.whatsappSessionId || "default";

  const subscribers = await prisma.subscriber.findMany({
    where: { accountId: auth.accountId, active: true, phone: { not: null } },
  });

  const results = { sent: 0, failed: 0 };

  for (const sub of subscribers) {
    if (!sub.phone) continue;

    try {
      let messageId = "";

      if (broadcast.imageUrl) {
        const filePath = resolveMediaPath(broadcast.imageUrl);
        const mediaType = getMediaType(broadcast.imageUrl);
        const result = await sendMediaMessage(
          sub.phone,
          mediaType,
          filePath,
          broadcast.body || undefined,
          sessionId
        );
        messageId = result.messageId;
      } else if (broadcast.audioUrl) {
        const filePath = resolveMediaPath(broadcast.audioUrl);
        const fileName = broadcast.audioFileName || path.basename(broadcast.audioUrl);
        const result = await sendMediaMessage(sub.phone, "audio", filePath, fileName, sessionId);
        messageId = result.messageId;

        // If there's also a text body, send it as a separate message
        if (broadcast.body) {
          await sendTextMessage(sub.phone, broadcast.body, sessionId);
        }
      } else if (broadcast.body) {
        const result = await sendTextMessage(sub.phone, broadcast.body, sessionId);
        messageId = result.messageId;
      }

      await prisma.delivery.create({
        data: {
          accountId: auth.accountId,
          broadcastId: broadcast.id,
          subscriberId: sub.id,
          status: "sent",
          whatsappMsgId: messageId,
          sentAt: new Date(),
        },
      });

      results.sent++;
    } catch (err) {
      console.error(`[send] Failed to deliver broadcast ${broadcast.id} to ${sub.phone}:`, err);
      await prisma.delivery.create({
        data: {
          accountId: auth.accountId,
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
