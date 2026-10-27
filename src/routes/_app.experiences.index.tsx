import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, Eye, Trash2, Plus } from "lucide-react";

import {
  listExperiencePosts,
  listMyExperiencePosts,
  deleteMyExperiencePost,
  TOPIC_TAGS,
  type TopicTag,
} from "@/lib/experiences.functions";
import { MascotPortrait } from "@/components/MascotPortrait";
import { ExperienceCover } from "@/components/ExperienceCover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/experiences/")({
  head: () => ({ meta: [{ title: "Women's Experiences — Nima" }] }),
  component: ExperiencesFeed,
});

const TAG_LABEL: Record<TopicTag, string> = {
  sleep: "Sleep",
  feeding: "Feeding",
  "mental-health": "Mental Health",
  recovery: "Recovery",
  relationships: "Relationships",
  "week-1-2": "Week 0–2",
  "week-3-6": "Week 3–6",
  "week-7-12": "Week 7–12",
  "week-13-plus": "Week 13+",
};

// Soft category-tinted badge colors (bg, fg)
const TAG_COLOR: Record<TopicTag, { bg: string; fg: string }> = {
  sleep: { bg: "#E6E8FB", fg: "#5B5FBF" },
  feeding: { bg: "#EFE6F8", fg: "#7A5BB0" },
  "mental-health": { bg: "#FDE7E4", fg: "#B7574F" },
  recovery: { bg: "#DDEFE3", fg: "#3E7A57" },
  relationships: { bg: "#FFE8D6", fg: "#A0612A" },
  "week-1-2": { bg: "#F4EDE7", fg: "#8A6E6B" },
  "week-3-6": { bg: "#F4EDE7", fg: "#8A6E6B" },
  "week-7-12": { bg: "#F4EDE7", fg: "#8A6E6B" },
  "week-13-plus": { bg: "#F4EDE7", fg: "#8A6E6B" },
};

const FEED_FILTERS: Array<{ id: TopicTag | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "sleep", label: "Sleep" },
  { id: "feeding", label: "Feeding" },
  { id: "recovery", label: "Recovery" },
  { id: "mental-health", label: "Mental Health" },
  { id: "relationships", label: "Relationships" },
];

function ExperiencesFeed() {
  const navigate = useNavigate();
  const [view, setView] = useState<"stories" | "mine">("stories");
  const [tag, setTag] = useState<TopicTag | "all">("all");
  const [sort, setSort] = useState<"recent" | "liked">("recent");

  const fetchFeed = useServerFn(listExperiencePosts);
  const fetchMine = useServerFn(listMyExperiencePosts);
  const removePost = useServerFn(deleteMyExperiencePost);

  const feedQuery = useQuery({
    queryKey: ["experiences", tag, sort],
    queryFn: () => fetchFeed({ data: { tag: tag === "all" ? undefined : tag, sort } }),
    enabled: view === "stories",
  });

  const mineQuery = useQuery({
    queryKey: ["experiences-mine"],
    queryFn: () => fetchMine(),
    enabled: view === "mine",
  });

  return (
    <div className="mx-auto max-w-md px-5 pb-24 pt-6">
      {/* Top bar */}
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/learn" })}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-[#5B403D]" />
        </button>
        <Link
          to="/experiences/new"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F38B82] text-white shadow-sm"
          aria-label="Share your experience"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </header>

      {/* Hero */}
      <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-[#FFF6F2] to-[#FFE8E2] p-5 shadow-sm">
        <div className="shrink-0">
          <MascotPortrait state="happy" size="md" accents />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl leading-tight text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            women's<br />experiences
          </h1>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8A6E6B]">
            Real stories from mothers, for mothers.<br />
            You are not alone in this journey.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex border-b border-[#F1D9D5]">
        {(["stories", "mine"] as const).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "relative flex-1 pb-3 pt-1 text-sm font-medium transition",
                active ? "text-[#3D2A28]" : "text-[#A8908D]",
              )}
            >
              {v === "stories" ? "Stories" : "My Posts"}
              {active && (
                <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-[#F38B82]" />
              )}
            </button>
          );
        })}
      </div>

      {view === "stories" && (
        <>
          {/* Sort + filter pills (horizontally scrollable) */}
          <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FEED_FILTERS.map((f) => {
              const active = tag === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setTag(f.id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-[#F38B82] text-white shadow-sm"
                      : "bg-[#FFF1EF] text-[#5B403D]",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <button
              onClick={() => setSort("recent")}
              className={cn(
                "rounded-full px-2.5 py-1",
                sort === "recent" ? "bg-[#1A1413] text-white" : "text-[#8A6E6B]",
              )}
            >
              Recent
            </button>
            <button
              onClick={() => setSort("liked")}
              className={cn(
                "rounded-full px-2.5 py-1",
                sort === "liked" ? "bg-[#1A1413] text-white" : "text-[#8A6E6B]",
              )}
            >
              Most loved
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {feedQuery.isLoading && (
              <p className="text-sm text-[#8A6E6B]">loading stories…</p>
            )}
            {feedQuery.data?.length === 0 && (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <p className="text-sm text-[#8A6E6B]">
                  No stories here yet — yours could be the first.
                </p>
                <Link
                  to="/experiences/new"
                  className="mt-4 inline-block rounded-full bg-[#F38B82] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Share yours
                </Link>
              </div>
            )}
            {feedQuery.data?.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </>
      )}

      {view === "mine" && (
        <div className="mt-5 space-y-3">
          {mineQuery.isLoading && <p className="text-sm text-[#8A6E6B]">loading…</p>}
          {mineQuery.data?.length === 0 && (
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-[#8A6E6B]">
                You haven't shared anything yet.
              </p>
              <Link
                to="/experiences/new"
                className="mt-4 inline-block rounded-full bg-[#F38B82] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white"
              >
                Share your first story
              </Link>
            </div>
          )}
          {mineQuery.data?.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
                    {p.status === "published"
                      ? "Published"
                      : p.status === "pending"
                        ? "In review"
                        : "Not published"}
                  </p>
                  {p.title && (
                    <h3
                      className="mt-1 text-base text-[#3D2A28]"
                      style={{ fontFamily: "ui-serif, Georgia, serif" }}
                    >
                      {p.title}
                    </h3>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B403D]">{p.content}</p>
                  {p.status === "published" && (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-[#8A6E6B]">
                      ♡ {p.like_count} · {p.view_count} views
                    </p>
                  )}
                  {p.status === "pending" && (
                    <p className="mt-2 text-[10px] text-[#B07A2C]">
                      awaiting review — we'll publish it shortly if it's a fit.
                    </p>
                  )}
                </div>
                <button
                  aria-label="Delete"
                  onClick={async () => {
                    if (!confirm("Delete this post? This cannot be undone.")) return;
                    await removePost({ data: { id: p.id } });
                    mineQuery.refetch();
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FDE7E4] text-[#D4726D]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function PostCard({
  post,
}: {
  post: {
    id: string;
    display_name: string;
    title: string | null;
    content: string;
    topic_tags: string[];
    like_count: number;
    view_count: number;
    week_postpartum: number | null;
    cover_image_path?: string | null;
  };
}) {
  const preview =
    post.content.length > 140 ? post.content.slice(0, 140).trimEnd() + "…" : post.content;
  const week = post.week_postpartum;
  const motherLabel =
    week == null
      ? post.display_name
      : week >= 13
        ? `a mother, month ${Math.max(3, Math.floor(week / 4))}`
        : `a mother, week ${week}`;
  const primaryTag = (post.topic_tags[0] ?? null) as TopicTag | null;
  const tagColor = primaryTag ? TAG_COLOR[primaryTag] : null;
  const tagLabel = primaryTag ? TAG_LABEL[primaryTag] : null;

  return (
    <Link
      to="/experiences/$id"
      params={{ id: post.id }}
      className="block overflow-hidden rounded-3xl bg-white shadow-sm transition hover:bg-[#FFF7F5]"
    >
      {post.cover_image_path && (
        <ExperienceCover
          path={post.cover_image_path}
          className="aspect-[16/9] w-full overflow-hidden bg-[#FFE8E2]"
          alt={post.title ?? "Story cover"}
        />
      )}
      <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        {tagLabel && tagColor ? (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: tagColor.bg, color: tagColor.fg }}
          >
            {tagLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] uppercase tracking-wider text-[#D4726D]">
          {motherLabel}
        </span>
      </div>
      {post.title && (
        <h3
          className="mt-3 text-lg leading-snug text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          {post.title}
        </h3>
      )}
      <p className="mt-2 text-sm leading-relaxed text-[#5B403D]">{preview}</p>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-[#8A6E6B]">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5 text-[#D4726D]" /> {formatCount(post.like_count)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> {formatCount(post.view_count)}
        </span>
      </div>
      </div>
    </Link>
  );
}
