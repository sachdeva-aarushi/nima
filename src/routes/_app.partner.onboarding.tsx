import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { CoralButton } from "@/components/CoralButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/partner/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Nima" }] }),
  component: PartnerOnboarding,
});

const RELATIONSHIPS = [
  { value: "husband", label: "Husband" },
  { value: "partner", label: "Partner" },
  { value: "spouse", label: "Spouse" },
  { value: "co_parent", label: "Co-parent" },
  { value: "other", label: "Other" },
];

function PartnerOnboarding() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<string>("partner");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (!id) return;
      setUid(id);
      supabase
        .from("profiles")
        .select("name")
        .eq("id", id)
        .maybeSingle()
        .then(({ data: p }) => setName(p?.name ?? ""));
    });
  }, []);

  async function finish() {
    if (!uid) return;
    setSaving(true);
    try {
      localStorage.setItem(`partner_relationship_${uid}`, relationship);
    } catch {}
    const { error } = await supabase
      .from("profiles")
      .update({ name: name || null } as never)
      .eq("id", uid);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    navigate({ to: "/partner/dashboard" });
  }

  return (
    <main className="min-h-[100dvh] bg-[#FDE7E4] px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center text-center">
          <MascotPortrait state="happy" size="lg" />
          <h1
            className="mt-5 text-3xl text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            welcome
          </h1>
          <p className="mt-2 max-w-xs text-sm text-[#8A6E6B]">
            I'm Nima. I'll help you support her through these first weeks — with
            practical, concrete suggestions, only on what she's chosen to share.
          </p>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          {step === 0 ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
                Your name
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should Nima call you?"
                className="mt-2 w-full border-b border-[#F1D9D5] bg-transparent pb-2 text-lg text-[#3D2A28] placeholder:text-[#B59A97] focus:border-[#F38B82] focus:outline-none"
                autoFocus
              />
              <CoralButton
                className="mt-6 w-full"
                disabled={!name.trim()}
                onClick={() => setStep(1)}
              >
                Continue
              </CoralButton>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
                Your relationship to her
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {RELATIONSHIPS.map((r) => {
                  const active = relationship === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRelationship(r.value)}
                      className={cn(
                        "rounded-2xl border-2 px-3 py-3 text-sm transition",
                        active
                          ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                          : "border-transparent bg-[#F6EFEE] text-[#8A6E6B]"
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <CoralButton
                className="mt-6 w-full"
                disabled={saving}
                onClick={finish}
              >
                {saving ? "Just a moment…" : "Open dashboard"}
              </CoralButton>
              <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-[#A8908D]">
                <Heart className="h-3 w-3 fill-[#F38B82] text-[#F38B82]" />
                You'll only see what she chooses to share.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
