"use client";

import { useEffect, useState, useRef } from "react";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  ghostId: string | null;
  active: boolean;
  currentPosition: number;
  createdAt: string;
  note?: string | null;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", name: "", phone: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      const res = await fetch("/api/subscribers", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Deleted ${data.deleted} subscribers`);
        fetchSubscribers();
      } else {
        setSyncResult(data.error || "Delete failed");
      }
    } catch {
      setSyncResult("Delete failed");
    }
    setDeleting(false);
    setDeleteModalOpen(false);
    setDeleteConfirmText("");
  }

  async function handleAddSubscriber() {
    if (!addForm.email) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        setAddModalOpen(false);
        setAddForm({ email: "", name: "", phone: "" });
        fetchSubscribers();
      } else {
        setAddError(data.error || "Failed to add subscriber");
      }
    } catch {
      setAddError("Failed to add subscriber");
    }
    setAdding(false);
  }

  function fetchSubscribers() {
    setLoading(true);
    fetch("/api/subscribers")
      .then((r) => r.json())
      .then(setSubscribers)
      .finally(() => setLoading(false));
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncStep(null);
    try {
      const res = await fetch("/api/subscribers/sync", { method: "POST" });

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/);
            if (!match) continue;
            const data = JSON.parse(match[1]);

            if (data.step) {
              setSyncStep(data.step);
            }
            if (data.done) {
              setSyncResult(`Synced ${data.synced} members (${data.created} new, ${data.updated} updated, ${data.deactivated || 0} deactivated)`);
              setLastSynced(new Date());
              fetchSubscribers();
            }
            if (data.error) {
              setSyncResult(data.error);
            }
          }
        }
      } else {
        const data = await res.json();
        if (res.ok) {
          setSyncResult(`Synced ${data.synced} members (${data.created} new, ${data.updated} updated)`);
          setLastSynced(new Date());
          fetchSubscribers();
        } else {
          setSyncResult(data.error || "Sync failed");
        }
      }
    } catch {
      setSyncResult("Sync failed — check your connection settings");
    }
    setSyncing(false);
    setSyncStep(null);
  }

  async function updatePhone(id: string) {
    await fetch("/api/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, phone: phoneValue || null }),
    });
    setEditingPhone(null);
    fetchSubscribers();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch("/api/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchSubscribers();
  }

  function formatLastSynced() {
    if (!lastSynced) return null;
    const diff = Math.floor((Date.now() - lastSynced.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff === 1) return "1 min ago";
    return `${diff} min ago`;
  }

  const filtered = subscribers
    .filter((s) => {
      if (statusFilter === "active") return s.active;
      if (statusFilter === "inactive") return !s.active;
      if (statusFilter === "whatsapp") return s.active && s.phone;
      return true;
    })
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    });

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted text-sm mb-1">{subscribers.length} total subscribers</p>
          <h2 className="font-display text-[28px] font-bold text-ink">Subscribers</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Actions dropdown */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setActionsOpen(!actionsOpen)}
              className="inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg text-muted hover:bg-surface hover:text-ink transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border-light rounded-lg shadow-lg z-10 py-1">
                <button
                  onClick={() => { setDeleteModalOpen(true); setActionsOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-terracotta hover:bg-terracotta/5 transition-colors"
                >
                  Delete All Subscribers
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-ink hover:bg-surface disabled:opacity-50 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "animate-spin" : ""}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {syncing ? "Syncing..." : "Sync Subscribers"}
          </button>
          <button
            onClick={() => { setAddModalOpen(true); setAddError(null); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-lg text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            Add Manually
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          syncResult.startsWith("Synced") ? "bg-sage/10 text-sage" : "bg-terracotta/10 text-terracotta"
        }`}>
          {syncResult}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-border rounded-lg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8A82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm bg-transparent outline-none placeholder:text-muted w-56"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-ink appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="whatsapp">WhatsApp ready</option>
        </select>

        {(syncing || lastSynced) && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted">
            {syncing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>{syncStep || "Starting sync..."}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-sage" />
                Last synced {formatLastSynced()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border-light overflow-hidden">
        {/* Table header */}
        <div className="flex items-center px-5 py-3 border-b border-border-light">
          <span className="w-[180px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Name</span>
          <span className="w-[220px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Email</span>
          <span className="w-[150px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">WhatsApp</span>
          <span className="w-[100px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Status</span>
          <span className="w-[110px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Joined</span>
          <span className="w-[70px] shrink-0 text-[11px] font-semibold text-muted uppercase tracking-wider">Enabled</span>
          <span className="w-[40px] shrink-0" />
        </div>

        {/* Table rows */}
        {filtered.map((sub) => (
          <div key={sub.id}>
            <div
              className={`flex items-center px-5 py-3.5 border-b border-border-light last:border-b-0 cursor-pointer hover:bg-surface/50 transition-colors ${
                !sub.active ? "opacity-60" : ""
              }`}
              onClick={() => setExpandedRow(expandedRow === sub.id ? null : sub.id)}
            >
              {/* Name */}
              <div className="w-[180px] shrink-0 flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#E8D5CF" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "#C45D3E" }}>
                    {sub.name ? sub.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </span>
                </div>
                <span className={`text-[14px] font-medium truncate ${sub.active ? "text-ink" : "text-muted"}`}>
                  {sub.name || "—"}
                </span>
              </div>

              {/* Email */}
              <span className="w-[220px] shrink-0 text-[14px] text-muted truncate">{sub.email}</span>

              {/* WhatsApp */}
              <div className="w-[150px] shrink-0" onClick={(e) => e.stopPropagation()}>
                {editingPhone === sub.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      placeholder="+1234567890"
                      className="w-28 px-2 py-1 border border-border rounded-md text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updatePhone(sub.id);
                        if (e.key === "Escape") setEditingPhone(null);
                      }}
                    />
                    <button onClick={() => updatePhone(sub.id)} className="text-xs text-sage font-medium hover:text-sage/80">Save</button>
                    <button onClick={() => setEditingPhone(null)} className="text-xs text-muted hover:text-ink">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingPhone(sub.id); setPhoneValue(sub.phone || ""); }}
                    className="flex items-center gap-1.5 text-[14px] text-muted hover:text-ink transition-colors"
                  >
                    {sub.phone ? (
                      <>
                        {sub.phone}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                          <path d="m15 5 4 4"/>
                        </svg>
                      </>
                    ) : (
                      <span className="text-terracotta">+ Add number</span>
                    )}
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="w-[100px] shrink-0">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-surface text-muted">
                  Free
                </span>
              </div>

              {/* Joined */}
              <span className="w-[110px] shrink-0 text-[13px] text-muted">
                {new Date(sub.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>

              {/* Enabled toggle */}
              <div className="w-[70px] shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleActive(sub.id, sub.active)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    sub.active ? "bg-sage" : "bg-[#D8D8D4]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      sub.active ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Menu */}
              <div className="w-[40px] shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <button className="p-1 rounded hover:bg-surface transition-colors text-muted hover:text-ink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="19" cy="12" r="2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Expandable detail panel */}
            {expandedRow === sub.id && (
              <div className="px-5 py-4 border-b border-border-light" style={{ backgroundColor: "#F7F6F3" }}>
                <div className="grid grid-cols-4 gap-x-8 gap-y-4">
                  {sub.ghostId && (
                    <div>
                      <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Ghost ID</span>
                      <span className="text-[13px] text-ink font-mono">{sub.ghostId}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">UUID</span>
                    <span className="text-[13px] text-ink font-mono">{sub.id}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Newsletter</span>
                    <span className="text-[13px] text-ink">{sub.active ? "Subscribed" : "Unsubscribed"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Current Position</span>
                    <span className="text-[13px] text-ink">{sub.currentPosition}</span>
                  </div>
                  {sub.note && (
                    <div className="col-span-4">
                      <span className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Note</span>
                      <span className="text-[13px] text-ink">{sub.note}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted text-sm">
            {subscribers.length === 0
              ? "No subscribers yet. Sync from your provider to get started."
              : "No subscribers match your filters."}
          </div>
        )}
      </div>

      {/* Delete All Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/40" onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-[420px] p-6">
            <h3 className="font-display text-lg font-bold text-ink">Delete All Subscribers</h3>
            <p className="text-sm text-muted mt-2">
              This will permanently delete all subscribers and their delivery history. This action cannot be undone.
            </p>
            <p className="text-sm text-ink mt-4">
              Type <span className="font-mono font-semibold text-terracotta">delete all</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full mt-2 px-3.5 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/20 focus:border-terracotta/40"
              placeholder="delete all"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setDeleteModalOpen(false); setDeleteConfirmText(""); }}
                className="px-4 py-2 text-sm font-medium text-ink hover:bg-surface rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteConfirmText !== "delete all" || deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-terracotta rounded-lg hover:bg-terracotta/90 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subscriber Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/40" onClick={() => { setAddModalOpen(false); setAddForm({ email: "", name: "", phone: "" }); setAddError(null); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-[420px] p-6">
            <h3 className="font-display text-lg font-bold text-ink">Add Subscriber</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30"
                  placeholder="email@example.com"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">Phone</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-border rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30"
                  placeholder="+1234567890"
                />
              </div>
            </div>
            {addError && (
              <p className="text-sm text-terracotta mt-3">{addError}</p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => { setAddModalOpen(false); setAddForm({ email: "", name: "", phone: "" }); setAddError(null); }}
                className="px-4 py-2 text-sm font-medium text-ink hover:bg-surface rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscriber}
                disabled={!addForm.email || adding}
                className="px-4 py-2 text-sm font-semibold text-white bg-ink rounded-lg hover:bg-ink/90 disabled:opacity-40 transition-colors"
              >
                {adding ? "Adding..." : "Add Subscriber"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
