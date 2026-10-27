import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  User as UserIcon,
  Heart,
  Baby,
  Moon,
  Activity,
  Brain,
  Sparkles,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CoralButton } from "@/components/CoralButton";
import { MascotPortrait } from "@/components/MascotPortrait";
import { DURATIONS, EASE_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Nima" }] }),
  component: Onboarding,
});

type DeliveryType = "vaginal" | "c_section" | "assisted" | "unknown";

const CONCERNS = [
  { key: "baby_health", label: "my baby's health", icon: Heart },
  { key: "breastfeeding", label: "breastfeeding", icon: Baby },
  { key: "sleep", label: "sleep deprivation", icon: Moon },
  { key: "recovery", label: "my recovery", icon: Activity },
  { key: "overwhelm", label: "feeling overwhelmed", icon: Brain },
  { key: "body", label: "body changes", icon: Sparkles },
  { key: "work", label: "returning to work", icon: Briefcase },
];

function Onboarding() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [dateMode, setDateMode] = useState<"birth" | "due">("birth");
  const [date, setDate] = useState("");
  const [delivery, setDelivery] = useState<DeliveryType | "">("");
  const [traumatic, setTraumatic] = useState<boolean | null>(null);
  const [nervousText, setNervousText] = useState("");
  const [nervousTags, setNervousTags] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, onboarded_at, role, delivery_type")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if ((profile?.role ?? "mother") === "partner") {
        const done = Boolean(profile?.name && profile?.delivery_type);
        navigate({ to: done ? "/partner/dashboard" : "/partner/onboarding" });
        return;
      }
      if (profile?.name) setName(profile.name);
      if (profile?.onboarded_at) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const totalSteps = 4;
  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(totalSteps - 1, s + 1));

  function toggleTag(key: string) {
    setNervousTags((tags) =>
      tags.includes(key) ? tags.filter((t) => t !== key) : [...tags, key]
    );
  }

  async function finish() {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          delivery_type: (delivery || null) as DeliveryType | null,
          birth_traumatic: traumatic,
          nervous_text: nervousText.trim() || null,
          nervous_tags: nervousTags,
          onboarded_at: new Date().toISOString(),
          birth_date: dateMode === "birth" ? date || null : null,
          due_date: dateMode === "due" ? date || null : null,
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success("You're all set.");
      navigate({ to: "/intro" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue = [
    name.trim().length > 0,
    date.length > 0,
    delivery !== "" && traumatic !== null,
    true,
  ][step];

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{ backgroundColor: "#FDE7E4" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#FFD1CC]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        {/* Header: back arrow + dots */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={back}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28] transition-opacity",
              step === 0 && "pointer-events-none opacity-0"
            )}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemax={totalSteps}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  i === step ? "bg-[#F38B82]" : "bg-[#F1D9D5]"
                )}
              />
            ))}
          </div>
          <div className="w-9" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
            className="flex flex-1 flex-col"
          >
            {step === 0 && (
              <StepShell title="what's your name?" subtitle="I'd love to know what to call you.">
                <Field icon={<UserIcon className="h-4 w-4" />} value={name} onChange={setName} placeholder="Your name" autoFocus />
                <div className="mt-12 flex flex-col items-center">
                  <MascotPortrait state="happy" size="lg" />
                  <p className="mt-6 text-center text-[15px] leading-relaxed text-[#5B403D]" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                    You don't have to be perfect.<br />You're already doing an incredible job.
                  </p>
                  <Heart className="mt-2 h-4 w-4 fill-[#F38B82] text-[#F38B82]" />
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell title="when did baby arrive?" subtitle="Or if you're still expecting, tell me your due date.">
                <div className="mb-4 flex w-full max-w-xs items-center rounded-full bg-white/70 p-1" role="tablist">
                  {(["birth", "due"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDateMode(m)}
                      className={cn(
                        "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        dateMode === m ? "bg-white text-[#3D2A28] shadow-sm" : "text-[#8A6E6B]"
                      )}
                    >
                      {m === "birth" ? "Birth date" : "Due date"}
                    </button>
                  ))}
                </div>
                <Field type="date" value={date} onChange={setDate} placeholder="Select a date" />
                <div className="mt-10 flex justify-center">
                  <MascotPortrait state="comforting" size="lg" />
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell title="how did baby arrive?" subtitle="No detail is too small — this helps me support you better.">
                <div className="space-y-2">
                  {(
                    [
                      { key: "vaginal", label: "Vaginal birth" },
                      { key: "c_section", label: "C-section" },
                      { key: "assisted", label: "Assisted (forceps / vacuum)" },
                      { key: "unknown", label: "I'd rather not say" },
                    ] as const
                  ).map((opt) => {
                    const active = delivery === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDelivery(opt.key)}
                        className={cn(
                          "w-full rounded-2xl border bg-white px-4 py-3 text-left text-sm transition-all",
                          active
                            ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                            : "border-[#F1D9D5] text-[#5B403D] hover:border-[#EFC2BD]"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-6 text-sm text-[#5B403D]">
                  Was your birth experience difficult or traumatic for you? It's okay if it was.
                </p>
                <div className="mt-3 flex gap-2">
                  {[
                    { val: true, label: "Yes, it was" },
                    { val: false, label: "No, it felt okay" },
                  ].map((o) => {
                    const active = traumatic === o.val;
                    return (
                      <button
                        key={String(o.val)}
                        type="button"
                        onClick={() => setTraumatic(o.val)}
                        className={cn(
                          "flex-1 rounded-full border bg-white px-4 py-3 text-sm font-medium transition-all",
                          active
                            ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                            : "border-[#F1D9D5] text-[#5B403D]"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell title="what are you most nervous about?" subtitle="You can write anything here, or tap a few that feel true for you.">
                <textarea
                  value={nervousText}
                  onChange={(e) => setNervousText(e.target.value)}
                  placeholder="Write your thoughts..."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:border-[#F38B82] focus:outline-none"
                />
                <p className="mt-5 mb-3 text-xs font-medium uppercase tracking-wider text-[#8A6E6B]">
                  Common concerns
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONCERNS.map((c) => {
                    const active = nervousTags.includes(c.key);
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggleTag(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-xs font-medium transition-all",
                          active
                            ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                            : "border-[#F1D9D5] text-[#5B403D]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-[#F38B82]" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                  <MascotPortrait state="comforting" size="sm" accents={false} />
                  <p className="text-xs leading-relaxed text-[#5B403D]">
                    It's okay to feel this way.<br />You don't have to figure it all out right now.
                  </p>
                </div>
              </StepShell>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8">
          {step < totalSteps - 1 ? (
            <CoralButton onClick={next} disabled={!canContinue} className="w-full">
              Continue
            </CoralButton>
          ) : (
            <CoralButton onClick={finish} disabled={submitting} className="w-full">
              {submitting ? "Saving…" : "Finish & start my journey"}
            </CoralButton>
          )}
        </div>
      </div>
    </main>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1
        className="text-center text-3xl font-medium tracking-tight text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        {title}
      </h1>
      <p className="mb-8 mt-3 text-center text-sm text-[#8A6E6B]">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({
  icon,
  value,
  onChange,
  ...rest
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 focus-within:border-[#F38B82]">
      {icon && <span className="text-[#C7A39F]">{icon}</span>}
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
      />
    </label>
  );
}
