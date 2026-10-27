import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { CoralButton } from "@/components/CoralButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/recovery")({
  head: () => ({ meta: [{ title: "Your path to recovery — Nima" }] }),
  component: RecoveryPath,
});

interface Step {
  id: string;
  title: string;
  description: string;
  weekStart: number;
  weekEnd: number;
}

function weeksBetween(birthDate: string | null | undefined): number {
  if (!birthDate) return 0;
  const ms = Date.now() - new Date(birthDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
}

function stepsFor(deliveryType: string | null): Step[] {
  const isC = deliveryType === "c_section" || deliveryType === "csection" || deliveryType === "c-section";
  const first: Step = isC
    ? {
        id: "post-op",
        title: "Immediate Post-Op Rest",
        description: "Gentle movement, incision care, and lots of pillows.",
        weekStart: 0,
        weekEnd: 2,
      }
    : {
        id: "first-days",
        title: "The First Days",
        description: "Rest, healing & taking it slow.",
        weekStart: 0,
        weekEnd: 2,
      };
  return [
    first,
    {
      id: "emotional",
      title: "Emotional Awareness",
      description: "Understanding your feelings.",
      weekStart: 2,
      weekEnd: 4,
    },
    {
      id: "routines",
      title: "Building Routines",
      description: "Small steps, everyday wins.",
      weekStart: 4,
      weekEnd: 6,
    },
    {
      id: "stronger",
      title: "Stronger Each Day",
      description: "Healing your body & mind.",
      weekStart: 6,
      weekEnd: 9,
    },
    {
      id: "thriving",
      title: "Thriving Ahead",
      description: "Growing into your new normal.",
      weekStart: 9,
      weekEnd: 99,
    },
  ];
}

function RecoveryPath() {
  const navigate = useNavigate();
  const [week, setWeek] = useState(0);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("birth_date, delivery_type")
        .eq("id", uid)
        .maybeSingle();
      setWeek(weeksBetween(p?.birth_date));
      setDelivery(p?.delivery_type ?? null);
      setLoading(false);
    })();
  }, []);

  const steps = stepsFor(delivery);
  const activeIdx = steps.findIndex((s) => week < s.weekEnd);
  const safeActive = activeIdx === -1 ? steps.length - 1 : activeIdx;

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-9" />
      </header>

      <div className="flex flex-col items-center text-center">
        <MascotPortrait state="happy" size="md" />
        <h1
          className="mt-3 text-[26px] leading-tight text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          your path to recovery
        </h1>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#8A6E6B]">
          A gentle, personalized guide to help you navigate your first weeks of motherhood.
        </p>
      </div>

      <section className="mt-6 space-y-3">
        {loading ? (
          <div className="h-40 animate-pulse rounded-3xl bg-white/70" />
        ) : (
          steps.map((s, i) => (
            <StepCard
              key={s.id}
              index={i + 1}
              step={s}
              status={i < safeActive ? "done" : i === safeActive ? "active" : "upcoming"}
              onContinue={() => navigate({ to: "/checkin" })}
            />
          ))
        )}
      </section>

      <div className="mt-6">
        <Link to="/progress" className="block">
          <CoralButton className="w-full">see this week's progress</CoralButton>
        </Link>
      </div>
    </div>
  );
}

function StepCard({
  index,
  step,
  status,
  onContinue,
}: {
  index: number;
  step: Step;
  status: "done" | "active" | "upcoming";
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className={cn(
        "rounded-3xl bg-white p-4 shadow-sm",
        status === "active" && "ring-2 ring-[#F38B82]/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
            status === "done" && "bg-[#E6F0E7] text-[#7BA886]",
            status === "active" && "bg-[#FDE7E4] text-[#D4726D]",
            status === "upcoming" && "border-2 border-[#EFD9D5] bg-white text-[#B59A97]"
          )}
        >
          {status === "done" ? <Check className="h-4 w-4" /> : index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "text-base text-[#3D2A28]",
                status === "done" && "text-[#8A6E6B] line-through"
              )}
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {step.title}
            </h3>
            {status === "active" && (
              <span className="rounded-full bg-[#FDE7E4] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#D4726D]">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#8A6E6B]">{step.description}</p>
          {status === "active" && (
            <button
              onClick={onContinue}
              className="mt-3 rounded-full bg-[#F38B82] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm"
            >
              Continue Progress
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
