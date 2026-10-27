CREATE TABLE public.daily_pulse (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pulse_date date NOT NULL,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pulse_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_pulse TO authenticated;
GRANT ALL ON public.daily_pulse TO service_role;
ALTER TABLE public.daily_pulse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily pulse" ON public.daily_pulse FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);