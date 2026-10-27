import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Pill,
  CalendarDays,
  Heart,
  Activity,
  ScanLine,
  Info,
  Lock,
  
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { MascotPortrait } from "@/components/MascotPortrait";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/records")({
  head: () => ({ meta: [{ title: "Health Records — Nima" }] }),
  component: HealthRecords,
});

type Tab = "medications" | "appointments" | "symptoms" | "vitals";
const TABS: { id: Tab; label: string; icon: typeof Pill }[] = [
  { id: "medications", label: "Medications", icon: Pill },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "symptoms", label: "Symptoms", icon: Heart },
  { id: "vitals", label: "Vitals", icon: Activity },
];

interface HRecord {
  id: string;
  record_type: string;
  title: string | null;
  value: any;
  unit: string | null;
  recorded_at: string;
  source: string;
  source_document_id: string | null;
  notes: string | null;
  is_abnormal?: boolean | null;
}

interface Checkin {
  id: string;
  symptoms: string[];
  note: string | null;
  mood: string;
  created_at: string;
}

interface QuizSession {
  id: string;
  quiz_type: string;
  result_summary: string | null;
  completed_at: string | null;
  started_at: string;
}

const MED_ICON_TINTS = [
  { bg: "#EAE9F8", fg: "#7B7FCE" },
  { bg: "#E6F0E7", fg: "#5C8A6A" },
  { bg: "#FDE7E4", fg: "#D4726D" },
  { bg: "#FFF1D6", fg: "#B07A2C" },
];

function HealthRecords() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("medications");
  const [records, setRecords] = useState<HRecord[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const uid = sess.session.user.id;
      const [r, c, q] = await Promise.all([
        supabase
          .from("health_records")
          .select("id, record_type, title, value, unit, recorded_at, source, source_document_id, notes, is_abnormal")
          .eq("user_id", uid)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("checkins")
          .select("id, symptoms, note, mood, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("quiz_sessions")
          .select("id, quiz_type, result_summary, completed_at, started_at")
          .eq("user_id", uid)
          .order("started_at", { ascending: false })
          .limit(40),
      ]);
      setRecords((r.data as HRecord[]) ?? []);
      setCheckins((c.data as Checkin[]) ?? []);
      setQuizzes((q.data as QuizSession[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const meds = useMemo(
    () => records.filter((r) => r.record_type === "medication" && !r.value?.discontinued_at),
    [records],
  );
  const appointments = useMemo(
    () => records.filter((r) => r.record_type === "appointment"),
    [records],
  );
  const vitals = useMemo(
    () => records.filter((r) => r.record_type === "vital" || r.record_type === "blood_pressure"),
    [records],
  );

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <MascotPortrait state="happy" size="sm" accents={false} />
        <Link
          to="/scan"
          aria-label="Scan a document"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F38B82] text-white shadow-sm transition hover:bg-[#E47A72]"
        >
          <ScanLine className="h-4 w-4" />
        </Link>
      </header>

      <h1
        className="text-3xl font-medium text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        health records
      </h1>

      {/* Tabs */}
      <div className="mt-5 -mx-5 flex gap-5 overflow-x-auto border-b border-[#F1D9D5] px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 pb-2.5 text-sm transition",
                active ? "text-[#D4726D]" : "text-[#8A6E6B]",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#D4726D]" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#A8908D]">
        <Info className="h-3 w-3" />
        Your {tab} are kept private and secure.
      </p>

      <div className="mt-3 space-y-3">
        {loading ? (
          <SkeletonCard />
        ) : tab === "medications" ? (
          meds.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-6 w-6 text-[#D4726D]" />}
              title="No medications yet"
              hint="Scan a prescription or discharge summary to add them."
            />
          ) : (
            meds.map((m, i) => <MedicationCard key={m.id} med={m} tint={MED_ICON_TINTS[i % MED_ICON_TINTS.length]} />)
          )
        ) : tab === "appointments" ? (
          appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6 text-[#D4726D]" />}
              title="No appointments yet"
              hint="Scan a discharge summary to import your follow-ups."
            />
          ) : (
            appointments.map((a) => <AppointmentCard key={a.id} appt={a} />)
          )
        ) : tab === "symptoms" ? (
          <SymptomLog checkins={checkins} quizzes={quizzes} />
        ) : (
          <VitalsTab vitals={vitals} />
        )}
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-[#A8908D]">
        <Lock className="h-3 w-3" /> Only you can see your health records.
      </p>
    </div>
  );
}

function MedicationCard({
  med,
  tint,
}: {
  med: HRecord;
  tint: { bg: string; fg: string };
}) {
  const v = med.value ?? {};
  const dose = v.dose ?? med.unit ?? "";
  const frequency = v.frequency ?? "";
  const instructions = v.instructions ?? med.notes ?? "";
  const sourceLabel = med.source === "scanned_document"
    ? `from your ${v.document_kind ? v.document_kind.replace(/_/g, " ") : "scanned document"}, ${formatShortDate(med.recorded_at)}`
    : "added manually";
  const [reminder, setReminder] = useState(Boolean(v.reminder_enabled));

  async function toggle() {
    const next = !reminder;
    setReminder(next);
    await supabase
      .from("health_records")
      .update({ value: { ...v, reminder_enabled: next } })
      .eq("id", med.id);
  }

  return (
    <Link
      to="/records/medication/$id"
      params={{ id: med.id }}
      className="block rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF8F7]"
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: tint.bg }}
        >
          <Pill className="h-5 w-5" style={{ color: tint.fg }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-base font-medium text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {med.title ?? "Medication"} {dose && <span className="text-[#5B403D]">{dose}</span>}
            </h3>
            <span className={cn(
              "shrink-0 text-right text-[10px] leading-tight",
              med.source === "scanned_document" ? "text-[#7B7FCE]" : "text-[#8A6E6B]",
            )}>
              {sourceLabel}
            </span>
          </div>
          {(dose || frequency) && (
            <p className="mt-0.5 text-xs text-[#8A6E6B]">
              {dose}
              {dose && frequency && " · "}
              {frequency}
            </p>
          )}
          {instructions && (
            <p className="mt-1.5 inline-block rounded-md bg-[#F6EFEE] px-2 py-1 text-[11px] text-[#5B403D]">
              {instructions}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#F6EFEE] pt-3">
        <div className="flex items-center gap-1.5 text-xs text-[#D4726D]">
          <Bell className="h-3.5 w-3.5" /> Reminder
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
          aria-pressed={reminder}
          className={cn(
            "relative h-6 w-11 rounded-full transition",
            reminder ? "bg-[#F38B82]" : "bg-[#E5DAD8]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
              reminder ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </div>
    </Link>
  );
}

function AppointmentCard({ appt }: { appt: HRecord }) {
  const v = appt.value ?? {};
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E6F0E7]">
          <CalendarDays className="h-5 w-5 text-[#5C8A6A]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-base font-medium text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {appt.title ?? v.purpose ?? "Follow-up appointment"}
          </h3>
          <p className="mt-0.5 text-xs text-[#8A6E6B]">
            {v.date ? formatShortDate(v.date) : formatShortDate(appt.recorded_at)}
            {v.provider && ` · ${v.provider}`}
          </p>
          {appt.notes && <p className="mt-2 text-xs text-[#5B403D]">{appt.notes}</p>}
        </div>
      </div>
    </div>
  );
}

function SymptomLog({ checkins, quizzes }: { checkins: Checkin[]; quizzes: QuizSession[] }) {
  type Entry = { id: string; date: string; kind: "checkin" | "quiz"; label: string; detail: string };
  const entries: Entry[] = [
    ...checkins
      .filter((c) => c.symptoms?.length || c.note)
      .map((c) => ({
        id: c.id,
        date: c.created_at,
        kind: "checkin" as const,
        label: c.mood ? `feeling ${c.mood}` : "check-in",
        detail: c.symptoms.length ? c.symptoms.join(", ") : c.note ?? "",
      })),
    ...quizzes
      .filter((q) => q.completed_at)
      .map((q) => ({
        id: q.id,
        date: q.completed_at ?? q.started_at,
        kind: "quiz" as const,
        label: `quiz · ${q.quiz_type}`,
        detail: q.result_summary ?? "completed",
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-6 w-6 text-[#D4726D]" />}
        title="No symptoms logged yet"
        hint="Your daily check-ins and quizzes show up here."
      />
    );
  }
  return (
    <>
      {entries.map((e) => (
        <div key={`${e.kind}-${e.id}`} className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                e.kind === "checkin" ? "bg-[#FDE7E4] text-[#D4726D]" : "bg-[#EAE9F8] text-[#7B7FCE]",
              )}
            >
              {e.kind === "checkin" ? "Check-in" : "Quiz"}
            </span>
            <span className="text-[11px] text-[#8A6E6B]">{formatShortDate(e.date)}</span>
          </div>
          <p
            className="mt-2 text-sm text-[#3D2A28]"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            {e.label}
          </p>
          {e.detail && <p className="mt-1 text-xs text-[#5B403D]">{e.detail}</p>}
        </div>
      ))}
    </>
  );
}

function VitalsTab({ vitals }: { vitals: HRecord[] }) {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState(vitals);

  useEffect(() => setList(vitals), [vitals]);

  async function save() {
    const s = Number(systolic);
    const d = Number(diastolic);
    if (!s || !d || s < 60 || s > 250 || d < 40 || d > 160) return;
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const { data } = await supabase
      .from("health_records")
      .insert({
        user_id: sess.session.user.id,
        record_type: "blood_pressure",
        title: "Blood pressure",
        value: { systolic: s, diastolic: d },
        unit: "mmHg",
        source: "manual",
        is_abnormal: s >= 140 || d >= 90,
      })
      .select("id, record_type, title, value, unit, recorded_at, source, source_document_id, notes, is_abnormal")
      .single();
    if (data) setList([data as HRecord, ...list]);
    setSystolic("");
    setDiastolic("");
    setSaving(false);
  }

  const bps = list
    .filter((v) => v.record_type === "blood_pressure")
    .slice(0, 12)
    .reverse();

  return (
    <>
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#3D2A28]">Log blood pressure</h3>
        <div className="mt-3 flex items-center gap-2">
          <input
            inputMode="numeric"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="120"
            className="w-16 rounded-xl border border-[#F1D9D5] bg-white px-2 py-2 text-center text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
          <span className="text-[#8A6E6B]">/</span>
          <input
            inputMode="numeric"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="80"
            className="w-16 rounded-xl border border-[#F1D9D5] bg-white px-2 py-2 text-center text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
          <span className="text-xs text-[#8A6E6B]">mmHg</span>
          <button
            disabled={saving}
            onClick={save}
            className="ml-auto rounded-full bg-[#F38B82] px-4 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          >
            save
          </button>
        </div>
      </div>

      {bps.length > 0 && (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#3D2A28]">Trend</h3>
          <BpChart points={bps.map((b) => ({ s: Number(b.value?.systolic), d: Number(b.value?.diastolic) }))} />
          <div className="mt-2 flex justify-between text-[10px] text-[#8A6E6B]">
            <span>oldest</span>
            <span>latest</span>
          </div>
        </div>
      )}

      {bps.length === 0 && (
        <EmptyState
          icon={<Activity className="h-6 w-6 text-[#D4726D]" />}
          title="No vitals logged yet"
          hint="Add a blood-pressure reading above to start your trend."
        />
      )}

      {list
        .filter((v) => v.record_type === "blood_pressure")
        .map((v) => (
          <div key={v.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "font-medium text-[#3D2A28]",
                  v.is_abnormal && "text-[#D4726D]",
                )}
              >
                {v.value?.systolic}/{v.value?.diastolic} mmHg
              </span>
              <span className="text-[11px] text-[#8A6E6B]">{formatShortDate(v.recorded_at)}</span>
            </div>
          </div>
        ))}
    </>
  );
}

function BpChart({ points }: { points: { s: number; d: number }[] }) {
  if (points.length === 0) return null;
  const W = 280, H = 110, P = 10;
  const all = points.flatMap((p) => [p.s, p.d]);
  const min = Math.min(...all, 60) - 5;
  const max = Math.max(...all, 140) + 5;
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const path = (key: "s" | "d") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-28 w-full">
      <path d={path("s")} stroke="#D4726D" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={path("d")} stroke="#8A8FD4" strokeWidth="2" fill="none" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.s)} r="2.5" fill="#D4726D" />
          <circle cx={x(i)} cy={y(p.d)} r="2.5" fill="#8A8FD4" />
        </g>
      ))}
    </svg>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-10 text-center shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#FDE7E4]">{icon}</div>
      <h3
        className="mt-3 text-base text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        {title}
      </h3>
      <p className="mt-1 text-xs text-[#8A6E6B]">{hint}</p>
      <Link
        to="/scan"
        className="mt-4 flex items-center gap-1.5 rounded-full bg-[#F38B82] px-4 py-2 text-xs font-semibold text-white"
      >
        <ScanLine className="h-3.5 w-3.5" /> scan a document
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/70" />
      ))}
    </div>
  );
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
