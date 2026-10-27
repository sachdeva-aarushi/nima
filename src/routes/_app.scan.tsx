import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bell, Camera, ImageIcon, FileText, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import { MascotPortrait } from "@/components/MascotPortrait";
import { extractScan, type DocumentKind } from "@/lib/scan.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/scan")({
  head: () => ({ meta: [{ title: "Scan a document — Nima" }] }),
  component: ScanScreen,
});

const KINDS: { id: DocumentKind; label: string }[] = [
  { id: "prescription", label: "Prescription" },
  { id: "discharge_summary", label: "Discharge Summary" },
  { id: "lab_result", label: "Lab Result" },
  { id: "other", label: "Other" },
];

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function ScanScreen() {
  const navigate = useNavigate();
  const extract = useServerFn(extractScan);
  const [kind, setKind] = useState<DocumentKind>("prescription");
  const [busy, setBusy] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    if (file.size > 9 * 1024 * 1024) {
      toast.error("That file is a bit too large. Please try one under 9 MB.");
      return;
    }
    setBusy(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { scanId } = await extract({
        data: { fileBase64, mime: file.type || "application/octet-stream", filename: file.name, kind },
      });
      navigate({ to: "/scan/review/$id", params: { id: scanId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong reading the document.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl italic text-[#3D2A28]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          scan a document
        </h1>
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <Bell className="h-5 w-5" />
        </button>
      </header>

      {/* Kind selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const active = k.id === kind;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                active
                  ? "bg-[#D4726D] text-white shadow-sm"
                  : "bg-white text-[#8A6E6B] hover:bg-[#FFEEEB]"
              )}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Upload card */}
      <div className="rounded-3xl border-2 border-dashed border-[#F1D9D5] bg-white/70 p-6">
        {busy ? (
          <LoadingState />
        ) : (
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              aria-label="Capture with camera"
              className="grid h-16 w-16 place-items-center rounded-full bg-[#F38B82] text-white shadow-md transition hover:bg-[#E47872]"
            >
              <Camera className="h-7 w-7" />
            </button>
            <h2
              className="mt-5 text-xl text-[#3D2A28]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              scan a document
            </h2>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#8A6E6B]">
              prescription, discharge summary, or any medical paper
            </p>
          </div>
        )}
      </div>

      {/* Source picker */}
      {!busy && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <SourceTile icon={Camera} label="Take photo" onClick={() => cameraRef.current?.click()} />
          <SourceTile icon={ImageIcon} label="Upload photo" onClick={() => photoRef.current?.click()} />
          <SourceTile icon={FileText} label="Upload PDF" onClick={() => pdfRef.current?.click()} />
        </div>
      )}

      {/* Example */}
      {!busy && (
        <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6E6B]">
            Good photo example
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#FDE7E4]">
              <Lightbulb className="h-6 w-6 text-[#D4726D]" />
            </div>
            <p className="text-xs leading-relaxed text-[#5B403D]">
              Flat paper, bright even light,<br />no blurry text.
            </p>
          </div>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

function SourceTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-[#5B403D] shadow-sm transition hover:bg-[#FFEEEB]"
    >
      <Icon className="h-5 w-5 text-[#D4726D]" />
      <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <MascotPortrait state="thinking" size="md" />
      <p
        className="mt-4 text-lg text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        Nima's reading through this…
      </p>
      <p className="mt-1 text-xs text-[#8A6E6B]">
        This usually takes a few seconds.
      </p>
    </div>
  );
}
