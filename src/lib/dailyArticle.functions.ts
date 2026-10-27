import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DailySuggestion {
  slug: string;
  title: string;
  summary: string;
  category: string;
  source_name: string | null;
  source_url: string | null;
  image: string | null;
}

export const getDailySuggestedArticle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailySuggestion | null> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Already picked today? return it.
    const { data: existing } = await supabase
      .from("daily_article_suggestions")
      .select("slug")
      .eq("user_id", userId)
      .eq("shown_date", today)
      .maybeSingle();

    if (existing?.slug) {
      const { data: hit } = await supabase
        .from("articles")
        .select("slug, title, summary, category, source_name, source_url, image")
        .eq("slug", existing.slug)
        .maybeSingle();
      if (hit) return hit as DailySuggestion;
    }

    // 2. Avoid repeating articles shown in the last 14 days.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data: recent } = await supabase
      .from("daily_article_suggestions")
      .select("slug")
      .eq("user_id", userId)
      .gte("shown_date", fourteenDaysAgo);
    const recentSlugs = new Set((recent ?? []).map((r) => r.slug));

    // 3. Pick from the latest web-sourced library.
    const { data: pool } = await supabase
      .from("articles")
      .select("slug, title, summary, category, source_name, source_url, image, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(50);

    const candidates = (pool ?? []).filter((a) => !recentSlugs.has(a.slug));
    const picked = (candidates.length > 0 ? candidates : pool ?? [])[
      // Deterministic-by-day pick so multiple opens today return the same article
      hash(`${userId}-${today}`) % Math.max(1, (candidates.length > 0 ? candidates.length : pool?.length ?? 1))
    ];

    if (!picked) return null;

    await supabase
      .from("daily_article_suggestions")
      .upsert(
        { user_id: userId, shown_date: today, slug: picked.slug },
        { onConflict: "user_id,shown_date" },
      );

    return {
      slug: picked.slug,
      title: picked.title,
      summary: picked.summary,
      category: picked.category,
      source_name: picked.source_name,
      source_url: picked.source_url,
      image: picked.image,
    };
  });

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
