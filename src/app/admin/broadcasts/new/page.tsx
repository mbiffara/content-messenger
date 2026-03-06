"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageIcon, Send, Clock } from "lucide-react";

export default function NewBroadcastPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (deliveryMode === "schedule" && (!scheduledDate || !scheduledTime)) {
      setError("Please set a date and time for the scheduled broadcast");
      return;
    }

    setSaving(true);
    setError("");

    const status = deliveryMode === "schedule" ? "scheduled" : "draft";
    const scheduledAt =
      deliveryMode === "schedule"
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null;

    const res = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: body || null,
        status,
        scheduledAt,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create broadcast");
      setSaving(false);
      return;
    }

    router.push("/admin/broadcasts");
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/admin/broadcasts"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink px-3 py-1.5 border border-border rounded-lg transition-colors"
        >
          <ChevronLeft size={14} />
          Broadcasts
        </Link>
        <span className="text-muted text-sm">/</span>
        <span className="text-sm text-ink">New Broadcast</span>
      </div>

      <div className="flex gap-10">
        {/* Form */}
        <div className="flex-1 max-w-[640px] space-y-6">
          <div>
            <h2 className="font-display text-[28px] font-bold text-ink">New Broadcast</h2>
            <p className="text-muted text-sm mt-1">
              Send a one-time message to all active subscribers
            </p>
          </div>

          {error && <p className="text-terracotta text-sm">{error}</p>}

          {/* Title */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5 tracking-wide">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
              placeholder="Enter broadcast title..."
            />
          </div>

          {/* Text content */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-[13px] font-medium text-ink tracking-wide">Message</label>
              <span className="text-[11px] text-muted uppercase tracking-wider">Optional</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors resize-none"
              placeholder="Write a message to send to all subscribers..."
            />
          </div>

          {/* Image upload */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-[13px] font-medium text-ink tracking-wide">Image</label>
              <span className="text-[11px] text-muted uppercase tracking-wider">Optional</span>
            </div>
            <label className="flex items-center gap-3 px-4 py-3.5 bg-white border border-dashed border-border rounded-lg cursor-pointer hover:border-muted transition-colors">
              <ImageIcon size={22} className="text-muted" strokeWidth={1.5} />
              <span className="text-sm text-muted">
                {imageFile ? imageFile.name : "Drop an image or click to upload"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {/* Delivery timing */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-3 tracking-wide">
              Delivery
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMode("now")}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border transition-colors text-left ${
                  deliveryMode === "now"
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-white text-ink hover:border-muted"
                }`}
              >
                <Send size={18} strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">Send now</p>
                  <p className={`text-[12px] mt-0.5 ${deliveryMode === "now" ? "text-white/60" : "text-muted"}`}>
                    Save as draft, send manually
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("schedule")}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg border transition-colors text-left ${
                  deliveryMode === "schedule"
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-white text-ink hover:border-muted"
                }`}
              >
                <Clock size={18} strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">Schedule</p>
                  <p className={`text-[12px] mt-0.5 ${deliveryMode === "schedule" ? "text-white/60" : "text-muted"}`}>
                    Pick a date and time
                  </p>
                </div>
              </button>
            </div>

            {deliveryMode === "schedule" && (
              <div className="flex gap-3 mt-3">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="flex-1 px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-[140px] px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-7 py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {deliveryMode === "schedule" ? "Schedule Broadcast" : "Save as Draft"}
            </button>
            <Link
              href="/admin/broadcasts"
              className="px-7 py-3 border border-border rounded-lg text-sm font-medium text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* WhatsApp Preview */}
        <div className="w-[300px] flex-shrink-0">
          <p className="text-[13px] font-semibold text-ink uppercase tracking-[0.04em] mb-3">
            WhatsApp Preview
          </p>
          <div className="bg-[#ECE5DD] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-[#075E54]">
              <div className="w-8 h-8 rounded-full bg-white/20" />
              <div>
                <p className="text-sm font-semibold text-white">Artista del negocio</p>
                <p className="text-[11px] text-white/70">online</p>
              </div>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {(body || imageFile) ? (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] overflow-hidden">
                  {imageFile && (
                    <div className="w-full h-[100px] bg-[#E8E4DF] flex items-center justify-center">
                      <ImageIcon size={24} className="text-[#B0B0A8]" />
                    </div>
                  )}
                  {body && (
                    <div className="px-2.5 py-2">
                      <p className="text-[12px] text-ink leading-[17px]">
                        {body.length > 100 ? body.slice(0, 100) + "..." : body}
                      </p>
                      <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] p-2.5">
                  <p className="text-[12px] text-muted leading-[17px]">
                    Your message will appear here...
                  </p>
                  <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
