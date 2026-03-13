"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Save, Loader2 } from "lucide-react";
import QRCode from "qrcode";

type Provider = "ghost" | "stripe";

interface WaSession {
  status: "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;
  phoneNumber: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const canEditStripe = session?.user?.role === "super_admin" || session?.user?.role === "account_admin";

  const [provider, setProvider] = useState<Provider>("stripe");
  const [ghostApiUrl, setGhostApiUrl] = useState("");
  const [ghostAdminApiKey, setGhostAdminApiKey] = useState("");
  const [stripeApiKey, setStripeApiKey] = useState("");
  const [stripeProductId, setStripeProductId] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [greetingEnabled, setGreetingEnabled] = useState(true);
  const [lessonDeliveryTime, setLessonDeliveryTime] = useState("10:30");
  const [lessonDeliveryTimezone, setLessonDeliveryTimezone] = useState("America/Argentina/Buenos_Aires");

  const [stripeProducts, setStripeProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeKeySaved, setStripeKeySaved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // WhatsApp connection state
  const [waSession, setWaSession] = useState<WaSession | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp?action=status");
      const data = await res.json();
      if (data.error && res.status === 502) {
        setWaSession({ status: "disconnected", qr: null, phoneNumber: null });
        setWaError("Baileys service is not running");
        return;
      }
      setWaSession({ ...data });
      setWaError(null);

      // Render QR if available
      if (data.qr && qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, data.qr, { width: 260, margin: 2 });
      }

      // Stop polling once connected
      if (data.status === "connected" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      setWaError("Could not reach WhatsApp service");
    }
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.sync_provider) setProvider(data.sync_provider as Provider);
        if (data.ghost_api_url) setGhostApiUrl(data.ghost_api_url);
        if (data.ghost_admin_api_key) setGhostAdminApiKey(data.ghost_admin_api_key);
        if (data.stripe_api_key) {
          setStripeApiKey(data.stripe_api_key);
          setStripeKeySaved(true);
          // Load products using saved key
          try {
            const res = await fetch("/api/stripe/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            const products = await res.json();
            if (!products.error) setStripeProducts(products);
          } catch { /* ignore */ }
        }
        if (data.stripe_product_id) setStripeProductId(data.stripe_product_id);
        if (data.greeting_message) setGreetingMessage(data.greeting_message);
        if (data.greeting_enabled !== undefined) setGreetingEnabled(data.greeting_enabled !== "false");
        if (data.lesson_delivery_time) setLessonDeliveryTime(data.lesson_delivery_time);
        if (data.lesson_delivery_timezone) setLessonDeliveryTimezone(data.lesson_delivery_timezone);
      })
      .finally(() => setLoading(false));

    fetchWaStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWaStatus]);

  async function handleSaveSync() {
    setSaving(true);
    setMessage(null);

    const body: Record<string, string> = { sync_provider: provider };
    if (provider === "ghost") {
      body.ghost_api_url = ghostApiUrl;
      body.ghost_admin_api_key = ghostAdminApiKey;
    } else {
      body.stripe_api_key = stripeApiKey;
      body.stripe_product_id = stripeProductId;
    }
    body.greeting_message = greetingMessage;
    body.greeting_enabled = greetingEnabled ? "true" : "false";
    body.lesson_delivery_time = lessonDeliveryTime;
    body.lesson_delivery_timezone = lessonDeliveryTimezone;

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Settings saved" });
    } else {
      setMessage({ type: "error", text: "Failed to save" });
    }
    setSaving(false);
  }

  async function handleSaveStripeKey() {
    if (!stripeApiKey || stripeApiKey.startsWith("••••••")) return;
    setStripeSaving(true);
    setMessage(null);

    // Save the key
    const saveRes = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stripe_api_key: stripeApiKey }),
    });
    if (!saveRes.ok) {
      setMessage({ type: "error", text: "Failed to save API key" });
      setStripeSaving(false);
      return;
    }

    // Fetch products
    const res = await fetch("/api/stripe/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: stripeApiKey }),
    });
    const data = await res.json();
    if (data.error) {
      setMessage({ type: "error", text: data.error });
    } else {
      setStripeProducts(data);
      setStripeKeySaved(true);
      setMessage({ type: "success", text: `Found ${data.length} product${data.length !== 1 ? "s" : ""}` });
    }
    setStripeSaving(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);

    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });

    const data = await res.json();
    if (data.ok) {
      setMessage({ type: "success", text: data.message });
    } else {
      setMessage({ type: "error", text: data.error });
    }
    setTesting(false);
  }

  async function handleWaConnect() {
    setWaConnecting(true);
    setWaError(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (data.error) {
        setWaError(data.error);
      } else {
        setWaSession({ ...data });
        // Start polling for QR updates and connection status
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(fetchWaStatus, 3000);
      }
    } catch {
      setWaError("Failed to connect — is the Baileys service running?");
    }
    setWaConnecting(false);
  }

  async function handleWaDisconnect() {
    setWaDisconnecting(true);
    setWaError(null);
    try {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setWaSession({ status: "disconnected", qr: null, phoneNumber: null });
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      setWaError("Failed to disconnect");
    }
    setWaDisconnecting(false);
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-muted text-sm mb-1">Configuration</p>
        <h2 className="font-display text-[28px] font-bold text-ink">Settings</h2>
      </div>

      <div className="max-w-[640px] space-y-10">
        {/* Subscriber Sync — only visible to account_admin+ */}
        {canEditStripe && (
          <>
            <section className="space-y-5">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Subscriber Sync</h3>
                <p className="text-sm text-muted mt-0.5">
                  Connect your Stripe account to import product customers as subscribers.
                </p>
              </div>

              {/* Stripe fields */}
              <div className="bg-white border border-border-light rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                    Secret API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={stripeApiKey}
                      onChange={(e) => {
                        setStripeApiKey(e.target.value);
                        setStripeKeySaved(false);
                      }}
                      className="flex-1 px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                      placeholder="sk_live_..."
                    />
                    <button
                      onClick={handleSaveStripeKey}
                      disabled={stripeSaving || !stripeApiKey || stripeKeySaved}
                      title={stripeKeySaved ? "Key saved" : "Save key & load products"}
                      className="px-3 py-3 border border-border rounded-lg text-ink hover:bg-surface disabled:opacity-40 disabled:hover:bg-white transition-colors"
                    >
                      {stripeSaving ? (
                        <Loader2 size={18} className="animate-spin text-muted" />
                      ) : (
                        <Save size={18} className={stripeKeySaved ? "text-sage" : ""} />
                      )}
                    </button>
                  </div>
                </div>
                {stripeProducts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-[13px] font-medium text-ink tracking-wide">
                        Product
                      </label>
                      <span className="text-[11px] font-medium text-terracotta uppercase tracking-wider">
                        Required
                      </span>
                    </div>
                    <select
                      value={stripeProductId}
                      onChange={(e) => setStripeProductId(e.target.value)}
                      className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                    >
                      <option value="">Select a product...</option>
                      {stripeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[12px] text-muted mt-1.5">
                      Subscribers are customers who purchased this product
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-border-light" />
          </>
        )}

        {/* Lesson Delivery */}
        <section className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">Lesson Delivery</h3>
            <p className="text-sm text-muted mt-0.5">
              Lessons are sent daily based on each subscriber&apos;s sequence position.
            </p>
          </div>

          <div className="bg-white border border-border-light rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                  Delivery Time
                </label>
                <input
                  type="time"
                  value={lessonDeliveryTime}
                  onChange={(e) => setLessonDeliveryTime(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                  Timezone
                </label>
                <select
                  value={lessonDeliveryTimezone}
                  onChange={(e) => setLessonDeliveryTimezone(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                >
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires (ART)</option>
                  <option value="America/New_York">New York (EST/EDT)</option>
                  <option value="America/Chicago">Chicago (CST/CDT)</option>
                  <option value="America/Denver">Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                  <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                  <option value="America/Mexico_City">Mexico City (CST)</option>
                  <option value="America/Bogota">Bogotá (COT)</option>
                  <option value="America/Santiago">Santiago (CLT)</option>
                  <option value="America/Lima">Lima (PET)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Madrid">Madrid (CET/CEST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-border-light" />

        {/* Greeting Message */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-ink">Greeting & Matching</h3>
              <p className="text-sm text-muted mt-0.5">
                When enabled, new WhatsApp contacts are asked for their email to link them to a subscriber.
              </p>
            </div>
            <button
              onClick={() => setGreetingEnabled(!greetingEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                greetingEnabled ? "bg-sage" : "bg-[#D8D8D4]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  greetingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="bg-white border border-border-light rounded-xl p-6">
            <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
              Message
            </label>
            <textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors resize-none"
              placeholder="Hey! To receive messages from us on WhatsApp, please reply with the email address you used when subscribing."
            />
            <p className="text-[12px] text-muted mt-1.5">
              Leave empty to use the default message.
            </p>
          </div>

          {/* Save actions + message */}
          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-sage" : "text-terracotta"}`}>
              {message.text}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSync}
              disabled={saving}
              className="px-6 py-2.5 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {canEditStripe && (
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={14} className={testing ? "animate-spin" : ""} />
                {testing ? "Testing..." : "Test Connection"}
              </button>
            )}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-border-light" />

        {/* WhatsApp Connection */}
        <section className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">WhatsApp Connection</h3>
            <p className="text-sm text-muted mt-0.5">
              Connect your WhatsApp account by scanning a QR code, just like WhatsApp Web.
            </p>
          </div>

          <div className="bg-white border border-border-light rounded-xl p-6">
            {/* Connected state */}
            {waSession?.status === "connected" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6BA368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">Connected</p>
                    <p className="text-sm text-muted mt-0.5">
                      {waSession.phoneNumber
                        ? `+${waSession.phoneNumber}`
                        : "WhatsApp account linked"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleWaDisconnect}
                  disabled={waDisconnecting}
                  className="px-5 py-2.5 border border-terracotta/30 text-terracotta rounded-lg text-sm font-medium hover:bg-terracotta/5 disabled:opacity-50 transition-colors"
                >
                  {waDisconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            )}

            {/* QR code state */}
            {(waSession?.status === "qr" || waSession?.status === "connecting") && (
              <div className="flex flex-col items-center py-4">
                <p className="text-sm text-muted mb-4">
                  Open WhatsApp on your phone → Linked Devices → Link a Device
                </p>
                <div className="bg-white rounded-xl border border-border-light p-3">
                  <canvas ref={qrCanvasRef} />
                </div>
                <p className="text-[12px] text-muted mt-3">
                  Waiting for scan...
                </p>
              </div>
            )}

            {/* Disconnected state */}
            {(!waSession || waSession.status === "disconnected") && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A8A82" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">Not connected</p>
                    <p className="text-sm text-muted mt-0.5">
                      Scan a QR code to link your WhatsApp account
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleWaConnect}
                  disabled={waConnecting}
                  className="px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
                >
                  {waConnecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            )}
          </div>

          {waError && (
            <p className="text-sm text-terracotta">{waError}</p>
          )}
        </section>
      </div>
    </div>
  );
}
