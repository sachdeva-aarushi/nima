import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Shield, ImagePlus, X } from "lucide-react";

import {
  createExperiencePost,
  TOPIC_TAGS,
  type TopicTag,
} from "@/lib/experiences.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/experiences/new")({
  head: () => ({ meta: [{ title: "Share your experience — Nima" }] }),
  component: NewExperience,
});

const TAG_LABEL: Record<TopicTag, string> = {
  sleep: "Sleep",
  feeding: "Feeding",
  "mental-health": "Mental Health",
  recovery: "Recovery",
  relationships: "Relationships",
  "week-1-2": "Week 0–2",
  "week-3-6": "Week 3–6",
  "week-7-12": "Week 7–12",
  "week-13-plus": "Week 13+",
};

const MAX_COVER_BYTES = 5 * 1024 * 1024;

function NewExperience() {
  const navigate = useNavigate();
  const submit = useServerFn(createExperiencePost);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<TopicTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const count = content.trim().length;
  const okLength = count >= 280 && count <= 600;
  const canSubmit =
    displayName.trim().length >= 2 && okLength && !submitting && !uploadingCover;

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Please sign in again.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("experience-covers")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      // remove previous unsaved cover
      if (coverPath) {
        await supabase.storage.from("experience-covers").remove([coverPath]).catch(() => undefined);
      }
      setCoverPath(path);
      setCoverPreview(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload image.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function removeCover() {
    if (coverPath) {
      await supabase.storage.from("experience-covers").remove([coverPath]).catch(() => undefined);
    }
    setCoverPath(null);
    setCoverPreview(null);
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          display_name: displayName.trim(),
          title: title.trim() || null,
          content: content.trim(),
          topic_tags: tags,
          cover_image_path: coverPath,
        },
      });
      if (res.status === "crisis") {
        navigate({ to: "/crisis" });
        return;
      }
      navigate({ to: "/experiences" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTag(t: TopicTag) {
    setTags((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 5 ? cur : [...cur, t],
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/experiences" })}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-[#5B403D]" />
        </button>
        <div className="w-9" />
      </header>

      <h1
        className="text-3xl leading-tight text-[#3D2A28]"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        share your experience
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#8A6E6B]">
        Your story can comfort and support another mother.
      </p>

      <div className="mt-5 space-y-5 rounded-3xl bg-white p-5 shadow-sm">
        <Field
          label="Cover image (optional)"
          help="A soft photo that fits the mood of your story. JPG or PNG, up to 5 MB."
        >
          {coverPreview ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="aspect-[16/9] w-full object-cover"
              />
              <button
                type="button"
                onClick={removeCover}
                aria-label="Remove cover"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCover}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#F1D9D5] bg-[#FFF7F5] text-[#A8908D] transition hover:bg-[#FFEEEB]"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">
                {uploadingCover ? "uploading…" : "Tap to add a cover image"}
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickCover}
          />
        </Field>

        <Field
          label="Your display name"
          hint={`${displayName.length}/20`}
          help="This is how other mothers will see your post."
        >
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
            placeholder="e.g. a mother, week 6"
            className="w-full rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 text-sm text-[#3D2A28] placeholder:text-[#C3A8A4] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
          <p className="mt-1 text-[10px] text-[#A8908D]">20 characters max</p>
        </Field>

        <Field label="Title (optional)" hint={`${title.length}/100`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            placeholder="Give your story a short title"
            className="w-full rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 text-sm text-[#3D2A28] placeholder:text-[#C3A8A4] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
        </Field>

        <Field
          label="Your experience"
          help="280–600 characters"
          hint={`${count}/600`}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 600))}
            rows={7}
            placeholder="Share your experience..."
            className="w-full resize-none rounded-2xl border border-[#F1D9D5] bg-white px-4 py-3 text-sm leading-relaxed text-[#3D2A28] placeholder:text-[#C3A8A4] focus:outline-none focus:ring-2 focus:ring-[#F38B82]/40"
          />
          {!okLength && count > 0 && (
            <p className="mt-1 text-[11px] text-[#B07A2C]">
              {count < 280 ? `${280 - count} more characters to share.` : "a little long — trim it down."}
            </p>
          )}
        </Field>

        <Field
          label="Topic tags (optional)"
          help="Choose up to 5 tags that best fit your story."
        >
          <div className="flex flex-wrap gap-2">
            {TOPIC_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] transition",
                    on
                      ? "border-[#F38B82] bg-[#FFEEEB] text-[#B7574F]"
                      : "border-[#F1D9D5] bg-white text-[#5B403D]",
                  )}
                >
                  {TAG_LABEL[t]}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* Moderation banner */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#EFE6F8] p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#7A5BB0]">
          <Shield className="h-4 w-4" />
        </div>
        <p className="text-[12px] leading-relaxed text-[#5B403D]">
          We review every story to keep this space safe and supportive for all mothers.
          Your post will be visible after it's approved.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-[#D4726D]">{error}</p>}

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={cn(
          "mt-6 w-full rounded-full py-4 text-sm font-medium text-white transition",
          canSubmit ? "bg-[#F38B82] shadow-md hover:bg-[#EF7C72]" : "bg-[#E8C4C0] cursor-not-allowed",
        )}
      >
        {submitting ? "submitting…" : "Submit for review"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  help,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-sm font-semibold text-[#3D2A28]">{label}</label>
        {hint && <span className="text-[10px] text-[#A8908D]">{hint}</span>}
      </div>
      {help && <p className="mb-2 text-[11px] text-[#8A6E6B]">{help}</p>}
      {children}
    </div>
  );
}
