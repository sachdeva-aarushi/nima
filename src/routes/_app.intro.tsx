import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { CoralButton } from "@/components/CoralButton";
import type { MascotState } from "@/components/NimaMascot";
import { DURATIONS, EASE_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/intro")({
  head: () => ({ meta: [{ title: "Meet Nima" }] }),
  component: IntroWalkthrough,
});

const TYPE_SPEED = 40; // ms per character

type Screen = { state: MascotState; text: (name: string) => string };

const SCREENS: Screen[] = [
  {
    state: "idle",
    text: (n) =>
      `Hi ${n || "there"}. I'm Nima — your postpartum companion. I'm not an app you fill forms in. I'm someone you talk to.`,
  },
  {
    state: "listening",
    text: () =>
      "As you talk to me, I listen for what matters. I quietly log your symptoms, update your records, and remember what you share — without you having to do anything extra.",
  },
  {
    state: "thinking",
    text: () =>
      "When something sounds concerning, I'll ask you a few gentle questions to understand it better. Then I'll build you a real action plan — based on your delivery, your history, your week.",
  },
  {
    state: "concerned",
    text: () =>
      "I'm grounded in real postpartum research. Not generic advice — insights matched to your specific journey, with sources you can read yourself.",
  },
  {
    state: "celebrating",
    text: () =>
      "Every conversation builds your profile. Every milestone gets noted. Every step forward, I'm here — tracking your journey so you can just focus on healing.",
  },
];

function IntroWalkthrough() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Auth + gate: skip if already seen
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (!id) {
        navigate({ to: "/auth" });
        return;
      }
      setUid(id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, has_seen_intro" as never)
        .eq("id", id)
        .maybeSingle();
      const p = prof as { name: string | null; has_seen_intro: boolean } | null;
      if (p?.has_seen_intro) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setName(p?.name ?? "");
    })();
  }, [navigate]);

  // Typing animation per step
  const fullText = SCREENS[step].text(name);
  useEffect(() => {
    setTyped("");
    setDone(false);
    let i = 0;
    function tick() {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) {
        setDone(true);
        timerRef.current = null;
        return;
      }
      timerRef.current = window.setTimeout(tick, TYPE_SPEED);
    }
    timerRef.current = window.setTimeout(tick, TYPE_SPEED);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // re-run when step or name (for screen 1) changes
  }, [step, fullText]);

  function skipToEnd() {
    if (done) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTyped(fullText);
    setDone(true);
  }

  async function next() {
    if (step < SCREENS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Last screen — persist + go to dashboard
    if (!uid || finishing) return;
    setFinishing(true);
    await supabase
      .from("profiles")
      .update({ has_seen_intro: true } as never)
      .eq("id", uid);
    navigate({ to: "/dashboard", replace: true });
  }

  const isLast = step === SCREENS.length - 1;
  const screen = SCREENS[step];

  return (
    <main
      className="fixed inset-0 z-50 flex flex-col bg-[#FDE7E4] px-6 pb-10 pt-12"
      onClick={skipToEnd}
      role="dialog"
      aria-label="Meet Nima"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`mascot-${step}`}
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
          >
            <MascotPortrait state={screen.state} size="lg" priority />
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-[#F38B82]" : "w-2 bg-[#F38B82]/25"
              )}
            />
          ))}
        </div>

        {/* Typing area */}
        <div className="mt-8 min-h-[180px] w-full">
          <p
            className="text-balance text-lg leading-relaxed text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {typed}
            {!done && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[2px] -translate-y-[2px] animate-pulse bg-[#3D2A28] align-middle"
              />
            )}
          </p>
        </div>
      </div>

      {/* Next button — fades in once typing completes */}
      <div className="mx-auto flex w-full max-w-md justify-center pb-2" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {done && (
            <motion.div
              key={`cta-${step}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
            >
              <CoralButton onClick={next} disabled={finishing} size="md">
                <span className="flex items-center gap-2">
                  {isLast ? "let's begin" : "next"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </CoralButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
