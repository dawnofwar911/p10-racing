-- 1. Profiles Table (Linked to Auth.Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false, -- Added for security
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

-- 3. League Members (Link table for Users and Leagues)
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

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Profiles: Anyone can view, only owner can update
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Leagues: Members can view, anyone can create
CREATE POLICY "Leagues are viewable by members." ON public.leagues FOR SELECT USING (
  id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
);
CREATE POLICY "Creators can view their own leagues." ON public.leagues FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Anyone authenticated can create a league." ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- League Members: Viewable by league mates
CREATE POLICY "Members can see each other." ON public.league_members FOR SELECT USING (
  user_id = auth.uid() OR
  league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can join leagues." ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Predictions: Owner can view/update, League mates can view AFTER race start
CREATE POLICY "Users can manage their own predictions." ON public.predictions FOR ALL USING (auth.uid() = user_id);
-- Note: A more complex policy for "League mates can view after race start" 
-- would be needed here once race timing logic is integrated into SQL or via a view.
