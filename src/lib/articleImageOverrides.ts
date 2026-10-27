import depression from "@/assets/articles/depression.jpg";
import recovery from "@/assets/articles/recovery.jpg";
import feeding from "@/assets/articles/feeding.jpg";
import body from "@/assets/articles/body.jpg";
import sleep from "@/assets/articles/sleep.jpg";

// Slug → contextual cover image for web-sourced articles seeded in the DB.
const BY_SLUG: Record<string, string> = {
  "postpartum-depression-what-it-is-risk-factors-symptoms-treatment-postpartum-supp": depression,
  "postpartum-care-what-to-expect-after-you-have-a-baby-mayo-clinic": recovery,
  "breastfeeding-guide-american-college-of-obstetricians-and-gynecologists-acog": feeding,
  "postpartum-bleeding-and-discharge-nhs": body,
  "sleep-and-your-new-baby-cleveland-clinic": sleep,
};

// Category fallbacks for any future fetched articles.
const BY_CATEGORY: Record<string, string> = {
  "mental health": depression,
  mood: depression,
  recovery,
  feeding,
  body,
  sleep,
  relationships: recovery,
  milestones: recovery,
};

export function articleCover(
  slug: string | null | undefined,
  category: string | null | undefined,
  fallback?: string | null,
): string | undefined {
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug];
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category];
  return fallback ?? undefined;
}
