import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, Eye, Trash2, Shield, Share2, MoreHorizontal } from "lucide-react";

import {
  getExperiencePost,
  listExperiencePosts,
  recordExperienceView,
  toggleExperienceLike,
  deleteMyExperiencePost,
  type TopicTag,
} from "@/lib/experiences.functions";
import { ExperienceCover } from "@/components/ExperienceCover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/experiences/$id")({
  head: () => ({ meta: [{ title: "A mother's story — Nima" }] }),
  component: ExperienceDetail,
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

const TAG_PILL = "rounded-full bg-[#F4EDE7] px-3 py-1 text-[11px] font-medium text-[#5B403D]";

function motherLabel(displayName: string, week: number | null): string {
  if (week == null) return displayName;
  if (week >= 13) return `a mother, month ${Math.max(3, Math.floor(week / 4))}`;
  return `a mother, week ${week}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Posted ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Posted ${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `Posted ${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function ExperienceDetail() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const fetchPost = useServerFn(getExperiencePost);
  const recordView = useServerFn(recordExperienceView);
  const toggleLike = useServerFn(toggleExperienceLike);
  const removePost = useServerFn(deleteMyExperiencePost);
  const fetchFeed = useServerFn(listExperiencePosts);

  const { data: post } = useQuery({
    queryKey: ["experience", id],
    queryFn: () => fetchPost({ data: { id } }),
  });

  const { data: related } = useQuery({
    queryKey: ["experiences-related"],
    queryFn: () => fetchFeed({ data: { sort: "recent", limit: 8 } }),
  });

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (post) {
      setLiked(post.liked_by_me);
      setLikeCount(post.like_count);
      if (!post.viewed_by_me && !post.is_mine) {
        recordView({ data: { id } }).catch(() => undefined);
      }
    }
  }, [post, id, recordView]);

  if (post === null) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center text-sm text-[#8A6E6B]">
        <p>This story isn't here anymore.</p>
        <button
          onClick={() => navigate({ to: "/experiences" })}
          className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-semibold tracking-wider text-[#5B403D] shadow-sm"
        >
          back to stories
        </button>
      </div>
    );
  }
  if (!post) {
    return <div className="mx-auto max-w-md px-5 pt-10 text-sm text-[#8A6E6B]">loading…</div>;
  }

  async function onLike() {
    setLiked((l) => !l);
    setLikeCount((c) => (liked ? Math.max(0, c - 1) : c + 1));
    try {
      const res = await toggleLike({ data: { id } });
      setLiked(res.liked);
    } catch {
      setLiked((l) => !l);
      setLikeCount((c) => (liked ? c + 1 : Math.max(0, c - 1)));
    }
  }

  async function onDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    await removePost({ data: { id } });
    navigate({ to: "/experiences" });
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = post && post.title ? post.title : "A mother's story on Nima";
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or unsupported — fall back to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied");
    }
  }

  const author = motherLabel(post.display_name, post.week_postpartum);
  const moreStories = (related ?? []).filter((p) => p.id !== id).slice(0, 3);

  return (
    <div className="mx-auto max-w-md px-5 pb-24 pt-6">
      {/* Top bar */}
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/experiences" })}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-[#5B403D]" />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((m) => !m)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="More"
          >
            <MoreHorizontal className="h-4 w-4 text-[#5B403D]" />
          </button>
          {menuOpen && post.is_mine && (
            <div className="absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl bg-white shadow-lg">
              <button
                onClick={onDelete}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-[#D4726D] hover:bg-[#FDE7E4]"
              >
                <Trash2 className="h-4 w-4" /> Delete post
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Author */}
      <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6F8] text-[#7A5BB0]">
          <span className="text-lg" aria-hidden>🌷</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#3D2A28]">{author}</p>
          <p className="text-[11px] text-[#A8908D]">{timeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Cover */}
      {(post as { cover_image_path?: string | null }).cover_image_path && (
        <div className="mt-4">
          <ExperienceCover
            path={(post as { cover_image_path?: string | null }).cover_image_path}
            className="aspect-[16/9] w-full overflow-hidden rounded-3xl bg-[#FFE8E2]"
            alt={post.title ?? "Story cover"}
          />
        </div>
      )}

      {/* Tags */}
      {post.topic_tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.topic_tags.map((t) => (
            <span key={t} className={TAG_PILL}>
              {TAG_LABEL[t as TopicTag] ?? t}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      {post.title && (
        <h1
          className="mt-4 text-3xl leading-tight text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          {post.title}
        </h1>
      )}

      {/* Body */}
      <article className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[#3D2A28]">
        {post.content}
      </article>

      {/* Engagement */}
      <div className="mt-6 flex items-center gap-5">
        <button
          onClick={onLike}
          disabled={post.is_mine}
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition",
            liked ? "text-[#D4726D]" : "text-[#5B403D]",
            post.is_mine && "opacity-60",
          )}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          {likeCount} likes
        </button>
        <span className="flex items-center gap-2 text-sm text-[#8A6E6B]">
          <Eye className="h-5 w-5" /> {post.view_count} views
        </span>
      </div>

      {/* Moderation banner */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#EFE6F8] p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#7A5BB0]">
          <Shield className="h-4 w-4" />
        </div>
        <p className="text-[12px] leading-relaxed text-[#5B403D]">
          Every story shared here is moderated to keep this space safe, kind, and supportive.
        </p>
      </div>

      {/* Related */}
      {moreStories.length > 0 && (
        <section className="mt-7">
          <h3
            className="text-base font-medium text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            More stories you might relate to
          </h3>
          <div className="mt-3 -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {moreStories.map((p) => (
              <Link
                key={p.id}
                to="/experiences/$id"
                params={{ id: p.id }}
                className="block w-44 shrink-0 rounded-2xl bg-white p-3 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFE8E2] text-lg" aria-hidden>
                  🌿
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-[#D4726D]">
                  {motherLabel(p.display_name, p.week_postpartum)}
                </p>
                {p.title && (
                  <h4
                    className="mt-1 line-clamp-2 text-sm leading-snug text-[#3D2A28]"
                    style={{ fontFamily: "ui-serif, Georgia, serif" }}
                  >
                    {p.title}
                  </h4>
                )}
                {p.topic_tags[0] && (
                  <span className="mt-2 inline-block rounded-full bg-[#F4EDE7] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#8A6E6B]">
                    {TAG_LABEL[p.topic_tags[0] as TopicTag] ?? p.topic_tags[0]}
                  </span>
                )}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-[#8A6E6B]">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {p.like_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {p.view_count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bottom action bar */}
      <div className="mt-8 flex items-center justify-center gap-8 border-t border-[#F1D9D5] pt-5 text-[12px] uppercase tracking-wider text-[#8A6E6B]">
        <button
          onClick={onShare}
          className="flex items-center gap-2 transition hover:text-[#5B403D]"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-[#A8908D]">
        This is a space for reading and witnessing.<br />
        No replies, no comments — just stories, held gently.
      </p>
    </div>
  );
}
