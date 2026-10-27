
DO $$ BEGIN
  CREATE TYPE public.insight_type AS ENUM ('pattern','preference','context','concern');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.insight_confidence AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.mother_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type public.insight_type NOT NULL,
  insight_text TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence public.insight_confidence NOT NULL DEFAULT 'medium',
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mother_insights_user_active ON public.mother_insights(user_id, active, confidence);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mother_insights TO authenticated;
GRANT ALL ON public.mother_insights TO service_role;
ALTER TABLE public.mother_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights" ON public.mother_insights FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_mother_insights_updated_at
  BEFORE UPDATE ON public.mother_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.insight_extraction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_ref TEXT,
  extracted_insight_id UUID REFERENCES public.mother_insights(id) ON DELETE SET NULL,
  raw_excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insight_log_user ON public.insight_extraction_log(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.insight_extraction_log TO authenticated;
GRANT ALL ON public.insight_extraction_log TO service_role;
ALTER TABLE public.insight_extraction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own extraction log" ON public.insight_extraction_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "insert own extraction log" ON public.insight_extraction_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
