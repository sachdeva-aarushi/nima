import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Pill, Bell, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/records_/medication/$id")({
  head: () => ({ meta: [{ title: "Medication — Nima" }] }),
  component: MedicationDetail,
});

interface MedRecord {
  id: string;
  title: string | null;
  value: any;
  unit: string | null;
  recorded_at: string;
  source: string;
  source_document_id: string | null;
  notes: string | null;
}

function MedicationDetail() {
  const { id } = useParams({ from: "/_app/records_/medication/$id" });
  const navigate = useNavigate();
  const [med, setMed] = useState<MedRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminder, setReminder] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("health_records")
        .select("id, title, value, unit, recorded_at, source, source_document_id, notes")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        const m = data as MedRecord;
        setMed(m);
        const v = m.value ?? {};
        setDose(v.dose ?? m.unit ?? "");
        setFrequency(v.frequency ?? "");
        setInstructions(v.instructions ?? m.notes ?? "");
        setReminderTime(v.reminder_time ?? "");
        setReminder(Boolean(v.reminder_enabled));
      }
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    if (!med) return;
    const v = {
      ...(med.value ?? {}),
      dose,
      frequency,
      instructions,
      reminder_enabled: reminder,
      reminder_time: reminderTime,
    };
    const { error } = await supabase
      .from("health_records")
      .update({ value: v, notes: instructions })
      .eq("id", med.id);
    if (error) {
      toast.error("Could not save changes");
      return;
    }
    toast.success("Saved");
    setMed({ ...med, value: v });
  }

  async function discontinue() {
    if (!med) return;
    const ok = window.confirm("Mark this medication as no longer taking?");
    if (!ok) return;
    const v = { ...(med.value ?? {}), discontinued_at: new Date().toISOString(), reminder_enabled: false };
    const { error } = await supabase.from("health_records").update({ value: v }).eq("id", med.id);
    if (error) {
      toast.error("Could not update");
      return;
    }
    toast.success("Marked as no longer taking");
    navigate({ to: "/records" });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10">
        <div className="h-40 animate-pulse rounded-3xl bg-white/70" />
      </div>
    );
  }

  if (!med) {
    return (
      <div className="mx-auto max-w-md px-5 pt-10 text-center text-[#8A6E6B]">
        <p>Medication not found.</p>
        <Link to="/records" className="mt-4 inline-block text-[#D4726D] underline">
          Back to records
        </Link>
      </div>
    );
  }

  const v = med.value ?? {};
  const isDiscontinued = Boolean(v.discontinued_at);
  const sourceLabel =
    med.source === "scanned_document"
      ? `From your ${v.document_kind ? v.document_kind.replace(/_/g, " ") : "scanned document"}, ${formatDate(med.recorded_at)}`
      : "Added manually";

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/records" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl italic text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          medication
        </h1>
        <div className="w-9" />
      </header>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EAE9F8]">
            <Pill className="h-6 w-6 text-[#7B7FCE]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="text-xl font-medium text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              {med.title ?? "Medication"}
            </h2>
            <p className={cn(
              "mt-0.5 text-[11px]",
              med.source === "scanned_document" ? "text-[#7B7FCE]" : "text-[#8A6E6B]",
            )}>
              {sourceLabel}
            </p>
            {isDiscontinued && (
              <p className="mt-2 inline-block rounded-md bg-[#F6EFEE] px-2 py-1 text-[11px] text-[#8A6E6B]">
                No longer taking · stopped {formatDate(v.discontinued_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <section className="mt-4 space-y-3">
        <Field label="Dose" value={dose} onChange={setDose} placeholder="500 mg" />
        <Field
          label="Frequency"
          value={frequency}
          onChange={setFrequency}
          placeholder="every 8 hours"
        />
        <Field
          label="Instructions"
          value={instructions}
          onChange={setInstructions}
          placeholder="Take one capsule by mouth"
          multiline
        />

        {v.prescriber && (
          <ReadField label="Prescriber" value={v.prescriber} />
        )}
        {v.duration && <ReadField label="Duration" value={v.duration} />}
      </section>

      {/* Reminder */}
      <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-[#3D2A28]">
            <Bell className="h-4 w-4 text-[#D4726D]" /> Daily reminder
          </div>
          <button
            type="button"
            onClick={() => setReminder((r) => !r)}
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
        {reminder && (
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="mt-3 w-full rounded-xl border border-[#F1D9D5] bg-white px-3 py-2 text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
        )}
      </div>

      {/* Source document link */}
      {med.source_document_id && (
        <Link
          to="/scan/review/$id"
          params={{ id: med.source_document_id }}
          className="mt-4 flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm transition hover:bg-[#FFF8F7]"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FDE7E4]">
              <FileText className="h-5 w-5 text-[#D4726D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3D2A28]">View source document</p>
              <p className="text-[11px] text-[#8A6E6B]">See the scan this came from</p>
            </div>
          </div>
        </Link>
      )}

      {/* Save */}
      <button
        onClick={save}
        className="mt-5 w-full rounded-full bg-[#F38B82] py-3 text-sm font-semibold text-white shadow-sm"
      >
        save changes
      </button>

      {!isDiscontinued && (
        <button
          onClick={discontinue}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-[#8A6E6B] shadow-sm"
        >
          <Trash2 className="h-4 w-4" /> mark as no longer taking
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block rounded-3xl bg-white p-4 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="mt-1 w-full resize-none bg-transparent text-sm text-[#3D2A28] placeholder:text-[#A8908D] focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full bg-transparent text-sm text-[#3D2A28] placeholder:text-[#A8908D] focus:outline-none"
        />
      )}
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6E6B]">{label}</p>
      <p className="mt-1 text-sm text-[#3D2A28]">{value}</p>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
