import { Sidebar } from "@/components/sidebar";
import { AuthSessionProvider } from "@/components/session-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-cream">
          <div className="max-w-[1104px] mx-auto px-12 py-8">
            {children}
          </div>
        </main>
      </div>
    </AuthSessionProvider>
  );
}
