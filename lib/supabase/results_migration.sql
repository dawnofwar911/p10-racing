-- verified_results table
CREATE TABLE public.verified_results (
  id TEXT PRIMARY KEY, -- Format: "season_round" e.g., "2026_1"
  data JSONB NOT NULL, -- The results data (positions, firstDnf, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Security
ALTER TABLE public.verified_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified results viewable by everyone." ON public.verified_results FOR SELECT USING (true);
CREATE POLICY "Only admins can modify results." ON public.verified_results FOR ALL USING (auth.role() = 'authenticated');
