"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutGrid,
  Sparkles,
  Users,
  Megaphone,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/lessons", label: "Lessons", icon: Sparkles },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

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
