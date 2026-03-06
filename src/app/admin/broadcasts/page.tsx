"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Megaphone, Clock, MessageSquare, Image } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Broadcast {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  _count: { deliveries: number };
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortNewest, setSortNewest] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/broadcasts")
      .then((r) => r.json())
      .then(setBroadcasts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = broadcasts
    .filter((b) => statusFilter === "all" || b.status === statusFilter)
    .sort((a, b) => {
      const aTime = a.scheduledAt || a.sentAt || "";
      const bTime = b.scheduledAt || b.sentAt || "";
      return sortNewest ? bTime.localeCompare(aTime) : aTime.localeCompare(bTime);
    });

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted text-sm mb-1">{broadcasts.length} broadcasts total</p>
          <h2 className="font-display text-[28px] font-bold text-ink">Broadcasts</h2>
        </div>
        <Link
          href="/admin/broadcasts/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-lg text-sm font-medium hover:bg-terracotta/90 transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Broadcast
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-border rounded-lg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8A82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search broadcasts..."
            className="text-sm bg-transparent outline-none placeholder:text-muted w-48"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-ink appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
        </select>

        <button
          onClick={() => setSortNewest(!sortNewest)}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/>
          </svg>
          {sortNewest ? "Newest first" : "Oldest first"}
        </button>

        <span className="ml-auto text-sm text-muted">
          Showing {filtered.length} of {broadcasts.length}
        </span>
      </div>

      {/* Broadcasts list */}
      <div className="bg-white rounded-xl border border-border-light overflow-hidden">
        {filtered.map((bc) => (
          <div
            key={bc.id}
            className="flex items-center px-5 py-4 gap-3.5 border-b border-border-light last:border-b-0"
          >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
              bc.status === "sent" ? "bg-terracotta" : "bg-surface"
            }`}>
              <Megaphone
                size={18}
                strokeWidth={1.8}
                className={bc.status === "sent" ? "text-cream" : "text-muted"}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink truncate">{bc.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {bc.status === "scheduled" && bc.scheduledAt && (
                  <>
                    <Clock size={12} className="text-terracotta" />
                    <span className="text-[13px] text-terracotta font-medium">
                      {new Date(bc.scheduledAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })} · {new Date(bc.scheduledAt).toLocaleTimeString("en-US", {
                        hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
                {bc.status === "sent" && bc.sentAt && (
                  <span className="text-[13px] text-muted">
                    {new Date(bc.sentAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })} · {new Date(bc.sentAt).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                )}
                {bc.status === "draft" && (
                  <span className="text-[13px] text-muted">No date set</span>
                )}
                {(bc.body || bc.imageUrl) && (
                  <>
                    <span className="w-[3px] h-[3px] rounded-full bg-border" />
                    {bc.body && <MessageSquare size={12} className="text-muted" />}
                    {bc.imageUrl && <Image size={12} className="text-muted" />}
                  </>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {bc.status === "scheduled" && bc.scheduledAt && (
                <span className="text-sm text-muted">
                  In {formatDistanceToNow(new Date(bc.scheduledAt))}
                </span>
              )}
              {bc.status === "sent" && bc._count.deliveries > 0 && (
                <span className="text-sm text-muted">{bc._count.deliveries} delivered</span>
              )}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                bc.status === "sent"
                  ? "bg-sage/10 text-sage"
                  : bc.status === "scheduled"
                  ? "bg-terracotta/10 text-terracotta"
                  : "bg-muted/10 text-muted"
              }`}>
                {bc.status === "sent" ? "Sent" : bc.status === "scheduled" ? "Scheduled" : "Draft"}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted text-sm">
            No broadcasts yet. Create your first one!
          </div>
        )}
      </div>
    </div>
  );
}
