import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Droplet,
  Heart,
  Info,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UserPlus,
  BookOpen,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { DURATIONS, EASE_SOFT, STAGGER_STEP, transitions, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/progress")({
  head: () => ({ meta: [{ title: "Your journey with Nima" }] }),
  component: JourneyScreen,
});

type InsightType = Database["public"]["Enums"]["insight_type"];
type DeliveryType = Database["public"]["Enums"]["delivery_type"];

interface InsightRow {
  id: string;
  insight_type: InsightType;
  insight_text: string;
  confidence: Database["public"]["Enums"]["insight_confidence"];
  last_confirmed_at: string;
  created_at: string;
}

interface TimelineEntry {
  id: string;
  date: string; // ISO
  text: string;
  kind: "milestone" | "concern" | "context" | "log";
}

interface ResearchInsight {
  id: string;
  finding: string;
  citation: string;
  bridge: string;
}

interface PartnerInfo {
  linked: boolean;
  name?: string | null;
  lastAlertDate?: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function weekFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const ms = Date.now() - new Date(birth).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Translate raw insight text into warm, plain-language UI text.
// We trust the stored text (the agent persona is already careful),
// just clean up the formatting and ensure first letter is lowercase
// to match the screen's tone.
function softenInsightText(s: string): string {
  const trimmed = s.trim().replace(/^["'\s]+|["'\s.]+$/g, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

// Normalize an insight string into a comparable token set. Strips stopwords,
// applies light stemming, and folds common postpartum synonyms so phrases like
// "preparing for a transition back to work" and "is preparing for an upcoming
// return to work" collapse to the same concept.
const STOP_WORDS = new Set([
  "a","an","the","and","or","but","is","am","are","was","were","be","been","being",
  "i","im","ive","my","me","you","your","she","her","he","his","it","its",
  "to","of","in","on","at","for","with","from","about","as","that","this","these","those",
  "have","has","had","do","does","did","feel","feels","feeling","felt","really","very","just","quite","bit",
  "nima","noticed","remembered","logged","mentioned","said","mom","mother",
  "near","future","upcoming","soon","day","days","week","weeks","time","times","lot","lots",
  "some","any","every","much","more","most","less","few","new",
]);
const SYNONYMS: Record<string, string> = {
  return: "return", returning: "return", transition: "return", transitioning: "return",
  back: "return", going: "return", go: "return", coming: "return",
  work: "work", job: "work", office: "work", employment: "work", career: "work",
  prepare: "prepare", preparing: "prepare", prep: "prepare", ready: "prepare", planning: "prepare",
  baby: "baby", infant: "baby", child: "baby", little: "baby", newborn: "baby",
  sleep: "sleep", sleeping: "sleep", sleeps: "sleep", nap: "sleep", rest: "sleep",
  feed: "feed", feeding: "feed", breastfeed: "feed", breastfeeding: "feed", formula: "feed", nursing: "feed",
  low: "low", sad: "low", down: "low", blue: "low", lonely: "low", loneliness: "low",
  anxious: "anxious", anxiety: "anxious", worried: "anxious", worry: "anxious", stressed: "anxious", stress: "anxious",
  overwhelmed: "anxious", overwhelm: "anxious",
  tired: "tired", exhausted: "tired", drained: "tired", fatigue: "tired",
  partner: "partner", husband: "partner", spouse: "partner",
};
function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/)) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    const stemmed = raw.replace(/(ing|ed|s)$/u, "");
    const folded = SYNONYMS[raw] ?? SYNONYMS[stemmed] ?? stemmed;
    if (folded.length < 2 || STOP_WORDS.has(folded)) continue;
    out.add(folded);
  }
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
// Pairwise dedupe: items are duplicates if they share the same bucket AND
// their tokenized text overlaps by >= threshold (Jaccard).
function dedupeSimilar<T>(
  items: T[],
  bucketFn: (item: T) => string,
  textFn: (item: T) => string,
  threshold = 0.4,
): T[] {
  const kept: { item: T; bucket: string; tokens: Set<string> }[] = [];
  for (const item of items) {
    const bucket = bucketFn(item);
    const tokens = tokenize(textFn(item));
    const dup = kept.some(
      (k) =>
        k.bucket === bucket &&
        tokens.size > 0 &&
        k.tokens.size > 0 &&
        jaccard(k.tokens, tokens) >= threshold,
    );
    if (!dup) kept.push({ item, bucket, tokens });
  }
  return kept.map((k) => k.item);
}


function insightVisual(type: InsightType) {
  switch (type) {
    case "context":
      return {
        bg: "bg-[#3D3633]",
        ring: "ring-[#5A4F4B]",
        text: "text-[#FAF1EF]",
        badgeBg: "bg-[#4A3C38]",
        badgeText: "text-[#FAF1EF]",
        Icon: Clock,
        iconColor: "text-[#F38B82]",
      };
    case "concern":
      return {
        bg: "bg-[#3D3633]",
        ring: "ring-[#5A4F4B]",
        text: "text-[#FAF1EF]",
        badgeBg: "bg-[#4A3C38]",
        badgeText: "text-[#FAF1EF]",
        Icon: Heart,
        iconColor: "text-[#F38B82]",
      };
    case "preference":
      return {
        bg: "bg-[#E6F0E7]",
        ring: "ring-[#C7DCC9]",
        text: "text-[#3A5A40]",
        badgeBg: "bg-[#CFE2D1]",
        badgeText: "text-[#3A5A40]",
        Icon: Star,
        iconColor: "text-[#7BA886]",
      };
    case "pattern":
      return {
        bg: "bg-[#F0E4F8]",
        ring: "ring-[#DBC8EB]",
        text: "text-[#4C336B]",
        badgeBg: "bg-[#E0CFEE]",
        badgeText: "text-[#4C336B]",
        Icon: Sparkles,
        iconColor: "text-[#B17ECE]",
      };
    default:
      return {
        bg: "bg-white",
        ring: "ring-[#F0E4E0]",
        text: "text-[#3D2A28]",
        badgeBg: "bg-[#F8D2CC]",
        badgeText: "text-[#7A4039]",
        Icon: Sparkles,
        iconColor: "text-[#D4726D]",
      };
  }
}

function buildResearchInsights(
  delivery: DeliveryType | null,
  traumatic: boolean | null,
  week: number | null,
): ResearchInsight[] {
  const out: ResearchInsight[] = [];
  if (delivery === "c_section") {
    out.push({
      id: "csec",
      finding:
        "Mothers recovering from cesarean delivery are at higher risk for delayed wound healing and venous thromboembolism in the first 6 weeks postpartum.",
      citation:
        "ACOG Committee Opinion No. 736 (2018); Sultan et al., JAMA 2021. Peer-reviewed.",
      bridge: "Nima is watching for this in your conversations.",
    });
  }
  if (delivery === "assisted") {
    out.push({
      id: "assist",
      finding:
        "Assisted vaginal deliveries (forceps/vacuum) carry an elevated risk of pelvic-floor symptoms and perineal pain through weeks 4–8.",
      citation: "Cochrane Pregnancy & Childbirth Group, 2017. Peer-reviewed.",
      bridge: "Nima is watching for this in your conversations.",
    });
  }
  if (traumatic) {
    out.push({
      id: "trauma",
      finding:
        "Mothers who describe their birth as traumatic have a roughly 3–4× higher risk of postpartum PTSD symptoms in the first 12 weeks.",
      citation: "Dekel et al., Frontiers in Psychology, 2017. Peer-reviewed.",
      bridge: "Nima is calibrated to listen for this without naming it.",
    });
  }
  if (out.length === 0 && week !== null && week >= 2 && week <= 4) {
    out.push({
      id: "wk-cardio",
      finding:
        "Weeks 2–4 are when cardiovascular risk patterns (preeclampsia, postpartum hypertension) most often emerge.",
      citation: "ACOG Practice Bulletin No. 222 (2020). Peer-reviewed.",
      bridge: "Nima is watching for early signs in your conversations.",
    });
  }
  return out.slice(0, 2);
}

function fadeUpProps(reduced: boolean, delay = 0) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      whileInView: { opacity: 1 },
      viewport: { once: true, amount: 0.2 },
      transition: { duration: DURATIONS.fast, ease: EASE_SOFT },
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: DURATIONS.base, ease: EASE_SOFT, delay },
  };
}

// ── screen ───────────────────────────────────────────────────────────────────

function JourneyScreen() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("");
  const [week, setWeek] = useState<number | null>(null);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [research, setResearch] = useState<ResearchInsight[]>([]);
  const [weeklyResearchSummary, setWeeklyResearchSummary] = useState<string>("");
  const [partner, setPartner] = useState<PartnerInfo>({ linked: false });
  const [openCitation, setOpenCitation] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        navigate({ to: "/auth" });
        return;
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        { data: prof },
        { data: insightRows },
        { data: logRows },
        { data: cardsShown },
        { data: consent },
        { data: alertRows },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, birth_date, delivery_type, birth_traumatic, linked_user_id")
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("mother_insights")
          .select("id, insight_type, insight_text, confidence, last_confirmed_at, created_at")
          .eq("user_id", uid)
          .eq("active", true)
          .order("confidence", { ascending: false })
          .order("last_confirmed_at", { ascending: false })
          .limit(12),
        supabase
          .from("insight_extraction_log")
          .select(
            "id, created_at, raw_excerpt, source, extracted_insight_id, mother_insights!insight_extraction_log_extracted_insight_id_fkey(insight_type, insight_text)",
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("insight_cards_shown")
          .select("card_key, context, shown_at")
          .eq("user_id", uid)
          .gte("shown_at", sevenDaysAgo.toISOString())
          .order("shown_at", { ascending: false })
          .limit(10),
        supabase
          .from("partner_consent_settings")
          .select("mother_user_id")
          .eq("mother_user_id", uid)
          .maybeSingle(),
        supabase
          .from("partner_care_alerts")
          .select("created_at")
          .eq("mother_user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      void consent;

      const name = (prof?.name ?? "").split(" ")[0] ?? "";
      setFirstName(name);
      const wk = weekFromBirth(prof?.birth_date ?? null);
      setWeek(wk);

      setInsights(
        dedupeSimilar(
          (insightRows ?? []) as InsightRow[],
          (r) => r.insight_type,
          (r) => r.insight_text,
        ),
      );



      // Build the timeline. Prefer the extraction log entries that resulted
      // in a stored insight; fall back to "Nima logged: <excerpt>" when the
      // extraction didn't yield one.
      const entries: TimelineEntry[] = [];
      for (const row of logRows ?? []) {
        const linked = (row as unknown as {
          mother_insights: { insight_type: InsightType; insight_text: string } | null;
        }).mother_insights;
        if (linked && linked.insight_text) {
          const kind: TimelineEntry["kind"] =
            linked.insight_type === "concern"
              ? "concern"
              : linked.insight_type === "context"
                ? "context"
                : linked.insight_type === "preference"
                  ? "context"
                  : "log";
          entries.push({
            id: row.id,
            date: row.created_at,
            text: `Nima ${linked.insight_type === "concern" ? "noticed" : "remembered"}: ${softenInsightText(linked.insight_text)}`,
            kind,
          });
        } else if (row.raw_excerpt) {
          entries.push({
            id: row.id,
            date: row.created_at,
            text: `Nima logged: ${softenInsightText(row.raw_excerpt).slice(0, 110)}`,
            kind: "log",
          });
        }
      }
      // Stitch in milestone records from health_records as well (any milestone
      // captured by the chat tool). Limit so the timeline stays scannable.
      const { data: milestones } = await supabase
        .from("health_records")
        .select("id, created_at, title, value, record_type")
        .eq("user_id", uid)
        .eq("record_type", "milestone")
        .order("created_at", { ascending: false })
        .limit(6);
      for (const m of milestones ?? []) {
        const label =
          (m.value as { label?: string } | null)?.label ??
          (m.title ? m.title.replace(/_/g, " ") : "a milestone");
        entries.push({
          id: `m_${m.id}`,
          date: m.created_at,
          text: `Nima noted: ${label} ✓`,
          kind: "milestone",
        });
      }
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const dedupedEntries = dedupeSimilar(entries, (e) => e.kind, (e) => e.text);
      setTimeline(dedupedEntries.slice(0, 10));


      // Research portrait
      setResearch(
        buildResearchInsights(
          prof?.delivery_type ?? null,
          prof?.birth_traumatic ?? null,
          wk,
        ),
      );

      // Weekly research summary
      const cards = cardsShown ?? [];
      if (cards.length > 0) {
        const observations = cards
          .map((c) => {
            const ctx = c.context as { observation?: string } | null;
            return ctx?.observation;
          })
          .filter((s): s is string => !!s)
          .slice(0, 2);
        if (observations.length > 0) {
          setWeeklyResearchSummary(
            `This week, Nima surfaced ${observations.length === 1 ? "one insight" : `${observations.length} insights`} from the research: ${observations.join(" Also — ")}`,
          );
        }
      }
      if (!weeklyResearchSummary) {
        if (wk !== null && wk >= 2 && wk <= 4) {
          setWeeklyResearchSummary(
            `Week ${wk} is when cardiovascular risk patterns most often shift — Nima is calibrated to this and listening accordingly.`,
          );
        } else if (wk !== null && wk >= 5 && wk <= 8) {
          setWeeklyResearchSummary(
            `Weeks 5–8 are when emotional patterns often crystallize. Nima is paying close attention to how you describe your days.`,
          );
        } else {
          setWeeklyResearchSummary(
            `Nima reads the latest postpartum research and watches for early signs of anything matching your profile.`,
          );
        }
      }

      // Partner info
      if (prof?.linked_user_id) {
        const { data: partnerProf } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", prof.linked_user_id)
          .maybeSingle();
        setPartner({
          linked: true,
          name: partnerProf?.name?.split(" ")[0] ?? null,
          lastAlertDate: alertRows && alertRows.length > 0 ? alertRows[0].created_at : null,
        });
      } else {
        setPartner({ linked: false });
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const showInsightEmpty = !loading && insights.length < 3;
  const showTimelineEmpty = !loading && timeline.length < 3;

  const headerSubtext = useMemo(() => {
    if (week === null) return "here's what we've built together.";
    return `Week ${week} of your fourth trimester — here's what we've built together.`;
  }, [week]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDE7E4] px-5 pb-20 pt-6">
        <div className="mx-auto max-w-md">
          <div className="h-32 animate-pulse rounded-3xl bg-white/50" />
          <div className="mt-4 h-24 animate-pulse rounded-3xl bg-white/50" />
          <div className="mt-4 h-48 animate-pulse rounded-3xl bg-white/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDE7E4] pb-24">
      {/* Top nav: back + more */}
      <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5B403D] shadow-sm transition active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5B403D] shadow-sm transition active:scale-95"
          aria-label="More"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Header */}
      <header className="mx-auto mt-2 max-w-md px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.softSlow}
          className="flex justify-center"
        >
          <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-[#F8D2CC]/70 ring-1 ring-[#F5C5BF]">
            <MascotPortrait state="happy" size="sm" accents={false} priority />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitions.soft, delay: 0.1 }}
          className="mt-3 text-[28px] leading-tight text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          your journey with nima
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitions.soft, delay: 0.18 }}
          className="mt-2 text-[12.5px] leading-relaxed text-[#8A6E6B]"
        >
          {headerSubtext}
        </motion.p>
      </header>

      <div className="mx-auto mt-6 max-w-md space-y-4 px-3">
        {/* (removed) what nima has noticed */}


        {/* SECTION 2 — Research portrait */}
        <motion.section
          {...fadeUpProps(reduced)}
          className="rounded-[28px] bg-white/85 px-4 py-4 shadow-[0_2px_12px_-6px_rgba(122,64,57,0.18)]"
        >
          <SectionHeader
            number={1}
            tone="purple"
            title="research relevant to you"
            rightText="Why this matters"
            rightIcon={<Info className="h-3 w-3 text-[#8A6E6B]" />}
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(research.length === 0
              ? [
                  {
                    id: "default",
                    finding:
                      "1 in 5 mothers experience postpartum depression. Nima is here to catch the signs early.",
                    citation: "WHO postpartum mental-health overview.",
                    bridge: "Nima is watching for this in your conversations.",
                  },
                ]
              : research
            ).map((r, idx) => {
              const Icon = idx === 0 ? Users : Droplet;
              return (
                <article
                  key={r.id}
                  className="rounded-2xl bg-[#3D3633] p-4"
                >
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4A3C38] text-[#FAF1EF]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-[13px] leading-snug text-[#FAF1EF]">{r.finding}</p>
                  </div>
                  <button
                    onClick={() => setOpenCitation(openCitation === r.id ? null : r.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#4A3C38] px-2.5 py-1 text-[10.5px] font-medium text-[#FAF1EF] transition hover:bg-[#5A4F4B]"
                  >
                    <BookOpen className="h-3 w-3" />
                    source: peer-reviewed research
                  </button>
                  <AnimatePresence>
                    {openCitation === r.id && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={transitions.softFast}
                        className="mt-2 overflow-hidden text-[11px] italic leading-relaxed text-[#B59A97]"
                      >
                        {r.citation}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className="mt-3 flex items-center gap-1.5 border-t border-[#5A4F4B]/60 pt-2.5 text-[11px] text-[#B59A97]">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="italic">{r.bridge}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </motion.section>

        {/* SECTION 3 — Your story so far (timeline) */}
        <motion.section
          {...fadeUpProps(reduced)}
          className="rounded-[28px] bg-white/85 px-4 py-4 shadow-[0_2px_12px_-6px_rgba(122,64,57,0.18)]"
        >
          <SectionHeader
            number={2}
            tone="coral"
            title="your story so far"
            rightText="Nima's notes from our conversations"
          />
          {showTimelineEmpty ? (
            <div className="mt-3 rounded-2xl bg-[#FDE7E4]/60 p-5 text-center">
              <p className="text-[14px] leading-relaxed text-[#5B403D]">
                Your story is just beginning. Every conversation adds to it.
              </p>
            </div>
          ) : (
            <div className="relative mt-4 pl-6">
              {/* the drawing line */}
              <motion.span
                aria-hidden
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: DURATIONS.slow, ease: EASE_SOFT }}
                style={{ transformOrigin: "top" }}
                className="absolute left-[10px] top-2 bottom-2 w-[2px] rounded-full bg-[#E5C9C5]"
              />
              <ul className="space-y-2.5">
                {timeline.map((t, i) => {
                  const tone =
                    t.kind === "milestone"
                      ? {
                          dot: "text-[#7BA886]",
                          iconBg: "bg-[#E6F0E7]",
                          iconColor: "text-[#7BA886]",
                          badgeBg: "bg-[#CFE2D1]",
                          badgeText: "text-[#3A5A40]",
                          label: "milestone",
                          Icon: CheckCircle2,
                        }
                      : t.kind === "concern"
                        ? {
                            dot: "text-[#F38B82]",
                            iconBg: "bg-[#3D3633]",
                            iconColor: "text-[#FAF1EF]",
                            badgeBg: "bg-[#4A3C38]",
                            badgeText: "text-[#FAF1EF]",
                            label: "concern",
                            Icon: Heart,
                          }
                        : t.kind === "context"
                          ? {
                              dot: "text-[#D4726D]",
                              iconBg: "bg-[#FDE7E4]",
                              iconColor: "text-[#D4726D]",
                              badgeBg: "bg-[#F8D2CC]",
                              badgeText: "text-[#7A4039]",
                              label: "context",
                              Icon: Clock,
                            }
                          : {
                              dot: "text-[#B17ECE]",
                              iconBg: "bg-[#F0E4F8]",
                              iconColor: "text-[#B17ECE]",
                              badgeBg: "bg-[#E0CFEE]",
                              badgeText: "text-[#4C336B]",
                              label: "symptom",
                              Icon: Plus,
                            };
                  return (
                    <motion.li
                      key={t.id}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8 }}
                      whileInView={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{
                        duration: DURATIONS.base,
                        ease: EASE_SOFT,
                        delay: 0.25 + i * 0.1,
                      }}
                      className="relative flex items-start gap-3"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[1px] top-3 grid h-4 w-4 place-items-center rounded-full bg-white",
                          tone.dot,
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <div className="w-12 shrink-0 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-[#A8908D]">
                        {fmtShortDate(t.date)}
                      </div>
                      <div className="flex flex-1 items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
                        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", tone.iconBg, tone.iconColor)}>
                          <tone.Icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="flex-1 text-[12.5px] leading-snug text-[#3D2A28]">{t.text}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            tone.badgeBg,
                            tone.badgeText,
                          )}
                        >
                          {tone.label}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#FDE7E4]/60 p-3.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#7BA886]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <p className="flex-1 text-[12.5px] leading-snug text-[#5B403D]">
                  Every conversation adds to your story.
                  <br />
                  <span className="italic text-[#8A6E6B]">I'm always listening.</span>
                </p>
                <Heart className="h-4 w-4 fill-[#F38B82] text-[#F38B82]" />
              </div>
            </div>
          )}
        </motion.section>

        {/* SECTION 4 — Your week in research */}
        <motion.section
          {...fadeUpProps(reduced)}
          className="rounded-[28px] bg-white/85 px-4 py-4 shadow-[0_2px_12px_-6px_rgba(122,64,57,0.18)]"
        >
          <SectionHeader
            number={3}
            tone="purple"
            title="your week in research"
            rightText={week !== null ? `Week ${week} focus` : "This week's focus"}
            rightIcon={<Info className="h-3 w-3 text-[#8A6E6B]" />}
          />
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#3D3633] p-4">
            <div className="flex items-start gap-3 pr-20">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4A3C38] text-[#FAF1EF]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[14px] font-semibold leading-snug text-[#FAF1EF]">
                  {weeklyResearchSummary.split(".")[0]}.
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#FAF1EF]/85">
                  {weeklyResearchSummary.split(".").slice(1).join(".").trim() ||
                    "Nima is calibrated to this and will help you notice what matters."}
                </p>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-2 right-1 opacity-95">
              <MascotPortrait state="thinking" size="sm" accents={false} />
            </div>
          </div>
        </motion.section>

        {/* SECTION 5 — Partner connection */}
        <motion.section
          {...fadeUpProps(reduced)}
          className="rounded-[28px] bg-white/85 px-4 py-4 shadow-[0_2px_12px_-6px_rgba(122,64,57,0.18)]"
        >
          <SectionHeader
            number={4}
            tone="coral"
            title="partner connection"
            rightText={partner.linked ? "Shared with your permission" : "Invite when ready"}
            rightIcon={<Info className="h-3 w-3 text-[#8A6E6B]" />}
          />
          {partner.linked ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#FDE7E4] p-4">
              <div className="relative flex shrink-0 -space-x-3">
                <MascotPortrait state="happy" size="sm" accents={false} />
                <MascotPortrait state="comforting" size="sm" accents={false} />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-[#3D2A28]">
                  {partner.name
                    ? `Your partner, ${partner.name}, is connected`
                    : "Your partner is connected"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[#8A6E6B]">
                  {partner.lastAlertDate
                    ? `Last care alert sent: ${fmtShortDate(partner.lastAlertDate)}`
                    : "No alerts sent yet"}
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-[#8A6E6B]">
                  Nima guides him on how to support you based on how you're doing.
                </p>
              </div>
              <Link
                to="/me"
                className="shrink-0 self-center rounded-full border border-[#D4726D] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#D4726D] transition active:scale-95"
              >
                manage <ArrowRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#FDE7E4] p-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/80 text-[#D4726D]">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-[#3D2A28]">
                  Nima can keep your partner informed
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#8A6E6B]">
                  Invite them to join your journey — you choose exactly what they see.
                </p>
              </div>
              <Link
                to="/me"
                className="shrink-0 self-center rounded-full border border-[#D4726D] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#D4726D] transition active:scale-95"
              >
                invite <ArrowRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

// ── small section header ─────────────────────────────────────────────────────

function SectionHeader({
  number,
  tone,
  title,
  rightText,
  rightIcon,
}: {
  number: number;
  tone: "coral" | "purple";
  title: string;
  rightText?: string;
  rightIcon?: React.ReactNode;
}) {
  const numStyles =
    tone === "coral"
      ? "bg-[#F38B82] text-white"
      : "bg-[#3D3633] text-[#FAF1EF]";
  const titleColor = tone === "coral" ? "text-[#7A4039]" : "text-[#3D3633]";
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold",
            numStyles,
          )}
        >
          {number}
        </span>
        <h2 className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", titleColor)}>
          {title}
        </h2>
      </div>
      {rightText && (
        <span className="flex items-center gap-1 text-[10.5px] text-[#8A6E6B]">
          {rightText}
          {rightIcon}
        </span>
      )}
    </div>
  );
}
