-- 1. Enable RLS (Mandatory)
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- 2. Wipe everything to prevent conflicts and start fresh
DROP POLICY IF EXISTS "leagues_select" ON public.leagues;
DROP POLICY IF EXISTS "leagues_insert" ON public.leagues;
DROP POLICY IF EXISTS "leagues_update_delete" ON public.leagues;
DROP POLICY IF EXISTS "leagues_select_policy" ON public.leagues;
DROP POLICY IF EXISTS "leagues_insert_policy" ON public.leagues;
DROP POLICY IF EXISTS "leagues_all_policy" ON public.leagues;
DROP POLICY IF EXISTS "members_select" ON public.league_members;
DROP POLICY IF EXISTS "members_insert" ON public.league_members;
DROP POLICY IF EXISTS "members_delete" ON public.league_members;
DROP POLICY IF EXISTS "members_select_policy" ON public.league_members;
DROP POLICY IF EXISTS "members_insert_policy" ON public.league_members;
DROP POLICY IF EXISTS "members_delete_policy" ON public.league_members;
DROP POLICY IF EXISTS "admin_leagues" ON public.leagues;
DROP POLICY IF EXISTS "admin_members" ON public.league_members;
-- Old policies from previous versions
DROP POLICY IF EXISTS "Leagues are viewable by authenticated users" ON public.leagues;
DROP POLICY IF EXISTS "Leagues are viewable by members" ON public.leagues;
DROP POLICY IF EXISTS "Members can see each other" ON public.league_members;

-- 3. Wipe and Re-create functions with strict search paths
DROP FUNCTION IF EXISTS public.is_league_member(UUID);
DROP FUNCTION IF EXISTS public.join_league_by_code(TEXT);

-- This function is the "Magic Key" that allows checking membership without recursion
CREATE OR REPLACE FUNCTION public.is_p10_league_member(l_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  -- This runs as 'postgres' owner, bypassing all RLS checks
  RETURN EXISTS (
    SELECT 1 FROM public.league_members 
    WHERE league_id = l_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- RPC for joining leagues that bypasses restricted SELECT on leagues table
CREATE OR REPLACE FUNCTION public.join_league_by_code(code TEXT) 
RETURNS JSONB AS $$
DECLARE
  l_id UUID;
  l_name TEXT;
BEGIN
  -- Search bypassing RLS
  SELECT id, name INTO l_id, l_name FROM public.leagues WHERE LOWER(invite_code) = LOWER(code);
  IF l_id IS NULL THEN RAISE EXCEPTION 'League not found'; END IF;

  -- Check membership bypassing RLS
  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = l_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already a member of this league.';
  END IF;
  
  INSERT INTO public.league_members (league_id, user_id) VALUES (l_id, auth.uid());
  RETURN jsonb_build_object('id', l_id, 'name', l_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. NEW LEAGUES POLICIES (Simple & Reliable)
-- View if creator OR if you have a membership record (uses a direct check)
CREATE POLICY "leagues_select_policy" ON public.leagues FOR SELECT
  USING (
    created_by = auth.uid() OR 
    id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "leagues_insert_policy" ON public.leagues FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "leagues_all_policy" ON public.leagues FOR ALL
  USING (created_by = auth.uid());

-- 5. NEW LEAGUE MEMBERS POLICIES (Simple & Reliable)
-- View your own record, OR others if you are a member (uses the function to break recursion)
CREATE POLICY "members_select_policy" ON public.league_members FOR SELECT
  USING (
    user_id = auth.uid() OR 
    public.is_p10_league_member(league_id)
  );

CREATE POLICY "members_insert_policy" ON public.league_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "members_delete_policy" ON public.league_members FOR DELETE
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND created_by = auth.uid())
  );

-- 6. ADMIN OVERRIDE
CREATE POLICY "admin_leagues" ON public.leagues FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_members" ON public.league_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
