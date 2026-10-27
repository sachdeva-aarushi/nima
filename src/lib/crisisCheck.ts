// Deterministic crisis-keyword check. Runs BEFORE anything reaches the AI.
// Also exposes the post-birth high-risk symptom check from reference data.

const SELF_HARM_PATTERNS: RegExp[] = [
  /\bkill (myself|me|the baby|my baby)\b/i,
  /\bend (my|it all|my life)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(i\s*want|i\s*wanna|i'?m\s*going)\s*to\s*die\b/i,
  /\b(don'?t|do\s*not)\s*want\s*to\s*(live|be\s*here|exist)\b/i,
  /\bharm\s*(myself|my\s*baby|the\s*baby)\b/i,
  /\bhurt\s*(myself|my\s*baby|the\s*baby)\b/i,
  /\b(shake|shaking|drown|smother|hit)\s*(the|my)\s*baby\b/i,
  /\bbetter\s*off\s*without\s*me\b/i,
  /\bcan'?t\s*go\s*on\b/i,
];

export type CrisisReason = "self_harm_language" | "high_risk_symptoms";

export interface CrisisResult {
  isCrisis: boolean;
  reason?: CrisisReason;
}

export function checkCrisis(text: string): CrisisResult {
  if (!text) return { isCrisis: false };
  for (const re of SELF_HARM_PATTERNS) {
    if (re.test(text)) return { isCrisis: true, reason: "self_harm_language" };
  }
  return { isCrisis: false };
}

// Post-birth deterministic high-risk symptom combinations.
// Reference: 06-POSTPARTUM-REFERENCE-DATA.md Section 2-3.
export function checkHighRiskSymptoms(
  symptoms: string[],
  note: string,
): CrisisResult {
  const has = (s: string) => symptoms.some((x) => x.toLowerCase().includes(s));
  const n = note.toLowerCase();
  const mentions = (re: RegExp) => re.test(n);
  const headache = has("headache") || mentions(/\bhead\s*ache|migraine\b/);
  const pelvic = has("pelvic") || mentions(/\bpelvic\b/);
  const vision = /\bblurry|blurred|vision|see (spots|stars)|spots\b/.test(n);
  const heavyBleed = /\b(soak(ing)?\s*(a\s*)?pad|heavy\s*bleed|hemorrhag)/.test(n);
  const chestPain = /\bchest\s*pain|short(ness)?\s*of\s*breath/.test(n);
  const calfSwell = /\bcalf\s*(pain|swell)|one\s*leg\s*swell/.test(n);
  const fever = /\bfever|10[01]\.[0-9]|temperature/.test(n);

  if (headache && vision) return { isCrisis: true, reason: "high_risk_symptoms" };
  if (heavyBleed) return { isCrisis: true, reason: "high_risk_symptoms" };
  if (chestPain) return { isCrisis: true, reason: "high_risk_symptoms" };
  if (calfSwell) return { isCrisis: true, reason: "high_risk_symptoms" };
  if (fever && (headache || pelvic)) {
    return { isCrisis: true, reason: "high_risk_symptoms" };
  }
  return { isCrisis: false };
}
