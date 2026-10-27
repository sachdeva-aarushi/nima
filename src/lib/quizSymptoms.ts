// Symptom categories the adaptive quiz can triage. Grounded excerpts from
// 06-POSTPARTUM-REFERENCE-DATA.md Section 4. Each entry carries:
//  - id / label
//  - short reference excerpt to ground the AI prompt
//  - hard-coded fallback questions if AI output fails validation
//  - deterministic risk-tier rules (Section 3) applied to her answers

export type RiskTier = "low" | "moderate" | "high";

export interface QuizQuestion {
  id: string;
  type: "multiple_choice" | "text";
  prompt: string;
  options?: string[];
  /** Optional one-liner the UI surfaces under "why am I being asked this?" */
  rationale?: string;
}

export interface AnswerRecord {
  questionId: string;
  value: string;
}

export interface SymptomCategory {
  id: string;
  label: string;
  /** Short reference excerpt; sent to the model as grounding context. */
  referenceExcerpt: string;
  /** Safe fallback if AI generation fails schema validation. */
  fallbackQuestions: QuizQuestion[];
  /** Deterministic if/else from Section 3 — returns tier from her answers. */
  computeRiskTier: (answers: AnswerRecord[]) => RiskTier;
  /** Short, warm sentence used in result screen for each tier. */
  tierMessages: Record<RiskTier, string>;
}

function ans(answers: AnswerRecord[], id: string): string {
  return (answers.find((a) => a.questionId === id)?.value ?? "").toLowerCase();
}

export const SYMPTOM_CATEGORIES: Record<string, SymptomCategory> = {
  mood: {
    id: "mood",
    label: "mood & emotional wellbeing",
    referenceExcerpt: `Postpartum mood reference (Sec 4.1):
- Baby blues: mild, tearful, transient; usually resolves within 2 weeks postpartum.
- Postpartum depression: persistent low mood, anhedonia, hopelessness lasting >2 weeks; affects 10-15% of mothers.
- Red-flag combinations: thoughts of harming self/baby, inability to care for baby, severe anxiety/panic, intrusive thoughts of harm.
Section 3 tiering: red-flag thoughts -> HIGH. Persistent sadness/anhedonia >2 weeks -> MODERATE. Transient blues <2 weeks -> LOW.`,
    fallbackQuestions: [
      {
        id: "duration",
        type: "multiple_choice",
        prompt: "How long have you been feeling this way?",
        options: ["A few days", "About 1-2 weeks", "More than 2 weeks", "More than a month"],
        rationale: "Duration helps tell baby blues from postpartum depression.",
      },
      {
        id: "joy",
        type: "multiple_choice",
        prompt: "Can you still feel moments of pleasure or connection — with the baby, with people you love?",
        options: ["Yes, often", "Sometimes", "Rarely", "Not at all"],
        rationale: "Loss of joy (anhedonia) is a core depression sign.",
      },
      {
        id: "harm",
        type: "multiple_choice",
        prompt: "Have you had any thoughts of harming yourself or the baby?",
        options: ["No, never", "Fleeting, not acting on them", "Yes, and they scare me"],
        rationale: "This is the single most important safety question — answers route directly to care.",
      },
      {
        id: "function",
        type: "multiple_choice",
        prompt: "Are you able to care for yourself and the baby day to day?",
        options: ["Yes, mostly", "It's a struggle but I'm managing", "No, I can't keep up"],
      },
    ],
    computeRiskTier: (answers) => {
      const harm = ans(answers, "harm");
      if (harm.includes("scare") || harm.includes("yes")) return "high";
      const duration = ans(answers, "duration");
      const joy = ans(answers, "joy");
      const fn = ans(answers, "function");
      const persistent = duration.includes("2 weeks") || duration.includes("month");
      const lowJoy = joy.includes("rarely") || joy.includes("not at all");
      const cantCope = fn.includes("can't") || fn.includes("struggle");
      if (persistent && (lowJoy || cantCope)) return "moderate";
      if (lowJoy && cantCope) return "moderate";
      return "low";
    },
    tierMessages: {
      low: "What you're describing sounds like the early-weeks emotional turbulence many new mothers feel. We'll keep gently checking in.",
      moderate: "What you're describing has lasted long enough that I'd like you to bring it up with your provider soon — you don't have to ride this out alone.",
      high: "What you said matters. I'm taking you to people trained for exactly this moment.",
    },
  },

  bleeding: {
    id: "bleeding",
    label: "postpartum bleeding",
    referenceExcerpt: `Postpartum bleeding reference (Sec 4.2):
- Normal lochia: heavy first 3-4 days, tapers over 2-6 weeks; bright -> brown -> yellow.
- Concerning: soaking >1 pad/hour, large clots (golf-ball+), bright red bleeding returning after it had slowed, foul smell, dizziness/lightheadedness.
Section 3 tiering: soaking 1 pad/hour OR large clots OR dizziness -> HIGH (postpartum hemorrhage risk). Foul smell or bright-red return -> MODERATE (call provider today). Normal lochia volume/color -> LOW.`,
    fallbackQuestions: [
      {
        id: "saturation",
        type: "multiple_choice",
        prompt: "How fast are you soaking through a pad right now?",
        options: ["Less than 1 pad per 4 hours", "About 1 pad every 2-3 hours", "1 pad an hour or more"],
        rationale: "Soaking a pad an hour is the threshold for urgent evaluation.",
      },
      {
        id: "clots",
        type: "multiple_choice",
        prompt: "Are you passing any clots?",
        options: ["None or very small", "Some, smaller than a grape", "Large, golf-ball size or bigger"],
      },
      {
        id: "dizzy",
        type: "multiple_choice",
        prompt: "Do you feel dizzy, weak, or like you might faint?",
        options: ["No", "A little when I stand up", "Yes, even sitting still"],
      },
      {
        id: "smell",
        type: "multiple_choice",
        prompt: "Has the bleeding changed in smell or color recently?",
        options: ["No, looks normal", "Bright red has returned", "Foul or unusual smell"],
      },
    ],
    computeRiskTier: (answers) => {
      const sat = ans(answers, "saturation");
      const clots = ans(answers, "clots");
      const dizzy = ans(answers, "dizzy");
      const smell = ans(answers, "smell");
      if (sat.includes("1 pad an hour") || clots.includes("golf-ball") || dizzy.includes("yes")) return "high";
      if (smell.includes("foul") || smell.includes("bright red") || dizzy.includes("little")) return "moderate";
      return "low";
    },
    tierMessages: {
      low: "What you're describing sounds within the normal range of lochia. Keep an eye on it and rest as much as you can.",
      moderate: "I'd like you to call your provider today and describe this — it's the kind of change worth a same-day check.",
      high: "This needs urgent attention. Please contact your provider or go to the emergency room now.",
    },
  },

  pain: {
    id: "pain",
    label: "pain or physical discomfort",
    referenceExcerpt: `Postpartum pain reference (Sec 4.3):
- Normal: afterpains, perineal/c-section incision soreness, sore breasts during milk-coming-in.
- Concerning: severe headache (esp. with vision changes), chest pain, shortness of breath, calf pain or one-sided leg swelling (DVT risk), incision red/hot/draining (infection), severe abdominal pain.
Section 3 tiering: headache+vision OR chest pain/SOB OR calf swell -> HIGH. Incision signs of infection OR fever -> MODERATE-HIGH (same-day). Normal expected soreness -> LOW.`,
    fallbackQuestions: [
      {
        id: "location",
        type: "multiple_choice",
        prompt: "Where is the pain mostly?",
        options: ["Head", "Chest or with breathing", "Belly / pelvis / incision", "Calf or leg", "Breasts", "Somewhere else"],
      },
      {
        id: "severity",
        type: "multiple_choice",
        prompt: "How would you rate the pain on a 0-10 scale?",
        options: ["1-3 mild", "4-6 moderate", "7-10 severe"],
      },
      {
        id: "redflag",
        type: "multiple_choice",
        prompt: "Are any of these happening with the pain?",
        options: [
          "Nothing else",
          "Vision changes (blurry, spots, flashes)",
          "Shortness of breath",
          "One-sided leg swelling",
          "Red, hot, or draining incision",
        ],
      },
    ],
    computeRiskTier: (answers) => {
      const flag = ans(answers, "redflag");
      const loc = ans(answers, "location");
      const sev = ans(answers, "severity");
      if (
        flag.includes("vision") ||
        flag.includes("shortness") ||
        flag.includes("leg swelling") ||
        (loc.includes("chest") && sev.includes("severe"))
      ) return "high";
      if (flag.includes("incision") || sev.includes("severe")) return "moderate";
      return "low";
    },
    tierMessages: {
      low: "What you're describing sounds like the normal soreness of early recovery. Gentle rest and ice/heat as it suits you.",
      moderate: "I'd like you to call your provider today and describe this — it deserves a same-day look.",
      high: "This needs urgent attention. Please contact your provider or go to the emergency room now.",
    },
  },

  feeding: {
    id: "feeding",
    label: "feeding & breastfeeding",
    referenceExcerpt: `Feeding reference (Sec 4.4):
- Common: sore nipples, latch struggles, engorgement, low supply worries.
- Concerning: hot red wedge on breast + fever (mastitis), cracked nipple with worsening pain, baby not having enough wet diapers (dehydration risk).
Section 3 tiering: fever + breast inflammation -> MODERATE-HIGH (same-day antibiotics likely). Baby <6 wet diapers/day -> MODERATE (call pediatrician). Discomfort without infection signs -> LOW.`,
    fallbackQuestions: [
      {
        id: "what",
        type: "multiple_choice",
        prompt: "What's the main concern?",
        options: ["Latch / soreness", "Supply worries", "Breast pain or hot spot", "Baby not feeding well"],
      },
      {
        id: "fever",
        type: "multiple_choice",
        prompt: "Do you have a fever (over 100.4F / 38C) or chills?",
        options: ["No", "Maybe — feel warm/achy", "Yes, measured fever"],
      },
      {
        id: "diapers",
        type: "multiple_choice",
        prompt: "About how many wet diapers is the baby having per 24 hours?",
        options: ["6 or more", "4-5", "Fewer than 4"],
      },
    ],
    computeRiskTier: (answers) => {
      const what = ans(answers, "what");
      const fever = ans(answers, "fever");
      const diapers = ans(answers, "diapers");
      if (fever.includes("yes") && (what.includes("breast") || what.includes("hot"))) return "high";
      if (fever.includes("maybe") && what.includes("breast")) return "moderate";
      if (diapers.includes("fewer")) return "moderate";
      return "low";
    },
    tierMessages: {
      low: "What you're describing is one of the most common early feeding bumps. Small adjustments often help a lot.",
      moderate: "I'd like you to reach out to your provider or a lactation consultant within the next day.",
      high: "This sounds like it may need same-day medical care — please call your provider now.",
    },
  },

  sleep: {
    id: "sleep",
    label: "sleep",
    referenceExcerpt: `Sleep reference (Sec 4.5):
- Fragmented sleep is universal early postpartum.
- Concerning: complete inability to sleep even when baby sleeps (especially with racing thoughts) can flag postpartum anxiety or hypomania.
Section 3 tiering: cannot sleep at all despite opportunity + racing thoughts -> MODERATE-HIGH. Otherwise fragmented but resting -> LOW.`,
    fallbackQuestions: [
      {
        id: "opportunity",
        type: "multiple_choice",
        prompt: "When the baby sleeps, can you also rest or fall asleep?",
        options: ["Usually yes", "Sometimes", "Almost never"],
      },
      {
        id: "racing",
        type: "multiple_choice",
        prompt: "When you try to sleep, are your thoughts racing or hard to slow down?",
        options: ["No", "A little", "Yes, constantly"],
      },
    ],
    computeRiskTier: (answers) => {
      const opp = ans(answers, "opportunity");
      const racing = ans(answers, "racing");
      if (opp.includes("never") && racing.includes("constantly")) return "high";
      if (opp.includes("never") || racing.includes("constantly")) return "moderate";
      return "low";
    },
    tierMessages: {
      low: "What you're describing fits the fragmented sleep most new mothers live in. Tiny rest windows still count.",
      moderate: "I'd like you to bring this up with your provider — sleep that won't come can be its own thing worth treating.",
      high: "What you're describing — being unable to sleep even when you can — is worth a same-day call to your provider.",
    },
  },
};

export function getCategory(id: string | null | undefined): SymptomCategory {
  if (id && SYMPTOM_CATEGORIES[id]) return SYMPTOM_CATEGORIES[id];
  return SYMPTOM_CATEGORIES.mood;
}

// --- Validation ---------------------------------------------------------

export function validateQuestions(raw: unknown): QuizQuestion[] | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return null;
  if (list.length < 3 || list.length > 5) return null;
  const out: QuizQuestion[] = [];
  for (const q of list) {
    if (!q || typeof q !== "object") return null;
    const r = q as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : null;
    const type = r.type === "multiple_choice" || r.type === "text" ? r.type : null;
    const prompt = typeof r.prompt === "string" && r.prompt.trim() ? r.prompt.trim() : null;
    if (!id || !type || !prompt) return null;
    let options: string[] | undefined;
    if (type === "multiple_choice") {
      if (!Array.isArray(r.options) || r.options.length < 2 || r.options.length > 6) return null;
      options = r.options.map((o) => String(o)).filter((o) => o.trim().length > 0);
      if (options.length < 2) return null;
    }
    const rationale =
      typeof r.rationale === "string" && r.rationale.trim() ? r.rationale.trim() : undefined;
    out.push({ id, type, prompt, options, rationale });
  }
  return out;
}
