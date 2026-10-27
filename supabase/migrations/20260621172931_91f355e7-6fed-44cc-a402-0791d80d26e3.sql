ALTER TYPE public.checkin_mood ADD VALUE IF NOT EXISTS 'very_low' BEFORE 'low';
ALTER TYPE public.checkin_mood ADD VALUE IF NOT EXISTS 'good' BEFORE 'great';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nervous_text text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nervous_tags text[] NOT NULL DEFAULT '{}';