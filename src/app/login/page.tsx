"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid credentials");
      setLoading(false);
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="w-[560px] bg-ink text-white flex flex-col justify-between p-12 flex-shrink-0">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">
            Artista del negocio
          </h1>
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 mt-1">
            Content Messenger
          </p>
        </div>

        <div>
          <h2 className="font-display text-[42px] leading-[1.15] font-bold tracking-tight">
            Send daily inspiration to your audience.
          </h2>
          <p className="text-white/50 mt-6 text-[15px] leading-relaxed max-w-[360px]">
            Manage your lessons and broadcasts, and deliver them straight to
            your subscribers via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-terracotta" />
          <span className="text-white/30 text-sm">Admin access only</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 bg-cream flex items-center justify-center">
        <div className="w-full max-w-[360px]">
          <h2 className="font-display text-[28px] font-bold text-ink">
            Sign in
          </h2>
          <p className="text-muted text-sm mt-1 mb-8">
            Enter your credentials to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="text-terracotta text-sm">{error}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                placeholder="admin@artista.co"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
