import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, KeyRound, Heart, Leaf, Bug } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { NimaMascot } from "@/components/NimaMascot";
import { CoralButton } from "@/components/CoralButton";
import { acceptPartnerInvite, lookupInvite } from "@/lib/partner.functions";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  mode: z.enum(["signin", "code", "signup"]).optional(),
});

export const Route = createFileRoute("/partner-auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Partner sign-in — Nima" },
      { name: "description", content: "Sign in or join Nima as a partner." },
    ],
  }),
  component: PartnerAuthScreen,
});

type Step = "signin" | "code" | "signup";

const DEV_LS_PARTNER_EMAIL = "lovable_dev_partner_email";
const DEV_LS_PARTNER_PASS = "lovable_dev_partner_password";
const DEV_LS_MOTHER_EMAIL = "lovable_dev_mother_email";
const DEV_LS_MOTHER_PASS = "lovable_dev_mother_password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PartnerAuthScreen() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const lookup = useServerFn(lookupInvite);
  const accept = useServerFn(acceptPartnerInvite);

  const [step, setStep] = useState<Step>(search.mode ?? "signin");
  const [code, setCode] = useState("");
  const [motherName, setMotherName] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showDev, setShowDev] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const isPreview = host.includes("preview") || host.includes("id-");
    if (import.meta.env.DEV || isLocal || isPreview) setShowDev(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);


  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back.");
      router.invalidate();
      navigate({ to: "/partner/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await lookup({ data: { code } });
      if (!result.valid) {
        const msg =
          result.reason === "expired"
            ? "That invite has expired. Ask her to send a new one."
            : result.reason === "accepted"
            ? "That invite has already been used."
            : result.reason === "revoked"
            ? "That invite was revoked."
            : "We didn't find that code — double-check it.";
        toast.error(msg);
        return;
      }
      setMotherName(result.mother_name);
      setStep("signup");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't verify the code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      let { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          toast.message("Check your email to confirm your account, then sign in.");
          return;
        }
        sess = (await supabase.auth.getSession()).data;
      }
      await accept({ data: { code } });
      toast.success("You're linked. Welcome to Nima.");
      router.invalidate();
      navigate({ to: "/partner/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete sign-up.");
    } finally {
      setBusy(false);
    }
  }

  async function devLogin(role: "partner" | "mother") {
    if (busy) return;
    const lsE = role === "partner" ? DEV_LS_PARTNER_EMAIL : DEV_LS_MOTHER_EMAIL;
    const lsP = role === "partner" ? DEV_LS_PARTNER_PASS : DEV_LS_MOTHER_PASS;
    const envE = (role === "partner"
      ? import.meta.env.VITE_DEV_PARTNER_EMAIL
      : import.meta.env.VITE_DEV_MOTHER_EMAIL) as string | undefined;
    const envP = (role === "partner"
      ? import.meta.env.VITE_DEV_PARTNER_PASSWORD
      : import.meta.env.VITE_DEV_MOTHER_PASSWORD) as string | undefined;

    let e = envE || localStorage.getItem(lsE) || "";
    e = window.prompt(`[dev] ${role} test email?`, e) ?? "";
    if (!e) return;
    if (!EMAIL_RE.test(e)) {
      toast.error("[dev] That doesn't look like a valid email.");
      return;
    }
    let p = envP || localStorage.getItem(lsP) || "";
    p = window.prompt(`[dev] ${role} test password? (min 8 chars)`, p) ?? "";
    if (!p) return;
    if (p.length < 8) {
      toast.error("[dev] Password must be at least 8 characters.");
      return;
    }
    localStorage.setItem(lsE, e);
    localStorage.setItem(lsP, p);

    setBusy(true);
    try {
      let { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      if (error && /invalid login credentials/i.test(error.message)) {
        toast(`[dev] Account not found, creating ${role}…`);
        const { error: signUpErr } = await supabase.auth.signUp({
          email: e,
          password: p,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpErr) {
          localStorage.removeItem(lsP);
          throw signUpErr;
        }
        ({ error } = await supabase.auth.signInWithPassword({ email: e, password: p }));
      }
      if (error) throw error;
      toast.success(`[dev] Logged in (${role} view)`);
      router.invalidate();
      navigate({ to: role === "partner" ? "/partner/dashboard" : "/" });
    } catch (err) {
      toast.error(`[dev] ${err instanceof Error ? err.message : "Login failed"}`);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    step === "signin"
      ? "welcome back"
      : step === "code"
      ? "you've been invited"
      : motherName
      ? `support ${motherName.toLowerCase()}`
      : "almost there";

  const sub =
    step === "signin"
      ? "Sign in to your partner account."
      : step === "code"
      ? "Enter the invite code she shared with you."
      : "Create your own account. You'll see only what she chooses to share.";

  return (
    <main className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: "#FDE7E4" }}>
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#FFD1CC]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center px-5 pt-24 pb-10">
        <div className="relative w-full rounded-[2rem] bg-white px-6 pb-7 pt-20 shadow-[0_24px_60px_-24px_rgba(212,114,109,0.35)]">
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <Leaf className="absolute -left-9 top-3 h-5 w-5 -rotate-45 text-[#9CC3A4]" strokeWidth={1.8} />
              <Leaf className="absolute -right-9 top-3 h-5 w-5 rotate-45 text-[#9CC3A4]" strokeWidth={1.8} />
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[#FFEEEB] shadow-[0_10px_30px_-12px_rgba(212,114,109,0.45)]">
                <NimaMascot state="listening" size="lg" className="h-full w-full" priority />
              </div>
              <div className="absolute -right-2 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#F38B82] shadow-md">
                <Heart className="h-4 w-4 fill-white text-white" />
              </div>
            </div>
          </div>

          {/* Mode tabs */}
          {step !== "signup" && (
            <div className="mx-auto mb-6 flex w-fit gap-1 rounded-full bg-[#FFF1EF] p-1">
              <TabBtn active={step === "signin"} onClick={() => setStep("signin")}>Sign in</TabBtn>
              <TabBtn active={step === "code"} onClick={() => setStep("code")}>Use invite code</TabBtn>
            </div>
          )}

          <div className="mb-6 text-center">
            <h1
              className="text-2xl font-medium tracking-tight text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {heading}
            </h1>
            <p className="mt-2 text-sm text-[#8A6E6B]">{sub}</p>
          </div>

          {step === "signin" ? (
            <form onSubmit={submitSignIn} className="space-y-3">
              <Field
                icon={<Mail className="h-4 w-4" />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Email"
                autoComplete="email"
                required
              />
              <Field
                icon={<Lock className="h-4 w-4" />}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Password"
                autoComplete="current-password"
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="text-[#8A6E6B]"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <CoralButton type="submit" disabled={busy} className="w-full">
                {busy ? "Signing in…" : "Sign in"}
              </CoralButton>
              <p className="pt-2 text-center text-[11px] text-[#A8908D]">
                Are you the mother?{" "}
                <button type="button" onClick={() => navigate({ to: "/auth" })} className="underline decoration-dotted">
                  Sign in here
                </button>
              </p>
            </form>
          ) : step === "code" ? (
            <form onSubmit={submitCode} className="space-y-3">
              <Field
                icon={<KeyRound className="h-4 w-4" />}
                value={code}
                onChange={(v) => setCode(v.toUpperCase())}
                placeholder="INVITE CODE"
                autoFocus
                required
                className="tracking-[0.3em] font-mono"
              />
              <CoralButton type="submit" disabled={busy || code.length < 4} className="w-full">
                {busy ? "Checking…" : "Continue"}
              </CoralButton>
            </form>
          ) : (
            <form onSubmit={submitSignup} className="space-y-3">
              <Field
                icon={<UserIcon className="h-4 w-4" />}
                value={name}
                onChange={setName}
                placeholder="Your name"
                autoComplete="name"
                required
              />
              <Field
                icon={<Mail className="h-4 w-4" />}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Email"
                autoComplete="email"
                required
              />
              <Field
                icon={<Lock className="h-4 w-4" />}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Password"
                autoComplete="new-password"
                required
                minLength={8}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="text-[#8A6E6B]"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <CoralButton type="submit" disabled={busy} className="w-full">
                {busy ? "Creating account…" : "Create account"}
              </CoralButton>
              <button
                type="button"
                onClick={() => setStep("code")}
                className="block w-full text-center text-[11px] text-[#A8908D] underline decoration-dotted"
              >
                use a different invite code
              </button>
            </form>
          )}

          {showDev && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-[#F1D9D5] pt-4">
              <button
                type="button"
                onClick={() => devLogin("partner")}
                disabled={busy}
                title="DEV ONLY — remove before publishing"
                className="flex items-center gap-1.5 rounded-md border-2 border-dashed border-yellow-500 bg-black/85 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-yellow-300 shadow-sm hover:bg-black disabled:opacity-50"
              >
                <Bug className="h-3 w-3" /> dev: partner
              </button>
              <button
                type="button"
                onClick={() => devLogin("mother")}
                disabled={busy}
                title="DEV ONLY — remove before publishing"
                className="flex items-center gap-1.5 rounded-md border-2 border-dashed border-pink-400 bg-black/85 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-pink-200 shadow-sm hover:bg-black disabled:opacity-50"
              >
                <Bug className="h-3 w-3" /> dev: mother
              </button>
              <button
                type="button"
                onClick={() => {
                  [DEV_LS_PARTNER_EMAIL, DEV_LS_PARTNER_PASS, DEV_LS_MOTHER_EMAIL, DEV_LS_MOTHER_PASS].forEach((k) =>
                    localStorage.removeItem(k),
                  );
                  toast("[dev] Cleared stored credentials");
                }}
                className="rounded-md border-2 border-dashed border-yellow-500 bg-black/85 px-1.5 py-1.5 font-mono text-[10px] font-bold text-yellow-300"
                title="Clear stored dev credentials"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-medium transition",
        active ? "bg-white text-[#3D2A28] shadow-sm" : "text-[#8A6E6B] hover:text-[#3D2A28]"
      )}
    >
      {children}
    </button>
  );
}

function Field({
  icon,
  suffix,
  value,
  onChange,
  className,
  ...rest
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <label className="group flex items-center gap-3 rounded-2xl border border-[#F1D9D5] bg-[#FFF8F7] px-4 py-3 transition-colors focus-within:border-[#F38B82] focus-within:bg-white">
      <span className="text-[#C7A39F] group-focus-within:text-[#F38B82]">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none",
          className
        )}
      />
      {suffix}
    </label>
  );
}
