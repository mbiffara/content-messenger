"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Building2 } from "lucide-react";

interface Account {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { members: number; subscribers: number };
}

export default function AccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isSuperAdmin = session?.user?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20 text-muted">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });

    if (res.ok) {
      const account = await res.json();
      setAccounts([{ ...account, _count: { members: 0, subscribers: 0 } }, ...accounts]);
      setShowCreate(false);
      setName("");
      setSlug("");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create account");
    }
    setCreating(false);
  }

  async function handleDelete(id: string, accountName: string) {
    if (!confirm(`Delete account "${accountName}" and all its data? This cannot be undone.`)) return;

    const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAccounts(accounts.filter((a) => a.id !== id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-[28px] font-bold text-ink">Accounts</h2>
          <p className="text-muted text-sm mt-1">Manage all accounts in the system</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
        >
          <Plus size={16} />
          New Account
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-4">Create Account</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <p className="text-terracotta text-sm">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  placeholder="acme-corp"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="divide-y divide-border-light">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-surface/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/admin/accounts/${account.id}`)}
              >
                <div className="w-10 h-10 rounded-lg bg-ink flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{account.name}</p>
                  <p className="text-xs text-muted">/{account.slug}</p>
                </div>
                <div className="text-right text-xs text-muted space-y-0.5">
                  <p>{account._count.members} member{account._count.members !== 1 ? "s" : ""}</p>
                  <p>{account._count.subscribers} subscriber{account._count.subscribers !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(account.id, account.name); }}
                  className="p-2 text-muted hover:text-terracotta transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="px-5 py-12 text-center text-muted text-sm">
                No accounts yet. Create your first one!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
