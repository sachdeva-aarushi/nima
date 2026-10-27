import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Info, Lock, Heart } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { CoralButton } from "@/components/CoralButton";
import { cn } from "@/lib/utils";
import { checkCrisis, checkHighRiskSymptoms } from "@/lib/crisisCheck";
import { extractInsights, listInsights } from "@/lib/insights.functions";

export const Route = createFileRoute("/_app/checkin")({
  head: () => ({ meta: [{ title: "Daily check-in — Nima" }] }),
  component: CheckinScreen,
});

type Mood = "very_low" | "low" | "okay" | "good" | "great";

const MOODS: { key: Mood; label: string; face: string }[] = [
  { key: "very_low", label: "very low", face: "😢" },
  { key: "low", label: "low", face: "😟" },
  { key: "okay", label: "okay", face: "😐" },
  { key: "good", label: "good", face: "🙂" },
  { key: "great", label: "great", face: "😄" },
];

const SYMPTOMS = [
  "Headache",
  "Back pain",
  "Breast / nipple pain",
  "Fatigue / low energy",
  "Dizziness",
  "Pelvic pain or heaviness",
  "Other",
];

function isHighRisk(_mood: Mood, symptoms: string[], note: string): boolean {
  return checkHighRiskSymptoms(symptoms, note).isCrisis;
}

function pickSymptomCategory(symptoms: string[]): string {
  const s = symptoms.join(" ").toLowerCase();
  if (/bleed/.test(s)) return "bleeding";
  if (/headache|back|pelvic|dizzi/.test(s)) return "pain";
  if (/breast|nipple/.test(s)) return "feeding";
  if (/fatigue|sleep|energy/.test(s)) return "sleep";
  return "mood";
}

function CheckinScreen() {
  const navigate = useNavigate();
  const extract = useServerFn(extractInsights);
  const loadInsights = useServerFn(listInsights);
  const [mood, setMood] = useState<Mood | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [concernKeywords, setConcernKeywords] = useState<string[]>([]);

  useEffect(() => {
    loadInsights()
      .then((rows) => {
        const concerns = rows
          .filter((r) => r.insight_type === "concern" || r.insight_type === "pattern")
          .map((r) => r.insight_text.toLowerCase());
        setConcernKeywords(concerns);
      })
      .catch(() => {});
  }, [loadInsights]);

  // Adaptive ordering — symptoms matching active concern insights bubble up.
  const orderedSymptoms = useMemo(() => {
    if (concernKeywords.length === 0) return SYMPTOMS;
    const score = (s: string) => {
      const lower = s.toLowerCase();
      return concernKeywords.some((c) => c.includes(lower.split(" ")[0]) || lower.split(" ").some((w) => c.includes(w))) ? 1 : 0;
    };
    return [...SYMPTOMS].sort((a, b) => score(b) - score(a));
  }, [concernKeywords]);


  function toggleSymptom(s: string) {
    setSymptoms((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }


  async function save() {
    if (!mood || submitting) return;
    if (checkCrisis(note).isCrisis) {
      navigate({ to: "/crisis" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("Not signed in.");
      const { error } = await supabase.from("checkins").insert({
        user_id: sess.session.user.id,
        mood,
        symptoms,
        note: note.trim() || null,
      });
      if (error) throw error;

      // Fire-and-forget insight extraction over the check-in summary.
      const excerpt = `Check-in — mood: ${mood}; symptoms: ${symptoms.join(", ") || "none"}; note: ${note.trim() || "(none)"}`;
      void extract({ data: { source: "checkin", excerpt } }).catch(() => {});


      if (isHighRisk(mood, symptoms, note)) {
        navigate({ to: "/crisis" });
      } else if (mood === "very_low" || mood === "low" || symptoms.length > 0) {
        const symptom = pickSymptomCategory(symptoms);
        toast.success("Saved. Let's understand it together.");
        navigate({ to: "/quiz", search: { symptom } });
      } else {
        toast.success("Saved. Thank you for showing up today.");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1
            className="text-2xl font-medium leading-tight text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            how are you,<br />today?
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#8A6E6B]">
            There's no right or wrong answer.<br />I'm here to listen.
          </p>
        </div>
        <MascotPortrait state="listening" size="sm" />
      </div>

      {/* Mood */}
      <Section label="How's your mood?">
        <div className="flex justify-between gap-1">
          {MOODS.map((m) => {
            const active = mood === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMood(m.key)}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full border-2 text-2xl transition-all",
                    active ? "border-[#F38B82] bg-[#FFF1EF] scale-105" : "border-transparent bg-[#FAF1EF]"
                  )}
                >
                  {m.face}
                </span>
                <span className={cn("text-[11px]", active ? "font-semibold text-[#F38B82]" : "text-[#8A6E6B]")}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Symptoms */}
      <Section label="Any physical symptoms today?">
        <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {orderedSymptoms.map((s, i) => {
            const active = symptoms.includes(s);
            return (
              <li key={s}>
                <button
                  onClick={() => toggleSymptom(s)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                    i !== 0 && "border-t border-[#F6E6E3]",
                    active ? "text-[#3D2A28]" : "text-[#5B403D]"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded-full border-2 transition-all",
                        active ? "border-[#F38B82] bg-[#F38B82]" : "border-[#E9CFCB] bg-white"
                      )}
                    >
                      {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    {s}
                  </span>
                  <Info className="h-4 w-4 text-[#C7A39F]" />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Note */}
      <Section label="Tell me more (optional)">
        <div className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Write anything that's on your mind..."
            className="w-full resize-none rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 pr-10 text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:border-[#F38B82] focus:outline-none"
          />
          <Heart className="absolute bottom-3 right-3 h-4 w-4 text-[#EFC2BD]" />
        </div>
      </Section>


      <div className="mt-8">
        <CoralButton onClick={save} disabled={!mood || submitting} className="w-full">
          {submitting ? "Saving…" : "save check-in"}
        </CoralButton>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#A8908D]">
          <Lock className="h-3 w-3" /> Your check-ins are private and secure.
        </p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#D4726D]">
        {label}
      </p>
      {children}
    </section>
  );
}
