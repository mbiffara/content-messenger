"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageIcon, Send, Clock, Music, X } from "lucide-react";

async function uploadFile(file: File): Promise<{ url: string; filePath: string; originalName: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  async function handleSubmit(sendImmediately = false) {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (sendImmediately && !body?.trim() && !imageFile && !audioFile) {
      setError("Add a message, image, or audio to send");
      return;
    }
    if (deliveryMode === "schedule" && (!scheduledDate || !scheduledTime)) {
      setError("Please set a date and time for the scheduled broadcast");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Upload files first
      let imageUrl: string | null = null;
      let audioUrl: string | null = null;
      let audioFileName: string | null = null;

      if (imageFile) {
        const result = await uploadFile(imageFile);
        imageUrl = result.url;
      }
      if (audioFile) {
        const result = await uploadFile(audioFile);
        audioUrl = result.url;
        audioFileName = result.originalName;
      }

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
          imageUrl,
          audioUrl,
          audioFileName,
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

      const broadcast = await res.json();

      if (sendImmediately) {
        setSaving(false);
        setSending(true);
        setSendResult(null);

        const sendRes = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ broadcastId: broadcast.id }),
        });
        const result = await sendRes.json();
        if (sendRes.ok) {
          setSendResult(result);
          setTimeout(() => router.push("/admin/broadcasts"), 2000);
        } else {
          setError(result.error || "Failed to send broadcast");
        }
        setSending(false);
        return;
      }

      router.push("/admin/broadcasts");
    } catch {
      setError("Something went wrong — check your connection");
      setSaving(false);
      setSending(false);
    }
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
              Send a one-time message to all enabled subscribers
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
            {imageFile ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-lg">
                <ImageIcon size={18} className="text-muted" strokeWidth={1.5} />
                <span className="text-sm text-ink flex-1 truncate">{imageFile.name}</span>
                <button onClick={() => setImageFile(null)} className="text-muted hover:text-ink">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3.5 bg-white border border-dashed border-border rounded-lg cursor-pointer hover:border-muted transition-colors">
                <ImageIcon size={22} className="text-muted" strokeWidth={1.5} />
                <span className="text-sm text-muted">Click to upload an image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {/* Audio upload */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-[13px] font-medium text-ink tracking-wide">Audio</label>
              <span className="text-[11px] text-muted uppercase tracking-wider">Optional</span>
            </div>
            {audioFile ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-lg">
                <Music size={18} className="text-muted" strokeWidth={1.5} />
                <span className="text-sm text-ink flex-1 truncate">{audioFile.name}</span>
                <button onClick={() => setAudioFile(null)} className="text-muted hover:text-ink">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3.5 bg-white border border-dashed border-border rounded-lg cursor-pointer hover:border-muted transition-colors">
                <Music size={22} className="text-muted" strokeWidth={1.5} />
                <span className="text-sm text-muted">Click to upload an audio file</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
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
                    Send immediately to all subscribers
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

          {/* Send result */}
          {sendResult && (
            <div className="bg-sage/10 text-sage px-4 py-3 rounded-lg text-sm">
              Broadcast sent! {sendResult.sent} delivered{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}
            </div>
          )}

          {/* Actions */}
          {!sendResult && (
            <div className="flex items-center gap-3 pt-2">
              {deliveryMode === "now" ? (
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={saving || sending}
                  className="inline-flex items-center gap-2 px-7 py-3 bg-terracotta text-white rounded-lg text-sm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors"
                >
                  <Send size={15} />
                  {saving ? "Uploading..." : sending ? "Sending..." : "Send Now"}
                </button>
              ) : (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={saving}
                  className="px-7 py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Schedule Broadcast"}
                </button>
              )}
              <button
                onClick={() => handleSubmit(false)}
                disabled={saving || sending}
                className="px-7 py-3 border border-border rounded-lg text-sm font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors"
              >
                Save Draft
              </button>
              <Link
                href="/admin/broadcasts"
                className="text-sm text-muted hover:text-ink transition-colors"
              >
                Cancel
              </Link>
            </div>
          )}
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
              {(body || imageFile || audioFile) ? (
                <>
                  {/* Image message */}
                  {imageFile && (
                    <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(imageFile)} alt="" className="w-full object-cover max-h-[160px]" />
                      {body && !audioFile && (
                        <div className="px-2.5 py-2">
                          <p className="text-[12px] text-ink leading-[17px]">
                            {body.length > 80 ? body.slice(0, 80) + "..." : body}
                          </p>
                          <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                        </div>
                      )}
                      {!body && (
                        <div className="px-2.5 py-1">
                          <p className="text-[10px] text-muted text-right">9:00 AM</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audio message */}
                  {audioFile && (
                    <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0">
                          <Music size={14} className="text-sage" />
                        </div>
                        <div className="flex-1">
                          <div className="h-1 bg-[#E8E4DF] rounded-full">
                            <div className="h-1 bg-sage/40 rounded-full w-1/3" />
                          </div>
                          <p className="text-[10px] text-muted mt-1">0:00</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted text-right">9:00 AM</p>
                    </div>
                  )}

                  {/* Text-only message (or text with audio) */}
                  {body && !imageFile && (
                    <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] px-2.5 py-2">
                      <p className="text-[12px] text-ink leading-[17px]">
                        {body.length > 100 ? body.slice(0, 100) + "..." : body}
                      </p>
                      <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                    </div>
                  )}
                </>
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
