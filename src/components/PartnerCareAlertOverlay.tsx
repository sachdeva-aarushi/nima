import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { MascotPortrait } from "@/components/MascotPortrait";
import { CoralButton } from "@/components/CoralButton";
import { DURATIONS, EASE_SOFT } from "@/lib/motion";

const TYPE_SPEED = 32;

export interface CareAlertOverlayProps {
  motherFirstName: string;
  alertContext: string;
  guidance: string[];
  onAcknowledge: () => void;
}

type Phase = "headline" | "context" | "guidance" | "ready";

export function PartnerCareAlertOverlay({
  motherFirstName,
  alertContext,
  guidance,
  onAcknowledge,
}: CareAlertOverlayProps) {
  const headline = `Hey. ${motherFirstName} could use some extra support today.`;
  const [phase, setPhase] = useState<Phase>("headline");
  const [typed, setTyped] = useState("");
  const [typedDone, setTypedDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setTyped("");
    setTypedDone(false);
    let i = 0;
    function tick() {
      i += 1;
      setTyped(headline.slice(0, i));
      if (i >= headline.length) {
        setTypedDone(true);
        timerRef.current = null;
        return;
      }
      timerRef.current = window.setTimeout(tick, TYPE_SPEED);
    }
    timerRef.current = window.setTimeout(tick, TYPE_SPEED);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [headline]);

  // After typing finishes, reveal context, then guidance, then ready.
  useEffect(() => {
    if (!typedDone) return;
    const t1 = window.setTimeout(() => setPhase("context"), 250);
    const t2 = window.setTimeout(() => setPhase("guidance"), 1100);
    const t3 = window.setTimeout(() => setPhase("ready"), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [typedDone]);

  function skip() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTyped(headline);
    setTypedDone(true);
    setPhase("ready");
  }

  return (
    <main
      className="fixed inset-0 z-[60] flex flex-col bg-[#FDE7E4] px-6 pb-10 pt-12"
      role="dialog"
      aria-label="Care alert"
      onClick={skip}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
        >
          <MascotPortrait state="concerned" size="lg" priority />
        </motion.div>

        <div className="mt-8 w-full">
          <p
            className="text-balance text-xl leading-relaxed text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {typed}
            {!typedDone && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1.05em] w-[2px] -translate-y-[2px] animate-pulse bg-[#3D2A28] align-middle"
              />
            )}
          </p>
        </div>

        <AnimatePresence>
          {(phase === "context" || phase === "guidance" || phase === "ready") && (
            <motion.p
              key="ctx"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
              className="mt-5 text-[15px] leading-relaxed text-[#7A5F5C]"
            >
              {alertContext}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(phase === "guidance" || phase === "ready") && (
            <motion.ul
              key="guidance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATIONS.base, ease: EASE_SOFT, delay: 0.05 }}
              className="mt-6 w-full space-y-2.5 text-left"
            >
              {guidance.slice(0, 3).map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-white/70 p-3.5 text-[13.5px] leading-relaxed text-[#3D2A28]"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F38B82]"
                  />
                  <span>{g}</span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <div
        className="mx-auto flex w-full max-w-md justify-center pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence>
          {phase === "ready" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATIONS.base, ease: EASE_SOFT }}
            >
              <CoralButton onClick={onAcknowledge} size="md">
                I&apos;ve got her
              </CoralButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
