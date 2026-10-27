import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Phone,
  Check,
  ChevronRight,
  Info,
  ClipboardList,
  Droplet,
  Moon,
  Wind,
  Footprints,
  Flame,
  Snowflake,
} from "lucide-react";
import { toast } from "sonner";

import { MascotPortrait } from "@/components/MascotPortrait";
import {
  loadActionPlan,
  type ActionPlan,
  type NonMedIcon,
} from "@/lib/quiz.functions";
import type { RiskTier } from "@/lib/quizSymptoms";
import { cn } from "@/lib/utils";

interface ActionPlanSearch {
  session?: string;
  from?: string;
}

export const Route = createFileRoute("/_app/action-plan")({
  head: () => ({ meta: [{ title: "Your action plan — Nima" }] }),
  validateSearch: (raw: Record<string, unknown>): ActionPlanSearch => ({
    session: typeof raw.session === "string" ? raw.session : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
  }),
  component: ActionPlanScreen,
});

const ICON_MAP: Record<NonMedIcon, typeof Droplet> = {
  hydration: Droplet,
  rest: Moon,
  "fresh air": Wind,
  walk: Footprints,
  "warm compress": Flame,
  "cool compress": Snowflake,
};

function ActionPlanScreen() {
  const navigate = useNavigate();
  const { session, from } = Route.useSearch();
  const homeTo = from === "nima" ? "/nima" : "/dashboard";
  const load = useServerFn(loadActionPlan);

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [riskTier, setRiskTier] = useState<RiskTier>("low");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate({ to: homeTo });
      return;
    }
    load({ data: { sessionId: session } })
      .then((res) => {
        setPlan(res.plan);
        setRiskTier(res.riskTier);
        setMessage(res.message);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Couldn't load your action plan.");
        navigate({ to: homeTo });
      })
      .finally(() => setLoading(false));
  }, [session, load, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 pt-16 text-center text-sm text-[#A8908D]">
        preparing your plan…
      </div>
    );
  }
  if (!plan) return null;

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-5">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: homeTo })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-lg text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          action plan
        </h1>
        <MascotPortrait state="happy" size="sm" accents={false} />
      </header>

      {/* High-risk escalation — TOP of screen, visually prioritized */}
      {riskTier === "high" ? (
        <a
          href="tel:911"
          className="mb-5 flex items-start gap-3 rounded-2xl bg-[#F38B82] p-4 text-white shadow-md"
        >
          <Phone className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">this is serious.</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/90">
              please call your doctor or emergency services right now. tap here to call.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0" />
        </a>
      ) : (
        <div className="mb-5 rounded-2xl border-2 border-dashed border-[#F1D9D5] bg-[#FFF5F3] p-4">
          <div className="flex items-center gap-3 text-[#C7A39F]">
            <Phone className="h-4 w-4" />
            <p className="text-xs leading-relaxed">
              high-risk alert would appear here only when needed.
            </p>
          </div>
        </div>
      )}

      <h2
        className="text-3xl text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        your action plan
      </h2>
      {message && (
        <p className="mt-2 text-sm leading-relaxed text-[#8A6E6B]">{message}</p>
      )}

      {/* Step cards */}
      <ol className="mt-5 space-y-3">
        {plan.steps.map((s, i) => {
          const isDone = !!completed[i];
          return (
            <li
              key={`${s.when}-${i}`}
              className="relative rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFE3DF] text-xs font-semibold text-[#D4726D]">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p
                    className="text-base font-medium text-[#3D2A28]"
                    style={{ fontFamily: "ui-serif, Georgia, serif" }}
                  >
                    {s.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#8A6E6B]">{s.body}</p>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#C7A39F]">
                    {s.when}
                  </p>
                </div>
                <button
                  onClick={() => setCompleted((c) => ({ ...c, [i]: !c[i] }))}
                  aria-label={isDone ? "Mark not done" : "Mark done"}
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors",
                    isDone
                      ? "bg-[#9CC3A4] text-white"
                      : "bg-[#FFF5F3] text-[#D4726D] hover:bg-[#FFE3DF]"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
              {i < plan.steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[27px] top-[52px] h-[calc(100%-44px)] border-l border-dashed border-[#F1D9D5]"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Symptom Insight Card — observation + non-med quick chips */}
      {plan.insight && (
        <section className="mt-5 rounded-2xl bg-[#EAE9F8] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#7E6BCB]">
              <Info className="h-4 w-4" />
            </span>
            <p className="flex-1 text-sm leading-relaxed text-[#3D2A28]">
              {plan.insight.observation}
            </p>
          </div>
          <div className="my-3 border-t border-[#D7D4EC]" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7E6BCB]">
            quick non-medication options
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#3D2A28]">
            {plan.insight.non_med_options.map((o) => {
              const Icon = ICON_MAP[o.icon] ?? Droplet;
              return (
                <li key={o.label} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-[#7E6BCB]" strokeWidth={1.8} />
                  {o.label}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Detailed advisory: remedies / foods / exercises / massages */}
      {plan.insight && (
        <div className="mt-4 space-y-3">
          {plan.insight.remedies?.length > 0 && (
            <AdvisorySection
              title="at-home remedies"
              accent="#D4726D"
              bg="#FFF5F3"
              items={plan.insight.remedies}
            />
          )}
          {plan.insight.foods?.length > 0 && (
            <AdvisorySection
              title="foods that help"
              accent="#B07A3A"
              bg="#FBF1E3"
              items={plan.insight.foods}
            />
          )}
          {plan.insight.exercises?.length > 0 && (
            <AdvisorySection
              title="gentle exercises"
              accent="#5E8C66"
              bg="#EAF3EC"
              items={plan.insight.exercises}
            />
          )}
          {plan.insight.massages?.length > 0 && (
            <AdvisorySection
              title="self-care massages"
              accent="#7E6BCB"
              bg="#EAE9F8"
              items={plan.insight.massages}
            />
          )}
        </div>
      )}


      {/* Doctor visit prep */}
      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAE9F8] text-[#7E6BCB]">
            <ClipboardList className="h-4 w-4" />
          </span>
          <h3
            className="text-base font-medium text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            doctor visit prep
          </h3>
        </div>
        <ul className="mt-3 list-disc space-y-1.5 pl-9 text-xs leading-relaxed text-[#5B403D]">
          {plan.doctor_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      {from === "nima" ? (
        <div className="mt-6 space-y-2">
          <button
            onClick={() => navigate({ to: "/nima" })}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F38B82] py-3 text-sm font-semibold text-white shadow-md"
          >
            <MascotPortrait state="listening" size="sm" accents={false} />
            continue talking to Nima about this
          </button>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="block w-full rounded-full bg-white py-3 text-sm font-medium text-[#D4726D] shadow-sm"
          >
            back to home
          </button>
        </div>
      ) : (
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => navigate({ to: "/nima" })}
            className="flex-1 rounded-full bg-white py-3 text-sm font-medium text-[#D4726D] shadow-sm"
          >
            talk to nima
          </button>
          <button
            onClick={() => navigate({ to: homeTo })}
            className="flex-1 rounded-full bg-[#F38B82] py-3 text-sm font-semibold text-white shadow-md"
          >
            back to home
          </button>
        </div>
      )}
    </div>
  );
}

function AdvisorySection({
  title,
  items,
  accent,
  bg,
}: {
  title: string;
  items: string[];
  accent: string;
  bg: string;
}) {
  return (
    <section className="rounded-2xl p-4" style={{ backgroundColor: bg }}>
      <p
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: accent }}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-[#3D2A28]"
          >
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
