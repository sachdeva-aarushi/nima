
CREATE TYPE public.experience_post_status AS ENUM ('pending', 'published', 'rejected');

CREATE TABLE public.experience_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  title text,
  content text NOT NULL,
  topic_tags text[] NOT NULL DEFAULT '{}',
  status public.experience_post_status NOT NULL DEFAULT 'pending',
  crisis_flagged boolean NOT NULL DEFAULT false,
  ai_flagged boolean NOT NULL DEFAULT false,
  ai_flag_reason text,
  like_count int NOT NULL DEFAULT 0,
  view_count int NOT NULL DEFAULT 0,
  week_postpartum int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.experience_posts TO authenticated;
GRANT ALL ON public.experience_posts TO service_role;

ALTER TABLE public.experience_posts ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read published posts (intentional cross-user read).
CREATE POLICY "Read published posts"
ON public.experience_posts FOR SELECT TO authenticated
USING (status = 'published');

-- Author can also read their own non-published posts.
CREATE POLICY "Author reads own posts"
ON public.experience_posts FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Author can insert their own row. Status transitions happen server-side
-- via service_role; INSERT is restricted to 'pending' to prevent
-- a malicious client from self-publishing.
CREATE POLICY "Author inserts own pending post"
ON public.experience_posts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Author can delete their own posts (hard delete).
CREATE POLICY "Author deletes own posts"
ON public.experience_posts FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- No general UPDATE policy for clients: status, like_count, view_count,
-- and flag fields are mutated exclusively by server functions running
-- under service_role.

CREATE INDEX idx_experience_posts_status_created
  ON public.experience_posts(status, created_at DESC);
CREATE INDEX idx_experience_posts_user
  ON public.experience_posts(user_id, created_at DESC);
CREATE INDEX idx_experience_posts_tags
  ON public.experience_posts USING gin(topic_tags);

CREATE TRIGGER experience_posts_updated_at
BEFORE UPDATE ON public.experience_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.experience_post_views (
  post_id uuid NOT NULL REFERENCES public.experience_posts(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, viewer_id)
);

GRANT SELECT, INSERT ON public.experience_post_views TO authenticated;
GRANT ALL ON public.experience_post_views TO service_role;

ALTER TABLE public.experience_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own view"
ON public.experience_post_views FOR INSERT TO authenticated
WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Read own views"
ON public.experience_post_views FOR SELECT TO authenticated
USING (viewer_id = auth.uid());


CREATE TABLE public.experience_post_likes (
  post_id uuid NOT NULL REFERENCES public.experience_posts(id) ON DELETE CASCADE,
  liker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, liker_id)
);

GRANT SELECT, INSERT, DELETE ON public.experience_post_likes TO authenticated;
GRANT ALL ON public.experience_post_likes TO service_role;

ALTER TABLE public.experience_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own likes"
ON public.experience_post_likes FOR ALL TO authenticated
USING (liker_id = auth.uid()) WITH CHECK (liker_id = auth.uid());


-- Counter triggers keep like_count / view_count consistent.
CREATE OR REPLACE FUNCTION public.bump_experience_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.experience_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.experience_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER experience_likes_count
AFTER INSERT OR DELETE ON public.experience_post_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_experience_like_count();

CREATE OR REPLACE FUNCTION public.bump_experience_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.experience_posts SET view_count = view_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER experience_views_count
AFTER INSERT ON public.experience_post_views
FOR EACH ROW EXECUTE FUNCTION public.bump_experience_view_count();
