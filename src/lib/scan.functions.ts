import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type HealthRecordInsert = Database["public"]["Tables"]["health_records"]["Insert"];

export type DocumentKind = "prescription" | "discharge_summary" | "lab_result" | "other";

export interface ExtractedMedication {
  name: string;
  dose: string;
  frequency: string;
  confidence: "high" | "low";
}

export interface ExtractedFollowUp {
  date: string;
  provider: string;
  confidence: "high" | "low";
}

export interface ExtractedScan {
  document_title: string;
  medications: ExtractedMedication[];
  instructions: { text: string; confidence: "high" | "low" }[];
  follow_up: ExtractedFollowUp | null;
  raw_text: string;
  overall_confidence: "high" | "low";
}

const SYSTEM_PROMPT = `You are a careful medical document transcriber for a postpartum app.
You DO NOT diagnose, interpret, give advice, or add commentary.
You ONLY extract structured fields from a medical document the user uploaded.

Return STRICT JSON matching this schema (no prose, no markdown):
{
  "document_title": string,
  "medications": [
    { "name": string, "dose": string, "frequency": string, "confidence": "high" | "low" }
  ],
  "instructions": [
    { "text": string, "confidence": "high" | "low" }
  ],
  "follow_up": { "date": string, "provider": string, "confidence": "high" | "low" } | null,
  "raw_text": string,
  "overall_confidence": "high" | "low"
}

Rules:
- "raw_text" is the verbatim text you read from the document (best-effort OCR).
- Instructions are plain factual bullets the doctor wrote (e.g. "take with food", "avoid driving"). Do not invent any.
- If a field is missing or unreadable, omit it (empty string for required strings, [] for arrays, null for follow_up).
- Mark "confidence": "low" on ANY field where you are not fully sure of the value.
- Never add information that is not present in the document. Never give medical advice.`;

interface ExtractInput {
  fileBase64: string;
  mime: string;
  filename: string;
  kind: DocumentKind;
}

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

function parseExtract(raw: unknown): ExtractInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fileBase64 = typeof r.fileBase64 === "string" ? r.fileBase64 : "";
  const mime = typeof r.mime === "string" ? r.mime : "";
  const filename = typeof r.filename === "string" ? r.filename.slice(0, 200) : "document";
  const kind = (typeof r.kind === "string" ? r.kind : "other") as DocumentKind;
  if (!fileBase64 || !mime) throw new Error("File required");
  if (!ALLOWED_MIMES.has(mime)) {
    throw new Error("Unsupported file type. Use JPG, PNG, WEBP, or PDF.");
  }
  // base64 expands ~4/3; true bytes ≈ length * 3 / 4.
  const approxBytes = Math.floor((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_FILE_BYTES) {
    throw new Error("File too large (max 10MB).");
  }
  return { fileBase64, mime, filename, kind };
}

function safeJson(text: string): ExtractedScan | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const json = JSON.parse(cleaned);
    return json as ExtractedScan;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as ExtractedScan;
    } catch {
      return null;
    }
  }
}

export const extractScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseExtract)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    // 1. Upload original to private storage (user-scoped folder).
    const ext = data.filename.split(".").pop() || "bin";
    const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("medical-scans")
      .upload(storagePath, bytes, { contentType: data.mime, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // 2. Create scanned_documents row (status uploaded → processing).
    const { data: scanRow, error: insErr } = await supabase
      .from("scanned_documents")
      .insert({
        user_id: userId,
        storage_path: storagePath,
        original_filename: data.filename,
        mime_type: data.mime,
        document_kind: data.kind,
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr || !scanRow) throw new Error(insErr?.message ?? "Could not create scan record");
    const scanId = scanRow.id;

    // 3. Build multimodal request for the gateway.
    const dataUrl = `data:${data.mime};base64,${data.fileBase64}`;
    const isPdf = data.mime === "application/pdf";
    const userContent = isPdf
      ? [
          { type: "text" as const, text: `Document kind: ${data.kind}. Extract per the rules.` },
          {
            type: "file" as const,
            file: { filename: data.filename, file_data: dataUrl },
          },
        ]
      : [
          { type: "text" as const, text: `Document kind: ${data.kind}. Extract per the rules.` },
          { type: "image_url" as const, image_url: { url: dataUrl } },
        ];

    let extracted: ExtractedScan | null = null;
    let errorMessage: string | null = null;
    let modelText = "";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Nima is busy — please try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted.");
        throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      modelText = json.choices?.[0]?.message?.content ?? "";
      extracted = safeJson(modelText);
      if (!extracted) throw new Error("Could not understand the response.");
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Extraction failed";
    }

    // 4. Persist result (audit trail regardless of outcome).
    if (extracted) {
      await supabase
        .from("scanned_documents")
        .update({
          status: "awaiting_review",
          extracted_data: extracted as never,
          ai_model: "google/gemini-3-flash-preview",
        })
        .eq("id", scanId);
    } else {
      await supabase
        .from("scanned_documents")
        .update({
          status: "failed",
          error_message: errorMessage,
          extracted_data: { raw: modelText },
        })
        .eq("id", scanId);
      throw new Error(errorMessage ?? "Extraction failed");
    }

    return { scanId, extracted };
  });

export const loadScan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { id?: unknown };
    if (typeof r.id !== "string") throw new Error("id required");
    return { id: r.id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("scanned_documents")
      .select("id, document_kind, status, extracted_data, storage_path, mime_type, original_filename")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Scan not found");

    let thumbnailUrl: string | null = null;
    if (row.storage_path) {
      const { data: signed } = await supabase.storage
        .from("medical-scans")
        .createSignedUrl(row.storage_path, 60 * 30);
      thumbnailUrl = signed?.signedUrl ?? null;
    }
    return { ...row, thumbnailUrl };
  });

interface ConfirmInput {
  scanId: string;
  documentTitle: string;
  medications: ExtractedMedication[];
  instructions: { text: string }[];
  followUp: { date: string; provider: string } | null;
  createReminder: boolean;
}

function parseConfirm(raw: unknown): ConfirmInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.scanId !== "string") throw new Error("scanId required");
  return {
    scanId: r.scanId,
    documentTitle: typeof r.documentTitle === "string" ? r.documentTitle : "",
    medications: Array.isArray(r.medications) ? (r.medications as ExtractedMedication[]) : [],
    instructions: Array.isArray(r.instructions) ? (r.instructions as { text: string }[]) : [],
    followUp:
      r.followUp && typeof r.followUp === "object"
        ? (r.followUp as { date: string; provider: string })
        : null,
    createReminder: Boolean(r.createReminder),
  };
}

export const confirmScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseConfirm)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const confirmed = {
      document_title: data.documentTitle,
      medications: data.medications,
      instructions: data.instructions,
      follow_up: data.followUp,
      create_reminder: data.createReminder,
    };

    const { error: upErr } = await supabase
      .from("scanned_documents")
      .update({
        status: "confirmed",
        confirmed_data: confirmed as never,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", data.scanId)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    const rows: HealthRecordInsert[] = [];

    for (const med of data.medications) {
      if (!med.name?.trim()) continue;
      rows.push({
        user_id: userId,
        record_type: "medication",
        title: med.name,
        value: { dose: med.dose, frequency: med.frequency, reminder: data.createReminder },
        source: "scanned_document",
        source_document_id: data.scanId,
      });
    }
    for (const ins of data.instructions) {
      if (!ins.text?.trim()) continue;
      rows.push({
        user_id: userId,
        record_type: "instruction",
        title: ins.text.slice(0, 80),
        value: { text: ins.text },
        source: "scanned_document",
        source_document_id: data.scanId,
      });
    }
    if (data.followUp?.date) {
      rows.push({
        user_id: userId,
        record_type: "follow_up",
        title: data.followUp.provider || "Follow-up appointment",
        value: { date: data.followUp.date, provider: data.followUp.provider },
        source: "scanned_document",
        source_document_id: data.scanId,
      });
    }

    if (rows.length > 0) {
      const { error: hrErr } = await supabase.from("health_records").insert(rows);
      if (hrErr) throw new Error(hrErr.message);
    }

    return { ok: true, count: rows.length };
  });

export const discardScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const r = (raw ?? {}) as { scanId?: unknown };
    if (typeof r.scanId !== "string") throw new Error("scanId required");
    return { scanId: r.scanId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("scanned_documents")
      .update({ status: "rejected" })
      .eq("id", data.scanId)
      .eq("user_id", userId);
    return { ok: true };
  });
