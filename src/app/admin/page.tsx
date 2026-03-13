import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const accountId = auth.accountId;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalSubscribers, broadcastsSentThisMonth, totalLessons, publishedLessons, totalBroadcasts, sentBroadcasts] =
    await Promise.all([
      prisma.subscriber.count({ where: { accountId } }),
      prisma.broadcast.count({ where: { accountId, status: "sent", sentAt: { gte: startOfMonth } } }),
      prisma.lesson.count({ where: { accountId } }),
      prisma.lesson.count({ where: { accountId, status: "published" } }),
      prisma.broadcast.count({ where: { accountId } }),
      prisma.broadcast.count({ where: { accountId, status: "sent" } }),
    ]);

  const recentLessons = await prisma.lesson.findMany({
    where: { accountId },
    orderBy: { position: "asc" },
    take: 5,
    include: { _count: { select: { deliveries: true } } },
  });

  const upcomingBroadcasts = await prisma.broadcast.findMany({
    where: { accountId, status: { in: ["scheduled", "draft"] } },
    orderBy: { scheduledAt: "asc" },
    take: 3,
  });

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });

  const stats = [
    { label: "Subscribers", value: totalSubscribers, sub: `of ${totalSubscribers} total` },
    { label: "Broadcasts Sent", value: broadcastsSentThisMonth, sub: "this month" },
    { label: "Lessons Published", value: publishedLessons, sub: `of ${totalLessons} total` },
    { label: "Total Broadcasts", value: totalBroadcasts, sub: `${sentBroadcasts} sent` },
  ];

  return (
    <div>
      <p className="text-muted text-sm mb-1">
        {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
      <h2 className="font-display text-[28px] font-bold text-ink">
        {account?.name || "Dashboard"}
      </h2>

      <div className="grid grid-cols-4 gap-4 mt-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-border-light p-5"
          >
            <p className="text-sm text-muted">{stat.label}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold text-ink">{stat.value}</p>
              {stat.sub && (
                <span className="text-sm text-sage">{stat.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        {/* Recent Lessons */}
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Recent Lessons</h3>
            <a href="/admin/lessons" className="text-sm text-muted hover:text-ink transition-colors">
              View all
            </a>
          </div>
          <div className="divide-y divide-border-light">
            {recentLessons.map((lesson) => (
              <div key={lesson.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  lesson.status === "published" ? "bg-ink" : "bg-surface"
                }`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={lesson.status === "published" ? "#FAFAF8" : "#8A8A82"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{lesson.title}</p>
                  <p className="text-xs text-muted">#{lesson.position}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  lesson.status === "published"
                    ? "bg-sage/10 text-sage"
                    : "bg-muted/10 text-muted"
                }`}>
                  {lesson.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
            ))}
            {recentLessons.length === 0 && (
              <div className="px-5 py-8 text-center text-muted text-sm">
                No lessons yet. Create your first one!
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Broadcasts */}
        <div className="bg-white rounded-xl border border-border-light overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Upcoming</h3>
            <a href="/admin/broadcasts" className="text-sm text-muted hover:text-ink transition-colors">
              View all
            </a>
          </div>
          <div className="divide-y divide-border-light">
            {upcomingBroadcasts.map((bc) => (
              <div key={bc.id} className="px-5 py-4">
                <p className="text-sm font-medium text-ink">{bc.title}</p>
                <p className="text-xs text-muted mt-1">
                  {bc.scheduledAt
                    ? new Date(bc.scheduledAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })
                    : "No date set"}
                </p>
                <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${
                  bc.status === "scheduled"
                    ? "bg-terracotta/10 text-terracotta"
                    : "bg-muted/10 text-muted"
                }`}>
                  {bc.status === "scheduled" ? "Scheduled" : "Draft"}
                </span>
              </div>
            ))}
            {upcomingBroadcasts.length === 0 && (
              <div className="px-5 py-8 text-center text-muted text-sm">
                No upcoming broadcasts.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
