import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Heart, Leaf } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { NimaMascot } from "@/components/NimaMascot";
import { CoralButton } from "@/components/CoralButton";
import { cn } from "@/lib/utils";
import { DURATIONS, EASE_SOFT } from "@/lib/motion";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Welcome to Nima" },
      { name: "description", content: "Sign in or create your Nima account — your gentle companion for postpartum recovery." },
    ],
  }),
  component: AuthScreen,
});

type Mode = "signup" | "login";

function AuthScreen() {
  const navigate = useNavigate();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, leave the auth screen.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Nima.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      router.invalidate();
      navigate({ to: "/" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Try again in a moment.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
      if (result.redirected) return; // browser will navigate
      router.invalidate();
      navigate({ to: "/" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in didn't work. Try email instead.";
      toast.error(message);
      setSubmitting(false);
    }
  }

  const headline = mode === "login" ? "welcome back" : "hello, mama";
  const subtext = "Nima is here for you, whenever you need me";

  return (
    <main className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: "#FDE7E4" }}>
      {/* soft decorative blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#FFD1CC]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-start px-5 pt-24 pb-10">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATIONS.base / 1000, ease: EASE_SOFT }}
          className="relative w-full rounded-[2rem] bg-white px-6 pb-7 pt-20 shadow-[0_24px_60px_-24px_rgba(212,114,109,0.35)]"
        >
          {/* Avatar — circular frame with capybara, heart accent + leaf decorations */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              {/* leaves left */}
              <Leaf
                className="absolute -left-12 top-3 h-6 w-6 -rotate-45 text-[#9CC3A4]"
                strokeWidth={1.8}
              />
              <Leaf
                className="absolute -left-9 top-10 h-4 w-4 -rotate-12 text-[#B7D6BD]"
                strokeWidth={1.8}
              />
              {/* leaves right */}
              <Leaf
                className="absolute -right-12 top-4 h-6 w-6 rotate-45 text-[#9CC3A4]"
                strokeWidth={1.8}
              />
              <Leaf
                className="absolute -right-9 top-11 h-4 w-4 rotate-12 text-[#B7D6BD]"
                strokeWidth={1.8}
              />

              <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-[#FFEEEB] shadow-[0_10px_30px_-12px_rgba(212,114,109,0.45)]">
                <NimaMascot
                  state="happy"
                  size="lg"
                  className="h-full w-full"
                  priority
                />
              </div>

              {/* heart accent */}
              <div className="absolute -right-2 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#F38B82] shadow-md">
                <Heart className="h-4 w-4 fill-white text-white" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Toggle */}
          <div
            className="mx-auto mb-6 flex w-full max-w-xs items-center rounded-full bg-[#FDE7E4]/70 p-1"
            role="tablist"
            aria-label="Sign up or log in"
          >
            {(["signup", "login"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className={cn(
                    "relative flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active ? "text-[#3D2A28]" : "text-[#8A6E6B] hover:text-[#3D2A28]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-toggle-active"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(212,114,109,0.35)]"
                      transition={{ duration: DURATIONS.fast / 1000, ease: EASE_SOFT }}
                    />
                  )}
                  <span className="relative">{m === "signup" ? "Sign up" : "Log in"}</span>
                </button>
              );
            })}
          </div>

          {/* Headline */}
          <div className="mb-6 text-center">
            <h1
              className="text-3xl font-medium tracking-tight text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
            >
              {headline}
            </h1>
            <p className="mt-2 text-sm text-[#8A6E6B]">{subtext}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {mode === "signup" && (
                <motion.div
                  key="name"
                  initial={reduced ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: DURATIONS.fast / 1000, ease: EASE_SOFT }}
                >
                  <Field
                    icon={<UserIcon className="h-4 w-4" />}
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Field
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="Email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />

            <Field
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[#8A6E6B] transition-colors hover:text-[#3D2A28]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <CoralButton
              type="submit"
              disabled={submitting}
              className="mt-2 w-full"
              size="md"
            >
              {submitting ? "Just a moment…" : mode === "signup" ? "Create account" : "Log in"}
            </CoralButton>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#F1D9D5]" />
            <span className="text-xs uppercase tracking-wider text-[#B59A97]">or</span>
            <div className="h-px flex-1 bg-[#F1D9D5]" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#EFD9D5] bg-white px-5 py-3 text-sm font-medium text-[#3D2A28] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          >
            <GoogleGlyph className="h-4 w-4" />
            Continue with Google
          </button>

          {/* Partner entry */}
          <button
            type="button"
            onClick={() => navigate({ to: "/partner-auth", search: { mode: "signin" } })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#EFD9D5] bg-transparent px-5 py-2.5 text-[12px] font-medium text-[#8A6E6B] transition hover:bg-[#FFF8F7] hover:text-[#3D2A28]"
          >
            Enter as a partner
          </button>

          {/* Terms */}
          <p className="mt-5 text-center text-[11px] leading-relaxed text-[#A8908D]">
            By continuing you agree to Nima's{" "}
            <a href="#" className="underline decoration-dotted underline-offset-2">Terms</a>{" "}
            and{" "}
            <a href="#" className="underline decoration-dotted underline-offset-2">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </main>
  );
}

function Field({
  icon,
  suffix,
  value,
  onChange,
  ...rest
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="group flex items-center gap-3 rounded-2xl border border-[#F1D9D5] bg-[#FFF8F7] px-4 py-3 transition-colors focus-within:border-[#F38B82] focus-within:bg-white">
      <span className="text-[#C7A39F] group-focus-within:text-[#F38B82]">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
      />
      {suffix}
    </label>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.5S6.9 20.8 12 20.8c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z" />
    </svg>
  );
}
