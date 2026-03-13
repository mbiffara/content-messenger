import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from "baileys";
import path from "path";
import fs from "fs";

const AUDIO_MIMETYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg; codecs=opus",
  ".opus": "audio/ogg; codecs=opus",
  ".wav": "audio/wav",
};

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3005/api/whatsapp/webhook";

export interface SessionInfo {
  status: "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;
  phoneNumber: string | null;
}

interface ManagedSession extends SessionInfo {
  socket: WASocket | null;
}

export class SessionManager {
  private sessions = new Map<string, ManagedSession>();

  listSessions(): Array<{ id: string } & SessionInfo> {
    const result: Array<{ id: string } & SessionInfo> = [];
    this.sessions.forEach((s, id) => {
      result.push({
        id,
        status: s.status,
        qr: s.qr,
        phoneNumber: s.phoneNumber,
      });
    });

    // Also list auth dirs that exist on disk but aren't active
    if (fs.existsSync(AUTH_DIR)) {
      for (const dir of fs.readdirSync(AUTH_DIR)) {
        if (!this.sessions.has(dir)) {
          result.push({
            id: dir,
            status: "disconnected",
            qr: null,
            phoneNumber: null,
          });
        }
      }
    }

    return result;
  }

  getSession(id: string): SessionInfo | null {
    const s = this.sessions.get(id);
    if (!s) {
      // Check if auth state exists on disk
      const authPath = path.join(AUTH_DIR, id);
      if (fs.existsSync(authPath)) {
        return { status: "disconnected", qr: null, phoneNumber: null };
      }
      return null;
    }
    return { status: s.status, qr: s.qr, phoneNumber: s.phoneNumber };
  }

  async connectSession(id: string): Promise<SessionInfo> {
    const existing = this.sessions.get(id);
    if (existing?.status === "connected") {
      return { status: existing.status, qr: null, phoneNumber: existing.phoneNumber };
    }

    // If already connecting, return current state (may have QR)
    if (existing?.status === "connecting" || existing?.status === "qr") {
      return { status: existing.status, qr: existing.qr, phoneNumber: null };
    }

    return this.createSocket(id);
  }

  async disconnectSession(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) {
      const authPath = path.join(AUTH_DIR, id);
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true });
        return true;
      }
      return false;
    }

    session.socket?.end(undefined);
    this.sessions.delete(id);

    // Remove auth state so reconnecting requires a fresh QR scan
    const authPath = path.join(AUTH_DIR, id);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true });
    }

    return true;
  }

  async sendMessage(id: string, to: string, text: string) {
    const session = this.sessions.get(id);
    if (!session?.socket || session.status !== "connected") {
      throw new Error(`Session '${id}' is not connected`);
    }

    const jid = this.toJid(to);
    const result = await session.socket.sendMessage(jid, { text });
    return { messageId: result?.key.id, to: jid };
  }

  async sendMedia(
    id: string,
    to: string,
    type: "image" | "video" | "audio" | "document",
    url: string,
    caption?: string
  ) {
    const session = this.sessions.get(id);
    if (!session?.socket || session.status !== "connected") {
      throw new Error(`Session '${id}' is not connected`);
    }

    const jid = this.toJid(to);

    let result;
    if (type === "image") {
      result = await session.socket.sendMessage(jid, { image: { url }, caption });
    } else if (type === "video") {
      result = await session.socket.sendMessage(jid, { video: { url }, caption });
    } else if (type === "audio") {
      const ext = path.extname(url).toLowerCase();
      const mimetype = AUDIO_MIMETYPES[ext] || "audio/mpeg";
      const fileName = caption || `audio${ext}`;
      result = await session.socket.sendMessage(jid, { document: { url }, mimetype, fileName });
    } else {
      result = await session.socket.sendMessage(jid, { document: { url }, mimetype: "application/octet-stream", fileName: caption || "file" });
    }
    return { messageId: result?.key.id, to: jid };
  }

  private toJid(phone: string): string {
    // If already a JID, return as-is
    if (phone.includes("@")) return phone;
    // Strip everything except digits
    const digits = phone.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
  }

  private async createSocket(id: string): Promise<SessionInfo> {
    const authPath = path.join(AUTH_DIR, id);
    fs.mkdirSync(authPath, { recursive: true });

    // eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const managed: ManagedSession = {
      status: "connecting",
      qr: null,
      phoneNumber: null,
      socket: null,
    };
    this.sessions.set(id, managed);

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
    });

    managed.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        managed.status = "qr";
        managed.qr = qr;
        console.log(`[${id}] QR code generated — scan with WhatsApp`);
      }

      if (connection === "open") {
        managed.status = "connected";
        managed.qr = null;
        managed.phoneNumber = socket.user?.id?.split(":")[0] || null;
        console.log(`[${id}] Connected as ${managed.phoneNumber}`);
      }

      if (connection === "close") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[${id}] Disconnected (code: ${statusCode})`);

        if (shouldReconnect) {
          console.log(`[${id}] Reconnecting...`);
          this.createSocket(id);
        } else {
          managed.status = "disconnected";
          managed.qr = null;
          managed.socket = null;
          this.sessions.delete(id);
          console.log(`[${id}] Logged out — auth cleared`);
        }
      }
    });

    // Forward incoming messages to the webhook
    socket.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
      console.log(`[${id}] messages.upsert type=${type}, count=${msgs.length}`);

      for (const msg of msgs) {
        console.log(`[${id}] msg: fromMe=${msg.key.fromMe} remoteJid=${msg.key.remoteJid} participant=${msg.key.participant} type=${type} msgType=${Object.keys(msg.message || {}).join(",")}`);

        if (type !== "notify") continue;
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        // Skip groups and broadcasts, accept @s.whatsapp.net and @lid
        if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        if (!text) {
          console.log(`[${id}] Skipping message with no text from ${msg.key.remoteJid}`);
          continue;
        }

        console.log(`[${id}] Incoming from ${jid}: ${text}`);

        try {
          await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from: jid,
              message: text,
              sessionId: id,
            }),
          });
        } catch (err) {
          console.error(`[${id}] Webhook call failed:`, err);
        }
      }
    });

    // Wait briefly for QR or connection
    await new Promise((r) => setTimeout(r, 2000));

    return {
      status: managed.status,
      qr: managed.qr,
      phoneNumber: managed.phoneNumber,
    };
  }
}
