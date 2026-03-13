"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageIcon, Music, Volume2, CheckCircle, XCircle, Clock } from "lucide-react";

interface Delivery {
  id: string;
  status: string;
  sentAt: string | null;
  subscriber: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
}

interface Lesson {
  id: string;
  title: string;
  body: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  position: number;
  status: string;
  createdAt: string;
  deliveries: Delivery[];
}

export default function LessonDetailPage() {
  const params = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/lessons/${params.id}`)
      .then((r) => r.json())
      .then(setLesson)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  if (!lesson) {
    return <div className="text-muted">Lesson not found</div>;
  }

  const sentCount = lesson.deliveries.filter((d) => d.status === "sent" || d.status === "delivered").length;
  const failedCount = lesson.deliveries.filter((d) => d.status === "failed").length;
  const pendingCount = lesson.deliveries.filter((d) => d.status === "pending").length;

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
        <span className="text-sm text-ink truncate max-w-[200px]">{lesson.title}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
            lesson.status === "published" ? "bg-ink" : "bg-surface"
          }`}>
            <Volume2
              size={18}
              strokeWidth={1.8}
              className={lesson.status === "published" ? "text-cream" : "text-muted"}
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[28px] font-bold text-ink">{lesson.title}</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                lesson.status === "published"
                  ? "bg-sage/10 text-sage"
                  : "bg-muted/10 text-muted"
              }`}>
                {lesson.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <p className="text-sm text-muted mt-0.5">
              Lesson #{lesson.position} · Created {new Date(lesson.createdAt).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-border-light rounded-xl px-5 py-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Total Sent</p>
          <p className="text-2xl font-bold text-ink">{lesson.deliveries.length}</p>
        </div>
        <div className="bg-white border border-border-light rounded-xl px-5 py-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Delivered</p>
          <p className="text-2xl font-bold text-sage">{sentCount}</p>
        </div>
        <div className="bg-white border border-border-light rounded-xl px-5 py-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Failed</p>
          <p className="text-2xl font-bold text-terracotta">{failedCount}</p>
        </div>
        <div className="bg-white border border-border-light rounded-xl px-5 py-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Pending</p>
          <p className="text-2xl font-bold text-muted">{pendingCount}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8">
        <h3 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3">Content</h3>
        <div className="bg-white border border-border-light rounded-xl p-5 space-y-3">
          {lesson.body && (
            <p className="text-[15px] text-ink whitespace-pre-wrap">{lesson.body}</p>
          )}
          {lesson.imageUrl && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <ImageIcon size={16} />
              <span>Image attached</span>
            </div>
          )}
          {lesson.audioUrl && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Music size={16} />
              <span>Audio attached</span>
            </div>
          )}
          {!lesson.body && !lesson.imageUrl && !lesson.audioUrl && (
            <p className="text-sm text-muted">No content</p>
          )}
        </div>
      </div>

      {/* Recipients table */}
      <div>
        <h3 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3">
          Recipients ({lesson.deliveries.length})
        </h3>
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-5 py-3 border-b border-border-light">
            <span className="w-[200px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Name</span>
            <span className="w-[240px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Email</span>
            <span className="w-[150px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Phone</span>
            <span className="w-[100px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</span>
            <span className="flex-1 text-[11px] font-semibold text-muted uppercase tracking-wider">Sent at</span>
          </div>

          {/* Rows */}
          {lesson.deliveries.map((d) => (
            <div key={d.id} className="flex items-center px-5 py-3 border-b border-border-light last:border-b-0">
              {/* Name */}
              <div className="w-[200px] shrink-0 flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#E8D5CF" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "#C45D3E" }}>
                    {d.subscriber.name
                      ? d.subscriber.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                      : "?"}
                  </span>
                </div>
                <span className="text-[14px] font-medium text-ink truncate">
                  {d.subscriber.name || "—"}
                </span>
              </div>

              {/* Email */}
              <span className="w-[240px] shrink-0 text-[14px] text-muted truncate">
                {d.subscriber.email}
              </span>

              {/* Phone */}
              <span className="w-[150px] shrink-0 text-[14px] text-muted truncate">
                {d.subscriber.phone || "—"}
              </span>

              {/* Status */}
              <div className="w-[100px] shrink-0">
                {d.status === "sent" || d.status === "delivered" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-sage">
                    <CheckCircle size={13} />
                    Sent
                  </span>
                ) : d.status === "failed" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-terracotta">
                    <XCircle size={13} />
                    Failed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                    <Clock size={13} />
                    Pending
                  </span>
                )}
              </div>

              {/* Sent at */}
              <span className="flex-1 text-[13px] text-muted">
                {d.sentAt
                  ? new Date(d.sentAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    }) + " · " + new Date(d.sentAt).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
          ))}

          {lesson.deliveries.length === 0 && (
            <div className="px-5 py-10 text-center text-muted text-sm">
              No one has received this lesson yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
