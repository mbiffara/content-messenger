"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Volume2, Image, MessageSquare } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  audioUrl: string | null;
  body: string | null;
  imageUrl: string | null;
  position: number;
  status: string;
  _count: { deliveries: number };
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then(setLessons)
      .finally(() => setLoading(false));
  }, []);

  const filtered = lessons
    .filter((l) => statusFilter === "all" || l.status === statusFilter)
    .sort((a, b) => sortAsc ? a.position - b.position : b.position - a.position);

  async function handleDrop(fromIdx: number, toIdx: number) {
    const sorted = [...lessons].sort((a, b) => a.position - b.position);
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const reordered = sorted.map((l, i) => ({ ...l, position: i + 1 }));
    setLessons(reordered);
    setDragIndex(null);
    setOverIndex(null);

    await fetch("/api/lessons/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((l) => l.id) }),
    });
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted text-sm mb-1">{lessons.length} lessons in sequence</p>
          <h2 className="font-display text-[28px] font-bold text-ink">Lessons</h2>
        </div>
        <Link
          href="/admin/lessons/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta text-white rounded-lg text-sm font-medium hover:bg-terracotta/90 transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          New Lesson
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
            placeholder="Search lessons..."
            className="text-sm bg-transparent outline-none placeholder:text-muted w-48"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-ink appearance-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>

        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 3 18 9"/><polyline points="6 15 12 21 18 15"/>
          </svg>
          {sortAsc ? "First → Last" : "Last → First"}
        </button>

        <span className="ml-auto text-sm text-muted">
          Showing {filtered.length} of {lessons.length}
        </span>
      </div>

      {/* Lessons list */}
      <div className="bg-white rounded-xl border border-border-light overflow-hidden">
        {filtered.map((lesson, idx) => (
          <div
            key={lesson.id}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(idx); }}
            onDrop={() => dragIndex !== null && handleDrop(dragIndex, idx)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            onClick={() => {
              if (dragIndex === null) {
                router.push(lesson.status === "draft"
                  ? `/admin/lessons/${lesson.id}/edit`
                  : `/admin/lessons/${lesson.id}`
                );
              }
            }}
            className={`flex items-center px-5 py-4 gap-3.5 border-b border-border-light last:border-b-0 cursor-pointer hover:bg-surface/50 transition-colors ${
              overIndex === idx ? "bg-surface" : ""
            }`}
          >
            {/* Drag handle */}
            <div className="text-muted/40 cursor-grab active:cursor-grabbing flex-shrink-0">
              <GripVertical size={16} />
            </div>

            {/* Position */}
            <span className="text-sm font-semibold text-muted w-8 text-center flex-shrink-0">
              #{lesson.position}
            </span>

            {/* Icon */}
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
              lesson.status === "published" ? "bg-ink" : "bg-surface"
            }`}>
              <Volume2
                size={18}
                strokeWidth={1.8}
                className={lesson.status === "published" ? "text-cream" : "text-muted"}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink truncate">{lesson.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {lesson.audioUrl && <Volume2 size={12} className="text-muted" />}
                {lesson.imageUrl && <Image size={12} className="text-muted" />}
                {lesson.body && <MessageSquare size={12} className="text-muted" />}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {lesson.status === "published" && lesson._count.deliveries > 0 && (
                <span className="text-sm text-muted">{lesson._count.deliveries} delivered</span>
              )}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                lesson.status === "published"
                  ? "bg-sage/10 text-sage"
                  : "bg-muted/10 text-muted"
              }`}>
                {lesson.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted text-sm">
            No lessons yet. Create your first one!
          </div>
        )}
      </div>
    </div>
  );
}
