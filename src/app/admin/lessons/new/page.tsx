"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mic, ImageIcon } from "lucide-react";

export default function NewLessonPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(status: "draft" | "published") {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");

    // For now, send JSON. File uploads will be added when storage is configured.
    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: body || null,
        status,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create lesson");
      setSaving(false);
      return;
    }

    router.push("/admin/lessons");
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/admin/lessons"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink px-3 py-1.5 border border-border rounded-lg transition-colors"
        >
          <ChevronLeft size={14} />
          Lessons
        </Link>
        <span className="text-muted text-sm">/</span>
        <span className="text-sm text-ink">New Lesson</span>
      </div>

      <div className="flex gap-10">
        {/* Form */}
        <div className="flex-1 max-w-[640px] space-y-6">
          <div>
            <h2 className="font-display text-[28px] font-bold text-ink">New Lesson</h2>
            <p className="text-muted text-sm mt-1">
              This lesson will be added to the end of the sequence
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
              placeholder="Enter lesson title..."
            />
          </div>

          {/* Audio upload */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-[13px] font-medium text-ink tracking-wide">Audio File</label>
              <span className="text-[11px] font-medium text-terracotta uppercase tracking-wider">Required</span>
            </div>
            <label className="flex flex-col items-center justify-center py-8 bg-white border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-muted transition-colors">
              <Mic size={36} className="text-muted mb-2.5" strokeWidth={1.2} />
              <p className="text-sm font-medium text-ink">
                {audioFile ? audioFile.name : "Drop your audio file here"}
              </p>
              <p className="text-[13px] text-muted mt-1">MP3, WAV, or M4A up to 16 MB</p>
              <div className="mt-3 px-4 py-2 bg-surface rounded-md">
                <span className="text-[13px] font-medium text-ink">Browse files</span>
              </div>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {/* Text content */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-[13px] font-medium text-ink tracking-wide">Text Content</label>
              <span className="text-[11px] text-muted uppercase tracking-wider">Optional</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-3 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors resize-none"
              placeholder="Write a message to accompany the audio..."
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

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleSubmit("draft")}
              disabled={saving}
              className="px-7 py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit("published")}
              disabled={saving}
              className="px-7 py-3 bg-sage text-white rounded-lg text-sm font-semibold hover:bg-sage/90 disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
            <Link
              href="/admin/lessons"
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
            <div className="p-3 space-y-2 min-h-[260px]">
              {(body || imageFile) && (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] overflow-hidden">
                  {imageFile && (
                    <div className="w-full h-[100px] bg-[#E8E4DF] flex items-center justify-center">
                      <ImageIcon size={24} className="text-[#B0B0A8]" />
                    </div>
                  )}
                  {body && (
                    <div className="px-2.5 py-2">
                      <p className="text-[12px] text-ink leading-[17px]">
                        {body.length > 80 ? body.slice(0, 80) + "..." : body || "Your text message will appear here..."}
                      </p>
                      <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] p-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#075E54] flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="h-[3px] bg-[#B0B0A8] rounded-full">
                      <div className="w-1/3 h-full bg-[#075E54] rounded-full" />
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">1:24</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
