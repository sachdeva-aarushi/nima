import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NIMA_SYSTEM_PROMPT } from "./nimaPersona";
import { NIMA_PARTNER_SYSTEM_PROMPT } from "./nimaPersonaPartner";

import { checkCrisis, checkHighRiskSymptoms } from "./crisisCheck";
import { ARTICLES } from "./articles";
import { classifyIssueText } from "./quiz.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ChatTurn {
  role: "user" | "nima";
  content: string;
}

interface SendChatInput {
  message: string;
  history: ChatTurn[];
}

export type NavigationEvent =
  | { type: "crisis"; params: Record<string, string> }
  | { type: "quiz"; params: { category: string; issueText?: string } }
  | null;

export interface ToolCallReceipt {
  tool: string;
  status: "ok" | "skipped" | "error";
  label: string;
  data?: { [k: string]: string | number | boolean | null };
}

export interface SendChatResult {
  reply: string;
  text: string; // alias for reply, per v3 schema
  tool_calls_executed: ToolCallReceipt[];
  navigation_event: NavigationEvent;
  article_suggestion: { slug: string; title: string } | null;
}

const MAX_MESSAGE_CHARS = 2000;

function parseInput(raw: unknown): SendChatInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid payload");
  const r = raw as Record<string, unknown>;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  if (!message) throw new Error("Message required");
  const history = Array.isArray(r.history) ? (r.history as ChatTurn[]) : [];
  // Cap each history turn too so prompt injection via oversized context is bounded.
  const safeHistory = history.slice(-16).map((h) => ({
    role: h.role,
    content: typeof h.content === "string" ? h.content.slice(0, MAX_MESSAGE_CHARS) : "",
  }));
  return { message, history: safeHistory };
}

// --- Tool schemas (OpenAI-compatible; Lovable AI Gateway / Gemini) ---------

const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "log_symptom",
      description:
        "Log a physical symptom the mother just described to her health records. Use for clear, distinct symptoms only.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short symptom label, e.g. 'headache', 'back pain'." },
          severity: {
            type: "string",
            enum: ["mild", "moderate", "severe"],
            description: "Optional severity if she made it clear.",
          },
          note: { type: "string", description: "Short verbatim-ish quote or extra context (one sentence)." },
        },
        required: ["label"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_checkin_mood",
      description:
        "Set or update today's mood check-in based on how she just said she feels. Skip if she already checked in today.",
      parameters: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            enum: ["great", "good", "okay", "low", "very_low", "crisis"],
          },
        },
        required: ["mood"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_insight",
      description:
        "Remember a context fact about her across sessions (life situation, preference, recurring concern). Atomic, <=15 words, neutral.",
      parameters: {
        type: "object",
        properties: {
          insight_type: { type: "string", enum: ["pattern", "preference", "context", "concern"] },
          text: { type: "string", description: "Plain, neutral statement <=15 words." },
        },
        required: ["insight_type", "text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_progress_milestone",
      description: "Mark a recovery milestone she just described as completed.",
      parameters: {
        type: "object",
        properties: {
          milestone_key: {
            type: "string",
            description: "Short stable key, e.g. 'first_walk', 'four_hour_sleep', 'first_full_feed'.",
          },
          label: { type: "string", description: "Human-readable label." },
        },
        required: ["milestone_key", "label"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "trigger_quiz",
      description:
        "Open the adaptive triage quiz. USE VERY RARELY — only when she describes a red-flag pattern (e.g. headache with vision changes, heavy bleeding, chest pain, severe escalating mood symptoms) or explicitly asks for a structured assessment. NEVER call for ordinary low mood, tiredness, a single headache, normal aches, stress, overwhelm, work anxiety, or on the first message of a session unless clear red flags are present. Default to NOT calling this tool — keep the conversation going instead.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["mood", "bleeding", "pain", "feeding", "sleep"],
          },
          issue_text: {
            type: "string",
            description: "Her own words describing the issue, to ground the quiz questions.",
          },
        },
        required: ["category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "trigger_crisis_resources",
      description:
        "Immediately open crisis resources. Use only for self-harm, suicide, or harming-the-baby content. The system also runs a deterministic check.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "suggest_content",
      description: "Surface a Wellness Library article that fits the conversation.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Short topic keyword(s) to match against the library — e.g. 'breastfeeding', 'sleep', 'low mood'.",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "notify_partner",
      description:
        "Quietly let her partner know she could use some extra support today. Use ONLY when she has expressed sustained emotional difficulty across at least 2 consecutive user messages (loneliness, overwhelm, persistent low mood, needing more support). Never for a single sad message, never for crisis-level content (use trigger_crisis_resources for that). The tool will check her partner-sharing consent and silently skip if she hasn't opted in.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "Plain-language, warm, non-clinical summary of what's going on, in third person — e.g. 'She's been feeling really isolated today' or 'She's overwhelmed and could use a break tonight.' Never quote her directly. Max 200 chars.",
          },
        },
        required: ["summary"],
      },
    },
  },
];


// --- Tool executors --------------------------------------------------------

type Sb = SupabaseClient<Database>;

interface ExecContext {
  supabase: Sb;
  userId: string;
}

interface ToolOutcome {
  receipt: ToolCallReceipt;
  navigation?: NavigationEvent;
  article?: { slug: string; title: string };
  toolResponse: Record<string, unknown>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

async function execLogSymptom(args: Record<string, unknown>, ctx: ExecContext): Promise<ToolOutcome> {
  const label = String(args.label ?? "").trim().slice(0, 80);
  if (!label) {
    return {
      receipt: { tool: "log_symptom", status: "error", label: "could not log" },
      toolResponse: { ok: false, error: "missing label" },
    };
  }
  const severity = typeof args.severity === "string" ? args.severity : null;
  const note = typeof args.note === "string" ? args.note.slice(0, 280) : null;
  const { error } = await ctx.supabase.from("health_records").insert({
    user_id: ctx.userId,
    record_type: "symptom",
    title: label,
    source: "ai_inferred",
    notes: note,
    value: { label, severity, note, origin: "chat_conversation" } as never,
  });
  if (error) {
    return {
      receipt: { tool: "log_symptom", status: "error", label: "could not log" },
      toolResponse: { ok: false, error: error.message },
    };
  }
  return {
    receipt: { tool: "log_symptom", status: "ok", label: `noted: ${label}`, data: { label, severity } },
    toolResponse: { ok: true, label },
  };
}

async function execUpdateCheckinMood(args: Record<string, unknown>, ctx: ExecContext): Promise<ToolOutcome> {
  const allowed = ["great", "good", "okay", "low", "very_low", "crisis"] as const;
  const mood = String(args.mood ?? "").toLowerCase();
  if (!allowed.includes(mood as (typeof allowed)[number])) {
    return {
      receipt: { tool: "update_checkin_mood", status: "error", label: "invalid mood" },
      toolResponse: { ok: false, error: "invalid mood" },
    };
  }
  // Find today's check-in
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: existing } = await ctx.supabase
    .from("checkins")
    .select("id")
    .eq("user_id", ctx.userId)
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await ctx.supabase
      .from("checkins")
      .update({ mood: mood as Database["public"]["Enums"]["checkin_mood"] })
      .eq("id", existing.id);
    if (error) {
      return {
        receipt: { tool: "update_checkin_mood", status: "error", label: "could not update" },
        toolResponse: { ok: false, error: error.message },
      };
    }
    return {
      receipt: { tool: "update_checkin_mood", status: "ok", label: "mood updated", data: { mood } },
      toolResponse: { ok: true, mode: "updated", mood },
    };
  }
  const { error } = await ctx.supabase.from("checkins").insert({
    user_id: ctx.userId,
    mood: mood as Database["public"]["Enums"]["checkin_mood"],
  });
  if (error) {
    return {
      receipt: { tool: "update_checkin_mood", status: "error", label: "could not create check-in" },
      toolResponse: { ok: false, error: error.message },
    };
  }
  return {
    receipt: { tool: "update_checkin_mood", status: "ok", label: "check-in created", data: { mood } },
    toolResponse: { ok: true, mode: "created", mood },
  };
}

async function execAddInsight(args: Record<string, unknown>, ctx: ExecContext): Promise<ToolOutcome> {
  const allowed = ["pattern", "preference", "context", "concern"] as const;
  const type = String(args.insight_type ?? "").toLowerCase();
  const text = String(args.text ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
  if (!allowed.includes(type as (typeof allowed)[number]) || !text) {
    return {
      receipt: { tool: "add_insight", status: "error", label: "could not save" },
      toolResponse: { ok: false, error: "invalid insight" },
    };
  }
  const typedType = type as Database["public"]["Enums"]["insight_type"];
  // Dedupe against active insights
  const { data: existing } = await ctx.supabase
    .from("mother_insights")
    .select("id, insight_text")
    .eq("user_id", ctx.userId)
    .eq("insight_type", typedType)
    .eq("active", true);
  const n = normalize(text);
  const dup = (existing ?? []).find((r) => {
    const e = normalize(r.insight_text);
    return e === n || e.includes(n) || n.includes(e);
  });
  if (dup) {
    await ctx.supabase
      .from("mother_insights")
      .update({ last_confirmed_at: new Date().toISOString(), confidence: "high" })
      .eq("id", dup.id);
    return {
      receipt: { tool: "add_insight", status: "ok", label: "remembered (confirmed)", data: { text } },
      toolResponse: { ok: true, mode: "confirmed" },
    };
  }
  const { error } = await ctx.supabase.from("mother_insights").insert({
    user_id: ctx.userId,
    insight_type: typedType,
    insight_text: text,
    source: "chat_tool",
    confidence: "medium",
  });
  if (error) {
    return {
      receipt: { tool: "add_insight", status: "error", label: "could not save" },
      toolResponse: { ok: false, error: error.message },
    };
  }
  return {
    receipt: { tool: "add_insight", status: "ok", label: "remembered", data: { text } },
    toolResponse: { ok: true, mode: "added" },
  };
}

async function execUpdateMilestone(args: Record<string, unknown>, ctx: ExecContext): Promise<ToolOutcome> {
  const key = String(args.milestone_key ?? "").trim().toLowerCase().slice(0, 60);
  const label = String(args.label ?? "").trim().slice(0, 120);
  if (!key || !label) {
    return {
      receipt: { tool: "update_progress_milestone", status: "error", label: "could not mark" },
      toolResponse: { ok: false, error: "missing fields" },
    };
  }
  // Stored in health_records with record_type='milestone' to avoid a new table.
  // Dedupe on key.
  const { data: existing } = await ctx.supabase
    .from("health_records")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("record_type", "milestone")
    .eq("title", key)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return {
      receipt: { tool: "update_progress_milestone", status: "skipped", label: `already marked: ${label}` },
      toolResponse: { ok: true, mode: "already_marked" },
    };
  }
  const { error } = await ctx.supabase.from("health_records").insert({
    user_id: ctx.userId,
    record_type: "milestone",
    title: key,
    source: "ai_inferred",
    value: { key, label, achieved_at: new Date().toISOString(), origin: "chat_conversation" } as never,
  });
  if (error) {
    return {
      receipt: { tool: "update_progress_milestone", status: "error", label: "could not mark" },
      toolResponse: { ok: false, error: error.message },
    };
  }
  return {
    receipt: { tool: "update_progress_milestone", status: "ok", label: `milestone marked: ${label}`, data: { key, label } },
    toolResponse: { ok: true, mode: "marked" },
  };
}

function execTriggerQuiz(args: Record<string, unknown>): ToolOutcome {
  const allowed = ["mood", "bleeding", "pain", "feeding", "sleep"] as const;
  let category = String(args.category ?? "").toLowerCase();
  if (!allowed.includes(category as (typeof allowed)[number])) category = "mood";
  const issueText = typeof args.issue_text === "string" ? args.issue_text.slice(0, 400) : undefined;
  return {
    receipt: { tool: "trigger_quiz", status: "ok", label: "opening quiz", data: { category } },
    navigation: { type: "quiz", params: { category, issueText } },
    toolResponse: { ok: true, navigation: "quiz", category },
  };
}

function execTriggerCrisis(): ToolOutcome {
  return {
    receipt: { tool: "trigger_crisis_resources", status: "ok", label: "opening crisis resources" },
    navigation: { type: "crisis", params: {} },
    toolResponse: { ok: true, navigation: "crisis" },
  };
}

function execSuggestContent(args: Record<string, unknown>): ToolOutcome {
  const topic = String(args.topic ?? "").toLowerCase();
  const words = topic.split(/\s+/).filter(Boolean);
  let best: { score: number; article: (typeof ARTICLES)[number] } | null = null;
  for (const a of ARTICLES) {

    const hay = `${a.title} ${a.summary} ${a.category}`.toLowerCase();
    let score = 0;
    for (const w of words) if (w && hay.includes(w)) score += 1;
    if (hay.includes(topic) && topic.length > 2) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { score, article: a };
  }
  if (!best) {
    return {
      receipt: { tool: "suggest_content", status: "skipped", label: "no matching article" },
      toolResponse: { ok: false, error: "no match" },
    };
  }
  return {
    receipt: {
      tool: "suggest_content",
      status: "ok",
      label: `suggested: ${best.article.title}`,
      data: { slug: best.article.slug, title: best.article.title },
    },
    article: { slug: best.article.slug, title: best.article.title },
    toolResponse: { ok: true, slug: best.article.slug, title: best.article.title },
  };
}

async function execNotifyPartner(args: Record<string, unknown>, ctx: ExecContext): Promise<ToolOutcome> {
  const summaryIn = String(args.summary ?? "").trim().slice(0, 240);
  if (!summaryIn) {
    return {
      receipt: { tool: "notify_partner", status: "error", label: "no summary" },
      toolResponse: { ok: false, error: "missing summary" },
    };
  }

  // Look up mother profile + partner link + consent.
  const { data: prof } = await ctx.supabase
    .from("profiles")
    .select("name, linked_user_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const partnerId = prof?.linked_user_id ?? null;
  if (!partnerId) {
    return {
      receipt: { tool: "notify_partner", status: "skipped", label: "no linked partner" },
      toolResponse: { ok: false, sent: false, reason: "no_partner_linked" },
    };
  }

  const { data: consent } = await ctx.supabase
    .from("partner_consent_settings")
    .select("share_mood")
    .eq("mother_user_id", ctx.userId)
    .maybeSingle();
  if (!consent?.share_mood) {
    return {
      receipt: { tool: "notify_partner", status: "skipped", label: "sharing not enabled" },
      toolResponse: { ok: false, sent: false, reason: "consent_not_granted" },
    };
  }

  // Generate nima_guidance using the partner persona.
  const motherName = (prof?.name ?? "").split(" ")[0] || "her";
  let guidance: string[] = [];
  const apiKey = process.env.LOVABLE_API_KEY;
  if (apiKey) {
    const prompt = `${NIMA_PARTNER_SYSTEM_PROMPT}

A care alert is being sent to her partner right now. The situation, in your own warm summary:
"${summaryIn}"

Generate EXACTLY 2-3 concrete, immediate, actionable suggestions for what the partner can do tonight or in the next few hours to support ${motherName}. Each suggestion should be one short sentence, plain language, no preface. Output ONLY a JSON array of strings, no markdown, no commentary. Example: ["Take the late feed so she can get a long stretch of sleep.","Sit with her for 20 minutes without trying to fix anything — just be there."]`;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = (json.choices?.[0]?.message?.content ?? "").trim();
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            guidance = parsed
              .filter((s) => typeof s === "string")
              .slice(0, 3)
              .map((s) => String(s).trim().slice(0, 220))
              .filter(Boolean);
          }
        } catch {
          /* fall through to fallback */
        }
      }
    } catch {
      /* fall through to fallback */
    }
  }
  if (guidance.length === 0) {
    guidance = [
      "Sit with her tonight without trying to fix anything — just be present.",
      "Take one concrete task off her plate (a feed, a meal, the dishes).",
      "Tell her plainly: 'I see how hard you're working. I've got you.'",
    ];
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("partner_care_alerts").insert({
    mother_user_id: ctx.userId,
    partner_user_id: partnerId,
    alert_type: "emotional_support",
    alert_context: summaryIn,
    nima_guidance: guidance as never,
  });
  if (error) {
    return {
      receipt: { tool: "notify_partner", status: "error", label: "could not notify" },
      toolResponse: { ok: false, sent: false, error: error.message },
    };
  }
  return {
    receipt: { tool: "notify_partner", status: "ok", label: "partner notified" },
    toolResponse: { ok: true, sent: true },
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ExecContext,
): Promise<ToolOutcome> {
  switch (name) {
    case "log_symptom":
      return execLogSymptom(args, ctx);
    case "update_checkin_mood":
      return execUpdateCheckinMood(args, ctx);
    case "add_insight":
      return execAddInsight(args, ctx);
    case "update_progress_milestone":
      return execUpdateMilestone(args, ctx);
    case "trigger_quiz":
      return execTriggerQuiz(args);
    case "trigger_crisis_resources":
      return execTriggerCrisis();
    case "suggest_content":
      return execSuggestContent(args);
    case "notify_partner":
      return execNotifyPartner(args, ctx);
    default:
      return {
        receipt: { tool: name, status: "error", label: `unknown tool: ${name}` },
        toolResponse: { ok: false, error: "unknown tool" },
      };
  }
}


// --- Main handler ----------------------------------------------------------

interface GatewayToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface GatewayMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: GatewayToolCall[];
}

const CRISIS_REPLY =
  "I hear you, and I'm so glad you said that out loud. You don't have to carry this alone — I'm taking you to people trained for exactly this moment.";

export const sendNimaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }): Promise<SendChatResult> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    // Persist user message first so it shows in history regardless of outcome.
    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // ----- Step 1: deterministic safety floor -----
    const crisis = checkCrisis(data.message);
    if (crisis.isCrisis) {
      await supabase.from("chat_messages").insert({
        user_id: userId,
        role: "nima",
        content: CRISIS_REPLY,
        metadata: { source: "deterministic_crisis_check" } as never,
      });
      return {
        reply: CRISIS_REPLY,
        text: CRISIS_REPLY,
        tool_calls_executed: [
          { tool: "trigger_crisis_resources", status: "ok", label: "opening crisis resources" },
        ],
        navigation_event: { type: "crisis", params: {} },
        article_suggestion: null,
      };
    }

    const highRisk = checkHighRiskSymptoms([], data.message);
    let forceQuizCategory: string | null = null;
    if (highRisk.isCrisis) {
      // Translate to a quiz category via the existing classifier.
      forceQuizCategory = classifyIssueText(data.message);
    }

    // ----- Step 2: context assembly -----
    const { data: insightRows } = await supabase
      .from("mother_insights")
      .select("insight_type, insight_text, confidence")
      .eq("user_id", userId)
      .eq("active", true)
      .order("confidence", { ascending: false })
      .order("last_confirmed_at", { ascending: false })
      .limit(5);
    const insightBlock = (insightRows ?? [])
      .map((r) => `- (${r.insight_type}) ${r.insight_text}`)
      .join("\n");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: todayCheckin } = await supabase
      .from("checkins")
      .select("mood, created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("birth_date")
      .eq("id", userId)
      .maybeSingle();
    let weekPostpartum: number | null = null;
    if (profile?.birth_date) {
      const ms = Date.now() - new Date(profile.birth_date).getTime();
      weekPostpartum = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
    }

    const contextParts: string[] = [];
    if (insightBlock) {
      contextParts.push(
        `MEMORY — things you've noticed about her across past conversations (use lightly, never quote verbatim, never make her feel surveilled):\n${insightBlock}`,
      );
    }
    if (todayCheckin) {
      contextParts.push(`TODAY'S CHECK-IN: she already logged mood = "${todayCheckin.mood}" today. Do not call update_checkin_mood again.`);
    } else {
      contextParts.push(`TODAY'S CHECK-IN: she has not checked in today.`);
    }
    if (weekPostpartum !== null) contextParts.push(`WEEK POSTPARTUM: ${weekPostpartum}`);
    if (forceQuizCategory) {
      contextParts.push(
        `SYSTEM HINT: deterministic post-birth pattern check matched the "${forceQuizCategory}" category. You MUST call trigger_quiz for this category this turn, in addition to responding warmly.`,
      );
    }

    const systemPrompt =
      contextParts.length > 0
        ? `${NIMA_SYSTEM_PROMPT}\n\n${contextParts.join("\n\n")}`
        : NIMA_SYSTEM_PROMPT;

    // ----- Step 3: AI call with tools, with bounded tool loop -----
    type GwMsg =
      | { role: "system" | "user" | "assistant"; content: string }
      | { role: "assistant"; content: string | null; tool_calls?: GatewayToolCall[] }
      | { role: "tool"; tool_call_id: string; content: string };

    const messages: GwMsg[] = [
      { role: "system", content: systemPrompt },
      ...data.history.map((h) => ({
        role: (h.role === "nima" ? "assistant" : "user") as "assistant" | "user",
        content: h.content,
      })),
      { role: "user", content: data.message },
    ];

    const receipts: ToolCallReceipt[] = [];
    let navigation: NavigationEvent = null;
    let articleSuggestion: { slug: string; title: string } | null = null;
    let finalText = "";

    const MAX_ROUNDS = 4;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Nima is taking a breath — please try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
        throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: GatewayMessage; finish_reason?: string }[];
      };
      const assistant = json.choices?.[0]?.message;
      const toolCalls = assistant?.tool_calls ?? [];

      // Always include assistant turn in messages (preserve any text + tool_calls).
      messages.push({
        role: "assistant",
        content: assistant?.content ?? null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });

      if (!toolCalls.length) {
        finalText = (assistant?.content ?? "").trim();
        break;
      }

      // Execute each tool call server-side.
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        const outcome = await executeTool(call.function.name, args, { supabase, userId });
        receipts.push(outcome.receipt);
        if (outcome.navigation && !navigation) navigation = outcome.navigation;
        if (outcome.article && !articleSuggestion) articleSuggestion = outcome.article;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(outcome.toolResponse),
        });
      }
      // loop again to let model produce a natural language follow-up
    }

    // If the deterministic high-risk check fired but the model didn't actually
    // call trigger_quiz, force the navigation anyway — the floor wins.
    if (forceQuizCategory && (!navigation || navigation.type !== "quiz")) {
      navigation = {
        type: "quiz",
        params: { category: forceQuizCategory, issueText: data.message.slice(0, 400) },
      };
      receipts.push({
        tool: "trigger_quiz",
        status: "ok",
        label: "opening quiz",
        data: { category: forceQuizCategory, source: "deterministic_high_risk" },
      });
    }

    if (!finalText) {
      finalText = navigation?.type === "quiz"
        ? "Let's understand this together — opening a short check now."
        : "I'm here with you.";
    }

    // Persist Nima's reply.
    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "nima",
      content: finalText,
      metadata: {
        tool_calls_executed: receipts,
        navigation_event: navigation,
        article_suggestion: articleSuggestion,
      } as never,
    });

    return {
      reply: finalText,
      text: finalText,
      tool_calls_executed: receipts,
      navigation_event: navigation,
      article_suggestion: articleSuggestion,
    };
  });

export const loadNimaHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Permanently delete this user's chat history with Nima and today's cached
// pulse question so the next visit starts truly fresh.
export const clearNimaHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error: msgErr } = await supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", userId);
    if (msgErr) throw new Error(msgErr.message);
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("daily_pulse")
      .delete()
      .eq("user_id", userId)
      .eq("pulse_date", today);
    return { ok: true };
  });

// Save a crisis-routed user message without calling the model. Used when the
// client-side crisis check intercepts before AI invocation.
export const saveCrisisMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { message?: unknown };
    if (typeof r.message !== "string" || !r.message.trim()) throw new Error("Message required");
    return { message: r.message.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("chat_messages").insert([
      { user_id: userId, role: "user", content: data.message },
      {
        user_id: userId,
        role: "nima",
        content: CRISIS_REPLY,
      },
    ]);
    return { ok: true };
  });

// Ensure today's pulse: if no chat_messages exist today for this user, generate
// (or fetch cached) today's personalized opening question and insert it as
// Nima's first chat message for the day. Returns the inserted message or null.
export const ensureDailyPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: existingMsg } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString())
      .limit(1)
      .maybeSingle();
    if (existingMsg) return { message: null as null };

    const pulseDate = new Date().toISOString().slice(0, 10);
    const { data: cached } = await supabase
      .from("daily_pulse")
      .select("question")
      .eq("user_id", userId)
      .eq("pulse_date", pulseDate)
      .maybeSingle();
    let question: string = cached?.question ?? "";

    if (!question) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("birth_date, name")
        .eq("id", userId)
        .maybeSingle();
      const week = profile?.birth_date
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 7)),
          )
        : null;
      const { data: insights } = await supabase
        .from("mother_insights")
        .select("insight_type, insight_text")
        .eq("user_id", userId)
        .eq("active", true)
        .order("last_confirmed_at", { ascending: false })
        .limit(5);
      const insightBlock =
        (insights ?? []).map((r) => `- (${r.insight_type}) ${r.insight_text}`).join("\n") ||
        "(no prior insights yet)";

      const apiKey = process.env.LOVABLE_API_KEY;
      if (apiKey) {
        const prompt = `You are Nima, a warm, gentle postpartum companion. Generate ONE short, specific opening check-in question for today (under 25 words). Make it personal and grounded in her context below. No greeting, no name, no preface — just the single question.

WEEK POSTPARTUM: ${week ?? "unknown"}
MEMORY:
${insightBlock}

Return only the question text.`;
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            question = (json.choices?.[0]?.message?.content ?? "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
          }
        } catch {
          /* fall through to fallback */
        }
      }
      if (!question) question = "how are you feeling in your body today, mama?";

      await supabase.from("daily_pulse").insert({
        user_id: userId,
        pulse_date: pulseDate,
        question,
      });
    }

    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        role: "nima",
        content: question,
        metadata: { source: "daily_pulse" } as never,
      })
      .select("id, role, content, created_at")
      .maybeSingle();

    return { message: inserted };
  });
