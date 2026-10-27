import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Settings, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Toggle } from "./_app.me";

export const Route = createFileRoute("/_app/privacy")({
  head: () => ({ meta: [{ title: "Privacy & security — Nima" }] }),
  component: PrivacyCenter,
});

interface PrivacyRow {
  ai_insights_enabled: boolean;
  usage_analytics_enabled: boolean;
}

function PrivacyCenter() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const id = sess.session?.user.id;
      if (!id) return;
      setUid(id);
      const { data } = await supabase
        .from("profiles")
        .select("ai_insights_enabled, usage_analytics_enabled")
        .eq("id", id)
        .maybeSingle();
      const p = data as PrivacyRow | null;
      setAiInsights(p?.ai_insights_enabled !== false);
      setAnalytics(Boolean(p?.usage_analytics_enabled));
    })();
  }, []);

  async function update(field: keyof PrivacyRow, value: boolean) {
    if (!uid) return;
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value } as never)
      .eq("id", uid);
    if (error) {
      toast.error("Could not update setting.");
      return false;
    }
    return true;
  }

  async function exportData() {
    if (!uid) return;
    setExporting(true);
    try {
      const tables = [
        "profiles",
        "checkins",
        "health_records",
        "scanned_documents",
        "quiz_sessions",
        "chat_messages",
        "insight_cards_shown",
        "progress_reports",
        "baby_logs",
      ] as const;
      const payload: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: uid,
      };
      for (const t of tables) {
        const { data } = await supabase.from(t).select("*");
        payload[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nima-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e) {
      console.error(e);
      toast.error("Could not export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteEverything() {
    if (!uid) return;
    const confirmText = prompt(
      'This permanently deletes your check-ins, records, scanned documents, and chat history. Type DELETE to confirm.'
    );
    if (confirmText !== "DELETE") return;

    try {
      // delete app rows; profiles cascade is via auth.users so leave it for now
      await Promise.all([
        supabase.from("chat_messages").delete().eq("user_id", uid),
        supabase.from("checkins").delete().eq("user_id", uid),
        supabase.from("health_records").delete().eq("user_id", uid),
        supabase.from("scanned_documents").delete().eq("user_id", uid),
        supabase.from("quiz_sessions").delete().eq("user_id", uid),
        supabase.from("insight_cards_shown").delete().eq("user_id", uid),
        supabase.from("progress_reports").delete().eq("user_id", uid),
        supabase.from("baby_logs").delete().eq("user_id", uid),
      ]);

      // remove scan files from storage
      const { data: files } = await supabase.storage.from("medical-scans").list(uid);
      if (files && files.length) {
        const paths = files.map((f) => `${uid}/${f.name}`);
        await supabase.storage.from("medical-scans").remove(paths);
      }

      toast.success("Your data has been removed.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (e) {
      console.error(e);
      toast.error("Could not delete all data. Please contact support.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/me" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-base italic text-[#A6645F]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          privacy & security
        </h1>
        <button
          aria-label="Account"
          onClick={() => navigate({ to: "/me" })}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#5B403D]"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* Soft silk hero */}
      <div
        className="relative h-32 overflow-hidden rounded-3xl"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 30%, #F8C5B8 0%, #E69A8C 35%, #C46A60 70%, #8B4036 100%)",
          }}
        />
        <svg
          viewBox="0 0 400 160"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-60"
        >
          <defs>
            <linearGradient id="silk" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFF1ED" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#7A2C25" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 12 }).map((_, i) => (
            <path
              key={i}
              d={`M0 ${30 + i * 10} C ${100 + i * 4} ${10 + i * 8}, ${260 - i * 6} ${110 - i * 4}, 400 ${70 + i * 5}`}
              stroke="url(#silk)"
              strokeWidth="1.2"
              fill="none"
            />
          ))}
        </svg>
      </div>

      <h2
        className="mt-5 text-2xl text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        your privacy is yours
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-[#8A6E6B]">
        your conversations with nima are private. your health records are yours.
        nothing is shared without your explicit consent — and you can delete
        everything, any time.
      </p>

      {/* Permissions */}
      <section className="mt-6">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A6E6B]">
          data permissions
        </h3>
        <div className="space-y-3">
          <PermissionCard
            title="personalized insights"
            description="let nima learn your patterns to offer warmer, more relevant guidance over time."
            value={aiInsights}
            onToggle={async () => {
              const next = !aiInsights;
              setAiInsights(next);
              const ok = await update("ai_insights_enabled", next);
              if (!ok) setAiInsights(!next);
            }}
          />
          <PermissionCard
            title="anonymous usage data"
            description="help us make nima better — never tied to your identity, never sold."
            value={analytics}
            tone="muted"
            onToggle={async () => {
              const next = !analytics;
              setAnalytics(next);
              const ok = await update("usage_analytics_enabled", next);
              if (!ok) setAnalytics(!next);
            }}
          />
        </div>
      </section>

      {/* Policy text */}
      <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A6E6B]">
          <Shield className="h-3.5 w-3.5" /> how we protect you
        </h3>
        <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#5B403D]">
          <li>· All your check-ins, records, and scanned documents are encrypted in transit and at rest.</li>
          <li>· Only you can see your data — Nima staff cannot read your private notes or scans.</li>
          <li>· AI features only run when you ask. Your prompts are never used to train outside models.</li>
        </ul>
      </section>

      {/* Data export & delete */}
      <section className="mt-6 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A6E6B]">
          your data
        </h3>

        <button
          onClick={exportData}
          disabled={exporting}
          className="flex w-full items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF] disabled:opacity-60"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EAE9F8]">
              <Download className="h-5 w-5 text-[#7B7FCE]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3D2A28]">
                {exporting ? "preparing your export…" : "download my data"}
              </p>
              <p className="text-[11px] text-[#8A6E6B]">
                A JSON archive of your check-ins, records, scans & chats.
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={deleteEverything}
          className="flex w-full items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF]"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FDE7E4]">
              <Trash2 className="h-5 w-5 text-[#D4726D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3D2A28]">delete all my data</p>
              <p className="text-[11px] text-[#8A6E6B]">
                Permanently removes your records, scans, and chats.
              </p>
            </div>
          </div>
        </button>
      </section>

      <p className="mt-6 text-center text-[10px] leading-relaxed text-[#A8908D]">
        Read our full{" "}
        <span className="underline">privacy policy</span> and{" "}
        <span className="underline">terms of service</span>.
      </p>

      {/* Avoid unused warning */}
      <span className={cn("hidden")} />
    </div>
  );
}

function PermissionCard({
  title,
  description,
  value,
  onToggle,
  tone = "coral",
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  tone?: "coral" | "muted";
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#3D2A28]">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8A6E6B]">{description}</p>
      </div>
      <Toggle on={value} onChange={onToggle} tone={tone === "muted" ? "sage" : "coral"} />
    </div>
  );
}
