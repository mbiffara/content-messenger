import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTextMessage } from "@/lib/whatsapp";

function extractPhone(jid: string): string | null {
  if (jid.endsWith("@s.whatsapp.net")) {
    return jid.replace("@s.whatsapp.net", "");
  }
  return null;
}

// Called by Baileys service when a message is received
export async function POST(req: NextRequest) {
  const { from, message, sessionId } = await req.json();

  if (!from || !message) {
    return NextResponse.json({ error: "Missing from or message" }, { status: 400 });
  }

  // Resolve account from sessionId
  const account = await prisma.account.findUnique({
    where: { whatsappSessionId: sessionId || "default" },
  });
  if (!account) {
    return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  }
  const accountId = account.id;

  // Check if greeting/matching is enabled for this account
  const enabledSetting = await prisma.setting.findUnique({
    where: { accountId_key: { accountId, key: "greeting_enabled" } },
  });
  if (enabledSetting?.value === "false") {
    return NextResponse.json({ disabled: true });
  }

  const phone = extractPhone(from);
  const replyTo = from;

  // Check if this JID is already linked to a subscriber in this account
  const byJid = await prisma.subscriber.findUnique({
    where: { accountId_whatsappJid: { accountId, whatsappJid: from } },
  });
  if (byJid) {
    return NextResponse.json({ matched: true, subscriberId: byJid.id });
  }

  // Also check by phone number (for @s.whatsapp.net JIDs)
  if (phone) {
    const byPhone = await prisma.subscriber.findFirst({
      where: { accountId, phone },
    });
    if (byPhone) {
      // Store the JID for future fast matching
      await prisma.subscriber.update({
        where: { id: byPhone.id },
        data: { whatsappJid: from },
      });
      return NextResponse.json({ matched: true, subscriberId: byPhone.id });
    }
  }

  // Check if the message looks like an email
  const text = message.trim().toLowerCase();
  const emailMatch = text.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

  if (emailMatch) {
    const email = emailMatch[0];

    const subscriber = await prisma.subscriber.findUnique({
      where: { accountId_email: { accountId, email } },
    });

    if (subscriber) {
      // Link the JID and phone number
      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          whatsappJid: from,
          phone: phone || subscriber.phone,
        },
      });

      await sendTextMessage(
        replyTo,
        "You're all set! Your WhatsApp number has been linked. You'll start receiving messages from us here.",
        sessionId || account.whatsappSessionId
      );

      return NextResponse.json({ linked: true, subscriberId: subscriber.id });
    } else {
      await sendTextMessage(
        replyTo,
        "We couldn't find that email in our system. Please make sure you're using the same email you subscribed with.",
        sessionId || account.whatsappSessionId
      );

      return NextResponse.json({ notFound: true });
    }
  }

  // Not an email — send the greeting
  const greetingSetting = await prisma.setting.findUnique({
    where: { accountId_key: { accountId, key: "greeting_message" } },
  });
  const greeting = greetingSetting?.value;
  const defaultGreeting =
    "Hey! To receive messages from us on WhatsApp, please reply with the email address you used when subscribing.";

  await sendTextMessage(replyTo, greeting || defaultGreeting, sessionId || account.whatsappSessionId);

  return NextResponse.json({ greeted: true });
}
