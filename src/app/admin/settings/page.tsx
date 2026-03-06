"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Provider = "ghost" | "stripe";

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("ghost");
  const [ghostApiUrl, setGhostApiUrl] = useState("");
  const [ghostAdminApiKey, setGhostAdminApiKey] = useState("");
  const [stripeApiKey, setStripeApiKey] = useState("");
  const [stripeProductId, setStripeProductId] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.sync_provider) setProvider(data.sync_provider as Provider);
        if (data.ghost_api_url) setGhostApiUrl(data.ghost_api_url);
        if (data.ghost_admin_api_key) setGhostAdminApiKey(data.ghost_admin_api_key);
        if (data.stripe_api_key) setStripeApiKey(data.stripe_api_key);
        if (data.stripe_product_id) setStripeProductId(data.stripe_product_id);
        if (data.whatsapp_phone_number_id) setWhatsappPhoneId(data.whatsapp_phone_number_id);
        if (data.whatsapp_access_token) setWhatsappToken(data.whatsapp_access_token);
      })
      .finally(() => setLoading(false));
  }, []);

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

  async function handleSaveWhatsapp() {
    setSavingWhatsapp(true);
    setWhatsappMessage(null);

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsapp_phone_number_id: whatsappPhoneId,
        whatsapp_access_token: whatsappToken,
      }),
    });

    if (res.ok) {
      setWhatsappMessage({ type: "success", text: "Settings saved" });
    } else {
      setWhatsappMessage({ type: "error", text: "Failed to save" });
    }
    setSavingWhatsapp(false);
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
        {/* Subscriber Sync */}
        <section className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">Subscriber Sync</h3>
            <p className="text-sm text-muted mt-0.5">
              Choose where to import your subscribers from. Connect one provider at a time.
            </p>
          </div>

          {/* Provider cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setProvider("ghost")}
              className={`flex items-center gap-3.5 px-5 py-4 rounded-xl border-2 text-left transition-colors ${
                provider === "ghost"
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-white text-ink hover:border-muted"
              }`}
            >
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                provider === "ghost" ? "bg-white/12" : "bg-surface"
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={provider === "ghost" ? "#FAFAF8" : "#8A8A82"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <circle cx="9" cy="10" r="1.5" fill={provider === "ghost" ? "#FAFAF8" : "#8A8A82"} stroke="none"/>
                  <circle cx="15" cy="10" r="1.5" fill={provider === "ghost" ? "#FAFAF8" : "#8A8A82"} stroke="none"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Ghost</p>
                <p className={`text-[12px] mt-0.5 ${provider === "ghost" ? "text-white/50" : "text-muted"}`}>
                  Newsletter members
                </p>
              </div>
              <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                provider === "ghost" ? "border-white/30" : "border-border"
              }`}>
                {provider === "ghost" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </div>
            </button>

            <button
              onClick={() => setProvider("stripe")}
              className={`flex items-center gap-3.5 px-5 py-4 rounded-xl border-2 text-left transition-colors ${
                provider === "stripe"
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-white text-ink hover:border-muted"
              }`}
            >
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                provider === "stripe" ? "bg-white/12" : "bg-surface"
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={provider === "stripe" ? "#FAFAF8" : "#8A8A82"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Stripe</p>
                <p className={`text-[12px] mt-0.5 ${provider === "stripe" ? "text-white/50" : "text-muted"}`}>
                  Product customers
                </p>
              </div>
              <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                provider === "stripe" ? "border-white/30" : "border-border"
              }`}>
                {provider === "stripe" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </div>
            </button>
          </div>

          {/* Provider fields */}
          <div className="bg-white border border-border-light rounded-xl p-6 space-y-4">
            {provider === "ghost" ? (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                    API URL
                  </label>
                  <input
                    type="text"
                    value={ghostApiUrl}
                    onChange={(e) => setGhostApiUrl(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                    placeholder="https://your-site.ghost.io"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                    Admin API Key
                  </label>
                  <input
                    type="password"
                    value={ghostAdminApiKey}
                    onChange={(e) => setGhostAdminApiKey(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                    placeholder="Enter your Ghost Admin API key"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                    Secret API Key
                  </label>
                  <input
                    type="password"
                    value={stripeApiKey}
                    onChange={(e) => setStripeApiKey(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                    placeholder="sk_live_..."
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <label className="text-[13px] font-medium text-ink tracking-wide">
                      Product ID
                    </label>
                    <span className="text-[11px] font-medium text-terracotta uppercase tracking-wider">
                      Required
                    </span>
                  </div>
                  <input
                    type="text"
                    value={stripeProductId}
                    onChange={(e) => setStripeProductId(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                    placeholder="prod_..."
                  />
                  <p className="text-[12px] text-muted mt-1.5">
                    Subscribers are customers who purchased this product
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Sync actions + message */}
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
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={testing ? "animate-spin" : ""} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-border-light" />

        {/* WhatsApp API */}
        <section className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">WhatsApp API</h3>
            <p className="text-sm text-muted mt-0.5">
              Configure your Meta WhatsApp Business API credentials for message delivery.
            </p>
          </div>

          <div className="bg-white border border-border-light rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                Phone Number ID
              </label>
              <input
                type="text"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                placeholder="Enter your WhatsApp phone number ID"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
                Access Token
              </label>
              <input
                type="password"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                placeholder="Enter your permanent access token"
              />
            </div>
          </div>

          {whatsappMessage && (
            <p className={`text-sm ${whatsappMessage.type === "success" ? "text-sage" : "text-terracotta"}`}>
              {whatsappMessage.text}
            </p>
          )}
          <div>
            <button
              onClick={handleSaveWhatsapp}
              disabled={savingWhatsapp}
              className="px-6 py-2.5 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {savingWhatsapp ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
