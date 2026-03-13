"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  Sparkles,
  Users,
  Megaphone,
  Settings,
  LogOut,
  Building2,
  UserCog,
  ChevronDown,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/lessons", label: "Lessons", icon: Sparkles },
  { href: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const superAdminItems = [
  { href: "/admin/accounts", label: "Accounts", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: UserCog },
];

interface AccountOption {
  id: string;
  name: string;
  slug: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, update } = useSession();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const isSuperAdmin = session?.user?.role === "super_admin";
  const currentAccountId = session?.user?.currentAccountId;
  const currentAccount = accounts.find((a) => a.id === currentAccountId);

  useEffect(() => {
    fetch("/api/accounts/mine")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAccounts(data);
      })
      .catch(() => {});
  }, []);

  async function switchAccount(accountId: string) {
    await update({ currentAccountId: accountId });
    setShowSwitcher(false);
    window.location.reload();
  }

  return (
    <aside className="w-60 bg-ink text-white min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-lg font-bold tracking-tight">
          Artista del negocio
        </h1>
        <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mt-1">
          Content Messenger
        </p>
      </div>

      {/* Account switcher */}
      {accounts.length > 0 && (
        <div className="px-3 mb-2 relative">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Building2 size={14} strokeWidth={1.8} />
            <span className="flex-1 text-left truncate text-xs">
              {currentAccount?.name || "Select account"}
            </span>
            <ChevronDown size={14} className={`transition-transform ${showSwitcher ? "rotate-180" : ""}`} />
          </button>

          {showSwitcher && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-[#2a2a28] rounded-lg border border-white/10 shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => switchAccount(account.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors ${
                    account.id === currentAccountId ? "text-white" : "text-white/50"
                  }`}
                >
                  <span className="block truncate">{account.name}</span>
                  <span className="block text-[10px] text-white/30">/{account.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mx-5 border-t border-white/10 mb-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={18} strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}

        {/* Super Admin section */}
        {isSuperAdmin && (
          <>
            <div className="mx-0 my-3 border-t border-white/10" />
            <p className="px-3 text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">
              Super Admin
            </p>
            {superAdminItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={18} strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 mt-auto">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {session?.user?.name?.charAt(0) || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">
              {session?.user?.name || "Admin"}
            </p>
            <p className="text-xs text-white/40 truncate">
              {session?.user?.email || ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 w-full transition-colors mt-1"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
