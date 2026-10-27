import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();

export function useSignedCoverUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const hit = cache.get(path);
    return hit && hit.exp > Date.now() ? hit.url : null;
  });
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    const hit = cache.get(path);
    if (hit && hit.exp > Date.now()) {
      setUrl(hit.url);
      return;
    }
    supabase.storage
      .from("experience-covers")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(path, { url: data.signedUrl, exp: Date.now() + 3500 * 1000 });
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

export function ExperienceCover({
  path,
  className,
  alt = "",
}: {
  path: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const url = useSignedCoverUrl(path);
  if (!path) return null;
  return (
    <div className={className ?? "aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#FFE8E2]"}>
      {url && (
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      )}
    </div>
  );
}
