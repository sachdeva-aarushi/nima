import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  SYMPTOM_CATEGORIES,
  getCategory,
  validateQuestions,
  type AnswerRecord,
  type QuizQuestion,
  type RiskTier,
} from "./quizSymptoms";

type HealthRecordInsert = Database["public"]["Tables"]["health_records"]["Insert"];

// --------------------------------------------------------------------------
// Free-text issue → symptom category (cheap heuristic; no AI round-trip).
// --------------------------------------------------------------------------
export function classifyIssueText(text: string): string {
  const t = (text ?? "").toLowerCase();
  if (/bleed|clot|lochia|pad|hemorrh/.test(t)) return "bleeding";
  if (/breast|nipple|milk|latch|feed|nurs|engorge|mastiti/.test(t)) return "feeding";
  if (/sleep|insomnia|awake|wake|exhaust|fatigue|tired/.test(t)) return "sleep";
  if (/headache|pain|back|pelvic|incision|chest|leg|cramp|sore|ache/.test(t)) return "pain";
  if (/sad|anxi|depress|cry|mood|hopeless|overwhelm|panic|worry|numb/.test(t))
    return "mood";
  return "mood";
}

// --------------------------------------------------------------------------
// generateQuiz — now accepts optional issueText so questions stay close to
// what she actually described.
// --------------------------------------------------------------------------
const GEN_SYSTEM = `You are a triage-question generator for a postpartum care app.
You DO NOT diagnose. You DO NOT give advice. You only produce short, neutral
triage questions to help a clinician-aware app understand a single symptom.

Strict rules:
- Output ONLY valid JSON, no prose, no markdown fences.
- Generate exactly 3 to 5 questions. Each question is multiple_choice (with 3-5 options) or short text.
- Questions must be specific to the symptom category and grounding context provided.
- If the user described their own issue in their own words, the questions MUST stay close to that specific description.
- Never presuppose a diagnosis. Never imply medication, surgery, or procedure.
- Never ask open-ended medical questions ("what's wrong?") — every question must be answerable in one line.
- Each question may include a short "rationale" string (one line) explaining why it helps triage.

JSON shape:
{ "questions": [ { "id": "kebab-id", "type": "multiple_choice"|"text", "prompt": "...", "options"?: ["...","..."], "rationale"?: "..." } ] }`;

interface GenInput {
  symptomCategory: string;
  weekPostpartum: number | null;
  deliveryType: string | null;
  issueText: string | null;
}

function parseGenInput(raw: unknown): GenInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const issueText =
    typeof r.issueText === "string" && r.issueText.trim()
      ? r.issueText.trim().slice(0, 800)
      : null;
  const symptomCategory =
    typeof r.symptomCategory === "string" && r.symptomCategory in SYMPTOM_CATEGORIES
      ? r.symptomCategory
      : issueText
        ? classifyIssueText(issueText)
        : "mood";
  const weekPostpartum =
    typeof r.weekPostpartum === "number" && Number.isFinite(r.weekPostpartum)
      ? Math.max(0, Math.min(60, Math.round(r.weekPostpartum)))
      : null;
  const deliveryType = typeof r.deliveryType === "string" ? r.deliveryType : null;
  return { symptomCategory, weekPostpartum, deliveryType, issueText };
}

export interface GenerateQuizResult {
  sessionId: string;
  questions: QuizQuestion[];
  symptomCategory: string;
  fallbackUsed: boolean;
}

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseGenInput)
  .handler(async ({ data, context }): Promise<GenerateQuizResult> => {
    const { supabase, userId } = context;
    const category = getCategory(data.symptomCategory);

    // Pull her medications from health_records so the quiz can be context-aware.
    const { data: medRecords } = await supabase
      .from("health_records")
      .select("record_type, title, value, notes")
      .eq("user_id", userId)
      .or("record_type.ilike.medication%,record_type.ilike.%medication%,title.ilike.%medication%")
      .order("recorded_at", { ascending: false })
      .limit(10);

    const medNames = (medRecords ?? [])
      .map((r) => {
        const v = r.value as Record<string, unknown> | null;
        const fromValue =
          v && typeof v === "object"
            ? [v.name, v.medication, v.drug].find((x) => typeof x === "string")
            : null;
        return (fromValue as string | undefined) ?? r.title ?? null;
      })
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .slice(0, 5);
    const hasMeds = medNames.length > 0;

    let questions: QuizQuestion[] | null = null;
    let fallbackUsed = false;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const userMsg = `Symptom category: ${category.label}
Week postpartum: ${data.weekPostpartum ?? "unknown"}
Delivery type: ${data.deliveryType ?? "unknown"}
${data.issueText ? `\nHer own words: """${data.issueText}"""` : ""}
${hasMeds ? `\nMedications on file: ${medNames.join(", ")}` : ""}

Grounding (reference data — use to shape questions; do not quote verbatim):
${category.referenceExcerpt}

Generate 3-5 triage questions in the JSON shape described.`;

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
              { role: "system", content: GEN_SYSTEM },
              { role: "user", content: userMsg },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = json.choices?.[0]?.message?.content ?? "";
          try {
            const parsed = JSON.parse(text);
            questions = validateQuestions(parsed);
          } catch {
            questions = null;
          }
        }
      } catch {
        questions = null;
      }
    }

    if (!questions) {
      questions = category.fallbackQuestions;
      fallbackUsed = true;
    }

    // Always append the medication-adherence question if she has meds on file —
    // it's deterministic context that downstream risk-tiering depends on.
    if (hasMeds && !questions.some((q) => q.id === "med-adherence")) {
      const medList = medNames.slice(0, 3).join(", ");
      questions = [
        ...questions,
        {
          id: "med-adherence",
          type: "multiple_choice",
          prompt: `Have you been taking your prescribed medications (${medList}) as directed?`,
          options: [
            "Yes, all of them as prescribed",
            "Some — I've missed a few doses",
            "No, I stopped or never started them",
          ],
          rationale:
            "If a symptom is happening despite — or because of skipping — prescribed meds, the picture changes.",
        },
      ];
    }

    const { data: inserted, error } = await supabase
      .from("quiz_sessions")
      .insert({
        user_id: userId,
        quiz_type: `adaptive:${category.id}`,
        questions: {
          questions,
          issueText: data.issueText,
          medsOnFile: medNames,
        } as unknown as Database["public"]["Tables"]["quiz_sessions"]["Insert"]["questions"],
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Could not start quiz.");

    return {
      sessionId: inserted.id,
      questions,
      symptomCategory: category.id,
      fallbackUsed,
    };
  });

// --------------------------------------------------------------------------
// submitQuiz — deterministic tiering + AI-generated action plan in one call.
// --------------------------------------------------------------------------

export interface ActionStep {
  when: "right now" | "today" | "this week";
  title: string;
  body: string;
}

export type NonMedIcon = "hydration" | "rest" | "fresh air" | "walk" | "warm compress" | "cool compress";

export interface InsightCard {
  observation: string;
  non_med_options: { label: string; icon: NonMedIcon }[];
  remedies: string[];
  foods: string[];
  exercises: string[];
  massages: string[];
}

export interface ActionPlan {
  steps: ActionStep[];
  insight: InsightCard | null;
  doctor_questions: string[];
}

const PLAN_SYSTEM = `You are generating a rich, specific action plan for a postpartum mother in an app called Nima.

STRICT RULES:
- Output ONLY valid JSON, no prose, no markdown fences.
- "steps" MUST be exactly 3 items with "when" values "right now", "today", "this week" (in that order).
- Each step: gentle, specific, actionable. Lowercase friendly tone. Include WHAT to do, HOW, and roughly HOW LONG (e.g. "sip 250ml of warm water slowly over 10 minutes").
- No prescription medication dosing changes. No diagnosis.
- ALWAYS include an "insight" card unless the symptom is acutely high-risk-only (in which case still include one if her health records have anything relevant).
- "insight.observation": one sentence. If her records literally contain something relevant, reference it as "<observation from her records> — this is just something to mention to your doctor, not a diagnosis." Otherwise summarize the symptom pattern in plain language.
- "insight.non_med_options": 2-4 quick icon chips. Each "icon" MUST be one of:
  "hydration", "rest", "fresh air", "walk", "warm compress", "cool compress".
- "insight.remedies": 3-5 SPECIFIC at-home remedies for THIS symptom (e.g. "warm sitz bath for 10 min, twice daily", "chamomile or fennel tea before bed", "raise legs on a pillow for 15 min after feeding"). Avoid generic "rest" — be concrete. No prescription meds. OTC items only if widely accepted as postpartum-safe; phrase as "ask your provider before" if any doubt.
- "insight.foods": 3-5 SPECIFIC foods/drinks that help with THIS symptom (e.g. for low milk: oats, fenugreek tea, fennel seeds, brewer's yeast; for mood: walnuts, dark leafy greens, salmon; for bleeding/iron: lentils, spinach with lemon, dates). Real foods, not categories.
- "insight.exercises": 3-5 SPECIFIC, postpartum-safe movements with reps/duration (e.g. "diaphragmatic breathing, 5 min lying down", "pelvic tilts, 10 reps, 2 sets", "gentle 10-minute walk after lunch", "neck rolls, 5 each direction"). Skip exercises that contradict the symptom (no core work for active bleeding, no jumping pre-6-weeks).
- "insight.massages": 2-4 SPECIFIC self-massage or partner-massage techniques with location + duration (e.g. "warm castor-oil belly massage clockwise for 5 min", "shoulder & neck kneading for 3 min", "scalp massage with warm coconut oil before bed").
- All four lists MUST be specific to the symptom category and her own-words description — never generic filler.
- "doctor_questions": 2-4 short questions she can bring to her appointment. Reference her records only if literally present.
- If meds-skipped context is provided, ADD a step or doctor_question that gently addresses restarting/discussing the meds with her provider.

JSON shape:
{
  "steps": [
    {"when":"right now","title":"...","body":"..."},
    {"when":"today","title":"...","body":"..."},
    {"when":"this week","title":"...","body":"..."}
  ],
  "insight": {
    "observation":"...",
    "non_med_options":[{"label":"hydration","icon":"hydration"}],
    "remedies":["...","..."],
    "foods":["...","..."],
    "exercises":["...","..."],
    "massages":["...","..."]
  },
  "doctor_questions": ["...","..."]
}`;

function buildFallbackInsight(categoryLabel: string): InsightCard {
  return {
    observation: `what you're describing fits a common ${categoryLabel} pattern — worth gentle care and a mention to your provider.`,
    non_med_options: [
      { label: "hydration", icon: "hydration" },
      { label: "rest", icon: "rest" },
      { label: "fresh air", icon: "fresh air" },
    ],
    remedies: [
      "warm shower or 10-minute sitz bath, twice daily",
      "chamomile tea before bed (one cup)",
      "lie on your left side for 15 min after feeding to ease pressure",
    ],
    foods: [
      "oats with berries for breakfast",
      "lentil soup or dal with a squeeze of lemon (iron + vitamin C)",
      "a handful of walnuts or almonds as a snack",
      "warm milk with a pinch of turmeric before bed",
    ],
    exercises: [
      "diaphragmatic breathing, 5 minutes lying down",
      "pelvic tilts, 10 reps × 2 sets",
      "gentle 10-minute walk after a meal",
      "neck rolls, 5 each direction",
    ],
    massages: [
      "warm-oil shoulder & neck kneading, 3 minutes",
      "scalp massage with warm coconut or sesame oil before bed, 5 minutes",
      "clockwise belly massage with warm oil, 5 minutes (skip if heavy bleeding)",
    ],
  };
}

const FALLBACK_PLAN: Record<RiskTier, ActionPlan> = {
  low: {
    steps: [
      { when: "right now", title: "pause and breathe", body: "sit comfortably and take 5 slow diaphragmatic breaths — 4 sec in, 6 sec out." },
      { when: "today", title: "nourish gently", body: "drink at least 2 litres of water, eat a warm iron-rich meal (dal, lentil soup, or eggs with greens), and ask for 30 min of help." },
      { when: "this week", title: "keep watching", body: "log how you feel daily — if anything worsens or new symptoms appear, check in with me or your provider." },
    ],
    insight: buildFallbackInsight("postpartum"),
    doctor_questions: [
      "is what i'm experiencing within the normal range for my week postpartum?",
      "what should I watch for that would mean I need to come in?",
    ],
  },
  moderate: {
    steps: [
      { when: "right now", title: "stop and rest", body: "lie down on your left side for 15 min, sip warm water, and note exactly what you're feeling so you can describe it clearly." },
      { when: "today", title: "call your provider", body: "describe what you're experiencing in your own words and ask whether you should be seen today." },
      { when: "this week", title: "follow up & adjust", body: "schedule any recommended visits, restart any missed medications only with provider guidance, and write down what changes." },
    ],
    insight: buildFallbackInsight("postpartum"),
    doctor_questions: [
      "could what i'm describing be a sign of something that needs same-day care?",
      "what symptoms should make me call back urgently?",
      "should I restart or adjust any of my medications?",
    ],
  },
  high: {
    steps: [
      { when: "right now", title: "call for help", body: "use the tap-to-call above to reach your provider or 911. do not drive yourself." },
      { when: "today", title: "do not be alone", body: "ask a partner, family member, or friend to stay with you until you are seen." },
      { when: "this week", title: "follow the care plan", body: "follow every instruction your care team gives, take medications exactly as directed, and lean on the people around you." },
    ],
    insight: buildFallbackInsight("postpartum"),
    doctor_questions: [
      "what are the warning signs that mean I should go back to the ER?",
      "what should i tell my support people so they can help?",
    ],
  },
};

function strArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function validateActionPlan(raw: unknown): ActionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const stepsRaw = Array.isArray(r.steps) ? r.steps : null;
  if (!stepsRaw || stepsRaw.length !== 3) return null;
  const wantWhen: ActionStep["when"][] = ["right now", "today", "this week"];
  const steps: ActionStep[] = [];
  for (let i = 0; i < 3; i++) {
    const s = stepsRaw[i] as Record<string, unknown> | undefined;
    if (!s || typeof s !== "object") return null;
    const when = String(s.when ?? "").toLowerCase() as ActionStep["when"];
    if (when !== wantWhen[i]) return null;
    const title = typeof s.title === "string" ? s.title.trim() : "";
    const body = typeof s.body === "string" ? s.body.trim() : "";
    if (!title || !body) return null;
    steps.push({ when, title, body });
  }
  let insight: InsightCard | null = null;
  if (r.insight && typeof r.insight === "object") {
    const ins = r.insight as Record<string, unknown>;
    const observation = typeof ins.observation === "string" ? ins.observation.trim() : "";
    const opts = Array.isArray(ins.non_med_options) ? ins.non_med_options : [];
    const allowed: NonMedIcon[] = ["hydration", "rest", "fresh air", "walk", "warm compress", "cool compress"];
    const non_med_options = opts
      .map((o) => {
        if (!o || typeof o !== "object") return null;
        const x = o as Record<string, unknown>;
        const label = typeof x.label === "string" ? x.label.trim() : "";
        const icon = String(x.icon ?? "").toLowerCase() as NonMedIcon;
        if (!label || !allowed.includes(icon)) return null;
        return { label, icon };
      })
      .filter((o): o is { label: string; icon: NonMedIcon } => o !== null)
      .slice(0, 4);
    const remedies = strArray(ins.remedies, 6);
    const foods = strArray(ins.foods, 6);
    const exercises = strArray(ins.exercises, 6);
    const massages = strArray(ins.massages, 5);
    if (observation && non_med_options.length >= 2) {
      insight = { observation, non_med_options, remedies, foods, exercises, massages };
    }
  }
  const dq = Array.isArray(r.doctor_questions) ? r.doctor_questions : [];
  const doctor_questions = dq
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter((q) => q.length > 0)
    .slice(0, 4);
  if (doctor_questions.length === 0) return null;
  return { steps, insight, doctor_questions };
}

interface SubmitInput {
  sessionId: string;
  answers: AnswerRecord[];
}

function parseSubmitInput(raw: unknown): SubmitInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sessionId = typeof r.sessionId === "string" ? r.sessionId : "";
  if (!sessionId) throw new Error("sessionId required");
  const rawAnswers = Array.isArray(r.answers) ? r.answers : [];
  const answers: AnswerRecord[] = [];
  for (const a of rawAnswers) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    if (typeof x.questionId === "string" && typeof x.value === "string") {
      answers.push({ questionId: x.questionId, value: x.value });
    }
  }
  return { sessionId, answers };
}

export interface SubmitQuizResult {
  sessionId: string;
  riskTier: RiskTier;
  message: string;
  symptomCategory: string;
  issueText: string | null;
  plan: ActionPlan;
}

function extractStoredQuestions(stored: unknown): {
  questions: QuizQuestion[];
  issueText: string | null;
} {
  if (Array.isArray(stored)) return { questions: stored as QuizQuestion[], issueText: null };
  if (stored && typeof stored === "object") {
    const s = stored as Record<string, unknown>;
    const qs = Array.isArray(s.questions) ? (s.questions as QuizQuestion[]) : [];
    const it = typeof s.issueText === "string" ? s.issueText : null;
    return { questions: qs, issueText: it };
  }
  return { questions: [], issueText: null };
}

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseSubmitInput)
  .handler(async ({ data, context }): Promise<SubmitQuizResult> => {
    const { supabase, userId } = context;

    const { data: row, error: loadErr } = await supabase
      .from("quiz_sessions")
      .select("id, quiz_type, questions")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !row) throw new Error("Quiz session not found.");

    const categoryId = row.quiz_type.replace(/^adaptive:/, "");
    const category = getCategory(categoryId);
    const { questions, issueText } = extractStoredQuestions(row.questions);

    // ---- Deterministic tier (never AI) ----
    let riskTier = category.computeRiskTier(data.answers);

    // ---- Medication-adherence escalation (06-POSTPARTUM-REFERENCE-DATA.md §3) ----
    // If she has meds on file and reports missing/skipping doses while symptomatic,
    // bump the tier — symptomatic + non-adherence is materially higher risk.
    const medAns = (data.answers.find((a) => a.questionId === "med-adherence")?.value ?? "").toLowerCase();
    const missedSome = medAns.includes("some") || medAns.includes("missed");
    const stoppedMeds = medAns.startsWith("no") || medAns.includes("stopped") || medAns.includes("never started");
    let medsEscalation: "none" | "missed" | "stopped" = "none";
    if (stoppedMeds) {
      medsEscalation = "stopped";
      riskTier = riskTier === "high" ? "high" : "high"; // symptomatic + stopped meds -> high
    } else if (missedSome) {
      medsEscalation = "missed";
      if (riskTier === "low") riskTier = "moderate";
    }

    // Pull recent health records to constrain insight generation.
    const { data: records } = await supabase
      .from("health_records")
      .select("record_type, title, value, notes, source, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(15);

    const recordsSummary =
      records && records.length
        ? records
            .map((r) => {
              const v =
                r.value && typeof r.value === "object"
                  ? JSON.stringify(r.value).slice(0, 200)
                  : "";
              return `- [${r.source}] ${r.title ?? r.record_type}: ${r.notes ?? ""} ${v}`.trim();
            })
            .join("\n")
        : "(no records)";

    // ---- Generate action plan ----
    let plan: ActionPlan | null = null;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const answerLines = data.answers
        .map((a) => {
          const q = questions.find((qq) => qq.id === a.questionId);
          return `- ${q?.prompt ?? a.questionId}: ${a.value}`;
        })
        .join("\n");

      const medsContext =
        medsEscalation === "stopped"
          ? "IMPORTANT: she has prescribed medications on file but reports STOPPING/NEVER STARTING them. Include a step gently urging her to call her provider TODAY to discuss restarting, and add a doctor question about safely resuming."
          : medsEscalation === "missed"
            ? "NOTE: she has prescribed medications on file and has MISSED SOME DOSES. Include a step gently reminding her to resume the schedule and add a doctor question about catching up on doses."
            : "";

      const userMsg = `Risk tier (deterministic, do not override): ${riskTier}
Symptom category: ${category.label}
${issueText ? `\nHer own words: """${issueText}"""\n` : ""}
Her answers:
${answerLines || "(none)"}

${medsContext}

Her recent health records (use ONLY these for any direct "observation" claim; you may still always provide the remedies/foods/exercises/massages lists tailored to the symptom):
${recordsSummary}

Generate the rich JSON action plan now — remedies, foods, exercises, and massages MUST be specific to her symptom category and own words, not generic.`;


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
              { role: "system", content: PLAN_SYSTEM },
              { role: "user", content: userMsg },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const text = j.choices?.[0]?.message?.content ?? "";
          try {
            plan = validateActionPlan(JSON.parse(text));
          } catch {
            plan = null;
          }
        }
      } catch {
        plan = null;
      }
    }
    if (!plan) plan = FALLBACK_PLAN[riskTier];

    // Persist results
    await supabase
      .from("quiz_sessions")
      .update({
        answers: data.answers as unknown as Database["public"]["Tables"]["quiz_sessions"]["Update"]["answers"],
        completed_at: new Date().toISOString(),
        score: {
          risk_tier: riskTier,
          plan,
          symptom_category: category.id,
          issue_text: issueText,
        } as unknown as Database["public"]["Tables"]["quiz_sessions"]["Update"]["score"],
        result_summary: category.tierMessages[riskTier],
      })
      .eq("id", row.id);

    const record: HealthRecordInsert = {
      user_id: userId,
      record_type: `symptom:${category.id}`,
      title: `${category.label} — ${riskTier} concern`,
      value: {
        risk_tier: riskTier,
        answers: data.answers,
        quiz_session_id: row.id,
        issue_text: issueText,
      } as unknown as HealthRecordInsert["value"],
      source: "quiz_session" as HealthRecordInsert["source"],
      is_abnormal: riskTier !== "low",
      notes: category.tierMessages[riskTier],
    };
    await supabase.from("health_records").insert(record);

    // Audit-trail: insight card was generated and will be shown.
    if (plan.insight) {
      await supabase.from("insight_cards_shown").insert({
        user_id: userId,
        card_key: `symptom_insight:${category.id}`,
        context: {
          quiz_session_id: row.id,
          risk_tier: riskTier,
          observation: plan.insight.observation,
        } as unknown as Database["public"]["Tables"]["insight_cards_shown"]["Insert"]["context"],
      });
    }

    return {
      sessionId: row.id,
      riskTier,
      message: category.tierMessages[riskTier],
      symptomCategory: category.id,
      issueText,
      plan,
    };
  });

// --------------------------------------------------------------------------
// loadActionPlan — re-read a previously generated plan.
// --------------------------------------------------------------------------

export interface LoadActionPlanResult extends SubmitQuizResult {}

function parseLoadInput(raw: unknown): { sessionId: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sessionId = typeof r.sessionId === "string" ? r.sessionId : "";
  if (!sessionId) throw new Error("sessionId required");
  return { sessionId };
}

export const loadActionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseLoadInput)
  .handler(async ({ data, context }): Promise<LoadActionPlanResult> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quiz_sessions")
      .select("id, quiz_type, score, result_summary")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error("Action plan not found.");
    const score = (row.score ?? {}) as Record<string, unknown>;
    const riskTier = (score.risk_tier as RiskTier) ?? "low";
    const plan = (score.plan as ActionPlan) ?? FALLBACK_PLAN[riskTier];
    const symptomCategory =
      (score.symptom_category as string) ?? row.quiz_type.replace(/^adaptive:/, "");
    const issueText = (score.issue_text as string | null) ?? null;
    return {
      sessionId: row.id,
      riskTier,
      message: row.result_summary ?? "",
      symptomCategory,
      issueText,
      plan,
    };
  });
