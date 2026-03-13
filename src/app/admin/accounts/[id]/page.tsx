"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

interface AccountDetail {
  id: string;
  name: string;
  slug: string;
  whatsappSessionId: string;
  createdAt: string;
  members: { id: string; user: { id: string; name: string | null; email: string; role: string } }[];
  _count: { subscribers: number; lessons: number; broadcasts: number };
}

export default function AccountDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = session?.user?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin || !params.id) return;
    fetch(`/api/accounts/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setAccount(data);
        setName(data.name);
        setSlug(data.slug);
      })
      .finally(() => setLoading(false));
  }, [isSuperAdmin, params.id]);

  if (!isSuperAdmin) {
    return <div className="text-center py-20 text-muted">No permission.</div>;
  }

  async function handleSave() {
    if (!account) return;
    setSaving(true);
    await fetch(`/api/accounts/${account.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    setSaving(false);
  }

  if (loading) return <div className="text-center py-12 text-muted text-sm">Loading...</div>;
  if (!account) return <div className="text-center py-12 text-muted text-sm">Account not found.</div>;

  return (
    <div>
      <button
        onClick={() => router.push("/admin/accounts")}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Back to accounts
      </button>

      <h2 className="font-display text-[28px] font-bold text-ink mb-6">{account.name}</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border-light p-5">
          <p className="text-sm text-muted">Subscribers</p>
          <p className="text-3xl font-bold text-ink mt-2">{account._count.subscribers}</p>
        </div>
        <div className="bg-white rounded-xl border border-border-light p-5">
          <p className="text-sm text-muted">Lessons</p>
          <p className="text-3xl font-bold text-ink mt-2">{account._count.lessons}</p>
        </div>
        <div className="bg-white rounded-xl border border-border-light p-5">
          <p className="text-sm text-muted">Broadcasts</p>
          <p className="text-3xl font-bold text-ink mt-2">{account._count.broadcasts}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-light p-6 mb-6">
        <h3 className="font-display text-lg font-semibold text-ink mb-4">Account Details</h3>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">WhatsApp Session ID</label>
            <input
              type="text"
              value={account.whatsappSessionId}
              readOnly
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-lg text-[15px] text-muted"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-light overflow-hidden">
        <div className="px-5 py-4 border-b border-border-light">
          <h3 className="font-display text-lg font-semibold text-ink">Members</h3>
        </div>
        <div className="divide-y divide-border-light">
          {account.members.map((m) => (
            <div key={m.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {m.user.name?.charAt(0) || m.user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{m.user.name || m.user.email}</p>
                <p className="text-xs text-muted">{m.user.email}</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted/10 text-muted">
                {m.user.role === "super_admin" ? "Super Admin" : m.user.role === "account_admin" ? "Account Admin" : "Admin"}
              </span>
            </div>
          ))}
          {account.members.length === 0 && (
            <div className="px-5 py-8 text-center text-muted text-sm">
              No members assigned to this account.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
