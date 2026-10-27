import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bell, AlertTriangle, ChevronDown, ChevronUp, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CoralButton } from "@/components/CoralButton";
import { Switch } from "@/components/ui/switch";
import {
  confirmScan,
  discardScan,
  loadScan,
  type ExtractedScan,
} from "@/lib/scan.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/scan_/review/$id")({
  head: () => ({ meta: [{ title: "Review scan — Nima" }] }),
  component: ReviewScreen,
});

interface MedState {
  name: string;
  dose: string;
  frequency: string;
  nameLow: boolean;
  doseLow: boolean;
  freqLow: boolean;
}
interface InstrState {
  text: string;
  low: boolean;
}

function ReviewScreen() {
  const { id } = useParams({ from: "/_app/scan_/review/$id" });
  const navigate = useNavigate();
  const load = useServerFn(loadScan);
  const confirm = useServerFn(confirmScan);
  const discard = useServerFn(discardScan);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("image/jpeg");
  const [meds, setMeds] = useState<MedState[]>([]);
  const [instrs, setInstrs] = useState<InstrState[]>([]);
  const [followDate, setFollowDate] = useState("");
  const [followProvider, setFollowProvider] = useState("");
  const [followLow, setFollowLow] = useState(false);
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [createReminder, setCreateReminder] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const row = await load({ data: { id } });
        const ex = (row.extracted_data ?? {}) as unknown as ExtractedScan;
        setTitle(ex.document_title || row.original_filename || "Scanned document");
        setThumb(row.thumbnailUrl);
        setMime(row.mime_type || "image/jpeg");
        setMeds(
          (ex.medications ?? []).map((m) => ({
            name: m.name ?? "",
            dose: m.dose ?? "",
            frequency: m.frequency ?? "",
            nameLow: m.confidence === "low",
            doseLow: m.confidence === "low",
            freqLow: m.confidence === "low",
          })),
        );
        setInstrs(
          (ex.instructions ?? []).map((i) => ({
            text: i.text ?? "",
            low: i.confidence === "low",
          })),
        );
        if (ex.follow_up) {
          setFollowDate(ex.follow_up.date ?? "");
          setFollowProvider(ex.follow_up.provider ?? "");
          setFollowLow(ex.follow_up.confidence === "low");
        }
        setRawText(ex.raw_text ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load scan.");
        navigate({ to: "/scan" });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, load, navigate]);

  async function onSave() {
    setSubmitting(true);
    try {
      const { count } = await confirm({
        data: {
          scanId: id,
          documentTitle: title,
          medications: meds
            .filter((m) => m.name.trim())
            .map((m) => ({
              name: m.name,
              dose: m.dose,
              frequency: m.frequency,
              confidence: "high",
            })),
          instructions: instrs.filter((i) => i.text.trim()).map((i) => ({ text: i.text })),
          followUp:
            followDate || followProvider ? { date: followDate, provider: followProvider } : null,
          createReminder,
        },
      });
      toast.success(`Saved ${count} item${count === 1 ? "" : "s"} to your records.`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
      setSubmitting(false);
    }
  }

  async function onDiscard() {
    setSubmitting(true);
    try {
      await discard({ data: { scanId: id } });
      navigate({ to: "/scan" });
    } catch {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center text-sm text-[#8A6E6B]">
        Loading your scan…
      </div>
    );
  }

  const hasMed = meds.some((m) => m.name.trim());

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-6">
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/scan" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl italic text-[#F38B82]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          Nima
        </h1>
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <Bell className="h-5 w-5" />
        </button>
      </header>

      <h2
        className="text-2xl text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        here's what <span className="italic text-[#D4726D]">I found</span>
      </h2>
      <p className="mt-1 text-xs text-[#8A6E6B]">please check this is correct</p>

      {/* Thumbnail */}
      <div className="mt-4 flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#FDE7E4]">
          {thumb && mime.startsWith("image/") ? (
            <img src={thumb} alt="Uploaded document" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-semibold uppercase text-[#D4726D]">PDF</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4726D]">
            Uploaded today
          </p>
          <p className="truncate text-sm font-medium text-[#3D2A28]">{title}</p>
          {thumb && (
            <a
              href={thumb}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#8A6E6B] underline"
            >
              View original
            </a>
          )}
        </div>
      </div>

      {/* Medications */}
      {meds.length === 0 && (
        <button
          type="button"
          onClick={() =>
            setMeds([
              { name: "", dose: "", frequency: "", nameLow: false, doseLow: false, freqLow: false },
            ])
          }
          className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#F1D9D5] py-3 text-xs text-[#8A6E6B]"
        >
          + Add medication
        </button>
      )}

      {meds.map((m, idx) => (
        <div key={idx} className="mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <FieldRow
            label="Medication name"
            value={m.name}
            low={m.nameLow}
            onChange={(v) =>
              setMeds((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v, nameLow: false } : x)))
            }
          />
          <FieldRow
            label="Dosage"
            value={m.dose}
            low={m.doseLow}
            onChange={(v) =>
              setMeds((prev) => prev.map((x, i) => (i === idx ? { ...x, dose: v, doseLow: false } : x)))
            }
          />
          <FieldRow
            label="Frequency"
            value={m.frequency}
            low={m.freqLow}
            onChange={(v) =>
              setMeds((prev) =>
                prev.map((x, i) => (i === idx ? { ...x, frequency: v, freqLow: false } : x)),
              )
            }
          />
          <button
            type="button"
            onClick={() => setMeds((prev) => prev.filter((_, i) => i !== idx))}
            className="flex items-center gap-1 text-[11px] text-[#8A6E6B]"
          >
            <Trash2 className="h-3 w-3" /> remove
          </button>
        </div>
      ))}

      {/* Instructions */}
      {instrs.length > 0 && (
        <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4726D]">
            Doctor's instructions
          </p>
          <ul className="mt-3 space-y-3">
            {instrs.map((ins, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4726D]" />
                <div className="flex-1">
                  <textarea
                    value={ins.text}
                    onChange={(e) =>
                      setInstrs((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, text: e.target.value, low: false } : x,
                        ),
                      )
                    }
                    rows={2}
                    className="w-full resize-none rounded-xl bg-[#FFF8F7] px-3 py-2 text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
                  />
                  {ins.low && <LowConfidenceHint />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow up */}
      <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4726D]">
          Follow-up appointment
        </p>
        <div className="mt-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#D4726D]" />
          <input
            type="date"
            value={followDate}
            onChange={(e) => {
              setFollowDate(e.target.value);
              setFollowLow(false);
            }}
            className="flex-1 rounded-xl bg-[#FFF8F7] px-3 py-2 text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
        </div>
        <input
          type="text"
          value={followProvider}
          placeholder="Provider (optional)"
          onChange={(e) => setFollowProvider(e.target.value)}
          className="mt-2 w-full rounded-xl bg-[#FFF8F7] px-3 py-2 text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
        />
        {followLow && <LowConfidenceHint />}
      </div>

      {/* Reminder toggle */}
      {hasMed && (
        <div className="mt-4 flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-[#3D2A28]">Remind me to take this</p>
            <p className="text-[11px] text-[#8A6E6B]">Off by default. You can change it anytime.</p>
          </div>
          <Switch checked={createReminder} onCheckedChange={setCreateReminder} />
        </div>
      )}

      {/* Raw text */}
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-3xl bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B] shadow-sm"
      >
        <span>View original text</span>
        {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {showRaw && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-3xl bg-white p-4 text-[11px] leading-relaxed text-[#5B403D] shadow-sm whitespace-pre-wrap">
          {rawText || "(no extracted text)"}
        </pre>
      )}

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <CoralButton onClick={onSave} disabled={submitting} className="w-full" size="lg">
          {submitting ? "saving…" : "save to my records"}
        </CoralButton>
        <button
          type="button"
          onClick={onDiscard}
          disabled={submitting}
          className="block w-full text-center text-xs text-[#8A6E6B] underline"
        >
          this isn't right, let me redo it
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  low,
  onChange,
}: {
  label: string;
  value: string;
  low: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
          {label}
        </label>
        {low && <DoubleCheckBadge />}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1.5 w-full rounded-xl bg-[#FFF8F7] px-3 py-2 text-sm text-[#3D2A28] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40",
          low && "ring-2 ring-[#F5C56B]/60",
        )}
      />
      {low && <LowConfidenceHint />}
    </div>
  );
}

function DoubleCheckBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1D6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#B07A1E]">
      <AlertTriangle className="h-3 w-3" /> double check
    </span>
  );
}

function LowConfidenceHint() {
  return (
    <p className="mt-1 text-[11px] text-[#B07A1E]">
      Nima wasn't fully sure about this one — please double check.
    </p>
  );
}
