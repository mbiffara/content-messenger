"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Trash2 } from "lucide-react";

interface UserAccount {
  id: string;
  name: string;
  slug: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  memberships: { account: UserAccount }[];
}

interface AccountOption {
  id: string;
  name: string;
  slug: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  account_admin: "Account Admin",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-terracotta/10 text-terracotta",
  account_admin: "bg-sage/10 text-sage",
  admin: "bg-muted/10 text-muted",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<UserRow | null>(null);

  const isSuperAdmin = session?.user?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([u, a]) => {
      setUsers(u);
      setAccounts(a);
      setLoading(false);
    });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20 text-muted">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== id));
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete user");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-[28px] font-bold text-ink">Users</h2>
          <p className="text-muted text-sm mt-1">Manage admin users and their access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      {showCreate && (
        <UserModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onSaved={(user) => {
            setUsers([user, ...users]);
            setShowCreate(false);
          }}
        />
      )}

      {showEdit && (
        <UserModal
          user={showEdit}
          accounts={accounts}
          onClose={() => setShowEdit(null)}
          onSaved={(updated) => {
            setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
            setShowEdit(null);
          }}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-muted text-sm">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="divide-y divide-border-light">
            {users.map((user) => (
              <div
                key={user.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-surface/50 cursor-pointer transition-colors"
                onClick={() => setShowEdit(user)}
              >
                <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center flex-shrink-0 text-white text-sm font-medium">
                  {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{user.name || user.email}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role] || ROLE_COLORS.admin}`}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                  <div className="text-xs text-muted">
                    {user.memberships.length} account{user.memberships.length !== 1 ? "s" : ""}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(user.id, user.email); }}
                    className="p-2 text-muted hover:text-terracotta transition-colors"
                    disabled={user.id === session?.user?.id}
                    title={user.id === session?.user?.id ? "Cannot delete yourself" : "Delete user"}
                  >
                    <Trash2 size={16} className={user.id === session?.user?.id ? "opacity-20" : ""} />
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-5 py-12 text-center text-muted text-sm">
                No users found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserModal({
  user,
  accounts,
  onClose,
  onSaved,
}: {
  user?: UserRow;
  accounts: AccountOption[];
  onClose: () => void;
  onSaved: (user: UserRow) => void;
}) {
  const isEdit = !!user;
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "admin");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    user?.memberships.map((m) => m.account.id) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      email,
      name,
      role,
      accountIds: selectedAccounts,
    };
    if (password) body.password = password;

    const url = isEdit ? `/api/users/${user.id}` : "/api/users";
    const method = isEdit ? "PUT" : "POST";

    if (!isEdit && !password) {
      setError("Password is required for new users");
      setSaving(false);
      return;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // Re-fetch the user with full data
      const usersRes = await fetch("/api/users");
      const allUsers = await usersRes.json();
      const savedUser = allUsers.find((u: UserRow) => u.email === email);
      if (savedUser) onSaved(savedUser);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-semibold text-ink mb-4">
          {isEdit ? "Edit User" : "Create User"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-terracotta text-sm">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              required
            />
          </div>

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
            <label className="block text-sm font-medium text-ink mb-1">
              {isEdit ? "New Password (leave blank to keep)" : "Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
              required={!isEdit}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            >
              <option value="admin">Admin</option>
              <option value="account_admin">Account Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Accounts</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-ink">{account.name}</span>
                  <span className="text-xs text-muted">/{account.slug}</span>
                </label>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-muted">No accounts available</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
