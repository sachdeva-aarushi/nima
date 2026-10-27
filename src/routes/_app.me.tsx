import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Copy,
  FileBarChart2,
  FileText,
  Heart,
  LogOut,
  Shield,
  Sparkles,
  Trash2,
  Unplug,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import {
  createPartnerInvite,
  getPartnerStatus,
  revokePartnerInvite,
  unlinkPartner,
  updatePartnerConsent,
} from "@/lib/partner.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/me")({
  head: () => ({ meta: [{ title: "Profile — Nima" }] }),
  component: MePage,
});

interface ProfileRow {
  name: string | null;
  birth_date: string | null;
  delivery_type: string | null;
}

interface ScanRow {
  id: string;
  original_filename: string | null;
  document_kind: string | null;
  status: string;
  created_at: string;
}

function MePage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"mother" | "partner">("mother");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deliveryType, setDeliveryType] = useState<string>("");
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [linkedMotherName, setLinkedMotherName] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const id = sess.session?.user.id;
      if (!id) return;
      setUid(id);
      setEmail(sess.session?.user.email ?? "");
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, birth_date, delivery_type, role, linked_user_id")
        .eq("id", id)
        .maybeSingle();
      const p = prof as (ProfileRow & { role: string | null; linked_user_id: string | null }) | null;
      setName(p?.name ?? "");
      setBirthDate(p?.birth_date ?? "");
      setDeliveryType(p?.delivery_type ?? "");
      const r = (p?.role as "mother" | "partner" | undefined) ?? "mother";
      setRole(r);

      if (r === "partner") {
        setRelationship(localStorage.getItem(`partner_relationship_${id}`) ?? "");
        if (p?.linked_user_id) {
          const { data: motherProf } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", p.linked_user_id)
            .maybeSingle();
          setLinkedMotherName(motherProf?.name ?? null);
        }
      } else {
        const { data: docs } = await supabase
          .from("scanned_documents")
          .select("id, original_filename, document_kind, status, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(20);
        setScans((docs ?? []) as ScanRow[]);
      }
      setLoading(false);
    })();
  }, []);


  async function saveProfile() {
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: name || null,
        birth_date: birthDate || null,
        delivery_type: (deliveryType || null) as never,
      })
      .eq("id", uid);
    setSaving(false);
    if (error) {
      toast.error("Could not save changes.");
      return;
    }
    setDirty(false);
    toast.success("Profile updated");
  }

  async function deleteScan(id: string) {
    if (!confirm("Delete this scanned document? This can't be undone.")) return;
    const { error } = await supabase.from("scanned_documents").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete document.");
      return;
    }
    setScans((arr) => arr.filter((s) => s.id !== id));
    toast.success("Document removed");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }


  if (role === "partner") {
    return (
      <PartnerMeView
        uid={uid}
        email={email}
        name={name}
        relationship={relationship}
        linkedMotherName={linkedMotherName}
        loading={loading}
        dirty={dirty}
        saving={saving}
        onNameChange={(v) => markDirty(setName)(v)}
        onRelationshipChange={(v) => {
          setRelationship(v);
          if (uid) localStorage.setItem(`partner_relationship_${uid}`, v);
        }}
        onSave={async () => {
          if (!uid) return;
          setSaving(true);
          const { error } = await supabase
            .from("profiles")
            .update({ name: name || null })
            .eq("id", uid);
          setSaving(false);
          if (error) {
            toast.error("Could not save changes.");
            return;
          }
          setDirty(false);
          toast.success("Profile updated");
        }}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      {/* Header */}
      <header className="mb-6 flex items-center gap-3">
        <MascotPortrait state="happy" size="md" />
        <div className="min-w-0">
          <h1
            className="truncate text-2xl text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {name ? name.split(" ")[0].toLowerCase() : "your profile"}
          </h1>
          <p className="truncate text-[11px] text-[#8A6E6B]">{email}</p>
        </div>
      </header>

      {/* Editable profile */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
          about you
        </h2>
        <FieldCard label="Name">
          <input
            value={name}
            onChange={(e) => markDirty(setName)(e.target.value)}
            placeholder="Your name"
            className="w-full bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
          />
        </FieldCard>
        <FieldCard label="Baby's birth date">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => markDirty(setBirthDate)(e.target.value)}
            className="w-full bg-transparent text-sm text-[#3D2A28] focus:outline-none"
          />
        </FieldCard>
        <FieldCard label="Delivery type">
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[
              { value: "vaginal", label: "Vaginal" },
              { value: "c_section", label: "C-section" },
            ].map((opt) => {
              const active = deliveryType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => markDirty(setDeliveryType)(opt.value)}
                  className={cn(
                    "rounded-2xl border-2 px-3 py-2 text-sm transition",
                    active
                      ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                      : "border-transparent bg-[#F6EFEE] text-[#8A6E6B]"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FieldCard>
        {dirty && (
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full rounded-full bg-[#F38B82] py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {saving ? "saving…" : "save changes"}
          </button>
        )}
      </section>

      {/* Quick links */}
      <section className="mt-6 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
          your space
        </h2>
        <LinkRow
          to="/recovery"
          icon={<Sparkles className="h-5 w-5 text-[#D4726D]" />}
          iconBg="bg-[#FDE7E4]"
          title="your path to recovery"
          sub="a personalized step guide"
        />
        <LinkRow
          to="/progress"
          icon={<FileBarChart2 className="h-5 w-5 text-[#7B7FCE]" />}
          iconBg="bg-[#EAE9F8]"
          title="progress & milestones"
          sub="your week, summarized"
        />
        <LinkRow
          to="/privacy"
          icon={<Shield className="h-5 w-5 text-[#7BA886]" />}
          iconBg="bg-[#E6F0E7]"
          title="privacy & security"
          sub="how your data is handled"
        />
      </section>

      {/* Connected documents */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
            connected documents
          </h2>
          <Link to="/scan" className="text-[11px] font-medium text-[#D4726D]">
            + add new
          </Link>
        </div>
        <div className="space-y-2.5">
          {loading ? (
            <div className="h-24 animate-pulse rounded-3xl bg-white/70" />
          ) : scans.length === 0 ? (
            <div className="rounded-3xl bg-white p-4 text-center text-xs text-[#8A6E6B] shadow-sm">
              No scanned documents yet.
            </div>
          ) : (
            scans.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FDE7E4]">
                  <FileText className="h-5 w-5 text-[#D4726D]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#3D2A28]">
                    {s.original_filename ?? "Document"}
                  </p>
                  <p className="text-[11px] text-[#8A6E6B]">
                    {prettyKind(s.document_kind)} ·{" "}
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {prettyStatus(s.status)}
                  </p>
                </div>
                <Link
                  to="/scan/review/$id"
                  params={{ id: s.id }}
                  className="rounded-full bg-[#F6EFEE] px-3 py-1 text-[11px] font-medium text-[#5B403D]"
                >
                  view
                </Link>
                <button
                  onClick={() => deleteScan(s.id)}
                  aria-label="Delete document"
                  className="grid h-8 w-8 place-items-center rounded-full text-[#B59A97] hover:bg-[#FDE7E4] hover:text-[#D4726D]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Partner sharing */}
      <PartnerSection />

      {/* Logout */}
      <button
        onClick={signOut}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-[#EFD9D5] bg-white py-3 text-sm text-[#3D2A28]"
      >
        <LogOut className="h-4 w-4" />
        sign out
      </button>
    </div>
  );
}

function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function LinkRow({
  to,
  icon,
  iconBg,
  title,
  sub,
}: {
  to: "/recovery" | "/progress" | "/privacy";
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF]"
    >
      <div className="flex items-center gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-2xl", iconBg)}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-[#3D2A28]">{title}</p>
          <p className="text-[11px] text-[#8A6E6B]">{sub}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#B59A97]" />
    </Link>
  );
}

export function Toggle({
  on,
  onChange,
  tone = "coral",
}: {
  on: boolean;
  onChange: () => void;
  tone?: "coral" | "sage";
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        on ? (tone === "sage" ? "bg-[#7BA886]" : "bg-[#F38B82]") : "bg-[#E5DAD8]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

function prettyKind(k: string | null) {
  if (!k) return "Document";
  return k.replace(/_/g, " ");
}
function prettyStatus(s: string) {
  return s.replace(/_/g, " ");
}

// ─── Partner sharing section ──────────────────────────────────────────────

interface ConsentFlags {
  share_mood: boolean;
  share_symptoms: boolean;
  share_checkin_streak: boolean;
  share_appointments: boolean;
  share_chat_summary: boolean;
}

const CONSENT_LABELS: Array<{
  key: keyof ConsentFlags;
  label: string;
  desc: string;
  extra?: string;
}> = [
  { key: "share_mood", label: "Let him see your mood trend", desc: "A gentle weekly summary — not raw numbers." },
  { key: "share_symptoms", label: "Let him see symptoms you've logged", desc: "Recent symptoms from your check-ins." },
  { key: "share_checkin_streak", label: "Let him see your check-in streak", desc: "Encouragement, framed positively." },
  { key: "share_appointments", label: "Let him see upcoming appointments", desc: "So he can help with logistics." },
  {
    key: "share_chat_summary",
    label: "Let him see a high-level mood summary",
    desc: "From your conversations with Nima.",
    extra: "Nima will share a brief, general summary of how you've been feeling — never your actual conversations.",
  },
];

interface PartnerStatus {
  role: string;
  linked_user_id: string | null;
  partner_name: string | null;
  invites: { invite_code: string; status: string; expires_at: string; created_at: string }[];
  consent: ConsentFlags;
}

function PartnerSection() {
  const fetchStatus = useServerFn(getPartnerStatus);
  const createInvite = useServerFn(createPartnerInvite);
  const revokeInvite = useServerFn(revokePartnerInvite);
  const updateConsent = useServerFn(updatePartnerConsent);
  const unlink = useServerFn(unlinkPartner);

  const [status, setStatus] = useState<PartnerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const s = (await fetchStatus()) as PartnerStatus;
      setStatus(s);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <section className="mt-6">
        <div className="h-24 animate-pulse rounded-3xl bg-white/70" />
      </section>
    );
  }
  if (!status || status.role === "partner") return null;

  const pending = status.invites.find(
    (i) => i.status === "pending" && new Date(i.expires_at).getTime() > Date.now()
  );
  const linked = Boolean(status.linked_user_id);

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    try {
      await createInvite({ data: { email: null } });
      await refresh();
      toast.success("Invite code ready to share");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(code: string) {
    setBusy(true);
    try {
      await revokeInvite({ data: { code } });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(field: keyof ConsentFlags) {
    if (!status) return;
    const next = !status.consent[field];
    setStatus({ ...status, consent: { ...status.consent, [field]: next } });
    try {
      await updateConsent({ data: { field, value: next } });
    } catch {
      setStatus(status);
      toast.error("Couldn't update sharing.");
    }
  }

  async function handleUnlink() {
    if (!confirm("Unlink your partner? They'll lose all access immediately.")) return;
    setBusy(true);
    try {
      await unlink();
      await refresh();
      toast.success("Partner unlinked");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy — long-press to copy.");
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
        partner sharing
      </h2>

      {!linked ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FDE7E4]">
              <UserPlus className="h-5 w-5 text-[#D4726D]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#3D2A28]">invite my partner</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#8A6E6B]">
                He'll get his own account. By default he'll see <span className="font-semibold">nothing</span> —
                you decide what to share, field by field, after he's linked.
              </p>
            </div>
          </div>

          {pending ? (
            <div className="mt-3 rounded-2xl bg-[#FFF8F7] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8A6E6B]">
                share this code
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <code className="font-mono text-xl tracking-[0.25em] text-[#3D2A28]">
                  {pending.invite_code}
                </code>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyCode(pending.invite_code)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#D4726D] shadow-sm"
                    aria-label="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRevoke(pending.invite_code)}
                    disabled={busy}
                    className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#8A6E6B] shadow-sm"
                  >
                    cancel
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[#A8908D]">
                Expires {new Date(pending.expires_at).toLocaleDateString()}.
              </p>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={busy}
              className="mt-3 w-full rounded-full bg-[#F38B82] py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {busy ? "generating…" : "generate invite code"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E6F0E7]">
                <Heart className="h-5 w-5 fill-[#7BA886] text-[#7BA886]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-[#3D2A28]">
                  linked with {status.partner_name ?? "your partner"}
                </p>
                <p className="text-[11px] text-[#8A6E6B]">
                  Toggle below what he can see. All off = nothing shared.
                </p>
              </div>
            </div>
          </div>

          {CONSENT_LABELS.map((c) => (
            <div key={c.key} className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#3D2A28]">{c.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8A6E6B]">{c.desc}</p>
                  {c.extra && (
                    <p className="mt-2 rounded-xl bg-[#FFF8F7] px-3 py-2 text-[10px] leading-relaxed text-[#5B403D]">
                      {c.extra}
                    </p>
                  )}
                </div>
                <Toggle on={status.consent[c.key]} onChange={() => handleToggle(c.key)} tone="sage" />
              </div>
            </div>
          ))}

          <button
            onClick={handleUnlink}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#EFD9D5] bg-white py-2.5 text-sm text-[#D4726D] shadow-sm disabled:opacity-60"
          >
            <Unplug className="h-4 w-4" />
            unlink partner
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Partner-side Me view ─────────────────────────────────────────────────

function PartnerMeView({
  uid,
  email,
  name,
  relationship,
  linkedMotherName,
  loading,
  dirty,
  saving,
  onNameChange,
  onRelationshipChange,
  onSave,
  onSignOut,
}: {
  uid: string | null;
  email: string;
  name: string;
  relationship: string;
  linkedMotherName: string | null;
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  onNameChange: (v: string) => void;
  onRelationshipChange: (v: string) => void;
  onSave: () => void;
  onSignOut: () => void;
}) {
  const RELATIONSHIPS = ["partner", "husband", "boyfriend", "co-parent", "other"];

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <MascotPortrait state="happy" size="md" />
        <div className="min-w-0">
          <h1
            className="truncate text-2xl text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {name ? name.split(" ")[0].toLowerCase() : "your profile"}
          </h1>
          <p className="truncate text-[11px] text-[#8A6E6B]">{email}</p>
        </div>
      </header>

      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-white/70" />
      ) : (
        <>
          {/* About you */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
              about you
            </h2>
            <FieldCard label="Your name">
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Your name"
                className="w-full bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
              />
            </FieldCard>
            <FieldCard label="Relationship">
              <div className="mt-1 flex flex-wrap gap-2">
                {RELATIONSHIPS.map((opt) => {
                  const active = relationship === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onRelationshipChange(opt)}
                      className={cn(
                        "rounded-full border-2 px-3 py-1.5 text-xs transition",
                        active
                          ? "border-[#F38B82] bg-[#FFF1EF] text-[#3D2A28]"
                          : "border-transparent bg-[#F6EFEE] text-[#8A6E6B]"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </FieldCard>
            {dirty && (
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full rounded-full bg-[#F38B82] py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {saving ? "saving…" : "save changes"}
              </button>
            )}
          </section>

          {/* Linked mother */}
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
              who you're supporting
            </h2>
            <div className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FDE7E4]">
                  <Heart className="h-5 w-5 fill-[#D4726D] text-[#D4726D]" />
                </div>
                <div className="min-w-0 flex-1">
                  {linkedMotherName ? (
                    <>
                      <p className="truncate text-sm font-medium text-[#3D2A28]">
                        {linkedMotherName}
                      </p>
                      <p className="text-[11px] text-[#8A6E6B]">
                        {relationship
                          ? `Linked as her ${relationship}`
                          : "You're linked together"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-[#3D2A28]">not linked</p>
                      <p className="text-[11px] text-[#8A6E6B]">
                        Ask her to send you a fresh invite code.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 rounded-2xl bg-[#FFF8F7] px-3 py-2 text-[10px] leading-relaxed text-[#5B403D]">
                Only she can change what's shared with you — and she can unlink at any time.
              </p>
            </div>
          </section>

          {/* Quick links */}
          <section className="mt-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8A6E6B]">
              your space
            </h2>
            <Link
              to="/partner/dashboard"
              className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FDE7E4]">
                  <Heart className="h-5 w-5 text-[#D4726D]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#3D2A28]">supporting her</p>
                  <p className="text-[11px] text-[#8A6E6B]">your shared dashboard</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#B59A97]" />
            </Link>
            <Link
              to="/privacy"
              className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF1EF]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#E6F0E7]">
                  <Shield className="h-5 w-5 text-[#7BA886]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#3D2A28]">privacy & security</p>
                  <p className="text-[11px] text-[#8A6E6B]">how her data is handled</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#B59A97]" />
            </Link>
          </section>

          <button
            onClick={onSignOut}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-[#EFD9D5] bg-white py-3 text-sm text-[#3D2A28]"
          >
            <LogOut className="h-4 w-4" />
            sign out
          </button>
        </>
      )}
    </div>
  );
}

