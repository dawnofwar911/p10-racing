-- ==========================================================
-- P10 RACING - SUPABASE SCHEMA (MASTER)
-- ==========================================================

-- 1. Profiles Table (Linked to Auth.Users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
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
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
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
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
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

-- 5b. Race Calendar (Source of truth for locking)
CREATE TABLE public.races (
  id TEXT PRIMARY KEY, -- Format: "season_round"
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  race_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Bug Reports
CREATE TABLE public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'Minor',
  device_info JSONB,
  image_url TEXT,
  status TEXT DEFAULT 'open',
  github_issue_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Push Tokens
CREATE TABLE public.push_tokens (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  token TEXT PRIMARY KEY,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Notifications History
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE, -- NULL means broadcast
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL, -- 'quali', 'race', 'season', 'test'
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Sent Notifications Tracking (to avoid duplicates)
CREATE TABLE public.sent_notifications (
  id TEXT PRIMARY KEY, -- Format: "season_round_type" e.g., "2026_1_quali"
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- HELPER FUNCTIONS & RPCs
-- ==========================================================

-- Bulletproof membership check (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.check_p10_membership(l_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.league_members 
    WHERE league_id = l_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Join league by invite code
CREATE OR REPLACE FUNCTION public.join_league_by_code(code TEXT) 
RETURNS JSONB AS $$
DECLARE
  l_id UUID;
  l_name TEXT;
BEGIN
  SELECT id, name INTO l_id, l_name FROM public.leagues WHERE LOWER(invite_code) = LOWER(code);
  IF l_id IS NULL THEN RAISE EXCEPTION 'League not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = l_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already a member of this league.';
  END IF;
  
  INSERT INTO public.league_members (league_id, user_id) VALUES (l_id, auth.uid());
  RETURN jsonb_build_object('id', l_id, 'name', l_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Delete user data (self-service deletion)
CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION delete_user_data() TO authenticated;

-- Push Notification Utils
CREATE OR REPLACE FUNCTION public.check_and_mark_notification_sent(p_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sent_notifications WHERE id = p_id) THEN RETURN FALSE; END IF;
  INSERT INTO public.sent_notifications (id) VALUES (p_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Format: "reminder_[race_id]_[user_id]"
CREATE OR REPLACE FUNCTION public.mark_reminder_sent(p_race_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'reminder_' || p_race_id || '_' || p_user_id::text;
  
  -- Use ON CONFLICT DO NOTHING for an atomic, race-condition safe operation
  INSERT INTO public.sent_notifications (id, sent_at) 
  VALUES (v_id, now())
  ON CONFLICT (id) DO NOTHING;
  
  -- FOUND is true if the INSERT actually happened
  IF FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.send_broadcast_notification(p_title TEXT, p_body TEXT, p_type TEXT, p_url TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (NULL, p_title, p_body, p_type, jsonb_build_object('url', p_url));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.send_test_notification(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (p_user_id, 'Test Notification', 'If you see this, push notifications are working! 🏎️💨', 'test', jsonb_build_object('url', '/'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Race Results
CREATE OR REPLACE FUNCTION public.on_verified_results_published()
RETURNS TRIGGER AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_is_recent BOOLEAN;
BEGIN
  -- Get the start time for the race from our races calendar table
  SELECT start_time INTO v_start_time FROM public.races WHERE id = NEW.id;

  -- Only notify if the results are published within 48 hours of the race start
  -- or if we don't have a start time yet (safety fallback for manual entry)
  v_is_recent := (v_start_time IS NULL) OR (now() < (v_start_time + INTERVAL '48 hours'));

  IF v_is_recent THEN
    IF NEW.id LIKE '%_24' THEN
      PERFORM public.send_broadcast_notification('Season Finale Results!', 'The final results are in! Check the leaderboard to see the season champion.', 'season', '/leaderboard');
    ELSE
      PERFORM public.send_broadcast_notification('Race Results Published!', 'The scores for the latest race are now available. See how you performed!', 'race', '/history');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_verified_results_published ON public.verified_results;
CREATE TRIGGER tr_on_verified_results_published AFTER INSERT OR UPDATE ON public.verified_results FOR EACH ROW EXECUTE FUNCTION public.on_verified_results_published();

-- Trigger for League Joins
CREATE OR REPLACE FUNCTION public.on_league_member_joined()
RETURNS TRIGGER AS $$
DECLARE
  v_league_name TEXT;
  v_creator_id UUID;
  v_new_member_name TEXT;
BEGIN
  -- Get league name and creator
  SELECT name, created_by INTO v_league_name, v_creator_id 
  FROM public.leagues WHERE id = NEW.league_id;

  -- Get new member username
  SELECT username INTO v_new_member_name 
  FROM public.profiles WHERE id = NEW.user_id;

  -- Notify creator if they aren't the one joining
  IF v_creator_id IS NOT NULL AND v_creator_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_creator_id, 
      'New League Member! 🏎️', 
      v_new_member_name || ' just joined ' || v_league_name || '.', 
      'league', 
      jsonb_build_object('url', '/leagues/view?id=' || NEW.league_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_league_member_joined ON public.league_members;
CREATE TRIGGER tr_on_league_member_joined 
AFTER INSERT ON public.league_members 
FOR EACH ROW EXECUTE FUNCTION public.on_league_member_joined();

-- Locking Trigger: Prevent predictions after race start
CREATE OR REPLACE FUNCTION public.ensure_prediction_not_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the start time for the race. Format: "season_round"
  SELECT start_time INTO v_start_time FROM public.races WHERE id = NEW.race_id;

  -- If the race is found and current time is > start_time + 2 minutes, block the update
  IF v_start_time IS NOT NULL AND now() > (v_start_time + INTERVAL '2 minutes') THEN
    RAISE EXCEPTION 'This race has already started. Predictions are locked.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_lock_predictions BEFORE INSERT OR UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.ensure_prediction_not_locked();

-- ==========================================================
-- POLICIES
-- ==========================================================

-- Profiles
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Races are public" ON public.races FOR SELECT USING (true);
CREATE POLICY "Admins manage races" ON public.races FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Profiles
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Leagues
CREATE POLICY "leagues_select" ON public.leagues FOR SELECT USING (
  created_by = auth.uid() OR public.check_p10_membership(id) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "leagues_insert" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "leagues_modify" ON public.leagues FOR ALL USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- League Members
CREATE POLICY "members_select" ON public.league_members FOR SELECT USING (
  user_id = auth.uid() OR public.check_p10_membership(league_id) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "members_insert" ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_delete" ON public.league_members FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND created_by = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Predictions
CREATE POLICY "Predictions are public" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Users can manage own predictions" ON public.predictions FOR ALL USING (auth.uid() = user_id);

-- Results
CREATE POLICY "Results are public" ON public.verified_results FOR SELECT USING (true);
CREATE POLICY "Admin results manage" ON public.verified_results FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Bug Reports
CREATE POLICY "Anyone can report bugs" ON public.bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage bug reports" ON public.bug_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Notifications & Tokens
CREATE POLICY "Users manage own tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Admins manage sent tracking" ON public.sent_notifications FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 10. User Achievements Table
CREATE TABLE public.user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    round TEXT, -- Optional: Round where it was unlocked
    UNIQUE(user_id, achievement_id)
);

-- RLS for user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can unlock their own achievements" ON public.user_achievements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own achievements" ON public.user_achievements FOR UPDATE USING (user_id = auth.uid());
