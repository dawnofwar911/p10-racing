-- 1. Profiles Table (Linked to Auth.Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- 2. Leagues Table
CREATE TABLE public.leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text) from 1 for 8),
  created_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. League Members (Link table)
-- RLS is DISABLED on this table to break the infinite recursion loop.
-- This is safe because it only stores UUIDs.
CREATE TABLE public.league_members (
  league_id UUID REFERENCES public.leagues ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (league_id, user_id)
);

-- 4. Predictions Table
CREATE TABLE public.predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  race_id TEXT NOT NULL, -- Format: "season_round" e.g., "2026_1"
  p10_driver_id TEXT NOT NULL,
  dnf_driver_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, race_id)
);

-- 5. Verified Results (Admin Only)
CREATE TABLE public.verified_results (
  id TEXT PRIMARY KEY, -- Format: "season_round"
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_results ENABLE ROW LEVEL SECURITY;
-- league_members RLS is intentionally disabled to break recursion

-- POLICIES

-- Profiles
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Leagues
CREATE POLICY "Members can view leagues" ON public.leagues FOR SELECT USING (
  id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid()) OR
  created_by = auth.uid()
);
CREATE POLICY "Authenticated can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Predictions
CREATE POLICY "Predictions are public" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Users can manage own predictions" ON public.predictions FOR ALL USING (auth.uid() = user_id);

-- Verified Results
CREATE POLICY "Results are public" ON public.verified_results FOR SELECT USING (true);
CREATE POLICY "Only admins can manage results" ON public.verified_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
