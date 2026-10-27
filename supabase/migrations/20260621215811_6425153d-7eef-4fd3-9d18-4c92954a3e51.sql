ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ai_insights_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS usage_analytics_enabled boolean NOT NULL DEFAULT false;