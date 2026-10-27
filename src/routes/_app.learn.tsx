import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, Search, ArrowRight, PlayCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import {
  ARTICLES,
  CATEGORY_META,
  articlesForAudience,
  categoryMeta,
  type ArticleCategory,
  type FetchedArticle,
} from "@/lib/articles";
import { articleCover } from "@/lib/articleImageOverrides";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/learn")({
  head: () => ({ meta: [{ title: "Wellness Library — Nima" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    seed: s.seed === "true" || s.seed === true ? true : undefined,
  }),
  component: WellnessLibrary,
});

// Library category tabs are based on the web-fetched category vocabulary
// (recovery, mental health, feeding, sleep, relationships, body, milestones).
const MOTHER_TABS: Array<{ id: "all" | string; label: string }> = [
  { id: "all", label: "ALL ARTICLES" },
  { id: "recovery", label: "RECOVERY" },
  { id: "mental health", label: "MENTAL HEALTH" },
  { id: "feeding", label: "FEEDING" },
  { id: "sleep", label: "SLEEP" },
  { id: "relationships", label: "RELATIONSHIPS" },
  { id: "body", label: "BODY" },
  { id: "milestones", label: "MILESTONES" },
];

const PARTNER_TABS: Array<{ id: "all" | ArticleCategory; label: string }> = [
  { id: "all", label: "ALL ARTICLES" },
  { id: "support", label: "SUPPORTING HER" },
  { id: "nutrition", label: "NUTRITION" },
  { id: "wisdom", label: "POSTPARTUM 101" },
  { id: "mood", label: "MENTAL HEALTH" },
  { id: "mindfulness", label: "MINDFULNESS" },
];

function fmtUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function WellnessLibrary() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [role, setRole] = useState<"mother" | "partner">("mother");
  const [tab, setTab] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [fetched, setFetched] = useState<FetchedArticle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadFetched() {
    const { data } = await supabase
      .from("articles")
      .select("slug, title, summary, source_name, source_url, category, image, is_curated, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(50);
    setFetched((data ?? []) as FetchedArticle[]);
  }

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const id = sess.session?.user.id;
      if (id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", id)
          .maybeSingle();
        if (prof?.role === "partner") setRole("partner");
      }
      await loadFetched();
    })();
  }, []);

  // Hidden admin trigger: /learn?seed=true (signed-in users only)
  useEffect(() => {
    if (!search.seed) return;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Sign in to refresh the library.");
        navigate({ to: "/learn", search: {} });
        return;
      }
      setRefreshing(true);
      toast("Fetching fresh articles from authoritative sources…");
      try {
        const { data, error } = await supabase.functions.invoke("fetch-weekly-articles", {
          body: {},
        });
        if (error) throw new Error(error.message);
        if (data?.ok === false) throw new Error(data.error ?? "Unknown error");
        toast.success(`Library refreshed — ${data?.inserted ?? 0} articles updated.`);
        await loadFetched();
      } catch (err) {
        toast.error((err as Error).message ?? "Refresh failed");
      } finally {
        setRefreshing(false);
        navigate({ to: "/learn", search: {} });
      }
    })();
  }, [search.seed, navigate]);

  const TABS = role === "partner" ? PARTNER_TABS : MOTHER_TABS;

  const lastUpdated = useMemo(() => {
    if (role === "partner") return null;
    return fetched[0]?.fetched_at ? fmtUpdated(fetched[0].fetched_at) : null;
  }, [fetched, role]);

  // For mother view we show the web-fetched library; for partner view we keep
  // the static curated partner articles (audience-aware).
  const partnerAudience = useMemo(() => articlesForAudience("partner"), []);

  const filteredMother = useMemo(() => {
    let list = fetched;
    if (tab !== "all") list = list.filter((a) => a.category === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
      );
    }
    return list;
  }, [fetched, tab, query]);

  const filteredPartner = useMemo(() => {
    let list = partnerAudience;
    if (tab !== "all") list = list.filter((a) => a.category === (tab as ArticleCategory));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
      );
    }
    return list;
  }, [partnerAudience, tab, query]);

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MascotPortrait state="happy" size="sm" accents={false} />
          <span
            className="text-xl italic text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            Nima
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Search"
            onClick={() => setSearchOpen((s) => !s)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <Search className="h-4 w-4 text-[#5B403D]" />
          </button>
          <button
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <Bell className="h-4 w-4 text-[#5B403D]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F38B82]" />
          </button>
        </div>
      </header>

      <h1
        className="text-3xl font-medium leading-tight text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        {role === "partner" ? "Partner Library" : "Wellness Library"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#8A6E6B]">
        {role === "partner" ? (
          <>Practical ways to support her.<br />Postpartum, nutrition, and mental health.</>
        ) : (
          <>Sourced from leading postpartum-care organizations.<br />Refreshed every Sunday.</>
        )}
      </p>

      {/* Updated caption + manual refresh state */}
      {role === "mother" && (
        <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#A8908D]">
          {refreshing ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin" />
              refreshing library…
            </>
          ) : lastUpdated ? (
            <>updated {lastUpdated}</>
          ) : (
            <>library not yet populated</>
          )}
        </p>
      )}

      {role === "mother" && (
        <Link
          to="/experiences"
          className="group mt-4 block overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF1EF] via-[#FFE6E1] to-[#FDD9D2] shadow-sm transition hover:shadow-md"
        >
          <div className="relative flex items-center gap-4 p-5">
            <div className="shrink-0">
              <MascotPortrait state="happy" size="md" accents />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4726D]">
                Women's Experiences
              </p>
              <p
                className="mt-1 text-lg leading-tight text-[#3D2A28]"
                style={{ fontFamily: "ui-serif, Georgia, serif" }}
              >
                in her own words
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#8A6E6B]">
                Real stories from mothers, for mothers.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#D4726D] transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      )}

      {searchOpen && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search articles"
          className="mt-4 w-full rounded-full border border-[#F1D9D5] bg-white px-4 py-2 text-sm text-[#3D2A28] placeholder:text-[#A8908D] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
        />
      )}

      {/* Filter pills */}
      <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={String(t.id)}
              onClick={() => setTab(t.id as string)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-wider transition",
                active
                  ? "bg-[#1A1413] text-white"
                  : "bg-white text-[#5B403D] hover:bg-[#FFEEEB]",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Article list */}
      {role === "mother" ? (
        <section className="mt-6 space-y-3">
          {filteredMother.length === 0 && !refreshing && (
            <p className="rounded-2xl bg-white p-5 text-center text-xs text-[#8A6E6B]">
              No articles yet. The library refreshes every Sunday.
            </p>
          )}
          {filteredMother.map((a) => (
            <FetchedCard key={a.slug} article={a} />
          ))}
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {filteredPartner.map((a) => (
            <ArticleMediumCard key={a.slug} article={a} />
          ))}
        </section>
      )}
    </div>
  );
}

function FetchedCard({ article }: { article: FetchedArticle }) {
  const cat = categoryMeta(article.category);
  const cover = articleCover(article.slug, article.category, article.image);
  return (
    <Link
      to="/learn/$slug"
      params={{ slug: article.slug }}
      className="block overflow-hidden rounded-3xl bg-[#1A1413] shadow-sm"
    >
      <div className="relative aspect-[16/10] w-full">
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-95"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: cat.bg, color: cat.fg }}
          >
            {cat.label}
          </span>
          <h3
            className="mt-2 text-lg leading-tight"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {article.title}
          </h3>
          {article.source_name && (
            <p className="mt-1 text-[11px] tracking-wider text-white/70">
              via {article.source_name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function ArticleMediumCard({ article }: { article: typeof ARTICLES[number] }) {
  const cat = CATEGORY_META[article.category];
  return (
    <Link
      to="/learn/$slug"
      params={{ slug: article.slug }}
      className="block overflow-hidden rounded-3xl bg-[#1A1413] shadow-sm"
    >
      <div className="relative aspect-[16/10] w-full">
        <img
          src={article.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        {article.hasVideo && (
          <PlayCircle className="absolute right-3 top-3 h-7 w-7 text-white/90" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: cat.bg, color: cat.fg }}
          >
            {cat.label}
          </span>
          <h3
            className="mt-2 text-lg leading-tight"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {article.title}
          </h3>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-white/80">
            {article.readMinutes} min read{article.hasVideo ? " · video included" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
