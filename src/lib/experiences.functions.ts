import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkCrisis } from "@/lib/crisisCheck";

export const TOPIC_TAGS = [
  "sleep",
  "feeding",
  "mental-health",
  "recovery",
  "relationships",
  "week-1-2",
  "week-3-6",
  "week-7-12",
  "week-13-plus",
] as const;
export type TopicTag = (typeof TOPIC_TAGS)[number];

const CreateInput = z.object({
  display_name: z.string().trim().min(2).max(40),
  title: z.string().trim().max(80).optional().nullable(),
  content: z.string().trim().min(280).max(600),
  topic_tags: z.array(z.enum(TOPIC_TAGS)).max(5).default([]),
  cover_image_path: z.string().trim().max(300).optional().nullable(),
});

const AI_SCREEN_SYSTEM = `You screen short first-person postpartum experience posts written by mothers for other mothers. Return ONLY a JSON object: {"flagged": boolean, "reason": "medical_claim" | "contact_info" | "spam" | "hostile" | null}.

Flag (set flagged=true) ONLY for:
- medical_claim: stating a diagnosis, dosage, or "this cure works" as fact for other readers (NOT her own subjective experience)
- contact_info: phone number, email, social handle, URL, in-person meetup
- spam: product/service promotion or solicitation
- hostile: insults, harassment, slurs, or content targeting another person

Do NOT flag: sadness, struggle, intrusive thoughts she's describing, vulnerable disclosures, profanity used non-hostilely, descriptions of her own symptoms or treatments.

If nothing matches, return {"flagged": false, "reason": null}.`;

async function aiPreScreen(content: string): Promise<{ flagged: boolean; reason: string | null }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { flagged: true, reason: "spam" }; // fail closed if AI unavailable
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: AI_SCREEN_SYSTEM },
          { role: "user", content: `Post:\n"""${content}"""` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { flagged: true, reason: "spam" };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      flagged?: boolean;
      reason?: string;
    };
    return {
      flagged: !!parsed.flagged,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return { flagged: true, reason: "spam" };
  }
}

export const createExperiencePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // SAFETY LAYER 1: crisis keyword check — never publishes, routes to crisis.
    const titleAndBody = `${data.title ?? ""}\n${data.content}`;
    const crisis = checkCrisis(titleAndBody);
    if (crisis.isCrisis) {
      return { status: "crisis" as const, reason: crisis.reason };
    }

    // SAFETY LAYER 2: AI pre-screen.
    const ai = await aiPreScreen(data.content);
    const finalStatus: "pending" | "published" = ai.flagged ? "pending" : "published";

    // Load week_postpartum for the optional anonymized label.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("birth_date")
      .eq("id", userId)
      .maybeSingle();

    let week: number | null = null;
    if (profile?.birth_date) {
      const days = Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / 86_400_000);
      week = Math.max(0, Math.floor(days / 7));
    }

    // Insert via admin so we can set the server-decided status, but still scoped to userId.
    const { data: inserted, error } = await supabaseAdmin
      .from("experience_posts")
      .insert({
        user_id: userId,
        display_name: data.display_name,
        title: data.title?.trim() || null,
        content: data.content,
        topic_tags: data.topic_tags,
        status: finalStatus,
        ai_flagged: ai.flagged,
        ai_flag_reason: ai.reason,
        week_postpartum: week,
        cover_image_path: data.cover_image_path || null,
      } as never)
      .select("id, status")
      .single();

    if (error) throw new Error(error.message);
    return { status: finalStatus, id: inserted.id };
  });

const ListInput = z.object({
  tag: z.enum(TOPIC_TAGS).optional(),
  sort: z.enum(["recent", "liked"]).default("recent"),
  limit: z.number().int().min(1).max(50).default(30),
});

export const listExperiencePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("experience_posts")
      .select("id, display_name, title, content, topic_tags, like_count, view_count, week_postpartum, cover_image_path, created_at")
      .eq("status", "published");

    if (data.tag) q = q.contains("topic_tags", [data.tag]);
    if (data.sort === "liked") q = q.order("like_count", { ascending: false });
    q = q.order("created_at", { ascending: false }).limit(data.limit);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getExperiencePost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: post, error } = await supabase
      .from("experience_posts")
      .select("id, user_id, display_name, title, content, topic_tags, like_count, view_count, week_postpartum, cover_image_path, status, created_at")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!post) return null;
    if (post.status !== "published" && post.user_id !== userId) return null;

    const [{ data: liked }, { data: viewed }] = await Promise.all([
      supabase
        .from("experience_post_likes")
        .select("post_id")
        .eq("post_id", data.id)
        .eq("liker_id", userId)
        .maybeSingle(),
      supabase
        .from("experience_post_views")
        .select("post_id")
        .eq("post_id", data.id)
        .eq("viewer_id", userId)
        .maybeSingle(),
    ]);

    return {
      ...post,
      is_mine: post.user_id === userId,
      liked_by_me: !!liked,
      viewed_by_me: !!viewed,
    };
  });

export const recordExperienceView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // upsert-style: ignore conflict if user already viewed.
    await supabase
      .from("experience_post_views")
      .insert({ post_id: data.id, viewer_id: userId })
      .select()
      .maybeSingle()
      .then(() => undefined, () => undefined);
    return { ok: true };
  });

export const toggleExperienceLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("experience_post_likes")
      .select("post_id")
      .eq("post_id", data.id)
      .eq("liker_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("experience_post_likes")
        .delete()
        .eq("post_id", data.id)
        .eq("liker_id", userId);
      return { liked: false };
    }
    await supabase
      .from("experience_post_likes")
      .insert({ post_id: data.id, liker_id: userId });
    return { liked: true };
  });

export const deleteMyExperiencePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("experience_posts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyExperiencePosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Uses the service-role admin client because `ai_flag_reason` is no longer
    // selectable by the `authenticated` role over PostgREST (moderation
    // reasoning is server-side only). We still scope strictly by userId.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("experience_posts")
      .select("id, title, content, status, like_count, view_count, created_at, ai_flag_reason")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
