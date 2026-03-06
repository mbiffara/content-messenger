const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

interface SendMessageResult {
  messageId: string;
}

export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendMessageResult> {
  const res = await fetch(
    `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
  }
  return { messageId: data.messages[0].id };
}

export async function sendMediaMessage(
  to: string,
  type: "image" | "video" | "audio",
  mediaUrl: string,
  caption?: string
): Promise<SendMessageResult> {
  const mediaPayload: Record<string, unknown> = { link: mediaUrl };
  if (caption && type === "image") {
    mediaPayload.caption = caption;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type,
        [type]: mediaPayload,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
  }
  return { messageId: data.messages[0].id };
}
