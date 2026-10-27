import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NIMA_PARTNER_SYSTEM_PROMPT } from "./nimaPersonaPartner";

// ─── Invite lifecycle ──────────────────────────────────────────────────────

function genCode(): string {
  // 8 chars, easy to read
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export const createPartnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { email?: unknown };
    return { email: typeof r.email === "string" && r.email.trim() ? r.email.trim() : null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ensure caller is a mother and not already linked.
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, linked_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.role === "partner") throw new Error("Partner accounts can't invite.");
    if (prof?.linked_user_id) throw new Error("You're already linked with a partner.");

    // Expire any prior pending invites
    await supabase
      .from("partner_invites")
      .update({ status: "expired" })
      .eq("mother_user_id", userId)
      .eq("status", "pending");

    const code = genCode();
    const { data: row, error } = await supabase
      .from("partner_invites")
      .insert({ mother_user_id: userId, invite_code: code, email: data.email })
      .select("invite_code, expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Ensure consent settings row exists (all OFF by default).
    await supabase
      .from("partner_consent_settings")
      .upsert({ mother_user_id: userId }, { onConflict: "mother_user_id" });

    return { code: row.invite_code, expires_at: row.expires_at };
  });

export const revokePartnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { code?: unknown };
    if (typeof r.code !== "string") throw new Error("code required");
    return { code: r.code };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("partner_invites")
      .update({ status: "revoked" })
      .eq("mother_user_id", userId)
      .eq("invite_code", data.code);
    return { ok: true };
  });

// Validate an invite code WITHOUT auth (used on the partner signup screen).
// Uses admin client because partners aren't signed in yet.
export const lookupInvite = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { code?: unknown };
    if (typeof r.code !== "string" || !r.code.trim()) throw new Error("code required");
    return { code: r.code.trim().toUpperCase() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("partner_invites")
      .select("id, mother_user_id, status, expires_at")
      .eq("invite_code", data.code)
      .maybeSingle();

    if (!invite) return { valid: false as const, reason: "not_found" as const };
    if (invite.status !== "pending")
      return { valid: false as const, reason: invite.status as "accepted" | "expired" | "revoked" };
    if (new Date(invite.expires_at).getTime() < Date.now())
      return { valid: false as const, reason: "expired" as const };

    // Look up mother's first name for friendly UI
    const { data: motherProf } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", invite.mother_user_id)
      .maybeSingle();

    return {
      valid: true as const,
      mother_name: motherProf?.name?.split(" ")[0] ?? null,
    };
  });

// Accept an invite — requires the partner to be signed in already.
export const acceptPartnerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { code?: unknown };
    if (typeof r.code !== "string" || !r.code.trim()) throw new Error("code required");
    return { code: r.code.trim().toUpperCase() };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("partner_invites")
      .select("id, mother_user_id, status, expires_at")
      .eq("invite_code", data.code)
      .maybeSingle();

    if (!invite) throw new Error("That invite code wasn't recognized.");
    if (invite.mother_user_id === userId) throw new Error("You can't accept your own invite.");
    if (invite.status !== "pending") throw new Error("That invite is no longer active.");
    if (new Date(invite.expires_at).getTime() < Date.now())
      throw new Error("That invite has expired — ask her to send a new one.");

    // Bidirectional link
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("profiles")
      .update({ role: "partner", linked_user_id: invite.mother_user_id })
      .eq("id", userId);
    await supabaseAdmin
      .from("profiles")
      .update({ linked_user_id: userId })
      .eq("id", invite.mother_user_id);

    // Ensure consent settings exist (defaults OFF)
    await supabaseAdmin
      .from("partner_consent_settings")
      .upsert({ mother_user_id: invite.mother_user_id }, { onConflict: "mother_user_id" });

    await supabaseAdmin
      .from("partner_invites")
      .update({ status: "accepted", accepted_by: userId, accepted_at: now })
      .eq("id", invite.id);

    return { ok: true };
  });

// Mother can unlink — wipes consent + nukes partner chat + clears links.
export const unlinkPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("linked_user_id")
      .eq("id", userId)
      .maybeSingle();
    const partnerId = prof?.linked_user_id;
    if (!partnerId) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("partner_chat_messages").delete().eq("mother_user_id", userId);
    await supabaseAdmin.from("partner_consent_settings").delete().eq("mother_user_id", userId);
    await supabaseAdmin.from("profiles").update({ linked_user_id: null }).eq("id", userId);
    await supabaseAdmin
      .from("profiles")
      .update({ linked_user_id: null, role: "mother" })
      .eq("id", partnerId);
    return { ok: true };
  });

// ─── Mother-side: read/update consent + read linked-partner status ────────

export const getPartnerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: prof }, { data: invites }, { data: consent }] = await Promise.all([
      supabase.from("profiles").select("role, linked_user_id").eq("id", userId).maybeSingle(),
      supabase
        .from("partner_invites")
        .select("invite_code, status, expires_at, created_at")
        .eq("mother_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("partner_consent_settings")
        .select("share_mood, share_symptoms, share_checkin_streak, share_appointments, share_chat_summary")
        .eq("mother_user_id", userId)
        .maybeSingle(),
    ]);

    let partnerName: string | null = null;
    if (prof?.linked_user_id) {
      const { data: partnerProf } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", prof.linked_user_id)
        .maybeSingle();
      partnerName = partnerProf?.name ?? null;
    }

    return {
      role: prof?.role ?? "mother",
      linked_user_id: prof?.linked_user_id ?? null,
      partner_name: partnerName,
      invites: invites ?? [],
      consent:
        consent ?? {
          share_mood: false,
          share_symptoms: false,
          share_checkin_streak: false,
          share_appointments: false,
          share_chat_summary: false,
        },
    };
  });

const CONSENT_FIELDS = [
  "share_mood",
  "share_symptoms",
  "share_checkin_streak",
  "share_appointments",
  "share_chat_summary",
] as const;
type ConsentField = (typeof CONSENT_FIELDS)[number];

export const updatePartnerConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { field?: unknown; value?: unknown };
    if (typeof r.field !== "string" || !CONSENT_FIELDS.includes(r.field as ConsentField))
      throw new Error("invalid field");
    if (typeof r.value !== "boolean") throw new Error("invalid value");
    return { field: r.field as ConsentField, value: r.value };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      mother_user_id: userId,
      [data.field]: data.value,
    };
    await supabase
      .from("partner_consent_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: "mother_user_id" });
    return { ok: true };
  });

// ─── Partner-side: dashboard payload (consented data only) ────────────────

interface SharedContext {
  mother_name: string | null;
  week_postpartum: number | null;
  delivery_type: string | null;
  birth_date: string | null;
  consent: {
    share_mood: boolean;
    share_symptoms: boolean;
    share_checkin_streak: boolean;
    share_appointments: boolean;
    share_chat_summary: boolean;
  };
  mood_summary?: string;
  recent_symptoms?: string[];
  streak_days?: number;
  upcoming_appointments?: { title: string; when: string }[];
  chat_summary?: string;
}

const MOOD_TO_SCORE: Record<string, number> = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  very_low: 1,
  crisis: 1,
};

function moodSummaryFromScores(scores: number[]): string {
  if (scores.length === 0) return "Not enough check-ins this week to summarize.";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 4) return "She's had an okay week — generally steady mood.";
  if (avg >= 3) return "A mixed week — some better days, some harder ones.";
  if (avg >= 2) return "This week has been harder than usual.";
  return "She's been having a really tough stretch this week.";
}

async function buildSharedContext(userId: string): Promise<{
  motherId: string | null;
  context: SharedContext | null;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("role, linked_user_id")
    .eq("id", userId)
    .maybeSingle();
  if (me?.role !== "partner" || !me.linked_user_id) return { motherId: null, context: null };
  const motherId = me.linked_user_id;

  const [{ data: motherProf }, { data: consent }] = await Promise.all([
    supabaseAdmin.from("profiles").select("name, birth_date, delivery_type").eq("id", motherId).maybeSingle(),
    supabaseAdmin
      .from("partner_consent_settings")
      .select("share_mood, share_symptoms, share_checkin_streak, share_appointments, share_chat_summary")
      .eq("mother_user_id", motherId)
      .maybeSingle(),
  ]);

  const c = consent ?? {
    share_mood: false,
    share_symptoms: false,
    share_checkin_streak: false,
    share_appointments: false,
    share_chat_summary: false,
  };

  const birthDate = (motherProf?.birth_date as string | null) ?? null;
  const weekPP = birthDate
    ? Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 7)))
    : null;

  const ctx: SharedContext = {
    mother_name: motherProf?.name?.split(" ")[0] ?? null,
    week_postpartum: weekPP,
    delivery_type: (motherProf?.delivery_type as string | null) ?? null,
    birth_date: birthDate,
    consent: c,
  };

  // Pull check-ins once if mood/symptoms/streak is consented
  if (c.share_mood || c.share_symptoms || c.share_checkin_streak) {
    const sinceISO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: checkins } = await supabaseAdmin
      .from("checkins")
      .select("mood, symptoms, created_at")
      .eq("user_id", motherId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false });

    const rows = (checkins ?? []) as Array<{
      mood: string | null;
      symptoms: string[] | null;
      created_at: string;
    }>;

    if (c.share_mood) {
      const recent = rows
        .slice(0, 7)
        .map((r) => (r.mood ? MOOD_TO_SCORE[r.mood] : undefined))
        .filter((m): m is number => typeof m === "number");
      ctx.mood_summary = moodSummaryFromScores(recent);
    }
    if (c.share_symptoms) {
      const flat = rows.flatMap((r) => r.symptoms ?? []);
      const counts = new Map<string, number>();
      for (const s of flat) counts.set(s, (counts.get(s) ?? 0) + 1);
      ctx.recent_symptoms = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s]) => s);
    }
    if (c.share_checkin_streak) {
      // Count distinct calendar days, walking back from today
      const days = new Set(rows.map((r) => r.created_at.slice(0, 10)));
      let streak = 0;
      const cursor = new Date();
      for (let i = 0; i < 14; i++) {
        const key = cursor.toISOString().slice(0, 10);
        if (days.has(key)) streak += 1;
        else if (i > 0) break;
        cursor.setDate(cursor.getDate() - 1);
      }
      ctx.streak_days = streak;
    }
  }

  if (c.share_appointments) {
    const { data: appts } = await supabaseAdmin
      .from("health_records")
      .select("title, recorded_at, record_type")
      .eq("user_id", motherId)
      .eq("record_type", "appointment")
      .gte("recorded_at", new Date().toISOString())
      .order("recorded_at", { ascending: true })
      .limit(5);
    ctx.upcoming_appointments = (appts ?? []).map((a) => ({
      title: (a.title as string | null) ?? "Appointment",
      when: a.recorded_at as string,
    }));
  }

  if (c.share_chat_summary) {
    // AI-paraphrased high-level summary; never raw transcript.
    const { data: recent } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", motherId)
      .order("created_at", { ascending: false })
      .limit(40);
    const userOnly = (recent ?? [])
      .filter((m) => m.role === "user")
      .reverse()
      .map((m) => (m.content as string).slice(0, 300));
    if (userOnly.length === 0) {
      ctx.chat_summary = "She hasn't shared much with Nima this week yet.";
    } else {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You generate a 1-2 sentence, high-level emotional summary of how a postpartum mother has been feeling, based on her own messages to a companion app. The audience is her partner, so ALWAYS refer to her in the third person ('she', 'her') — NEVER use second person ('you', 'your'). Be gentle, plain, non-clinical. NEVER quote her words. NEVER reveal specific events, names, or private details. Output the summary sentence(s) only.",
                },
                { role: "user", content: userOnly.join("\n---\n") },
              ],
            }),
          });
          if (res.ok) {
            const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            ctx.chat_summary =
              j.choices?.[0]?.message?.content?.trim() ??
              "She's been processing the adjustment week by week.";
          } else {
            ctx.chat_summary = "She's been processing the adjustment week by week.";
          }
        } catch {
          ctx.chat_summary = "She's been processing the adjustment week by week.";
        }
      } else {
        ctx.chat_summary = "She's been processing the adjustment week by week.";
      }
    }
  }

  return { motherId, context: ctx };
}

export const getPartnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { context: shared } = await buildSharedContext(userId);
    if (!shared) throw new Error("You're not linked to a mother account.");
    return shared;
  });

// ─── Partner chat ─────────────────────────────────────────────────────────

export interface PartnerChatTurn {
  role: "partner" | "nima";
  content: string;
}

export const loadPartnerNimaHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("partner_chat_messages")
      .select("id, role, content, created_at")
      .eq("partner_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return data ?? [];
  });

export const clearPartnerNimaHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("partner_chat_messages")
      .delete()
      .eq("partner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPartnerNimaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { message?: unknown; history?: unknown };
    const message = typeof r.message === "string" ? r.message.trim() : "";
    if (!message) throw new Error("Message required");
    const history = Array.isArray(r.history) ? (r.history as PartnerChatTurn[]).slice(-16) : [];
    return { message, history };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    // Assemble consented context SERVER-SIDE — AI never queries the db directly.
    const { motherId, context: shared } = await buildSharedContext(userId);
    if (!motherId || !shared) throw new Error("You're not linked to a mother account.");

    // Persist user message
    await supabase.from("partner_chat_messages").insert({
      partner_user_id: userId,
      mother_user_id: motherId,
      role: "partner",
      content: data.message,
    });

    // Build SHARED CONTEXT string. Only include consented fields.
    const lines: string[] = [];
    lines.push(`SHARED CONTEXT (only what she has consented to share):`);
    lines.push(`- Her name: ${shared.mother_name ?? "(not provided)"}`);
    if (shared.consent.share_mood && shared.mood_summary)
      lines.push(`- Recent mood trend: ${shared.mood_summary}`);
    if (shared.consent.share_symptoms && shared.recent_symptoms?.length)
      lines.push(`- Symptoms she's logged recently: ${shared.recent_symptoms.join(", ")}`);
    if (shared.consent.share_checkin_streak && typeof shared.streak_days === "number")
      lines.push(`- Daily check-in streak: ${shared.streak_days} day(s)`);
    if (shared.consent.share_appointments && shared.upcoming_appointments?.length)
      lines.push(
        `- Upcoming appointments: ${shared.upcoming_appointments
          .map((a) => `${a.title} on ${new Date(a.when).toLocaleDateString()}`)
          .join("; ")}`
      );
    if (shared.consent.share_chat_summary && shared.chat_summary)
      lines.push(`- General emotional summary: ${shared.chat_summary}`);

    const notShared = Object.entries(shared.consent)
      .filter(([, v]) => !v)
      .map(([k]) => k.replace("share_", ""));
    if (notShared.length)
      lines.push(`- NOT shared (do not reference or infer): ${notShared.join(", ")}`);

    const messages = [
      { role: "system" as const, content: NIMA_PARTNER_SYSTEM_PROMPT },
      { role: "system" as const, content: lines.join("\n") },
      ...data.history.map((h) => ({
        role: h.role === "nima" ? ("assistant" as const) : ("user" as const),
        content: h.content,
      })),
      { role: "user" as const, content: data.message },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Nima is busy — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply =
      json.choices?.[0]?.message?.content?.trim() ?? "I'm here. What would help right now?";

    await supabase.from("partner_chat_messages").insert({
      partner_user_id: userId,
      mother_user_id: motherId,
      role: "nima",
      content: reply,
    });

    return { reply };
  });

// ─── Partner care alerts ──────────────────────────────────────────────────

export const getUnseenCareAlert = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, linked_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.role !== "partner" || !prof.linked_user_id) return { alert: null };

    const { data } = await supabase
      .from("partner_care_alerts")
      .select("id, alert_type, alert_context, nima_guidance, created_at")
      .eq("partner_user_id", userId)
      .is("seen_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { alert: null };

    const { data: motherProf } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", prof.linked_user_id)
      .maybeSingle();
    const guidance = Array.isArray(data.nima_guidance)
      ? (data.nima_guidance as unknown[]).filter((s) => typeof s === "string").map((s) => String(s))
      : [];

    return {
      alert: {
        id: data.id,
        alert_type: data.alert_type,
        alert_context: data.alert_context,
        nima_guidance: guidance,
        created_at: data.created_at,
        mother_first_name: motherProf?.name?.split(" ")[0] ?? "she",
      },
    };
  });

export const markCareAlertSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { id?: unknown };
    if (typeof r.id !== "string" || !r.id) throw new Error("id required");
    return { id: r.id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("partner_care_alerts")
      .update({ seen_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("partner_user_id", userId);
    return { ok: true };
  });

// Mother-side: any care alert sent for me today?
export const getCareAlertSentToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("partner_care_alerts")
      .select("id, created_at")
      .eq("mother_user_id", userId)
      .gte("created_at", startOfDay.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { sent: !!data };
  });
