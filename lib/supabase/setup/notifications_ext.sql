-- 1. Updated Helper to mark reminder as sent using existing sent_notifications table
-- Format: "reminder_[race_id]_[user_id]"
CREATE OR REPLACE FUNCTION public.mark_reminder_sent(p_race_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'reminder_' || p_race_id || '_' || p_user_id::text;
  IF EXISTS (SELECT 1 FROM public.sent_notifications WHERE id = v_id) THEN 
    RETURN FALSE; 
  END IF;
  INSERT INTO public.sent_notifications (id, sent_at) VALUES (v_id, now());
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for League Joins
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
