"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ImageIcon, Music, CheckCircle, XCircle, Clock, RotateCw } from "lucide-react";

interface DeliveryLog {
  id: string;
  event: string;
  detail: string | null;
  createdAt: string;
}

interface Delivery {
  id: string;
  status: string;
  sentAt: string | null;
  logs: DeliveryLog[];
  subscriber: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
}

interface Broadcast {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  deliveries: Delivery[];
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/broadcasts/${params.id}`)
      .then((r) => r.json())
      .then(setBroadcast)
      .finally(() => setLoading(false));
  }, [params.id]);

  const reload = () => {
    fetch(`/api/broadcasts/${params.id}`)
      .then((r) => r.json())
      .then(setBroadcast);
  };

  const retryOne = async (deliveryId: string) => {
    setRetrying((s) => new Set(s).add(deliveryId));
    try {
      await fetch("/api/deliveries/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: [deliveryId] }),
      });
      reload();
    } finally {
      setRetrying((s) => { const n = new Set(s); n.delete(deliveryId); return n; });
    }
  };

  const retryAllFailed = async () => {
    if (!broadcast) return;
    const failedIds = broadcast.deliveries.filter((d) => d.status === "failed").map((d) => d.id);
    if (failedIds.length === 0) return;
    setRetrying(new Set(failedIds));
    try {
      await fetch("/api/deliveries/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: failedIds }),
      });
      reload();
    } finally {
      setRetrying(new Set());
    }
  };

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  if (!broadcast) {
    return <div className="text-muted">Broadcast not found</div>;
  }

  const sentCount = broadcast.deliveries.filter((d) => d.status === "sent" || d.status === "delivered").length;
  const failedCount = broadcast.deliveries.filter((d) => d.status === "failed").length;

  const allLogs = broadcast.deliveries
    .flatMap((d) => d.logs.map((log) => ({ ...log, subscriberName: d.subscriber.name || d.subscriber.email })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
        <span className="text-sm text-ink truncate max-w-[200px]">{broadcast.title}</span>
      </div>

      <div className="flex gap-10">
        {/* Left: Content + deliveries */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-display text-[28px] font-bold text-ink">{broadcast.title}</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                broadcast.status === "sent"
                  ? "bg-sage/10 text-sage"
                  : broadcast.status === "scheduled"
                  ? "bg-terracotta/10 text-terracotta"
                  : "bg-muted/10 text-muted"
              }`}>
                {broadcast.status === "sent" ? "Sent" : broadcast.status === "scheduled" ? "Scheduled" : "Draft"}
              </span>
            </div>
            {broadcast.sentAt && (
              <p className="text-sm text-muted">
                Sent on {new Date(broadcast.sentAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })} at {new Date(broadcast.sentAt).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-border-light rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Total</p>
              <p className="text-2xl font-bold text-ink">{broadcast.deliveries.length}</p>
            </div>
            <div className="bg-white border border-border-light rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Delivered</p>
              <p className="text-2xl font-bold text-sage">{sentCount}</p>
            </div>
            <div className="bg-white border border-border-light rounded-xl px-5 py-4">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Failed</p>
              <p className="text-2xl font-bold text-terracotta">{failedCount}</p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-8">
            <h3 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3">Content</h3>
            <div className="bg-white border border-border-light rounded-xl p-5 space-y-3">
              {broadcast.body && (
                <p className="text-[15px] text-ink whitespace-pre-wrap">{broadcast.body}</p>
              )}
              {broadcast.imageUrl && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <ImageIcon size={16} />
                  <span>Image attached</span>
                </div>
              )}
              {broadcast.audioUrl && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Music size={16} />
                  <span>Audio attached</span>
                </div>
              )}
              {!broadcast.body && !broadcast.imageUrl && !broadcast.audioUrl && (
                <p className="text-sm text-muted">No content</p>
              )}
            </div>
          </div>

          {/* Deliveries table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-muted uppercase tracking-wider">
                Recipients ({broadcast.deliveries.length})
              </h3>
              {failedCount > 0 && (
                <button
                  onClick={retryAllFailed}
                  disabled={retrying.size > 0}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta/80 disabled:opacity-50 transition-colors"
                >
                  <RotateCw size={13} className={retrying.size > 0 ? "animate-spin" : ""} />
                  Retry All Failed ({failedCount})
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-border-light overflow-hidden">
              {/* Header */}
              <div className="flex items-center px-5 py-3 border-b border-border-light">
                <span className="w-[200px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Name</span>
                <span className="w-[240px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Email</span>
                <span className="w-[150px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Phone</span>
                <span className="w-[100px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</span>
                <span className="w-[130px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Sent at</span>
                <span className="flex-1 text-[11px] font-semibold text-muted uppercase tracking-wider"></span>
              </div>

              {/* Rows */}
              {broadcast.deliveries.map((d) => (
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
                  <span className="w-[130px] shrink-0 text-[13px] text-muted">
                    {d.sentAt
                      ? new Date(d.sentAt).toLocaleTimeString("en-US", {
                          hour: "numeric", minute: "2-digit",
                        })
                      : "—"}
                  </span>

                  {/* Actions */}
                  <div className="flex-1">
                    {d.status === "failed" && (
                      <button
                        onClick={() => retryOne(d.id)}
                        disabled={retrying.has(d.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:text-terracotta/80 disabled:opacity-50 transition-colors"
                      >
                        <RotateCw size={12} className={retrying.has(d.id) ? "animate-spin" : ""} />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {broadcast.deliveries.length === 0 && (
                <div className="px-5 py-10 text-center text-muted text-sm">
                  No deliveries yet
                </div>
              )}
            </div>
          </div>
          {/* Activity Log */}
          {allLogs.length > 0 && (
            <div className="mt-8">
              <h3 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3">
                Activity Log
              </h3>
              <div className="bg-white rounded-xl border border-border-light overflow-hidden">
                {allLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3 border-b border-border-light last:border-b-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      log.event === "sent" ? "bg-sage" : log.event === "failed" ? "bg-terracotta" : "bg-muted"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-ink capitalize">{log.event}</span>
                        {log.subscriberName && (
                          <span className="text-[12px] text-muted">— {log.subscriberName}</span>
                        )}
                      </div>
                      {log.detail && (
                        <p className="text-[12px] text-muted mt-0.5 truncate">{log.detail}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted shrink-0">
                      {new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                      {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: WhatsApp Preview */}
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
              {/* Image message */}
              {broadcast.imageUrl && (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={broadcast.imageUrl} alt="" className="w-full object-cover max-h-[160px]" />
                  {broadcast.body && !broadcast.audioUrl && (
                    <div className="px-2.5 py-2">
                      <p className="text-[12px] text-ink leading-[17px]">
                        {broadcast.body.length > 80 ? broadcast.body.slice(0, 80) + "..." : broadcast.body}
                      </p>
                      <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                    </div>
                  )}
                  {!broadcast.body && (
                    <div className="px-2.5 py-1">
                      <p className="text-[10px] text-muted text-right">9:00 AM</p>
                    </div>
                  )}
                </div>
              )}

              {/* Audio message */}
              {broadcast.audioUrl && (
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

              {/* Text-only message */}
              {broadcast.body && !broadcast.imageUrl && (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] px-2.5 py-2">
                  <p className="text-[12px] text-ink leading-[17px]">
                    {broadcast.body.length > 100 ? broadcast.body.slice(0, 100) + "..." : broadcast.body}
                  </p>
                  <p className="text-[10px] text-muted text-right mt-1">9:00 AM</p>
                </div>
              )}

              {!broadcast.body && !broadcast.imageUrl && !broadcast.audioUrl && (
                <div className="bg-white rounded-r-lg rounded-bl-lg max-w-[220px] p-2.5">
                  <p className="text-[12px] text-muted leading-[17px]">No content</p>
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
