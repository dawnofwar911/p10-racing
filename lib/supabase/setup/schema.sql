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
CREATE TABLE public.league_members (
  league_id UUID REFERENCES public.leagues ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
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

-- 6. Bug Reports
CREATE TABLE public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  device_info JSONB,
  image_url TEXT,
  status TEXT DEFAULT 'open',
  github_issue_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS

-- 1. Bulletproof membership check function (Bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.check_p10_membership(l_id UUID, u_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.league_members 
    WHERE league_id = l_id AND user_id = u_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Function to join a league by invite code (Bypasses restricted SELECT on leagues)
CREATE OR REPLACE FUNCTION public.join_league_by_code(code TEXT) 
RETURNS JSONB AS $$
DECLARE
  l_id UUID;
  l_name TEXT;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find the league by code
  SELECT id, name INTO l_id, l_name FROM public.leagues WHERE LOWER(invite_code) = LOWER(code);
  
  IF l_id IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  -- 2. Check if already a member
  IF public.check_p10_membership(l_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are already a member of this league.';
  END IF;
  
  -- 3. Join the league
  INSERT INTO public.league_members (league_id, user_id)
  VALUES (l_id, auth.uid());
  
  -- 4. Return some info
  RETURN jsonb_build_object('id', l_id, 'name', l_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- POLICIES

-- Profiles
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Leagues
CREATE POLICY "leagues_select_policy" ON public.leagues FOR SELECT
  USING (
    created_by = auth.uid() OR 
    public.check_p10_membership(id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Authenticated can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "leagues_modify_policy" ON public.leagues FOR ALL
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- League Members
CREATE POLICY "members_select_policy" ON public.league_members FOR SELECT
  USING (
    user_id = auth.uid() OR 
    public.check_p10_membership(league_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can join leagues" ON public.league_members 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave leagues" ON public.league_members 
  FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND created_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Predictions
CREATE POLICY "Predictions are public" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Users can manage own predictions" ON public.predictions FOR ALL USING (auth.uid() = user_id);

-- Verified Results
CREATE POLICY "Results are public" ON public.verified_results FOR SELECT USING (true);
CREATE POLICY "Only admins can manage results" ON public.verified_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Bug Reports
CREATE POLICY "Anyone can submit bug reports" ON public.bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can view bug reports" ON public.bug_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- STORAGE POLICIES (Note: Buckets must be created in Dashboard first, but these policies apply)
-- 1. Create a bucket named 'bug-screenshots' in the Supabase Dashboard
-- 2. Enable RLS on the bucket
-- 3. Run these:
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'bug-screenshots');
-- CREATE POLICY "Anyone can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bug-screenshots');
