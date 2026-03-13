const BAILEYS_URL = process.env.BAILEYS_URL || "http://127.0.0.1:3006";

interface SendMessageResult {
  messageId: string;
}

export async function sendTextMessage(
  to: string,
  text: string,
  sessionId = "default"
): Promise<SendMessageResult> {
  const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Baileys error: ${data.error || JSON.stringify(data)}`);
  }
  return { messageId: data.messageId };
}

export async function sendMediaMessage(
  to: string,
  type: "image" | "video" | "audio" | "document",
  mediaUrl: string,
  caption?: string,
  sessionId = "default"
): Promise<SendMessageResult> {
  const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}/send-media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, type, url: mediaUrl, caption }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Baileys error: ${data.error || JSON.stringify(data)}`);
  }
  return { messageId: data.messageId };
}

export async function getSessionStatus(sessionId = "default") {
  const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}/status`);
  if (res.status === 404) return null;
  return res.json();
}

export async function listSessions() {
  const res = await fetch(`${BAILEYS_URL}/sessions`);
  return res.json();
}
