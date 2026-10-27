import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Heart,
  Leaf,
  Check,
  Send,
  Link2,
  FileText,
  Bell,
  ShieldCheck,
  Lock,
  User2,
  Eye,
  MessageCircle,
  Quote,
  Instagram,
  Mail,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { NimaMascot, type MascotState } from "@/components/NimaMascot";
import { CoralButton } from "@/components/CoralButton";
import { listLandingStories, type LandingStory } from "@/lib/landing.functions";
import { EASE_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nima — your gentle companion through motherhood" },
      {
        name: "description",
        content:
          "A quiet, private space for postpartum recovery. Nima listens, gently logs what matters, and surfaces clinically grounded support.",
      },
      { property: "og:title", content: "Nima — your gentle companion through motherhood" },
      {
        property: "og:description",
        content:
          "You don't have to navigate early motherhood alone. Nima listens, tracks what matters, and is here whenever you need her.",
      },
    ],
  }),
  component: Landing,
});

/* ─────────────────────────── tokens & helpers ─────────────────────────── */

const serif = { fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" } as const;

// Two tiers of dark for hierarchy within dark moments.
const DARK_WARM = "#4A3C38"; // sections 3, 8, new B — slightly lighter warm dark
const DARK_DEEP = "var(--ink)"; // section 6 partner — darkest
// Periwinkle removed — use coral palette throughout.
const ACCENT_BG = "var(--coral-bg)";
const ACCENT = "var(--coral)";
const ACCENT_SOFT = "var(--coral-soft)";

function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2, margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();
  const MotionTag = motion[Tag] as typeof motion.div;
  return (
    <MotionTag
      ref={ref}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.3, ease: EASE_SOFT, delay }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/* ─────────────────────────── auth-aware CTA ─────────────────────────── */

function BeginCTA({ session, size = "md" }: { session: Session | null; size?: "md" | "lg" }) {
  const navigate = useNavigate();
  return (
    <CoralButton
      size={size}
      onClick={() => navigate({ to: session ? "/dashboard" : "/auth" })}
    >
      begin your journey
    </CoralButton>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

function Landing() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stories, setStories] = useState<LandingStory[] | null>(null);
  const fetchStories = useServerFn(listLandingStories);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at, role, name, delivery_type")
          .eq("id", data.session.user.id)
          .maybeSingle();
        const role = (profile?.role as "mother" | "partner" | undefined) ?? "mother";
        if (role === "partner") {
          const done = Boolean(profile?.name && profile?.delivery_type);
          navigate({ to: done ? "/partner/dashboard" : "/partner/onboarding" });
        } else {
          navigate({ to: profile?.onboarded_at ? "/dashboard" : "/onboarding" });
        }
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    fetchStories({})
      .then((rows) => setStories(rows))
      .catch(() => setStories([]));
  }, [fetchStories]);

  if (authChecked && session) return null;

  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: "var(--cream)" }}>
      <HeroSection session={session} />
      <PillarsSection />
      <PersonalGuideSection />
      <RemembersSection />
      
      <ListensSection />
      <ResearchSection />
      <RecordsSection />
      <PartnerSection session={session} />
      <StoriesSection stories={stories} />
      <QuoteSection />
      <FinalCtaSection session={session} />
      <Footer />
    </main>
  );
}

/* ═══════════════════════════ HERO ═══════════════════════════ */

function HeroSection({ session }: { session: Session | null }) {
  const reduced = useReducedMotion();
  const T = (delay: number, duration = 0.4) => ({
    duration: reduced ? 0.001 : duration,
    ease: EASE_SOFT,
    delay: reduced ? 0 : delay,
  });

  return (
    <section
      className="relative overflow-hidden px-6 pb-14 pt-10 md:px-12 md:pb-24 md:pt-16"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-center md:gap-12">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="flex w-full items-start justify-between gap-4 md:block">
            <div className="flex flex-col items-start">
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={T(0.1, 0.25)}
                className="text-3xl font-medium tracking-tight"
                style={{ ...serif, color: "var(--ink-text)" }}
              >
                Nima
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={T(0.1, 0.25)}
                className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--coral)" }}
              >
                your fourth trimester
              </motion.p>
            </div>

            {/* Mobile-only mascot top-right beside "Nima" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={T(0.4, 0.4)}
              className="relative shrink-0 md:hidden"
              aria-hidden
            >
              <NimaMascot
                state="comforting"
                size="md"
                className="h-24 w-24"
                priority
              />
              <Heart
                className="absolute -right-1 -top-1 h-4 w-4"
                style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }}
              />
            </motion.div>
          </div>

          <h1
            className="mt-4 text-[3rem] leading-[1.05] md:text-[5.5rem] md:leading-[1.02]"
            style={{ ...serif, color: "var(--ink-text)", fontWeight: 400 }}
          >
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T(0.25)}
              className="inline-block"
            >
              your&nbsp;
            </motion.span>
            <motion.em
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T(0.3)}
              className="inline-block italic"
              style={{ ...serif, color: "var(--coral)" }}
            >
              gentle
            </motion.em>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T(0.25)}
              className="inline-block"
            >
              &nbsp;companion through motherhood
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T(0.55, 0.3)}
            className="mt-5 max-w-md text-base leading-relaxed md:text-lg"
            style={{ color: "var(--ink-soft)" }}
          >
            You don't have to navigate early motherhood alone. I'm here, whenever you need me.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T(1.1, 0.25)}
            className="mt-7 flex w-full justify-center md:justify-start"
          >
            <BeginCTA session={session} size="lg" />
          </motion.div>
        </div>

        {/* Portrait — IDLE (desktop only) */}
        <div className="relative hidden items-center justify-center md:flex">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={T(0.7, 0.5)}
            className="relative"
          >
            <div
              className="absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ backgroundColor: "var(--cream-deep)" }}
            />
            <div
              className="grid h-64 w-64 place-items-center rounded-full md:h-80 md:w-80"
              style={{ backgroundColor: "var(--coral-bg)" }}
            >
              <NimaMascot state="idle" size="xl" className="h-52 w-52 md:h-64 md:w-64" priority />
            </div>

            {[
              { delay: 0.9, cls: "-left-6 top-10", el: <Leaf className="h-6 w-6 -rotate-45" style={{ color: "var(--sage)" }} /> },
              { delay: 0.96, cls: "-right-6 top-12", el: <Leaf className="h-6 w-6 rotate-45" style={{ color: "var(--sage)" }} /> },
              { delay: 1.02, cls: "-left-2 bottom-8", el: <Leaf className="h-5 w-5 rotate-12" style={{ color: "var(--sage)" }} /> },
              { delay: 1.08, cls: "-right-2 -top-2", el: <Heart className="h-5 w-5" style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }} /> },
              { delay: 1.14, cls: "right-6 -bottom-2", el: <Heart className="h-4 w-4" style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }} /> },
              { delay: 1.2, cls: "-left-8 bottom-20", el: <Heart className="h-3 w-3" style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }} /> },
            ].map((a, i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={T(a.delay, 0.35)}
                className={cn("absolute", a.cls)}
              >
                {a.el}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── shared section heading style ─── */
const sectionHeading: React.CSSProperties = {
  ...serif,
  color: "var(--ink-text)",
  fontWeight: 400,
};
const sectionHeadingDark: React.CSSProperties = {
  ...serif,
  color: "#F4EDE7",
  fontWeight: 500, // slightly heavier on dark per spec
};

/* ═══════════════════════════ PILLARS ═══════════════════════════ */

function PillarsSection() {
  const pillars: { state: MascotState; title: string; body: string; icon: ReactNode }[] = [
    {
      state: "happy",
      title: "someone to talk to",
      body: "Share anything. I listen with warmth and care.",
      icon: <Heart className="absolute -left-2 -top-2 h-5 w-5" style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }} />,
    },
    {
      state: "comforting",
      title: "gentle guidance when you ask",
      body: "I offer ideas and support, only when you want it.",
      icon: <Leaf className="absolute -left-3 top-6 h-4 w-4 -rotate-45" style={{ color: "var(--sage)" }} />,
    },
    {
      state: "thinking",
      title: "track what matters, only if you want",
      body: "Log your journey, in a way that feels right for you.",
      icon: null,
    },
  ];

  return (
    <section className="px-6 py-10 md:px-12 md:py-14">
      <Reveal className="mx-auto grid max-w-6xl gap-4 p-2 md:grid-cols-3 md:gap-5">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08} as="article">
            <div
              className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{
                backgroundColor: "var(--cream-warm)",
                borderColor: "#F2C8C0",
              }}
            >
              {/* soft background shape */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundColor: "var(--coral-bg)" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full opacity-40"
                style={{ backgroundColor: "var(--cream-deep)" }}
              />
              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0">
                  {p.icon}
                  <div
                    className="grid h-12 w-12 place-items-center overflow-hidden rounded-full ring-2 ring-white/70"
                    style={{ backgroundColor: "var(--coral-bg)" }}
                  >
                    <NimaMascot state={p.state} size="sm" className="h-full w-full" />
                  </div>
                </div>
                <h3 className="pt-1 text-lg leading-snug" style={sectionHeading}>
                  {p.title}
                </h3>
              </div>
              <p className="relative text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {p.body}
              </p>
            </div>
          </Reveal>

        ))}
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ NEW A: PERSONAL GUIDE ═══════════════════════════ */

function QuizPhoneMockup() {
  const opts = ["barely any sleep", "broken — wake often", "okay — getting by", "actually slept well"];
  return (
    <div
      className="relative mx-auto w-full max-w-[290px] rounded-[2.4rem] border-[10px] p-3 shadow-xl"
      style={{ borderColor: "var(--ink-text)", backgroundColor: "var(--cream-warm)" }}
    >
      <div className="overflow-hidden rounded-[1.6rem] p-3" style={{ backgroundColor: "var(--cream-warm)" }}>
        {/* progress */}
        <div className="mb-4 flex items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: i <= 1 ? "var(--coral)" : "var(--coral-bg)" }}
            />
          ))}
        </div>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
          Question 2 of 5
        </p>
        <h4 className="mt-2 text-xl leading-tight" style={{ ...serif, color: "var(--ink-text)" }}>
          how has your <em className="italic" style={{ color: "var(--coral)" }}>sleep</em> been lately?
        </h4>
        <div className="mt-4 space-y-2">
          {opts.map((o, i) => (
            <div
              key={o}
              className="rounded-2xl px-3 py-2.5 text-[12px]"
              style={{
                backgroundColor: i === 1 ? "var(--coral-bg)" : "#fff",
                border: i === 1 ? "1px solid var(--coral)" : "1px solid #EFE0DC",
                color: "var(--ink-text)",
              }}
            >
              {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function PersonalGuideSection() {
  const tags = [
    "questions adapt to your history",
    "built around your delivery type",
    "leads to a real action plan",
  ];
  return (
    <section className="px-6 py-14 md:px-12 md:py-20" style={{ backgroundColor: "var(--cream)" }}>
      <Reveal className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
          <Reveal>
            <QuizPhoneMockup />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--coral-bg)" }}
              >
                <NimaMascot state="concerned" size="sm" className="h-full w-full" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--coral)" }}>
                adaptive questions
              </span>
            </div>
            <h2 className="mt-4 text-3xl leading-[1.1] md:text-4xl" style={sectionHeading}>
              your <em className="italic" style={{ color: "var(--coral)" }}>personal</em> guide to recovery
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              When you describe a symptom, Nima doesn't just listen — she opens a short, personalized
              quiz to understand it better. Your answers shape your care plan. No generic checklists.
              Just questions built around your birth, your week, your history.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px]"
                  style={{
                    backgroundColor: "var(--cream-warm)",
                    color: "var(--ink-text)",
                    border: "1px solid #EFE0DC",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ NEW B: REMEMBERS (DARK) ═══════════════════════════ */

function MemoryCard({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent: string;
}) {
  return (
    <div
      className="flex h-full flex-col gap-2 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09]"
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p
        className="text-base leading-snug"
        style={{ ...serif, color: "#F4EDE7", fontWeight: 400 }}
      >
        {text}
      </p>
    </div>
  );
}

function RemembersSection() {
  return (
    <section className="px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: DARK_WARM }}>
      <Reveal className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start md:gap-14">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="grid h-14 w-14 place-items-center overflow-hidden rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <NimaMascot state="listening" size="sm" className="h-full w-full" />
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--coral-soft)" }}
              >
                continuous memory
              </span>
            </div>
            <h2 className="mt-5 text-4xl leading-[1.05] md:text-5xl" style={sectionHeadingDark}>
              Nima <em className="italic" style={{ color: "var(--coral-soft)" }}>remembers</em>
              <br />
              everything
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: "#E5DAD8" }}>
              Every conversation builds your profile. Nima knows your delivery type, your fears,
              your recurring patterns, your wins. She brings that knowledge into every session —
              without you having to repeat yourself.
            </p>
            <p
              className="mt-6 max-w-md text-xs italic leading-relaxed"
              style={{ color: "rgba(244,237,231,0.55)" }}
            >
              Remembered across sessions. Visible to you. Never shared without permission.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MemoryCard
              label="remembered"
              text="returning to work in 3 weeks"
              accent="var(--coral-soft)"
            />
            <MemoryCard
              label="noticed"
              text="breastfeeding has come up 4 times"
              accent={ACCENT}
            />
            <MemoryCard
              label="milestone"
              text="first walk outside ✓"
              accent="var(--coral-soft)"
            />
            <MemoryCard
              label="pattern"
              text="sleep dips on cluster-feed nights"
              accent={ACCENT}
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}


/* ═══════════════════════════ LISTENS (DARK) ═══════════════════════════ */

function ChatBubble({
  role,
  children,
  receipt,
  onDark = false,
}: {
  role: "user" | "nima";
  children: ReactNode;
  receipt?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", role === "user" ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-[12px] leading-snug shadow-sm",
          role === "user" ? "rounded-br-md" : "rounded-bl-md",
        )}
        style={
          role === "user"
            ? { backgroundColor: "var(--coral-soft)", color: "#fff" }
            : { backgroundColor: "#fff", color: "var(--ink-text)" }
        }
      >
        {children}
      </div>
      {receipt && (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={
            onDark
              ? {
                  borderColor: "rgba(255,255,255,0.15)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: "#E5DAD8",
                }
              : {
                  borderColor: "#E9DAD7",
                  backgroundColor: "rgba(255,255,255,0.7)",
                  color: "var(--ink-soft)",
                }
          }
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
          {receipt}
        </span>
      )}
    </div>
  );
}

function PhoneMockup({ onDark = false }: { onDark?: boolean }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[295px] rounded-[2.4rem] border-[10px] p-3 shadow-xl"
      style={{ borderColor: onDark ? "#1F1815" : "var(--ink-text)", backgroundColor: "var(--cream-warm)" }}
    >
      <div className="overflow-hidden rounded-[1.6rem]" style={{ backgroundColor: "var(--cream-warm)" }}>
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <span
            className="grid h-7 w-7 place-items-center overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--coral-bg)" }}
          >
            <NimaMascot state="listening" size="sm" className="h-full w-full" />
          </span>
          <div className="flex flex-col">
            <span className="text-[12px] font-medium" style={{ color: "var(--ink-text)" }}>
              Talk to Nima
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
              online
            </span>
          </div>
        </div>
        <div className="space-y-2.5 px-3 pb-3">
          <ChatBubble role="user" receipt="remembered">
            I'm going back to work in two weeks and I just feel like I can't do this.
          </ChatBubble>
          <ChatBubble role="nima">
            That's such a tender moment, mama. Wanting to be everywhere at once is exhausting — and
            it doesn't mean you're failing. We'll take it gently, together.
          </ChatBubble>
          <ChatBubble role="user" receipt="symptom noted">
            And I've had this headache since yesterday — it's behind my eyes and my vision went a bit
            blurry when I stood up this morning.
          </ChatBubble>
          <ChatBubble role="nima">
            Thank you for telling me, sweetheart. Those together are worth looking at more carefully.
            I'm going to open a few gentle questions for you — it'll only take a minute. 💛
          </ChatBubble>
        </div>
        <div
          className="m-3 flex items-center justify-between rounded-full px-3 py-1.5"
          style={{ backgroundColor: "#fff", border: "1px solid #EFE0DC" }}
        >
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            Type your message...
          </span>
          <span
            className="grid h-6 w-6 place-items-center rounded-full"
            style={{ backgroundColor: "var(--coral)" }}
          >
            <Send className="h-3 w-3 text-white" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ListensSection() {
  const items = [
    { icon: MessageCircle, label: "logs symptoms from conversation" },
    { icon: FileText, label: "updates your check-in automatically" },
    { icon: Heart, label: "remembers what you share, across every session" },
  ];
  return (
    <section className="px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: DARK_WARM }}>
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center md:gap-12">
        <Reveal>
          <PhoneMockup onDark />
        </Reveal>
        <Reveal delay={0.1}>
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--coral-soft)" }}
          >
            she handles the admin
          </span>
          <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl" style={sectionHeadingDark}>
            Nima <em className="italic" style={{ color: "var(--coral-soft)" }}>listens.</em>
            <br />
            Then she <em className="italic" style={{ color: "var(--coral-soft)" }}>acts.</em>
          </h2>
          <p className="mt-5 text-base leading-relaxed" style={{ color: "#E5DAD8" }}>
            As you talk, Nima quietly logs symptoms, updates your records, notes what matters — so
            you never have to fill in a form. She handles the admin of recovery, so you can just be
            present.
          </p>
          <ul className="mt-6 space-y-3">
            {items.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "var(--coral-soft)" }} />
                </span>
                <span className="text-sm" style={{ color: "#F4EDE7" }}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════ RESEARCH (periwinkle) ═══════════════════════════ */

function ResearchCard({ body }: { body: string }) {
  return (
    <article
      className="flex h-full flex-col gap-3 rounded-2xl p-4 shadow-sm"
      style={{ backgroundColor: "#fff" }}
    >
      <Quote className="h-4 w-4" style={{ color: ACCENT }} />
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink-text)" }}>
        {body}
      </p>
      <span
        className="mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-medium"
        style={{ backgroundColor: ACCENT_BG, color: ACCENT }}
      >
        source: peer-reviewed research
      </span>
    </article>
  );
}

function ResearchSection() {
  return (
    <section className="px-6 py-14 md:px-12 md:py-20" style={{ backgroundColor: ACCENT_BG }}>
      <Reveal className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-start md:gap-12">
          <div>
            <span
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: ACCENT }}
            >
              <span
                className="grid h-10 w-10 place-items-center overflow-hidden rounded-full"
                style={{ backgroundColor: "#fff" }}
              >
                <NimaMascot state="thinking" size="sm" className="h-full w-full" />
              </span>
              clinically grounded
            </span>
            <h2 className="mt-4 text-3xl leading-[1.1] md:text-4xl" style={sectionHeading}>
              backed by <em className="italic" style={{ color: ACCENT }}>research,</em>
              <br />
              not guesswork
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Nima draws on published postpartum research to surface insights relevant to your
              specific journey — your delivery type, your history, your patterns. Not generic
              advice. Yours.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ResearchCard body="Mothers who had a cesarean section report PTSD symptoms at twice the rate of vaginal births. Nima watches for the signs." />
            <ResearchCard body="Postpartum hemorrhage is linked to a 24% higher risk of depression. If this was part of your birth, Nima already knows." />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-center">
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          <p className="text-[12px]" style={{ color: "var(--ink-soft)" }}>
            Every insight is sourced. Every number is real. This is population research, not a
            prediction about you specifically.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ RECORDS (light) ═══════════════════════════ */

function RecordsSection() {
  const chips = [
    { icon: Link2, label: "prescriptions" },
    { icon: FileText, label: "discharge summaries" },
    { icon: Bell, label: "medication reminders" },
  ];
  return (
    <section className="px-6 py-14 md:px-12 md:py-20" style={{ backgroundColor: "var(--cream)" }}>
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
        <Reveal>
          <h2 className="text-3xl leading-[1.1] md:text-4xl" style={sectionHeading}>
            your medical records,
            <br />
            <em className="italic" style={{ color: "var(--coral)" }}>understood</em>
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Upload your prescription or discharge summary. Nima reads it, extracts what matters, and
            adds it to your records with your confirmation before anything saves.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: "var(--cream-warm)",
                  color: "var(--ink-text)",
                  border: "1px solid #EFE0DC",
                }}
              >
                <Icon className="h-3 w-3" style={{ color: "var(--coral)" }} />
                {label}
              </span>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            <Lock className="h-3.5 w-3.5" />
            Nothing saves without your approval. Your records are yours.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div
            className="relative mx-auto w-full max-w-[300px] rounded-[2rem] border-[10px] p-3 shadow-xl"
            style={{ borderColor: "var(--ink-text)", backgroundColor: "var(--cream-warm)" }}
          >
            <div className="rounded-[1.4rem] bg-white p-3">
              <p className="text-[11px] font-medium" style={{ color: "var(--ink-text)" }}>
                Scan Review &amp; Confirm
              </p>
              <p
                className="mt-2 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--ink-faint)" }}
              >
                Extracted information
              </p>
              <dl className="mt-2 space-y-1.5 text-[11px]">
                {[
                  ["Medication name", "Sertraline 50mg"],
                  ["Dosage", "1 tablet once daily"],
                  ["Instructions", "Take in the morning with food"],
                  ["Prescribed by", "Dr. A. Patel"],
                  ["Date", "May 10, 2025"],
                  ["Notes", "For postpartum anxiety"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                    <dt style={{ color: "var(--ink-soft)" }}>{k}</dt>
                    <dd style={{ color: "var(--ink-text)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-full border px-3 py-1.5 text-[11px]"
                  style={{ borderColor: "var(--coral)", color: "var(--coral)" }}
                >
                  Edit
                </button>
                <button
                  className="flex-1 rounded-full px-3 py-1.5 text-[11px] text-white"
                  style={{ backgroundColor: "var(--coral)" }}
                >
                  Confirm &amp; Save
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════ PARTNER (DARKEST) ═══════════════════════════ */

function PartnerSection({ session }: { session: Session | null }) {
  const navigate = useNavigate();
  const chips = [
    { icon: User2, label: "partner gets their own login" },
    { icon: Eye, label: "you control what he sees" },
    { icon: MessageCircle, label: "Nima coaches him, not just you" },
  ];
  return (
    <section className="px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: DARK_DEEP }}>
      <Reveal className="mx-auto max-w-6xl">
        <Leaf
          className="pointer-events-none absolute right-2 bottom-6 h-24 w-24 rotate-12 opacity-20"
          style={{ color: "var(--sage)" }}
          aria-hidden
        />
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-center md:gap-14">
          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--coral-soft)" }}
            >
              not just for mothers
            </span>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl" style={sectionHeadingDark}>
              for the partner who
              <br />
              wants to <em className="italic" style={{ color: "var(--coral-soft)" }}>help</em>
            </h2>
            <p className="mt-5 text-base leading-relaxed" style={{ color: "#E5DAD8" }}>
              Nima connects your partner to your journey — with your permission, and only what you
              choose to share. He can ask Nima how to support you. She'll guide him, based on how
              you're actually doing.
            </p>
          </div>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <div
                className="grid h-24 w-24 place-items-center overflow-hidden rounded-full"
                style={{
                  backgroundColor: "var(--coral-bg)",
                  boxShadow: "0 0 0 4px rgba(255,255,255,0.08)",
                }}
              >
                <NimaMascot state="happy" size="md" className="h-full w-full" />
              </div>
              <Heart
                className="h-6 w-6"
                style={{ color: "var(--coral-soft)", fill: "var(--coral-soft)" }}
              />
              <div
                className="grid h-24 w-24 place-items-center overflow-hidden rounded-full"
                style={{
                  backgroundColor: "var(--coral-bg)",
                  boxShadow: "0 0 0 4px rgba(255,255,255,0.08)",
                }}
              >
                <NimaMascot state="comforting" size="md" className="h-full w-full" />
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {chips.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px]"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#F4EDE7" }}
                >
                  <Icon className="h-3 w-3" style={{ color: "var(--coral-soft)" }} />
                  {label}
                </span>
              ))}
            </div>
            <CoralButton onClick={() => navigate({ to: session ? "/dashboard" : "/auth" })}>
              invite your partner
            </CoralButton>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ STORIES (varied) ═══════════════════════════ */

const SEEDED_COUNTS: { likes: number; views: string }[] = [
  { likes: 132, views: "1.8k" },
  { likes: 104, views: "1.5k" },
  { likes: 156, views: "2.1k" },
];

const PLACEHOLDER_STORIES: LandingStory[] = [
  {
    id: "p1",
    display_name: "a mother",
    title: "the night I couldn't stop crying",
    content:
      "I told Nima at 3am and she just stayed with me. No advice, no rush. The next morning she suggested I talk to my midwife — gently, not pushy. I did. It helped.",
    like_count: 132,
    view_count: 1800,
    week_postpartum: 4,
  },
  {
    id: "p2",
    display_name: "a mother",
    title: "I didn't know c-section recovery could feel like this",
    content:
      "Week 6 and I still couldn't pick up my baby without flinching. Nima had been quietly tracking it. When I finally said it out loud, she had context — she'd noticed.",
    like_count: 104,
    view_count: 1500,
    week_postpartum: 6,
  },
  {
    id: "p3",
    display_name: "a mother",
    title: "the first time I felt like myself again",
    content:
      "Eleven weeks in. A walk outside, alone, for twenty minutes. Nima logged it as a milestone. Small, but it was the first thing that felt mine in months.",
    like_count: 156,
    view_count: 2100,
    week_postpartum: 11,
  },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StoryCard({
  story,
  variant,
  seeded,
}: {
  story: LandingStory;
  variant: "standard" | "featured";
  seeded: { likes: number; views: string };
}) {
  const weekLabel =
    typeof story.week_postpartum === "number"
      ? `a mother, week ${story.week_postpartum}`
      : "a mother";
  const heading = story.title ?? story.content.split(/[.!?]/)[0]?.trim().slice(0, 60) ?? "";
  const body =
    story.content.length > 200 ? story.content.slice(0, 200).trimEnd() + "…" : story.content;
  const isFeatured = variant === "featured";
  const likes = story.like_count > 0 ? formatCount(story.like_count) : String(seeded.likes);
  const views = story.view_count > 0 ? formatCount(story.view_count) : seeded.views;

  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl p-5 shadow-sm",
        isFeatured && "md:py-7",
      )}
      style={{
        backgroundColor: isFeatured ? "var(--cream-deep)" : "var(--cream-warm)",
        border: isFeatured ? "1px solid #F2C8C0" : "1px solid transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: "var(--coral)", color: "#fff" }}
        >
          {weekLabel}
        </span>
        {isFeatured && (
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--coral)" }}>
            featured
          </span>
        )}
      </div>
      <h3 className="text-lg leading-snug" style={sectionHeading}>
        {heading}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
      <div
        className="mt-auto flex items-center gap-4 pt-2 text-[11px]"
        style={{ color: "var(--ink-faint)" }}
      >
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3 w-3" /> {likes}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3 w-3" /> {views}
        </span>
      </div>
    </article>
  );
}

function StoriesSection({ stories }: { stories: LandingStory[] | null }) {
  const displayStories =
    stories === null
      ? null
      : stories.length >= 3
        ? stories.slice(0, 3)
        : [...stories, ...PLACEHOLDER_STORIES].slice(0, 3);

  return (
    <section className="px-6 py-14 md:px-12 md:py-20" style={{ backgroundColor: "var(--cream)" }}>
      <Reveal className="mx-auto max-w-6xl">
        <h2 className="text-3xl leading-[1.1] md:text-4xl" style={sectionHeading}>
          real stories from <em className="italic" style={{ color: "var(--coral)" }}>real mothers</em>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Read first-hand experiences from mothers at every stage. Find yourself in someone else's
          words. Share your own when you're ready.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-3 md:items-stretch">
          {displayStories === null ? (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl"
                  style={{ backgroundColor: "var(--cream-warm)" }}
                />
              ))}
            </>
          ) : (
            displayStories.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.08}>
                <StoryCard
                  story={s}
                  variant={i === 1 ? "featured" : "standard"}
                  seeded={SEEDED_COUNTS[i]}
                />
              </Reveal>
            ))
          )}
        </div>
        <p className="mt-6 text-sm" style={{ color: "var(--ink-soft)" }}>
          share your story when you're ready →
        </p>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ QUOTE (DARK) ═══════════════════════════ */

function QuoteSection() {
  return (
    <section className="px-6 py-16 md:px-12 md:py-24" style={{ backgroundColor: DARK_WARM }}>
      <Reveal className="mx-auto max-w-4xl">
        <div className="relative flex flex-col items-center gap-6 text-center">
          <Quote className="h-8 w-8" style={{ color: "var(--coral-soft)" }} />
          <div
            className="grid h-36 w-36 place-items-center overflow-hidden rounded-full"
            style={{
              backgroundColor: "var(--coral-bg)",
              boxShadow: "0 0 0 6px rgba(255,255,255,0.06)",
            }}
          >
            <NimaMascot state="comforting" size="lg" className="h-full w-full" />
          </div>
          <h3
            className="text-4xl leading-[1.05] md:text-6xl"
            style={sectionHeadingDark}
          >
            I listen first.
            <br />
            comfort <em className="italic" style={{ color: "var(--coral-soft)" }}>always.</em>
          </h3>
          <p className="max-w-md text-base" style={{ color: "#E5DAD8" }}>
            And Nima handles the rest — so you can just focus on healing.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ FINAL CTA ═══════════════════════════ */

function FinalCtaSection({ session }: { session: Session | null }) {
  return (
    <section className="px-6 py-14 md:px-12 md:py-20" style={{ backgroundColor: "var(--cream)" }}>
      <Reveal className="mx-auto max-w-6xl">
        <div
          className="relative flex flex-col items-center gap-6 rounded-3xl px-6 py-12 text-center md:py-16"
          style={{ backgroundColor: "var(--cream-warm)" }}
        >
          <h3 className="text-2xl leading-[1.1] md:text-3xl" style={sectionHeading}>
            Every step, every feeling,
            <br />
            you don't have to carry it{" "}
            <em className="italic" style={{ color: "var(--coral)" }}>alone.</em>
          </h3>
          <BeginCTA session={session} size="lg" />
          <NimaMascot state="happy" size="md" className="h-24 w-24" />
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════ FOOTER ═══════════════════════════ */

function Footer() {
  return (
    <footer
      className="px-6 py-10 md:px-12"
      style={{ backgroundColor: "var(--cream)", borderTop: "1px solid #EFE0DC" }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto_auto] md:items-center">
        <div>
          <h4 className="text-2xl" style={{ ...serif, color: "var(--ink-text)" }}>
            Nima
          </h4>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            your gentle companion through motherhood
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--ink-soft)" }}>
          <a href="#">about nima</a>
          <a href="#">privacy</a>
          <a href="#">terms</a>
          <a href="#">blog</a>
          <a href="#">help</a>
        </nav>
        <div className="flex items-center gap-3" style={{ color: "var(--ink-soft)" }}>
          <Instagram className="h-4 w-4" />
          <Mail className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-6 text-center text-[11px]" style={{ color: "var(--ink-faint)" }}>
        Made with care for new mothers
      </p>
    </footer>
  );
}
