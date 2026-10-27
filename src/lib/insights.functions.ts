import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InsightType = "pattern" | "preference" | "context" | "concern";
export type InsightConfidence = "low" | "medium" | "high";

export interface MotherInsight {
  id: string;
  insight_type: InsightType;
  insight_text: string;
  source: string;
  confidence: InsightConfidence;
  first_observed_at: string;
  last_confirmed_at: string;
  active: boolean;
}

const EXTRACTION_SYSTEM = `You are an "insight extractor" for a postpartum companion app called Nima.
Your job: read a short interaction (a chat exchange, a check-in, or a quiz result) and identify
AT MOST 1-2 atomic, neutral, useful facts about the mother that would help Nima feel continuous
across sessions.

STRICT RULES
- Each insight: <= 15 words, plain factual statement, neutral tone.
- NEVER a diagnosis, clinical interpretation, value judgment, or speculation about mental state
  beyond what she explicitly said.
- NEVER include medication names, vitals, lab values, or anything that belongs to her clinical record.
- Each insight must fit exactly one category:
   - "pattern": a recurring behaviour or timing she's shown (e.g. "tends to feel low in the evenings").
   - "preference": how she likes Nima to interact (e.g. "prefers practical suggestions over comfort").
   - "context": a life fact she mentioned (e.g. "returning to work in 3 weeks", "has a toddler at home").
   - "concern": a recurring worry or topic (e.g. "has mentioned breastfeeding difficulty multiple times").
- If nothing meaningful stands out, return {"insights":[]}. Do NOT force an insight.

OUTPUT
Strict JSON only, no prose, no fences:
{"insights":[{"type":"pattern|preference|context|concern","text":"..."}]}`;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bs?he\b|\bher\b|\bhim\b|\bhis\b|\bthe\b|\ba\b|\ban\b|\band\b|\bor\b|\bbut\b|\bwith\b|\bfor\b|\bfrom\b|\bat\b|\bin\b|\bon\b|\bto\b|\bof\b|\babout\b|\bis\b|\bam\b|\bare\b|\bbeen\b|\bhave\b|\bhas\b|\bhad\b|\bwill\b|\bwould\b|\bcould\b|\bshould\b|\bmay\b|\bmight\b|\bthis\b|\bthat\b|\bits\b/g, " ")
    .replace(/\breturning back\b/g, "returning")
    .replace(/\bgoing back\b/g, "returning")
    .replace(/\bback to work\b/g, "to work")
    .replace(/\bbaby\b|\binfant\b|\bchild\b|\blittle one\b/g, "baby")
    .replace(/\bwork\b|\bjob\b|\bemployment\b/g, "work")
    .replace(/\bsleep\b|\bsleeping\b|\bsleeps\b/g, "sleep")
    .replace(/\bfeed\b|\bfeeding\b|\bbreastfeed\b|\bbreastfeeding\b|\bformula\b/g, "feed")
    .replace(/\bmood\b|\bspirits\b|\bmental state\b/g, "mood")
    .replace(/\bheadache\b|\bhead pain\b/g, "headache")
    .replace(/\bpain\b|\baching\b|\bache\b/g, "pain")
    .replace(/\bsad\b|\bdown\b|\blow\b(?!\s+back)|\bblue\b/g, "low")
    .replace(/\banxious\b|\bworried\b|\bstressed\b/g, "anxious")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  const inter = new Set([...wa].filter((w) => wb.has(w)));
  const union = new Set([...wa, ...wb]);
  const jaccard = inter.size / union.size;
  // High Jaccard (>=0.5) catches rephrased duplicates; inclusion catches substrings.
  return jaccard >= 0.5;
}

function cleanInsightText(text: string): string {
  return text
    .replace(/\b[Rr]eturning back\b/g, "Returning")
    .replace(/\b[Gg]oing back\b/g, "Returning")
    .replace(/\breturning back\b/g, "returning")
    .replace(/\bgoing back\b/g, "returning")
    .replace(/\s+/g, " ")
    .trim();
}

export const extractInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const source = typeof r.source === "string" ? r.source : "chat";
    const excerpt = typeof r.excerpt === "string" ? r.excerpt.slice(0, 3000) : "";
    const sourceRef = typeof r.sourceRef === "string" ? r.sourceRef.slice(0, 200) : null;
    if (!excerpt.trim()) throw new Error("excerpt required");
    if (!["chat", "checkin", "quiz"].includes(source)) throw new Error("invalid source");
    return { source: source as "chat" | "checkin" | "quiz", excerpt, sourceRef };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { written: 0 };

    let extracted: { type: InsightType; text: string }[] = [];
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM },
            {
              role: "user",
              content: `Source: ${data.source}\n\nInteraction:\n"""${data.excerpt}"""`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return { written: 0 };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(text) as { insights?: unknown };
      const arr = Array.isArray(parsed.insights) ? parsed.insights : [];
      const valid: InsightType[] = ["pattern", "preference", "context", "concern"];
      extracted = arr
        .map((o) => {
          if (!o || typeof o !== "object") return null;
          const x = o as Record<string, unknown>;
          const type = typeof x.type === "string" ? (x.type.toLowerCase() as InsightType) : null;
          const raw = typeof x.text === "string" ? x.text.trim().replace(/\s+/g, " ") : "";
          const t = cleanInsightText(raw);
          if (!type || !valid.includes(type)) return null;
          if (!t) return null;
          const wordCount = t.split(/\s+/).length;
          if (wordCount > 18 || t.length > 140) return null;
          // basic safety filters — drop anything that smells clinical
          if (/diagnos|prescrib|disorder|mg\b|dose|depression\b|psychosis|anxiety disorder/i.test(t)) return null;
          return { type, text: t };
        })
        .filter((x): x is { type: InsightType; text: string } => x !== null)
        .slice(0, 2);
    } catch {
      return { written: 0 };
    }

    if (extracted.length === 0) return { written: 0 };

    // Load existing active insights to dedupe / upgrade confidence.
    const { data: existing } = await supabase
      .from("mother_insights")
      .select("id, insight_type, insight_text, confidence")
      .eq("user_id", userId)
      .eq("active", true);

    const existingRows = (existing ?? []) as Array<{
      id: string;
      insight_type: InsightType;
      insight_text: string;
      confidence: InsightConfidence;
    }>;

    let written = 0;
    for (const ins of extracted) {
      const match = existingRows.find(
        (r) => r.insight_type === ins.type && similar(r.insight_text, ins.text),
      );
      if (match) {
        const nextConfidence: InsightConfidence =
          match.confidence === "low" ? "medium" : "high";
        await supabase
          .from("mother_insights")
          .update({
            confidence: nextConfidence,
            last_confirmed_at: new Date().toISOString(),
          })
          .eq("id", match.id);
        await supabase.from("insight_extraction_log").insert({
          user_id: userId,
          source: data.source,
          source_ref: data.sourceRef,
          extracted_insight_id: match.id,
          raw_excerpt: data.excerpt.slice(0, 500),
        });
      } else {
        const { data: inserted } = await supabase
          .from("mother_insights")
          .insert({
            user_id: userId,
            insight_type: ins.type,
            insight_text: ins.text,
            source: data.source,
            confidence: "medium",
          })
          .select("id")
          .single();
        if (inserted) {
          await supabase.from("insight_extraction_log").insert({
            user_id: userId,
            source: data.source,
            source_ref: data.sourceRef,
            extracted_insight_id: inserted.id,
            raw_excerpt: data.excerpt.slice(0, 500),
          });
          written++;
        }
      }
    }
    return { written };
  });

export const listInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MotherInsight[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("mother_insights")
      .select("id, insight_type, insight_text, source, confidence, first_observed_at, last_confirmed_at, active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("confidence", { ascending: false })
      .order("last_confirmed_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as MotherInsight[];
  });

export const deactivateInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { id?: unknown };
    if (typeof r.id !== "string") throw new Error("id required");
    return { id: r.id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("mother_insights")
      .update({ active: false })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
