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
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL, -- 'quali', 'race', 'season'
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can see own notification history" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- 9. Sent Notifications Tracking (to avoid duplicates)
CREATE TABLE public.sent_notifications (
  id TEXT PRIMARY KEY, -- Format: "season_round_type" e.g., "2026_1_quali"
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RPCs and Triggers

-- RPC for automated checker to avoid duplicates
CREATE OR REPLACE FUNCTION public.check_and_mark_notification_sent(p_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sent_notifications WHERE id = p_id) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.sent_notifications (id) VALUES (p_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a notification to a specific user
CREATE OR REPLACE FUNCTION public.send_notification_to_user(p_user_id UUID, p_title TEXT, p_body TEXT, p_type TEXT, p_data JSONB DEFAULT '{}')
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (p_user_id, p_title, p_body, p_type, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Admin to broadcast
CREATE OR REPLACE FUNCTION public.send_broadcast_notification(p_title TEXT, p_body TEXT, p_type TEXT, p_url TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- A NULL user_id indicates a broadcast notification
  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (NULL, p_title, p_body, p_type, jsonb_build_object('url', p_url));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for Admin to test
CREATE OR REPLACE FUNCTION public.send_test_notification(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM public.send_notification_to_user(
    p_user_id, 
    'Test Notification', 
    'If you see this, push notifications are working!', 
    'test', 
    jsonb_build_object('url', '/')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Race Results
CREATE OR REPLACE FUNCTION public.on_verified_results_published()
RETURNS TRIGGER AS $$
DECLARE
  v_race_id TEXT;
  v_is_last_race BOOLEAN DEFAULT false;
BEGIN
  v_race_id := NEW.id;
  
  -- Simple check if it might be the end of season (e.g. Round 24)
  -- In a real app, you might check against the actual calendar
  IF v_race_id LIKE '%_24' THEN
    v_is_last_race := true;
  END IF;

  IF v_is_last_race THEN
    PERFORM public.send_broadcast_notification(
      'Season Finale Results!',
      'The final results are in! Check the leaderboard to see the season champion.',
      'season',
      '/leaderboard'
    );
  ELSE
    PERFORM public.send_broadcast_notification(
      'Race Results Published!',
      'The scores for the latest race are now available. See how you performed!',
      'race',
      '/history'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS tr_on_verified_results_published ON public.verified_results;

CREATE TRIGGER tr_on_verified_results_published
AFTER INSERT OR UPDATE ON public.verified_results
FOR EACH ROW EXECUTE FUNCTION public.on_verified_results_published();
