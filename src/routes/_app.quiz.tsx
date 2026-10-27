import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { NimaMascot } from "@/components/NimaMascot";
import { CoralButton } from "@/components/CoralButton";
import { cn } from "@/lib/utils";
import {
  SYMPTOM_CATEGORIES,
  type AnswerRecord,
  type QuizQuestion,
} from "@/lib/quizSymptoms";
import {
  classifyIssueText,
  generateQuiz,
  submitQuiz,
} from "@/lib/quiz.functions";
import { extractInsights } from "@/lib/insights.functions";

interface QuizSearch {
  symptom?: string;
  issue?: string;
  from?: string;
}

export const Route = createFileRoute("/_app/quiz")({
  head: () => ({ meta: [{ title: "Quick quiz — Nima" }] }),
  validateSearch: (raw: Record<string, unknown>): QuizSearch => ({
    symptom: typeof raw.symptom === "string" ? raw.symptom : undefined,
    issue: typeof raw.issue === "string" ? raw.issue : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
  }),
  component: QuizScreen,
});

type Phase = "loading" | "questions" | "submitting";

function weeksBetween(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
}

function QuizScreen() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const gen = useServerFn(generateQuiz);
  const submit = useServerFn(submitQuiz);
  const extract = useServerFn(extractInsights);

  const initialCategory = search.issue
    ? classifyIssueText(search.issue)
    : search.symptom ?? "mood";

  const [phase, setPhase] = useState<Phase>("loading");
  const [symptomId] = useState<string>(initialCategory);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [step, setStep] = useState(0);
  const [openRationale, setOpenRationale] = useState(false);

  const category = SYMPTOM_CATEGORIES[symptomId] ?? SYMPTOM_CATEGORIES.mood;
  const current = questions[step];
  const currentAnswer = current ? answers.find((a) => a.questionId === current.id)?.value ?? "" : "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id;
        let weekPostpartum: number | null = null;
        let deliveryType: string | null = null;
        if (uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("birth_date, delivery_type")
            .eq("id", uid)
            .maybeSingle();
          weekPostpartum = weeksBetween(profile?.birth_date);
          deliveryType = profile?.delivery_type ?? null;
        }
        const out = await gen({
          data: {
            symptomCategory: symptomId,
            weekPostpartum,
            deliveryType,
            issueText: search.issue ?? null,
          },
        });
        if (cancelled) return;
        setSessionId(out.sessionId);
        setQuestions(out.questions);
        setAnswers([]);
        setStep(0);
        setPhase("questions");
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Couldn't start quiz.");
        navigate({ to: search.from === "nima" ? "/nima" : "/checkin" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAnswerValue(value: string) {
    if (!current) return;
    setAnswers((arr) => {
      const others = arr.filter((a) => a.questionId !== current.id);
      return [...others, { questionId: current.id, value }];
    });
  }

  async function next() {
    if (!current || !currentAnswer.trim()) return;
    if (step < questions.length - 1) {
      setStep((s) => s + 1);
      setOpenRationale(false);
      return;
    }
    if (!sessionId) return;
    setPhase("submitting");
    try {
      const out = await submit({ data: { sessionId, answers } });
      // Fire-and-forget extraction summarising what she shared in the quiz.
      const summary = answers
        .map((a) => {
          const q = questions.find((qq) => qq.id === a.questionId);
          return q ? `${q.prompt} → ${a.value}` : null;
        })
        .filter(Boolean)
        .join("\n");
      const excerpt = `Quiz (${category.label})${search.issue ? `\nHer words: ${search.issue}` : ""}\n${summary}`;
      void extract({ data: { source: "quiz", excerpt } }).catch(() => {});
      navigate({ to: "/action-plan", search: { session: out.sessionId, from: search.from } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your answers.");
      setPhase("questions");
    }
  }

  if (phase === "loading" || !current) {
    return (
      <div className="mx-auto max-w-md px-5 pb-10 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate({ to: search.from === "nima" ? "/nima" : "/checkin" })}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="rounded-full bg-[#EAE9F8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#7E6BCB]">
            Understanding the issue
          </span>
        </div>
        <div className="mt-12 flex flex-col items-center text-center">
          <MascotPortrait state="thinking" size="lg" />
          <p className="mt-5 text-sm text-[#8A6E6B]">preparing a few gentle questions…</p>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const progress = ((step + 1) / total) * 100;

  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? navigate({ to: search.from === "nima" ? "/nima" : "/checkin" }) : setStep((s) => s - 1))}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="rounded-full bg-[#EAE9F8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#7E6BCB]">
          {category.label}
        </span>
      </div>

      {search.from === "nima" && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#F1D9D5] bg-[#FFF5F3] px-3 py-2 text-[11px] leading-snug text-[#8A6E6B]">
          <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFEEEB]">
            <NimaMascot state="listening" size="sm" className="h-full w-full" />
          </span>
          <span>Nima suggested these questions based on your conversation.</span>
        </div>
      )}

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F6E6E3]">
        <div
          className="h-full rounded-full bg-[#F38B82] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[#A8908D]">
        Step {step + 1} of {total}
      </p>

      <h1
        className="mt-5 text-2xl leading-snug text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        {current.prompt}
      </h1>
      <p className="mt-2 text-xs leading-relaxed text-[#8A6E6B]">
        Be gentle with yourself; there are no wrong answers.
      </p>

      {current.rationale && (
        <button
          onClick={() => setOpenRationale((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#7E6BCB]"
        >
          <Info className="h-3 w-3" /> why am I being asked this?
        </button>
      )}
      {openRationale && current.rationale && (
        <p className="mt-2 rounded-xl bg-[#EAE9F8] px-3 py-2 text-[11px] leading-relaxed text-[#5B4D8E]">
          {current.rationale}
        </p>
      )}

      <div className="mt-5 space-y-2.5">
        {current.type === "multiple_choice" && current.options ? (
          current.options.map((opt) => {
            const active = currentAnswer === opt;
            return (
              <button
                key={opt}
                onClick={() => setAnswerValue(opt)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left text-sm transition-all",
                  active
                    ? "border-[#F38B82] text-[#3D2A28] shadow-sm"
                    : "border-transparent text-[#5B403D]"
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all",
                    active ? "border-[#F38B82]" : "border-[#E9CFCB]"
                  )}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-[#F38B82]" />}
                </span>
                <span>{opt}</span>
              </button>
            );
          })
        ) : (
          <textarea
            value={currentAnswer}
            onChange={(e) => setAnswerValue(e.target.value)}
            rows={4}
            placeholder="A sentence or two is enough…"
            className="w-full resize-none rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:border-[#F38B82] focus:outline-none"
          />
        )}
      </div>

      <div className="mt-8">
        <CoralButton
          onClick={next}
          disabled={!currentAnswer.trim() || phase === "submitting"}
          className="w-full"
        >
          {phase === "submitting"
            ? "building your plan…"
            : step < total - 1
              ? "continue"
              : "see my action plan"}
        </CoralButton>
        <button
          onClick={() => navigate({ to: search.from === "nima" ? "/nima" : "/checkin" })}
          className="mt-3 block w-full text-center text-xs font-medium text-[#D4726D] underline-offset-2 hover:underline"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
