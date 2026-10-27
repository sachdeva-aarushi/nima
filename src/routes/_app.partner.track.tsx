import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Check, Compass, Flame, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { getPartnerDashboard } from "@/lib/partner.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/track")({
  head: () => ({ meta: [{ title: "Track her journey — Nima" }] }),
  component: PartnerTrack,
});

interface TrackData {
  mother_name: string | null;
  week_postpartum: number | null;
  delivery_type: string | null;
  birth_date: string | null;
  consent: {
    share_mood: boolean;
    share_symptoms: boolean;
    share_checkin_streak: boolean;
    share_appointments: boolean;
    share_chat_summary: boolean;
  };
  streak_days?: number;
  upcoming_appointments?: { title: string; when: string }[];
}

interface Step {
  id: string;
  title: string;
  description: string;
  weekStart: number;
  weekEnd: number;
}

function stepsFor(deliveryType: string | null): Step[] {
  const isC =
    deliveryType === "c_section" ||
    deliveryType === "csection" ||
    deliveryType === "c-section";
  const first: Step = isC
    ? {
        id: "post-op",
        title: "Immediate post-op rest",
        description: "Gentle movement, incision care, and a lot of pillows.",
        weekStart: 0,
        weekEnd: 2,
      }
    : {
        id: "first-days",
        title: "The first days",
        description: "Rest, healing, taking it slow.",
        weekStart: 0,
        weekEnd: 2,
      };
  return [
    first,
    { id: "emotional", title: "Emotional awareness", description: "Naming what she's feeling.", weekStart: 2, weekEnd: 4 },
    { id: "routines", title: "Building routines", description: "Small steps, everyday wins.", weekStart: 4, weekEnd: 6 },
    { id: "stronger", title: "Stronger each day", description: "Body and mind continuing to heal.", weekStart: 6, weekEnd: 9 },
    { id: "thriving", title: "Thriving ahead", description: "Settling into a new normal.", weekStart: 9, weekEnd: 99 },
  ];
}

function PartnerTrack() {
  const navigate = useNavigate();
  const load = useServerFn(getPartnerDashboard);
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const result = (await load()) as TrackData;
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10">
        <div className="h-40 animate-pulse rounded-3xl bg-white/70" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center">
        <Compass className="mx-auto h-8 w-8 text-[#D4726D]" />
        <h2
          className="mt-3 text-xl text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          not linked yet
        </h2>
        <p className="mt-2 text-sm text-[#8A6E6B]">
          {error ?? "Ask her to send you a fresh invite code."}
        </p>
      </div>
    );
  }

  const firstName = data.mother_name ?? "her";
  const week = data.week_postpartum;
  const steps = stepsFor(data.delivery_type);
  const activeIdx = week == null ? -1 : steps.findIndex((s) => week < s.weekEnd);
  const safeActive = activeIdx === -1 ? steps.length - 1 : activeIdx;
  const currentStep = steps[safeActive];

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-6 flex items-start gap-3">
        <MascotPortrait state="listening" size="md" />
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-[#8A6E6B]">
            tracking
          </p>
          <h1
            className="text-2xl text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {firstName.toLowerCase()}'s journey
          </h1>
        </div>
      </header>

      {/* Week card */}
      <section className="mb-3 rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
          where she is right now
        </p>
        {week == null ? (
          <p className="mt-2 text-sm text-[#8A6E6B]">
            She hasn't shared a birth date yet.
          </p>
        ) : (
          <>
            <p
              className="mt-2 text-3xl text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              week {week} postpartum
            </p>
            <p className="mt-1 text-sm text-[#8A6E6B]">
              {currentStep.title.toLowerCase()} — {currentStep.description.toLowerCase()}
            </p>
            {data.delivery_type && (
              <span className="mt-3 inline-block rounded-full bg-[#F6EFEE] px-3 py-1 text-[11px] text-[#5B403D]">
                {data.delivery_type === "c_section"
                  ? "c-section recovery"
                  : "vaginal birth recovery"}
              </span>
            )}
          </>
        )}
      </section>

      {/* Upcoming appointments */}
      <section className="mb-3 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[#E6F0E7]">
            <Calendar className="h-5 w-5 text-[#7BA886]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
            upcoming appointments
          </p>
        </div>

        {!data.consent.share_appointments ? (
          <p className="text-sm text-[#8A6E6B]">
            {firstName} hasn't enabled sharing appointments yet.
          </p>
        ) : (data.upcoming_appointments?.length ?? 0) === 0 ? (
          <p className="text-sm text-[#8A6E6B]">Nothing on the calendar.</p>
        ) : (
          <ul className="space-y-2">
            {data.upcoming_appointments!.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-2xl bg-[#FFF8F7] px-3 py-2 text-sm"
              >
                <span className="text-[#3D2A28]">{a.title}</span>
                <span className="text-[12px] text-[#8A6E6B]">
                  {new Date(a.when).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.consent.share_appointments && (
          <p className="mt-3 text-[11px] leading-relaxed text-[#8A6E6B]">
            Driving, childcare, or just being there afterward is one of the most
            concretely useful things you can offer.
          </p>
        )}
      </section>

      {/* Streak */}
      {data.consent.share_checkin_streak && typeof data.streak_days === "number" && (
        <section className="mb-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[#FCE4D2]">
              <Flame className="h-5 w-5 text-[#E08856]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
              check-in streak
            </p>
          </div>
          <p className="text-sm text-[#3D2A28]">
            <span className="text-xl font-semibold text-[#E08856]">
              {data.streak_days}
            </span>{" "}
            day{data.streak_days === 1 ? "" : "s"} in a row.
          </p>
        </section>
      )}

      {/* Journey roadmap */}
      <h2 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
        the road ahead
      </h2>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const status: "done" | "active" | "upcoming" =
            i < safeActive ? "done" : i === safeActive ? "active" : "upcoming";
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
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
                    status === "upcoming" &&
                      "border-2 border-[#EFD9D5] bg-white text-[#B59A97]"
                  )}
                >
                  {status === "done" ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        "text-base text-[#3D2A28]",
                        status === "done" && "text-[#8A6E6B]"
                      )}
                      style={{ fontFamily: "ui-serif, Georgia, serif" }}
                    >
                      {s.title}
                    </h3>
                    {status === "active" && (
                      <span className="rounded-full bg-[#FDE7E4] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#D4726D]">
                        now
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[#8A6E6B]">
                    weeks {s.weekStart}–{s.weekEnd === 99 ? "12+" : s.weekEnd} ·{" "}
                    {s.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-[#8A6E6B]">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#B17ECE]" />
        General guidance based on her stage — every recovery looks different.
      </p>
    </div>
  );
}
