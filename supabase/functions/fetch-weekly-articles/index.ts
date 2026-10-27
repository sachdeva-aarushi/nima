// Weekly fetch of postpartum-care articles via Lovable AI Gateway + web search.
// Triggered by pg_cron every Sunday 06:00 UTC, or on-demand from the in-app
// admin "?seed=true" shortcut.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ALLOWED_CATEGORIES = new Set([
  "recovery",
  "mental health",
  "feeding",
  "sleep",
  "relationships",
  "body",
  "milestones",
]);

const CATEGORY_IMAGE: Record<string, string> = {
  recovery: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=70",
  "mental health": "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=800&q=70",
  feeding: "https://images.unsplash.com/photo-1444212477490-ca407925329e?auto=format&fit=crop&w=800&q=70",
  sleep: "https://images.unsplash.com/photo-1455642305367-68834a1da7ab?auto=format&fit=crop&w=800&q=70",
  relationships: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=70",
  body: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=70",
  milestones: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=70",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface RawArticle {
  title?: unknown;
  source_name?: unknown;
  source?: unknown;
  url?: unknown;
  source_url?: unknown;
  summary?: unknown;
  category?: unknown;
}

interface CleanArticle {
  slug: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  category: string;
  image: string;
  is_curated: boolean;
  fetched_at: string;
}

function extractJsonArray(text: string): RawArticle[] | null {
  if (!text) return null;
  // Strip markdown fences if present.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  // Find first '[' and matching ']' for safety.
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as RawArticle[]) : null;
  } catch {
    return null;
  }
}

function validate(raw: RawArticle[]): CleanArticle[] {
  const out: CleanArticle[] = [];
  const fetchedAt = new Date().toISOString();
  for (const r of raw) {
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const summary = typeof r.summary === "string" ? r.summary.trim() : "";
    const sourceName =
      typeof r.source_name === "string"
        ? r.source_name.trim()
        : typeof r.source === "string"
        ? r.source.trim()
        : "";
    const url =
      typeof r.source_url === "string"
        ? r.source_url.trim()
        : typeof r.url === "string"
        ? r.url.trim()
        : "";
    const category =
      typeof r.category === "string" ? r.category.trim().toLowerCase() : "";

    if (!title || !summary || !sourceName || !url || !category) continue;
    if (!ALLOWED_CATEGORIES.has(category)) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }

    out.push({
      slug: slugify(`${title}-${sourceName}`),
      title: title.slice(0, 200),
      summary: summary.slice(0, 600),
      source_name: sourceName.slice(0, 100),
      source_url: url.slice(0, 500),
      category,
      image: CATEGORY_IMAGE[category] ?? CATEGORY_IMAGE.recovery,
      is_curated: false,
      fetched_at: fetchedAt,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!lovableKey || !supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Service unavailable." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // AUTH GATE: cron and admin trigger must present the service role key as a
  // Bearer token. Arbitrary authenticated users cannot fire this fn and burn AI credits.
  const authHeader = req.headers.get("authorization") ?? "";
  const presented = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!presented || presented !== serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const prompt = `Find 5 high-quality, recent articles about postpartum health and recovery from authoritative sources (ACOG, Postpartum Support International, Mayo Clinic, NHS, Cleveland Clinic, or peer-reviewed journals).

For each article return: title, source_name, source_url (the real article URL — must be a real, working https link to the original article), summary (a 2-sentence plain-language summary suitable for new mothers), and one category tag from: recovery, mental health, feeding, sleep, relationships, body, milestones.

Return ONLY a JSON array of 5 objects with keys: title, source_name, source_url, summary, category. No prose, no markdown fences, no commentary.`;

  let aiText = "";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a postpartum-care research assistant. Use web search to find real, recent, authoritative articles. Always return only valid JSON when asked. Never invent URLs — only return URLs you have actually retrieved from web search results.",
          },
          { role: "user", content: prompt },
        ],
        tools: [{ type: "google_search" }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (res.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: "AI gateway rate limit. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: "AI credits exhausted. Add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: false,
          error: `AI gateway error (${res.status}): ${errBody.slice(0, 300)}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    aiText = json?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: `AI request failed: ${(err as Error).message}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const raw = extractJsonArray(aiText);
  if (!raw) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "AI response was not valid JSON",
        sample: aiText.slice(0, 400),
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const articles = validate(raw);
  if (articles.length === 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No valid articles after validation",
        sample: aiText.slice(0, 400),
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await sb
    .from("articles")
    .upsert(articles, { onConflict: "slug" });

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: `db error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      inserted: articles.length,
      fetched_at: articles[0].fetched_at,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
