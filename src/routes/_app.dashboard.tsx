import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bell, HelpCircle, FileText, Sparkles, BarChart3, ScanLine, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { NimaMascot, type MascotState } from "@/components/NimaMascot";
import { CoralButton } from "@/components/CoralButton";
import { DURATIONS, EASE_SOFT, STAGGER_STEP } from "@/lib/motion";
import { getDailySuggestedArticle } from "@/lib/dailyArticle.functions";
import { getCareAlertSentToday } from "@/lib/partner.functions";

import { categoryMeta } from "@/lib/articles";
import { articleCover } from "@/lib/articleImageOverrides";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Today — Nima" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

const MOOD_TO_NUM: Record<string, number> = {
  great: 5, good: 4, okay: 3, low: 2, very_low: 1.5, crisis: 1,
};
const MOOD_TO_EMOJI: Record<string, string> = {
  great: "😊", good: "🙂", okay: "😐", low: "😔", very_low: "😢", crisis: "💔",
};
void MOOD_TO_EMOJI;

function Dashboard() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [, setStreak] = useState(0);
  const [todaysMood, setTodaysMood] = useState<string | null>(null);
  const [moodSeries, setMoodSeries] = useState<{ v: number }[]>([]);
  const [talkedToNimaToday, setTalkedToNimaToday] = useState(false);

  const fetchDaily = useServerFn(getDailySuggestedArticle);
  const { data: daily } = useQuery({
    queryKey: ["daily-article"],
    queryFn: () => fetchDaily(),
    staleTime: 1000 * 60 * 60,
  });

  const fetchAlertSent = useServerFn(getCareAlertSentToday);
  const { data: alertSent } = useQuery({
    queryKey: ["care-alert-sent-today"],
    queryFn: () => fetchAlertSent(),
    staleTime: 1000 * 60 * 5,
  });

  const dailyArticle = daily;


  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const uid = sess.session.user.id;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [{ data: profile }, { data: checkins }, { data: nimaToday }] = await Promise.all([
        supabase.from("profiles").select("name, onboarded_at, has_seen_intro" as never).eq("id", uid).maybeSingle(),
        supabase
          .from("checkins")
          .select("created_at, mood")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("chat_messages")
          .select("id")
          .eq("user_id", uid)
          .eq("role", "user")
          .gte("created_at", startOfDay.toISOString())
          .limit(1)
          .maybeSingle(),
      ]);
      setTalkedToNimaToday(!!nimaToday);

      const prof = profile as { name: string | null; onboarded_at: string | null; has_seen_intro: boolean } | null;
      if (prof && !prof.onboarded_at) {
        navigate({ to: "/onboarding" });
        return;
      }
      if (prof && !prof.has_seen_intro) {
        navigate({ to: "/intro" });
        return;
      }
      if (prof?.name) setName(prof.name);

      const rows = checkins ?? [];
      const byDay = new Map<string, string>();
      for (const r of rows) {
        const key = new Date(r.created_at).toDateString();
        if (!byDay.has(key)) byDay.set(key, r.mood);
      }
      const today = new Date();
      const todayStr = today.toDateString();
      setTodaysMood(byDay.get(todayStr) ?? null);

      let s = 0;
      const cursor = new Date(today);
      while (byDay.has(cursor.toDateString())) {
        s++;
        cursor.setDate(cursor.getDate() - 1);
      }
      setStreak(s);

      // Last 7 days of mood (oldest → newest)
      const series: { v: number }[] = [];
      const c2 = new Date(today);
      c2.setDate(c2.getDate() - 6);
      for (let i = 0; i < 7; i++) {
        const k = c2.toDateString();
        const m = byDay.get(k);
        if (m) series.push({ v: MOOD_TO_NUM[m] ?? 3 });
        c2.setDate(c2.getDate() + 1);
      }
      setMoodSeries(series);
    })();
  }, [navigate]);

  const firstName = name.split(" ")[0]?.toLowerCase() || "mama";
  void todaysMood;

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-6">
      {/* Header */}
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <MascotPortrait state="happy" size="sm" />
          <div className="min-w-0">
            <h1
              className="truncate text-2xl font-medium leading-tight text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {greeting()},<br />
              <span className="italic">{firstName}</span>
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-[#8A6E6B]">
              you're doing an incredible job.
            </p>
            {alertSent?.sent && (
              <p className="mt-1.5 text-[11px] italic leading-relaxed text-[#A8908D]">
                your partner has been notified — you're not alone today.
              </p>
            )}
          </div>

        </div>
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <Bell className="h-4 w-4 text-[#5B403D]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F38B82]" />
        </button>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-3 auto-rows-auto">
        {/* Card 1 — Today's check-in with Nima (full width) */}
        <BentoCard index={0} className="col-span-2">
          <Link
            to="/nima"
            className={cn(
              "relative block overflow-hidden rounded-3xl p-5 transition-colors duration-300 ease-out",
              talkedToNimaToday ? "bg-[#E6F0E7]" : "bg-[#FDE7E4]",
            )}
            style={{
              backgroundImage:
                "radial-gradient(circle at 92% 30%, rgba(255,255,255,0.55), transparent 55%)",
            }}
          >
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                talkedToNimaToday ? "text-[#5C8A6A]" : "text-[#D4726D]",
              )}
            >
              today's check-in with nima
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2
                  className="text-[22px] leading-tight text-[#3D2A28]"
                  style={{ fontFamily: "ui-serif, Georgia, serif" }}
                >
                  {talkedToNimaToday ? "you've checked in today" : "nima has a question for you"}
                </h2>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#7A5F5C]">
                  {talkedToNimaToday
                    ? "thank you for showing up today."
                    : "a gentle question is waiting in your chat."}
                </p>
                <span className="mt-4 inline-block">
                  {talkedToNimaToday ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7BA886] px-4 py-2 text-xs font-semibold text-white shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                      you've checked in with nima today
                    </span>
                  ) : (
                    <CoralButton size="sm">talk to nima</CoralButton>
                  )}
                </span>
              </div>
              <NimaMascot
                state={talkedToNimaToday ? "happy" : "comforting"}
                size="md"
                className="h-24 w-24"
              />
            </div>
          </Link>
        </BentoCard>

        {/* Card 2 — Today's reading (full width with cover image) */}
        {dailyArticle && (
          <BentoCard index={1} className="col-span-2">
            <Link
              to="/learn/$slug"
              params={{ slug: dailyArticle.slug }}
              className="block overflow-hidden rounded-3xl bg-white"
            >
              <div className="grid grid-cols-[1fr_42%]">
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: categoryMeta(dailyArticle.category).fg }}
                    >
                      today's reading
                    </p>
                    {dailyArticle.source_name && (
                      <span className="text-[10px] text-[#A8908D]">
                        · via {dailyArticle.source_name}
                      </span>
                    )}
                  </div>
                  <h2
                    className="mt-1.5 text-[19px] leading-[1.15] text-[#3D2A28]"
                    style={{ fontFamily: "ui-serif, Georgia, serif" }}
                  >
                    {dailyArticle.title}
                  </h2>
                  <p className="mt-2 text-[11px] leading-snug text-[#8A6E6B] line-clamp-2">
                    {dailyArticle.summary}
                  </p>
                </div>
                <div className="relative">
                  {(() => {
                    const cover = articleCover(dailyArticle.slug, dailyArticle.category, dailyArticle.image);
                    return cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null;
                  })()}
                </div>
              </div>
            </Link>
            <p className="mt-2 px-1 text-[10px] italic text-[#A8908D]">
              real, sourced articles — refreshed every Sunday.
            </p>
          </BentoCard>
        )}

        {/* Card 3 — Understand an issue (full width, rich form) */}
        <BentoCard index={2} className="col-span-2">
          <UnderstandIssueCard />
        </BentoCard>


        {/* Card 5 — Records (full width) */}
        <BentoCard index={4} className="col-span-2">
          <div
            className="relative overflow-hidden rounded-3xl bg-white p-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 95% 90%, rgba(212,114,109,0.08), transparent 40%), radial-gradient(circle at 10% 10%, rgba(123,127,206,0.06), transparent 50%)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4726D]">
                  <FileText className="h-3 w-3" /> your records
                </p>
                <h3
                  className="mt-1.5 text-[18px] leading-tight text-[#3D2A28]"
                  style={{ fontFamily: "ui-serif, Georgia, serif" }}
                >
                  your health records
                </h3>
                <p className="mt-1 text-[11px] text-[#8A6E6B]">
                  safely stored, always accessible.
                </p>
              </div>
              <NimaMascot state="thinking" size="sm" className="h-12 w-12" />
            </div>
            <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
              <Link
                to="/records"
                className="inline-flex items-center gap-1 text-[#D4726D] hover:underline"
              >
                your records <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to="/scan"
                className="inline-flex items-center gap-1 text-[#D4726D] hover:underline"
              >
                scan a document <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </BentoCard>

        {/* Card 6 — Recovery (full width) */}
        <BentoCard index={5} className="col-span-2">
          <Link
            to="/recovery"
            className="relative block overflow-hidden rounded-3xl bg-[#F1F5EC] p-4"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 5% 90%, rgba(124,168,134,0.18), transparent 55%), radial-gradient(ellipse at 95% 10%, rgba(124,168,134,0.12), transparent 50%)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C8A6A]">
                  <Sparkles className="h-3 w-3" /> path to recovery
                </p>
                <h3
                  className="mt-1.5 text-[19px] leading-tight text-[#3D2A28]"
                  style={{ fontFamily: "ui-serif, Georgia, serif" }}
                >
                  visualize your healing journey
                </h3>
                <p className="mt-1.5 text-[11px] leading-snug text-[#7A5F5C]">
                  every step forward is a victory. see how far you've come.
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#5C8A6A]">
                  begin your path <ArrowRight className="h-3 w-3" />
                </span>
              </div>
              <NimaMascot state="happy" size="sm" className="h-16 w-16" />
            </div>
          </Link>
        </BentoCard>

        {/* Card 7 — Progress with sparkline (full width) */}
        <BentoCard index={6} className="col-span-2">
          <Link
            to="/progress"
            className="block rounded-3xl bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4726D]">
                  <BarChart3 className="h-3 w-3" /> weekly summary
                </p>
                <h3
                  className="mt-1.5 text-[17px] leading-tight text-[#3D2A28]"
                  style={{ fontFamily: "ui-serif, Georgia, serif" }}
                >
                  your week, summarized
                </h3>
                <p className="mt-1 text-[11px] text-[#8A6E6B]">
                  reflecting on your mood patterns.
                </p>
              </div>
              <NimaMascot state="idle" size="sm" className="h-12 w-12" />
            </div>
            <div className="mt-3 h-14">
              {moodSeries.length >= 3 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={moodSeries} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <YAxis hide domain={[1, 5]} />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#D4726D"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#D4726D", strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl bg-[#FBF3F1] text-[10.5px] italic text-[#A8908D]">
                  check in daily to see your mood trend
                </div>
              )}
            </div>
          </Link>
        </BentoCard>
      </div>
    </div>
  );
}

/** Wraps each grid card with a staggered fade-up + 1px ink-8 border. */
function BentoCard({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATIONS.base,
        ease: EASE_SOFT,
        delay: index * STAGGER_STEP,
      }}
      className={cn(
        "[&>*:first-child]:border [&>*:first-child]:border-[rgba(61,42,40,0.08)] [&>*:first-child]:shadow-sm",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}




function UnderstandIssueCard() {
  const navigate = useNavigate();
  const [issue, setIssue] = useState("");

  function submit() {
    const text = issue.trim();
    if (!text) return;
    navigate({ to: "/quiz", search: { issue: text } });
  }

  return (
    <div className="rounded-3xl bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4726D]">
        want to understand an issue?
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAE9F8] text-[#7E6BCB]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <p
            className="text-base font-medium text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            understand an issue
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#8A6E6B]">
            describe what's bothering you and I'll ask a few gentle questions, then build an action plan with steps, gentle remedies, and what to bring to your doctor.
          </p>
        </div>
      </div>
      <textarea
        value={issue}
        onChange={(e) => setIssue(e.target.value)}
        rows={3}
        placeholder="e.g. my headaches keep coming back in the afternoon and I feel dizzy when I stand up…"
        className="mt-3 w-full resize-none rounded-2xl border border-[#F1D9D5] bg-[#FFF8F7] px-4 py-3 text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:border-[#F38B82] focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#7E6BCB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#6F5DBE]"
      >
        <Sparkles className="h-4 w-4" /> understand this issue
      </button>
    </div>
  );
}

