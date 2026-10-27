import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Share2, PlayCircle, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_META,
  categoryMeta,
  getArticle,
  relatedArticles,
  type FetchedArticle,
} from "@/lib/articles";
import { articleCover } from "@/lib/articleImageOverrides";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/learn_/$slug")({
  head: ({ params }) => {
    const a = getArticle(params.slug);
    return { meta: [{ title: a ? `${a.title} — Nima` : "Article — Nima" }] };
  },
  component: ArticleDetail,
});

function ArticleDetail() {
  const { slug } = useParams({ from: "/_app/learn_/$slug" });
  const navigate = useNavigate();
  const staticArticle = getArticle(slug);
  const [fetched, setFetched] = useState<FetchedArticle | null>(null);
  const [loading, setLoading] = useState(!staticArticle);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (staticArticle) return;
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("slug, title, summary, source_name, source_url, category, image, is_curated, fetched_at")
        .eq("slug", slug)
        .maybeSingle();
      setFetched((data ?? null) as FetchedArticle | null);
      setLoading(false);
    })();
  }, [slug, staticArticle]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center text-[#8A6E6B]">
        loading…
      </div>
    );
  }

  if (!staticArticle && !fetched) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center text-[#8A6E6B]">
        <p>This article could not be found.</p>
        <Link to="/learn" search={{}} className="mt-4 inline-block text-[#D4726D] underline">
          Back to library
        </Link>
      </div>
    );
  }

  // Normalize a shared view-model so the layout works for both sources.
  const view = staticArticle
    ? {
        title: staticArticle.title,
        summary: staticArticle.summary,
        body: staticArticle.body,
        image: staticArticle.image,
        category: staticArticle.category as string,
        author: staticArticle.author as string | null,
        readMinutes: staticArticle.readMinutes as number | null,
        hasVideo: !!staticArticle.hasVideo,
        sourceName: null as string | null,
        sourceUrl: null as string | null,
      }
    : {
        title: fetched!.title,
        summary: fetched!.summary,
        body: "",
        image: articleCover(fetched!.slug, fetched!.category, fetched!.image) ?? "",
        category: fetched!.category,
        author: null as string | null,
        readMinutes: null as number | null,
        hasVideo: false,
        sourceName: fetched!.source_name,
        sourceUrl: fetched!.source_url,
      };

  const cat = categoryMeta(view.category);
  const related = staticArticle ? relatedArticles(slug, 2) : [];

  return (
    <div className="mx-auto max-w-md pb-16">
      {/* Hero */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#1A1413]">
        {view.image && (
          <img src={view.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-95" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-6">
          <button
            onClick={() => navigate({ to: "/learn", search: {} })}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <button
              aria-label="Share"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSaved((v) => !v)}
              aria-label="Save"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-white backdrop-blur transition",
                saved ? "bg-[#D4726D]" : "bg-black/40"
              )}
            >
              <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
        </header>

        {view.hasVideo && (
          <button className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#D4726D] shadow-lg">
            <PlayCircle className="h-10 w-10" />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <span
            className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: cat.bg, color: cat.fg }}
          >
            {cat.label}
          </span>
          <h1
            className="mt-3 text-3xl leading-tight"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {view.title}
          </h1>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-white/80">
            {view.readMinutes ? `${view.readMinutes} min read` : "sourced article"}
            {view.author ? ` · by ${view.author}` : ""}
            {view.sourceName ? ` · via ${view.sourceName}` : ""}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-6">
        <p
          className="text-base italic leading-relaxed text-[#5B403D]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          {view.summary}
        </p>

        {view.body && (
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#3D2A28]">
            <p>{view.body}</p>
            <p>
              Take what serves you here and gently leave the rest. Your experience is unique, and
              no article can replace the wisdom your body is teaching you in this season.
            </p>
            <p>
              If something here brings up a question, talk it through with your provider, your
              partner, or with Nima — that's what we're here for.
            </p>
          </div>
        )}

        {/* Read-original link for web-sourced articles */}
        {view.sourceUrl && (
          <a
            href={view.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#FDE7E4] px-4 py-2.5 text-sm font-semibold text-[#D4726D] transition hover:bg-[#FBD6D1]"
          >
            read original
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {view.sourceUrl && view.sourceName && (
          <p className="mt-2 text-[11px] text-[#A8908D]">
            opens {view.sourceName} in a new tab — every insight is sourced.
          </p>
        )}

        {/* Related (static library only) */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2
              className="text-lg text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              you might also like
            </h2>
            <div className="mt-3 space-y-3">
              {related.map((r) => {
                const rc = CATEGORY_META[r.category];
                return (
                  <Link
                    key={r.slug}
                    to="/learn/$slug"
                    params={{ slug: r.slug }}
                    className="flex items-stretch gap-3 overflow-hidden rounded-2xl bg-white shadow-sm"
                  >
                    <img src={r.image} alt="" className="h-24 w-24 shrink-0 object-cover" />
                    <div className="flex-1 p-3">
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: rc.bg, color: rc.fg }}
                      >
                        {rc.label}
                      </span>
                      <h3
                        className="mt-1.5 text-sm leading-snug text-[#3D2A28]"
                        style={{ fontFamily: "ui-serif, Georgia, serif" }}
                      >
                        {r.title}
                      </h3>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-[#8A6E6B]">
                        {r.readMinutes} min
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
