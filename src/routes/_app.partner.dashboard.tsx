import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Flame,
  Heart,
  MessageCircle,
  Sparkles,
  Unplug,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { PartnerCareAlertOverlay } from "@/components/PartnerCareAlertOverlay";
import { getPartnerDashboard, getUnseenCareAlert, markCareAlertSeen } from "@/lib/partner.functions";


export const Route = createFileRoute("/_app/partner/dashboard")({
  head: () => ({ meta: [{ title: "Supporting her — Nima" }] }),
  component: PartnerDashboard,
});

interface DashboardData {
  mother_name: string | null;
  consent: {
    share_mood: boolean;
    share_symptoms: boolean;
    share_checkin_streak: boolean;
    share_appointments: boolean;
    share_chat_summary: boolean;
  };
  mood_summary?: string;
  recent_symptoms?: string[];
  streak_days?: number;
  upcoming_appointments?: { title: string; when: string }[];
  chat_summary?: string;
}

const SUPPORT_ARTICLES = [
  {
    slug: "how-to-support-pp-depression",
    title: "How to support your partner through postpartum depression",
    summary:
      "Knowing the signs, when to step in, and how to bring it up gently.",
  },
  {
    slug: "practical-task-sharing",
    title: "A practical guide to sharing the load",
    summary: "Concrete tasks that take the most pressure off in week 1-12.",
  },
  {
    slug: "language-that-helps",
    title: "Things to say (and not say) in the first weeks",
    summary: "Small phrasing shifts that change how supported she feels.",
  },
];

interface CareAlert {
  id: string;
  alert_context: string;
  nima_guidance: string[];
  mother_first_name: string;
}

function PartnerDashboard() {
  const navigate = useNavigate();
  const load = useServerFn(getPartnerDashboard);
  const loadAlert = useServerFn(getUnseenCareAlert);
  const markSeen = useServerFn(markCareAlertSeen);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [careAlert, setCareAlert] = useState<CareAlert | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const [result, alertResult] = await Promise.all([
          load() as Promise<DashboardData>,
          loadAlert() as Promise<{ alert: CareAlert | null }>,
        ]);
        setData(result);
        if (alertResult.alert) setCareAlert(alertResult.alert);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load, loadAlert, navigate]);

  async function acknowledgeAlert() {
    if (!careAlert) return;
    const id = careAlert.id;
    setCareAlert(null);
    try {
      await markSeen({ data: { id } });
    } catch {
      /* non-fatal */
    }
    navigate({ to: "/partner/nima" });
  }


  if (careAlert) {
    return (
      <PartnerCareAlertOverlay
        motherFirstName={careAlert.mother_first_name}
        alertContext={careAlert.alert_context}
        guidance={careAlert.nima_guidance}
        onAcknowledge={acknowledgeAlert}
      />
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10">
        <div className="h-32 animate-pulse rounded-3xl bg-white/70" />
      </div>
    );
  }


  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center">
        <Unplug className="mx-auto h-8 w-8 text-[#D4726D]" />
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

  const { mother_name, consent } = data;
  const anyConsent = Object.values(consent).some(Boolean);
  const firstName = mother_name ?? "her";

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      {/* Header */}
      <header className="mb-6 flex items-start gap-3">
        <MascotPortrait state="listening" size="md" />
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-[#8A6E6B]">
            supporting
          </p>
          <h1
            className="text-2xl text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {firstName.toLowerCase()}
          </h1>
        </div>
      </header>

      {/* Persistent Talk-to-Nima entry */}
      <Link
        to="/partner/nima"
        className="mb-5 flex items-center justify-between rounded-3xl bg-[#F38B82] p-4 text-white shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">talk to nima</p>
            <p className="text-[11px] text-white/85">
              ask how to support her right now
            </p>
          </div>
        </div>
        <Sparkles className="h-5 w-5 opacity-80" />
      </Link>

      {/* Consented sections */}
      {!anyConsent && (
        <div className="mb-5 rounded-3xl bg-white p-5 text-center shadow-sm">
          <Heart className="mx-auto h-6 w-6 text-[#D4726D]" />
          <p
            className="mt-2 text-lg text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            nothing shared yet
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8A6E6B]">
            {firstName} hasn't enabled any sharing yet — and that's her call.
            You can still ask Nima how to be present and helpful.
          </p>
        </div>
      )}

      {consent.share_mood && data.mood_summary && (
        <Card
          icon={<Heart className="h-5 w-5 text-[#D4726D]" />}
          iconBg="bg-[#FDE7E4]"
          label="how she's been feeling"
        >
          <p className="text-sm leading-relaxed text-[#3D2A28]">
            {data.mood_summary}
          </p>
        </Card>
      )}

      {consent.share_symptoms && (data.recent_symptoms?.length ?? 0) > 0 && (
        <Card
          icon={<Activity className="h-5 w-5 text-[#7B7FCE]" />}
          iconBg="bg-[#EAE9F8]"
          label="symptoms she's logged"
        >
          <div className="flex flex-wrap gap-1.5">
            {data.recent_symptoms!.map((s) => (
              <span
                key={s}
                className="rounded-full bg-[#F6EFEE] px-3 py-1 text-[12px] text-[#5B403D]"
              >
                {s}
              </span>
            ))}
          </div>
        </Card>
      )}

      {consent.share_checkin_streak && typeof data.streak_days === "number" && (
        <Card
          icon={<Flame className="h-5 w-5 text-[#E08856]" />}
          iconBg="bg-[#FCE4D2]"
          label="check-in streak"
        >
          <p className="text-sm text-[#3D2A28]">
            <span className="text-xl font-semibold text-[#E08856]">
              {data.streak_days}
            </span>{" "}
            day{data.streak_days === 1 ? "" : "s"} in a row — she's showing up
            for herself.
          </p>
        </Card>
      )}

      {consent.share_appointments && (data.upcoming_appointments?.length ?? 0) > 0 && (
        <Card
          icon={<Calendar className="h-5 w-5 text-[#7BA886]" />}
          iconBg="bg-[#E6F0E7]"
          label="upcoming appointments"
        >
          <ul className="space-y-2">
            {data.upcoming_appointments!.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
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
          <p className="mt-3 text-[11px] text-[#8A6E6B]">
            Driving, childcare, or just being there afterward is one of the
            most useful things you can offer.
          </p>
        </Card>
      )}

      {consent.share_chat_summary && data.chat_summary && (
        <Card
          icon={<Sparkles className="h-5 w-5 text-[#B17ECE]" />}
          iconBg="bg-[#F0E4F8]"
          label="how she's been processing things"
        >
          <p className="text-sm leading-relaxed text-[#3D2A28]">
            {data.chat_summary}
          </p>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-[#8A6E6B]">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            A high-level summary only — never her actual conversations.
          </p>
        </Card>
      )}

      {/* Articles */}
      <h2 className="mb-2 mt-7 text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
        for partners
      </h2>
      <div className="space-y-2.5">
        {SUPPORT_ARTICLES.map((a) => (
          <Link
            key={a.slug}
            to="/learn/$slug"
            params={{ slug: a.slug }}
            className="block rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF]"
          >
            <p
              className="text-base text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {a.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8A6E6B]">
              {a.summary}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Card({
  icon,
  iconBg,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`grid h-9 w-9 place-items-center rounded-2xl ${iconBg}`}>
          {icon}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
          {label}
        </p>
      </div>
      {children}
    </section>
  );
}
