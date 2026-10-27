CREATE TABLE public.daily_article_suggestions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_date date NOT NULL DEFAULT CURRENT_DATE,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shown_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_article_suggestions TO authenticated;
GRANT ALL ON public.daily_article_suggestions TO service_role;
ALTER TABLE public.daily_article_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily suggestions" ON public.daily_article_suggestions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_daily_article_user_date ON public.daily_article_suggestions(user_id, shown_date DESC);