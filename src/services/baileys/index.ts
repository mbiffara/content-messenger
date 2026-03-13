import { config } from "dotenv";
config();

import express from "express";
import cron from "node-cron";
import { SessionManager } from "./session-manager";

const app = express();
app.use(express.json());

const PORT = Number(process.env.BAILEYS_PORT) || 3006;
const manager = new SessionManager();

// List all sessions
app.get("/sessions", (_req, res) => {
  res.json(manager.listSessions());
});

// Get session status
app.get("/sessions/:id/status", (req, res) => {
  const session = manager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    id: req.params.id,
    status: session.status,
    qr: session.qr,
    phoneNumber: session.phoneNumber,
  });
});

// Connect a session (returns QR code)
app.post("/sessions/:id/connect", async (req, res) => {
  const { id } = req.params;
  try {
    const session = await manager.connectSession(id);
    res.json({
      id,
      status: session.status,
      qr: session.qr,
      message: session.qr
        ? "Scan the QR code with WhatsApp on your phone"
        : "Session already connected",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Disconnect a session
app.delete("/sessions/:id", async (req, res) => {
  const { id } = req.params;
  const existed = await manager.disconnectSession(id);
  if (!existed) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({ id, status: "disconnected" });
});

// Send a text message
app.post("/sessions/:id/send", async (req, res) => {
  const { id } = req.params;
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: "Missing 'to' or 'text' in body" });
  }

  try {
    const result = await manager.sendMessage(id, to, text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Send a media message
app.post("/sessions/:id/send-media", async (req, res) => {
  const { id } = req.params;
  const { to, type, url, caption } = req.body;

  if (!to || !type || !url) {
    return res.status(400).json({ error: "Missing 'to', 'type', or 'url' in body" });
  }

  try {
    const result = await manager.sendMedia(id, to, type, url, caption);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const APP_URL = process.env.APP_URL || "http://127.0.0.1:3005";
const CRON_SECRET = process.env.NEXTAUTH_SECRET || "";

// Run every minute — the cron endpoint handles time-gating for lessons
cron.schedule("* * * * *", async () => {
  try {
    const res = await fetch(`${APP_URL}/api/cron`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    console.log(`[cron] status=${res.status} lessons=${data.lessonsSent ?? 0} broadcasts=${data.broadcastsSent ?? 0} failures=${data.failures ?? 0}`);
  } catch (err) {
    console.error("[cron] Failed to call cron endpoint:", err);
  }
});

// Run every hour — sync Stripe subscribers for all configured accounts
cron.schedule("0 * * * *", async () => {
  try {
    const res = await fetch(`${APP_URL}/api/cron/sync`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    console.log(`[sync] status=${res.status}`, JSON.stringify(data));
  } catch (err) {
    console.error("[sync] Failed to call sync endpoint:", err);
  }
});

app.listen(PORT, async () => {
  console.log(`Baileys service running on http://localhost:${PORT}`);
  console.log("Scheduler: delivery cron every minute, sync cron every hour");

  // Auto-reconnect sessions that have saved auth state
  const sessions = manager.listSessions();
  for (const session of sessions) {
    if (session.status === "disconnected") {
      console.log(`[startup] Auto-reconnecting session: ${session.id}`);
      try {
        await manager.connectSession(session.id);
      } catch (err) {
        console.error(`[startup] Failed to reconnect ${session.id}:`, err);
      }
    }
  }
});
