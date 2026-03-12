-- 1. CLEAN SLATE: Wipe every possible policy we've created to prevent overlap
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('leagues', 'league_members')) 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename); 
    END LOOP; 
END $$;

-- 2. ENABLE RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- 3. RESET FUNCTIONS
DROP FUNCTION IF EXISTS public.check_p10_membership(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_p10_league_member(UUID);
DROP FUNCTION IF EXISTS public.join_league_by_code(TEXT);

-- Bulletproof Membership Check (Runs as System)
CREATE OR REPLACE FUNCTION public.p10_is_member(l_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.league_members 
    WHERE league_id = l_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- RPC for joining leagues
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

-- 4. LEAGUES POLICIES (Non-Recursive)
CREATE POLICY "leagues_owner_select" ON public.leagues FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "leagues_member_select" ON public.leagues FOR SELECT USING (
  id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
);
CREATE POLICY "leagues_admin_all" ON public.leagues FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "leagues_owner_manage" ON public.leagues FOR ALL USING (created_by = auth.uid());

-- 5. LEAGUE MEMBERS POLICIES (Non-Recursive)
CREATE POLICY "members_self_select" ON public.league_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "members_others_select" ON public.league_members FOR SELECT USING (public.p10_is_member(league_id));
CREATE POLICY "members_admin_all" ON public.league_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "members_insert" ON public.league_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_delete" ON public.league_members FOR DELETE USING (user_id = auth.uid());
