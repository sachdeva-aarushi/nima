import { createServerFn } from "@tanstack/react-start";

export interface LandingStory {
  id: string;
  display_name: string;
  title: string | null;
  content: string;
  like_count: number;
  view_count: number;
  week_postpartum: number | null;
}

/** Public, no-auth listing for the marketing landing page — top 3 published posts. */
export const listLandingStories = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingStory[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("experience_posts")
      .select(
        "id, display_name, title, content, like_count, view_count, week_postpartum, created_at",
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) return [];
    return (data ?? []) as LandingStory[];
  },
);
