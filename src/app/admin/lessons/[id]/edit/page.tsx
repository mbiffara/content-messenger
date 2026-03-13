"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mic, ImageIcon, X, Music } from "lucide-react";

async function uploadFile(file: File): Promise<{ url: string; originalName: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export default function EditLessonPage() {
  const params = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
  const [existingAudioName, setExistingAudioName] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/lessons/${params.id}`)
      .then((r) => r.json())
      .then((lesson) => {
        setTitle(lesson.title);
        setBody(lesson.body || "");
        setExistingAudioUrl(lesson.audioUrl);
        setExistingAudioName(lesson.audioFileName);
        setExistingImageUrl(lesson.imageUrl);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSubmit(status: "draft" | "published") {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let audioUrl: string | undefined = undefined;
      let audioFileName: string | undefined = undefined;
      let imageUrl: string | undefined = undefined;

      if (audioFile) {
        const result = await uploadFile(audioFile);
        audioUrl = result.url;
        audioFileName = result.originalName;
      } else if (removeAudio) {
        audioUrl = "";
        audioFileName = "";
      }

      if (imageFile) {
        const result = await uploadFile(imageFile);
        imageUrl = result.url;
      } else if (removeImage) {
        imageUrl = "";
      }

      const payload: Record<string, unknown> = {
        id: params.id,
        title,
        body: body || null,
        status,
      };
      if (audioUrl !== undefined) payload.audioUrl = audioUrl || null;
      if (audioFileName !== undefined) payload.audioFileName = audioFileName || null;
      if (imageUrl !== undefined) payload.imageUrl = imageUrl || null;

      const res = await fetch("/api/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }

      router.push("/admin/lessons");
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  const hasAudio = (existingAudioUrl && !removeAudio) || audioFile;
  const hasImage = (existingImageUrl && !removeImage) || imageFile;

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
        <span className="text-sm text-ink">Edit Lesson</span>
      </div>

      <div className="flex-1 max-w-[640px] space-y-6">
        <div>
          <h2 className="font-display text-[28px] font-bold text-ink">Edit Lesson</h2>
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
          </div>
          {hasAudio ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-lg">
              <Music size={18} className="text-muted" strokeWidth={1.5} />
              <span className="text-sm text-ink flex-1 truncate">
                {audioFile ? audioFile.name : existingAudioName || existingAudioUrl?.split("/").pop()}
              </span>
              <button
                onClick={() => {
                  setAudioFile(null);
                  if (existingAudioUrl) setRemoveAudio(true);
                }}
                className="text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center py-8 bg-white border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-muted transition-colors">
              <Mic size={36} className="text-muted mb-2.5" strokeWidth={1.2} />
              <p className="text-sm font-medium text-ink">Drop your audio file here</p>
              <p className="text-[13px] text-muted mt-1">MP3, WAV, or M4A up to 16 MB</p>
              <div className="mt-3 px-4 py-2 bg-surface rounded-md">
                <span className="text-[13px] font-medium text-ink">Browse files</span>
              </div>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  setAudioFile(e.target.files?.[0] || null);
                  setRemoveAudio(false);
                }}
              />
            </label>
          )}
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
          {hasImage ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-border rounded-lg">
              <ImageIcon size={18} className="text-muted" strokeWidth={1.5} />
              <span className="text-sm text-ink flex-1 truncate">
                {imageFile ? imageFile.name : existingImageUrl?.split("/").pop()}
              </span>
              <button
                onClick={() => {
                  setImageFile(null);
                  if (existingImageUrl) setRemoveImage(true);
                }}
                className="text-muted hover:text-ink"
              >
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
                onChange={(e) => {
                  setImageFile(e.target.files?.[0] || null);
                  setRemoveImage(false);
                }}
              />
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => handleSubmit("published")}
            disabled={saving}
            className="px-7 py-3 bg-sage text-white rounded-lg text-sm font-semibold hover:bg-sage/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Publish"}
          </button>
          <button
            onClick={() => handleSubmit("draft")}
            disabled={saving}
            className="px-7 py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            Save Draft
          </button>
          <Link
            href="/admin/lessons"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
