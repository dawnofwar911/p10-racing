-- Admin prediction override
-- Lets an admin add or correct a player's prediction after the race lock
-- (e.g. a prediction that failed to sync before lights out).
--
-- 1. The lock trigger skips its check only when the transaction-local
--    setting p10.admin_override = 'on'. Only admin_upsert_prediction sets it.
-- 2. admin_upsert_prediction checks the caller is an admin, then upserts.

CREATE OR REPLACE FUNCTION public.ensure_prediction_not_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  IF current_setting('p10.admin_override', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT start_time INTO v_start_time FROM public.races WHERE id = NEW.race_id;
  IF v_start_time IS NOT NULL AND now() > (v_start_time + INTERVAL '2 minutes') THEN
    RAISE EXCEPTION 'This race has already started. Predictions are locked.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_prediction(
  p_user_id UUID,
  p_race_id TEXT,
  p_p10_driver_id TEXT,
  p_dnf_driver_id TEXT
)
RETURNS public.predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.predictions;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF p_race_id !~ '^[0-9]{4}_[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid race id: %', p_race_id;
  END IF;

  IF coalesce(p_p10_driver_id, '') = '' OR coalesce(p_dnf_driver_id, '') = '' THEN
    RAISE EXCEPTION 'Both P10 and DNF picks are required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown player';
  END IF;

  PERFORM set_config('p10.admin_override', 'on', true);

  INSERT INTO public.predictions (user_id, race_id, p10_driver_id, dnf_driver_id)
  VALUES (p_user_id, p_race_id, p_p10_driver_id, p_dnf_driver_id)
  ON CONFLICT (user_id, race_id) DO UPDATE
    SET p10_driver_id = EXCLUDED.p10_driver_id,
        dnf_driver_id = EXCLUDED.dnf_driver_id,
        updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_row;

  PERFORM set_config('p10.admin_override', 'off', true);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_prediction(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_prediction(UUID, TEXT, TEXT, TEXT) TO authenticated;
